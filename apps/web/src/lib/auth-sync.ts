import pb from '@/lib/pocketbase-client';

/**
 * Asks the server to grant the admin role if the signed-in user's email is in
 * ADMIN_EMAILS, then refreshes the local token so the new role is reflected.
 * Safe to call after any sign-in; a no-op for regular clients.
 */
export async function syncRole(): Promise<string> {
  try {
    const response = await fetch('/api/auth/sync-role', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pb.authStore.token}` },
    });

    if (!response.ok) {
      return 'client';
    }

    const data = (await response.json()) as { role?: string; changed?: boolean };

    if (data.changed) {
      await pb.collection('users').authRefresh();
    }

    return data.role || 'client';
  } catch {
    return 'client';
  }
}
