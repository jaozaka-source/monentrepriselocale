import type { Route } from './+types/client';
import { seo } from '@/lib/seo';
import { ClientDetail } from '@/components/admin/client-detail';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Fiche client — Administration',
    description: 'Détail d’un client et gestion de son parcours.',
    noindex: true,
  });
}

export default function AdminClient() {
  return <ClientDetail />;
}
