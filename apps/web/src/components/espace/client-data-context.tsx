import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import pb from '@/lib/pocketbase-client';
import { syncRole } from '@/lib/auth-sync';
import { getOrCreateProfile, fetchPacks, type ClientProfile, type Pack } from '@/lib/client-steps';

type ClientData = {
  profile: ClientProfile | null;
  packs: Pack[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const ClientDataContext = createContext<ClientData>({
  profile: null,
  packs: [],
  loading: true,
  refresh: async () => {},
});

export function ClientDataProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [p, pk] = await Promise.all([
        getOrCreateProfile(),
        fetchPacks().catch(() => [] as Pack[]),
      ]);
      setProfile(p);
      setPacks(pk);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // On mount, sync the admin role from ADMIN_EMAILS (server-side) and refresh
    // the auth token. This picks up two things that change after login:
    //  - the `role` field, when the user's email was just added to ADMIN_EMAILS
    //    (syncRole grants admin server-side and refreshes the token if changed);
    //  - the `verified` flag, set when the user clicks the email confirmation
    //    link — the JWT in localStorage still carries `verified: false` until
    //    the token is refreshed.
    // A failure here (expired/invalid token) is handled by getOrCreateProfile's
    // session validation, which clears the store and redirects to /login.
    (async () => {
      try {
        await syncRole();
      } catch {
        // ignore — getOrCreateProfile will handle an invalid session
      }
      try {
        await pb.collection('users').authRefresh();
      } catch {
        // ignore
      }
    })();
    refresh();
  }, [refresh]);

  return (
    <ClientDataContext.Provider value={{ profile, packs, loading, refresh }}>
      {children}
    </ClientDataContext.Provider>
  );
}

export function useClientData() {
  return useContext(ClientDataContext);
}
