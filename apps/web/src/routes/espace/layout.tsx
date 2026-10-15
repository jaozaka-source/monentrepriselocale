import type { Route } from './+types/layout';
import { requireAuth } from '@/lib/require-auth';
import { ClientDataProvider } from '@/components/espace/client-data-context';
import { ClientLayout } from '@/components/espace/client-layout';

export function clientLoader() {
  return { user: requireAuth() };
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return <div className="espace-body" />;
}

export default function EspaceLayout() {
  return (
    <ClientDataProvider>
      <ClientLayout />
    </ClientDataProvider>
  );
}
