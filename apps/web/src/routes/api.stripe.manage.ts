import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import {
  callerFrom,
  loadOwnedProfile,
  loadPack,
  upgradeSubscription,
  upgradeFormula,
  scheduleDowngrade,
  cancelAtPeriodEnd,
  billingRank,
} from '@/lib/stripe.server';

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * POST /api/stripe/manage — subscription management actions.
 *
 * Body:
 *   { action: 'cancel' }                                   → cancel at period end
 *   { packId, billing }                                   → change pack/formula
 *
 * The operation is determined server-side from the pack sort and billing rank:
 * - higher pack (same formula)        → immediate, prorated, engagement unchanged
 * - same pack, longer formula         → immediate, prorated, new engagement date
 * - lower pack or shorter formula     → scheduled at end of engagement (Schedule)
 *
 * Returns: { ok: true, status, kind }
 */
export const action = withApi(async ({ request }) => {
  const user = await callerFrom(request);
  const profile = await loadOwnedProfile(user.id);
  const body = await readJsonBody<{
    action?: string;
    packId?: string;
    billing?: string;
  }>(request);

  // --- Cancellation -------------------------------------------------------
  if (body.action === 'cancel') {
    if (!profile.stripe_subscription_id || profile.subscription_status === 'canceled') {
      return apiError(422, 'Aucun abonnement actif.');
    }

    const now = new Date();
    const engEnd = profile.engagement_end_date ? new Date(profile.engagement_end_date) : null;
    const billing = String(profile.subscription_billing || profile.pack_billing || 'monthly');

    if (engEnd) {
      // Monthly: cancellable once the 12-month engagement is over.
      // Annual / 24 months: cancellable within 15 days before the due date.
      const threshold = billing === 'monthly' ? engEnd.getTime() : engEnd.getTime() - FIFTEEN_DAYS_MS;
      if (now.getTime() < threshold) {
        return apiError(
          422,
          billing === 'monthly'
            ? 'La résiliation sera possible à la fin de votre engagement de 12 mois.'
            : 'La résiliation sera possible à partir de 15 jours avant votre échéance.',
        );
      }
    }

    const sub = await cancelAtPeriodEnd(profile);
    return json({ ok: true, status: sub.status, cancelAtPeriodEnd: true });
  }

  // --- Pack / formula change ---------------------------------------------
  if (!body.packId || !body.billing) {
    return apiError(422, 'Pack et formule requis.');
  }

  if (!profile.stripe_subscription_id || profile.subscription_status === 'canceled') {
    return apiError(422, 'Aucun abonnement actif.');
  }

  const newPack = await loadPack(body.packId);
  const newBilling = body.billing;
  const currentPackId = String(profile.pack || '');
  const currentBilling = String(profile.subscription_billing || profile.pack_billing || 'monthly');

  if (newPack.id === currentPackId && newBilling === currentBilling) {
    return apiError(422, 'Aucun changement demandé.');
  }

  let currentSort = 0;
  if (currentPackId) {
    try {
      currentSort = (await loadPack(currentPackId)).sort;
    } catch {
      currentSort = 0;
    }
  }

  const packUpgrade = newPack.sort > currentSort;
  const formulaUpgrade = newPack.id === currentPackId && billingRank(newBilling) > billingRank(currentBilling);

  if (packUpgrade) {
    const sub = await upgradeSubscription(profile, newPack, newBilling);
    return json({ ok: true, status: sub.status, kind: 'pack_upgrade' });
  }

  if (formulaUpgrade) {
    const sub = await upgradeFormula(profile, newPack, newBilling);
    return json({ ok: true, status: sub.status, kind: 'formula_upgrade' });
  }

  // Downgrade: schedule at end of engagement.
  const sub = await scheduleDowngrade(profile, newPack, newBilling);
  return json({ ok: true, status: sub.status, kind: 'scheduled' });
});
