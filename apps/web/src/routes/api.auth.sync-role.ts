import { apiError, json, withApi } from '@/lib/api.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';

/**
 * Decodes the JWT payload (without verifying the signature) to extract the
 * user id. We don't need cryptographic verification here because we then read
 * the actual record via the superuser client — a forged id would at worst let
 * the caller learn their own role. The important thing is NOT to call
 * PocketBase's `auth-refresh` endpoint: that rotates the record's tokenKey
 * and invalidates the client's original token, breaking every subsequent
 * authenticated request (e.g. creating the client profile).
 */
function decodeJwtPayload(token: string): { id?: string; exp?: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/sync-role — after sign-in or sign-up, the client asks the
 * server to grant the admin role if the user's email is listed in ADMIN_EMAILS
 * (apps/web/.env). The role is otherwise "client" and a client can never
 * escalate it themselves (the updateRule locks the field).
 *
 * Returns the effective role so the client can refresh its token when it changes.
 */
export const action = withApi(async ({ request }) => {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!token) {
    return apiError(401, 'Non authentifié');
  }

  // Decode the JWT locally to get the user id WITHOUT calling `auth-refresh`,
  // which would rotate the tokenKey and invalidate the client's token.
  const payload = decodeJwtPayload(token);
  if (!payload?.id) {
    return apiError(401, 'Session invalide');
  }

  // Reject expired tokens (JWT `exp` is in seconds).
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return apiError(401, 'Session expirée');
  }

  // Read the authoritative record via superuser to get the real email + role.
  let record: { id?: string; email?: string; role?: string };
  try {
    record = await pocketbaseAdmin.getRecord<{ id: string; email: string; role?: string }>(
      'users',
      payload.id,
    );
  } catch {
    return apiError(401, 'Session invalide');
  }

  if (!record?.id || !record.email) {
    return apiError(401, 'Session invalide');
  }

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const shouldBeAdmin = adminEmails.includes(record.email.toLowerCase());
  const currentRole = record.role || 'client';

  if (shouldBeAdmin && currentRole !== 'admin') {
    await pocketbaseAdmin.updateRecord('users', record.id, { role: 'admin', verified: true });
  }

  return json({
    role: shouldBeAdmin ? 'admin' : currentRole,
    changed: shouldBeAdmin && currentRole !== 'admin',
  });
});
