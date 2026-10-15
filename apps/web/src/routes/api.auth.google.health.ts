import { json, withApi } from '@/lib/api.server';
import { siteOrigin } from '@/lib/site-origin.server';

/**
 * GET /api/auth/google/health — reports whether the Google OAuth credentials are
 * present in the server environment and which redirect URI the flow uses.
 * Only booleans and the URI are returned — never the credential values.
 */
export const loader = withApi(async ({ request }) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = siteOrigin(request);

  return json({
    clientId: Boolean(clientId),
    clientSecret: Boolean(clientSecret),
    redirectUri: `${origin}/api/auth/google/callback`,
  });
});
