import type { Route } from './+types/stripe-events';
import { seo } from '@/lib/seo';
import { StripeEventsList } from '@/components/admin/stripe-events-list';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Événements Stripe — Administration',
    description: 'Journal des webhooks Stripe reçus par la plateforme.',
    noindex: true,
  });
}

export default function AdminStripeEvents() {
  return <StripeEventsList />;
}
