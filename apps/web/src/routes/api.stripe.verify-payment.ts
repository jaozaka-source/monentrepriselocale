import { apiError, json, withApi } from '@/lib/api.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import {
  callerFrom,
  loadOwnedProfile,
  syncSubscriptionToProfile,
  getStripe,
} from '@/lib/stripe.server';

/**
 * POST /api/stripe/verify-payment — called by the client when it returns from
 * Stripe Checkout with ?status=success. The webhook is the primary mechanism,
 * but it can be delayed or missing (the endpoint isn't registered in Stripe
 * yet, or the webhook is still in flight). This endpoint verifies the
 * subscription directly with Stripe and advances the client from step 2.1 to
 * 3.1 if the subscription is active, so the client is never stuck on the
 * payment page after a successful checkout.
 *
 * Body: {}
 * Returns: { status, advanced, current_step }
 */
export const action = withApi(async ({ request }) => {
  let user;
  try {
    user = await callerFrom(request);
  } catch {
    return apiError(401, 'Votre session a expiré. Reconnectez-vous puis réessayez.');
  }

  let profile;
  try {
    profile = await loadOwnedProfile(user.id);
  } catch {
    return apiError(422, 'Profil client introuvable.');
  }

  // No subscription yet — nothing to verify.
  if (!profile.stripe_subscription_id) {
    return json({ status: profile.subscription_status || 'none', advanced: false });
  }

  // Verify the subscription directly with Stripe.
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

  // Sync the subscription details (status, period end, etc.) — same logic as
  // the webhook, so the profile is up to date even if the webhook hasn't fired.
  await syncSubscriptionToProfile(profile, sub);

  // Re-read the profile after the sync.
  const refreshed = await loadOwnedProfile(user.id);

  let advanced = false;
  const isActive = sub.status === 'active' || sub.status === 'trialing';

  // Sync the payment status field alongside the subscription status.
  if (isActive) {
    const nowIso = new Date().toISOString();
    const profileUpdates: Record<string, unknown> = { statut_paiement: 'realise' };
    if (!refreshed.last_payment_date) profileUpdates.last_payment_date = nowIso;
    await pocketbaseAdmin.updateRecord('client_profiles', refreshed.id, profileUpdates);
  }

  // Advance to step 3.1 if the subscription is active and the client is still
  // on the payment step (idempotent — safe to call multiple times).
  if (isActive && refreshed.current_step === '2.1') {
    await pocketbaseAdmin.updateRecord('client_profiles', refreshed.id, { current_step: '3.1' });
    await pocketbaseAdmin.createRecord('step_history', {
      owner: user.id,
      step: '3.1',
      action: 'advance',
      author: 'system',
      comment: 'Paiement confirmé — abonnement actif',
    });
    advanced = true;
  }

  return json({
    status: isActive ? 'active' : refreshed.subscription_status || 'none',
    advanced,
    current_step: advanced ? '3.1' : refreshed.current_step,
  });
});
