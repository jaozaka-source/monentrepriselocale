import { apiError, json, withApi } from '@/lib/api.server';
import { callerFrom, loadOwnedProfile, ensureStripeCustomer, createPortalSession } from '@/lib/stripe.server';

/**
 * POST /api/stripe/portal — opens a Stripe billing portal session for
 * updating the payment method only (no cancellation, no plan change).
 *
 * Body: { returnUrl? }
 * Returns: { url }
 */
export const action = withApi(async ({ request }) => {
  const user = await callerFrom(request);
  const profile = await loadOwnedProfile(user.id);

  // Ensure a Stripe customer exists (creates one idempotently if missing),
  // using the same logic and idempotency key as the checkout flow.
  const customer = await ensureStripeCustomer(profile);

  const returnUrl = new URL(request.url).origin + '/espace/abonnement';
  const session = await createPortalSession(customer.id, returnUrl);

  return json({ url: session.url });
});
