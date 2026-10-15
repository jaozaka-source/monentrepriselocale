import { apiError, json, withApi } from '@/lib/api.server';
import logger from '@/lib/logger.server';
import {
  callerFrom,
  loadOwnedProfile,
  loadPack,
  createCheckoutSession,
} from '@/lib/stripe.server';

/**
 * Extracts a human-readable message from a Stripe SDK error without leaking
 * the secret key. Stripe errors carry `.type`, `.code`, `.param` and `.message`
 * (and a raw `response` body) — all of which describe the failure, never the
 * key itself. We surface those so the client can see the real cause.
 */
function describeStripeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as {
      type?: string;
      code?: string;
      param?: string;
      message?: string;
      response?: { body?: { error?: { message?: string } } };
    };
    const parts: string[] = [];
    if (e.type) parts.push(`type=${e.type}`);
    if (e.code) parts.push(`code=${e.code}`);
    if (e.param) parts.push(`param=${e.param}`);
    const raw = e.response?.body?.error?.message || e.message || '';
    if (raw) parts.push(raw);
    return parts.join(' — ');
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * POST /api/stripe/checkout — creates a Stripe Checkout session for step 2.1.
 *
 * Body: { } (uses the client's selected pack and billing from their profile).
 * Returns: { url } — redirect the browser to this URL.
 *
 * No creation fees, no advance monthly payments, no trial. Stripe Tax
 * computes VAT from the HT price. Payment methods: card + SEPA debit.
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
    return apiError(422, 'Profil client introuvable. Complétez d’abord les étapes précédentes.');
  }

  if (!profile.pack) {
    return apiError(422, 'Aucun pack choisi. Sélectionnez un pack à l’étape 1.3.');
  }

  let pack;
  try {
    pack = await loadPack(String(profile.pack));
  } catch {
    return apiError(422, 'Le pack sélectionné est introuvable. Contactez le support.');
  }

  const billing = String(profile.pack_billing || 'monthly');

  // Refuse to create a new Checkout session if a payment is already realised
  // or in progress — prevents double payment on double-click or browser back.
  const statutPaiement = String(profile.statut_paiement || 'non_commence');
  if (statutPaiement === 'realise') {
    return apiError(422, 'Vous avez déjà réglé votre paiement.');
  }
  if (statutPaiement === 'en_cours') {
    return apiError(422, 'Un paiement est en cours de traitement. Veuillez patienter quelques instants.');
  }

  // Already has an active subscription?
  if (profile.stripe_subscription_id && profile.subscription_status === 'active') {
    return apiError(422, 'Vous avez déjà un abonnement actif.');
  }

  const origin = new URL(request.url).origin;
  let session;
  try {
    session = await createCheckoutSession(profile, pack, billing, origin);
  } catch (err) {
    logger.error(
      `Stripe Checkout creation failed: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err.stack : undefined,
    );
    return apiError(422, `Stripe : ${describeStripeError(err)}`);
  }

  return json({ url: session.url, sessionId: session.id });
});
