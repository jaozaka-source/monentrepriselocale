import { useParams } from 'react-router';
import type { Route } from './+types/ticket-detail';
import { seo } from '@/lib/seo';
import { TicketThread } from '@/components/espace/ticket-thread';
import { useAuth } from '@/hooks/use-auth';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Ticket — Espace client Mon Entreprise Locale',
    description: 'Détail de votre ticket.',
    noindex: true,
  });
}

export default function TicketDetail() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  return <TicketThread ticketId={id} isAdmin={user?.role === 'admin'} />;
}
