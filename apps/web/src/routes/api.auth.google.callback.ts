import { randomBytes } from 'node:crypto';
import { withApi } from '@/lib/api.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import { siteOrigin } from '@/lib/site-origin.server';
import logger from '@/lib/logger.server';

/**
 * GET /api/auth/google/callback — Google redirects here with `?code=&state=`.
 *
 * Verifies the CSRF state cookie, exchanges the code for Google tokens (using
 * the server-side client secret), fetches the profile, finds or creates the
 * PocketBase user, mints a PocketBase session token, stores it behind a
 * single-use opaque code in `oauth_exchanges`, and redirects to
 * `/login?google_finish=<code>`. The browser then redeems the code via
 * POST /api/auth/google (never cached) and lands on /espace.
 *
 * On any failure it redirects to `/login?google_error=1` so the user sees a
 * clear message instead of a raw error.
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const EXCHANGE_TTL_MS = 2 * 60 * 1000;
const POCKETBASE_URL = () => process.env.POCKETBASE_URL || 'http://localhost:8090';

const randomToken = () => randomBytes(32).toString('hex');
const randomPassword = () => `${randomBytes(24).toString('base64url')}Aa1!`;

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

const redirectTo = (location: string, extraHeaders: Record<string, string> = {}) =>
  new Response(null, { status: 302, headers: { Location: location, ...extraHeaders } });

export const loader = withApi(async ({ request }) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set in apps/web/.env');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam || !code || !state) {
    return redirectTo('/login?google_error=1');
  }

  // CSRF: the state must match the HttpOnly cookie set on /api/auth/google.
  const cookies = parseCookies(request.headers.get('cookie'));
  if (cookies.google_oauth_state !== state) {
    return redirectTo('/login?google_error=1');
  }

  const origin = siteOrigin(request);
  const redirectUri = `${origin}/api/auth/google/callback`;

  // 1. Exchange the authorization code for Google tokens.
  let accessToken: string;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      logger.error('Google token exchange failed', `${tokenRes.status} ${detail}`);
      return redirectTo('/login?google_error=1');
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    accessToken = tokenJson.access_token || '';
    if (!accessToken) {
      return redirectTo('/login?google_error=1');
    }
  } catch (error) {
    logger.error('Google token exchange threw', error instanceof Error ? error.message : error);
    return redirectTo('/login?google_error=1');
  }

  // 2. Fetch the Google profile (email, name).
  let email = '';
  let name = '';
  let emailVerified = false;
  try {
    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) {
      logger.error('Google userinfo failed', `${infoRes.status}`);
      return redirectTo('/login?google_error=1');
    }
    const profile = (await infoRes.json()) as {
      email?: string;
      name?: string;
      email_verified?: boolean;
    };
    email = (profile.email || '').toLowerCase().trim();
    name = profile.name || '';
    emailVerified = profile.email_verified !== false;
  } catch (error) {
    logger.error('Google userinfo threw', error instanceof Error ? error.message : error);
    return redirectTo('/login?google_error=1');
  }

  if (!email || !emailVerified) {
    return redirectTo('/login?google_error=1');
  }

  // 3. Find or create the PocketBase user.
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const role = adminEmails.includes(email) ? 'admin' : 'client';
  const password = randomPassword();

  let userId: string;
  try {
    const existing = await pocketbaseAdmin.listRecords<{ id: string }>('users', {
      filter: `email = "${email}"`,
      perPage: 1,
    });

    if (existing.items[0]) {
      userId = existing.items[0].id;
      // Set a fresh random password so we can mint a session token server-side.
      // Google users authenticate via Google; password login is unaffected for
      // users who never use Google.
      await pocketbaseAdmin.updateRecord('users', userId, {
        password,
        passwordConfirm: password,
        verified: true,
        name: name || undefined,
        role,
      });
    } else {
      const created = await pocketbaseAdmin.createRecord<{ id: string }>('users', {
        email,
        password,
        passwordConfirm: password,
        name,
        verified: true,
        role,
      });
      userId = created.id;
    }
  } catch (error) {
    logger.error('PocketBase user find/create failed', error instanceof Error ? error.message : error);
    return redirectTo('/login?google_error=1');
  }

  // 4. Mint a PocketBase session token for this user (server-side).
  let pbToken = '';
  let pbRecord: Record<string, unknown> = {};
  try {
    const authRes = await fetch(`${POCKETBASE_URL()}/api/collections/users/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
    });
    if (!authRes.ok) {
      const detail = await authRes.text();
      logger.error('PocketBase auth-with-password failed', `${authRes.status} ${detail}`);
      return redirectTo('/login?google_error=1');
    }
    const authJson = (await authRes.json()) as { token?: string; record?: Record<string, unknown> };
    pbToken = authJson.token || '';
    pbRecord = authJson.record || {};
    if (!pbToken) {
      return redirectTo('/login?google_error=1');
    }
  } catch (error) {
    logger.error('PocketBase auth-with-password threw', error instanceof Error ? error.message : error);
    return redirectTo('/login?google_error=1');
  }

  // 5. Store the session behind a single-use opaque code (redeemed via POST).
  const exchangeToken = randomToken();
  const expires = new Date(Date.now() + EXCHANGE_TTL_MS).toISOString();
  try {
    await pocketbaseAdmin.createRecord('oauth_exchanges', {
      token: exchangeToken,
      pb_token: pbToken,
      pb_record: pbRecord,
      expires,
      used: false,
    });
  } catch (error) {
    logger.error('Failed to store OAuth exchange token', error instanceof Error ? error.message : error);
    return redirectTo('/login?google_error=1');
  }

  // Clear the CSRF state cookie and hand off to the browser.
  const clearCookie = 'google_oauth_state=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/';
  return redirectTo(`/login?google_finish=${exchangeToken}`, { 'Set-Cookie': clearCookie });
});
