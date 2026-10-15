import { randomBytes } from 'node:crypto';
import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import { siteOrigin } from '@/lib/site-origin.server';
import logger from '@/lib/logger.server';

/**
 * Server-side Google OAuth for the client portal.
 *
 * - GET  /api/auth/google        → redirects the browser to Google's consent screen.
 * - POST /api/auth/google        → redeems the one-time code issued by the callback
 *                                  for the PocketBase session token + user record.
 *
 * The PocketBase session token is NEVER returned by a GET (the platform edge-caches
 * GET responses by URL for everyone). The callback stores it behind a single-use
 * opaque token in `oauth_exchanges`, and the browser redeems it via this POST.
 *
 * Credentials come from GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in apps/web/.env
 * (Node server side only — never shipped to the browser, never stored in PocketBase).
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = ['openid', 'email', 'profile'].join(' ');
const EXCHANGE_TTL_MS = 2 * 60 * 1000;

const randomToken = () => randomBytes(32).toString('hex');

function redirectUri(origin: string) {
  // No trailing slash: the origin already has none, and this must match the URI
  // authorized in Google Cloud Console exactly.
  return `${origin}/api/auth/google/callback`;
}

/**
 * GET /api/auth/google — redirect to Google. `?t=<ts>` is appended by the client
 * so each click is a unique URL and the edge cache never serves a stale state.
 */
export const loader = withApi(async ({ request }) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set in apps/web/.env');
  }

  const origin = siteOrigin(request);
  const uri = redirectUri(origin);
  const state = randomToken();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: uri,
    response_type: 'code',
    scope: SCOPES,
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  const secure = origin.startsWith('https') ? '; Secure' : '';
  const cookie = `google_oauth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/${secure}`;

  return new Response(null, {
    status: 302,
    headers: { Location: `${GOOGLE_AUTH_URL}?${params.toString()}`, 'Set-Cookie': cookie },
  });
});

/**
 * POST /api/auth/google — body `{ token }`. Redeems the one-time code from the
 * callback for `{ token, record }` (the PocketBase session). POST is never cached.
 */
export const action = withApi(async ({ request }) => {
  const { token } = await readJsonBody<{ token?: string }>(request);

  if (!token) {
    return apiError(422, 'Jeton manquant');
  }

  let row: {
    id: string;
    token: string;
    pb_token: string;
    pb_record: unknown;
    expires: string;
    used: boolean;
  } | undefined;

  try {
    const result = await pocketbaseAdmin.listRecords<{
      id: string;
      token: string;
      pb_token: string;
      pb_record: unknown;
      expires: string;
      used: boolean;
    }>('oauth_exchanges', {
      filter: `token = "${token}"`,
      perPage: 1,
    });
    row = result.items[0];
  } catch {
    return apiError(404, 'Jeton invalide');
  }

  if (!row) {
    return apiError(404, 'Jeton invalide');
  }
  if (row.used) {
    return apiError(410, 'Jeton déjà utilisé');
  }
  if (new Date(row.expires).getTime() < Date.now()) {
    return apiError(410, 'Jeton expiré');
  }

  // Single-use: mark consumed before returning so a replay cannot redeem it.
  try {
    await pocketbaseAdmin.updateRecord('oauth_exchanges', row.id, { used: true });
  } catch (error) {
    logger.error('Failed to consume OAuth exchange token', error instanceof Error ? error.message : error);
  }

  return json({ token: row.pb_token, record: row.pb_record });
});
