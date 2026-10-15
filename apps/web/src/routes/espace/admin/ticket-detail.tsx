import { useParams } from 'react-router';
import type { Route } from './+types/ticket-detail';
import { seo } from '@/lib/seo';
import { TicketThread } from '@/components/espace/ticket-thread';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Ticket — Administration',
    description: 'Détail d’un ticket client.',
    noindex: true,
  });
}

export default function AdminTicketDetail() {
  const { id = '' } = useParams();
  return <TicketThread ticketId={id} isAdmin />;
}
