import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import { callerFrom, resyncProfileFromStripe, type StripeProfile } from '@/lib/stripe.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';

/**
 * POST /api/stripe/resync — admin-only. Re-reads the subscription and latest
 * invoice from Stripe and reconciles the client profile's payment status,
 * subscription status and step. Used when a webhook was missed or arrived out
 * of order.
 *
 * Body: { profileId }
 * Returns: { ok, subscriptionStatus, paymentStatus, lastPaymentDate, lastPaymentAmount, invoiceNumber, advanced }
 */
export const action = withApi(async ({ request }) => {
  const user = await callerFrom(request);
  if (user.role !== 'admin') {
    return apiError(403, 'Réservé à l’administrateur.');
  }

  const body = await readJsonBody<{ profileId?: string }>(request);
  if (!body.profileId) {
    return apiError(422, 'profileId est requis.');
  }

  const profile = await pocketbaseAdmin.getRecord<StripeProfile>('client_profiles', body.profileId);
  if (!profile.stripe_subscription_id) {
    return apiError(422, 'Aucun abonnement Stripe associé à ce client.');
  }

  const result = await resyncProfileFromStripe(profile);

  return json({ ok: true, ...result });
});
