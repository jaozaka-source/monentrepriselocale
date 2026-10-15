/**
 * Stripe server-side helper.
 *
 * The secret key is read from process.env.STRIPE_SECRET_KEY per request and
 * never shipped to the browser. All Stripe operations (customer creation,
 * checkout sessions, subscription management, invoice listing, webhooks) go
 * through here.
 *
 * Prices are resolved by Stripe `lookup_key` (e.g. essentiel_mensuel,
 * boutique_24mois) from the pack's `stripe_lookup_prefix`. Prices are HT;
 * VAT is computed by Stripe Tax (automatic_tax) at checkout.
 */
import Stripe from 'stripe';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import logger from '@/lib/logger.server';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set in apps/web/.env');
  }
  if (!cached) {
    cached = new Stripe(key, {
      typescript: true,
    });
  }
  return cached;
}

export type StripeProfile = Record<string, unknown> & {
  id: string;
  owner: string;
  current_step: string;
  company_name?: string;
  trade_name?: string;
  rep_email?: string;
  rep_firstname?: string;
  rep_lastname?: string;
  rep_civility?: string;
  rep_mobile?: string;
  phone?: string;
  hq_address?: string;
  vat_number?: string;
  vat_subject?: boolean;
  pack?: string;
  pack_billing?: string;
  stripe_customer_id?: string;
  stripe_livemode?: boolean;
  stripe_subscription_id?: string;
  subscription_status?: string;
  subscription_billing?: string;
  engagement_end_date?: string;
  next_invoice_date?: string;
  subscription_current_period_end?: string;
  subscription_canceled_at?: string;
  payment_alert?: boolean;
};

const pocketbaseUrl = () => process.env.POCKETBASE_URL || 'http://localhost:8090';

export async function callerFrom(request: Request): Promise<{ id: string; email: string; role: string }> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) throw new Error('Non authentifié');
  const refresh = await fetch(`${pocketbaseUrl()}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: token },
  });
  if (!refresh.ok) throw new Error('Session invalide');
  const record = (await refresh.json()).record;
  return { id: record.id, email: record.email, role: record.role || 'client' };
}

export async function loadOwnedProfile(userId: string): Promise<StripeProfile> {
  const result = await pocketbaseAdmin.listRecords<StripeProfile>('client_profiles', {
    filter: `owner = "${userId}"`,
    perPage: 1,
  });
  const profile = result.items[0];
  if (!profile) throw new Error('Profil client introuvable.');
  return profile;
}

export async function loadPack(packId: string): Promise<{
  id: string;
  name: string;
  slug: string;
  sort: number;
  monthly_price: number;
  annual_price: number;
  biennial_price: number;
  stripe_product_id: string;
  stripe_lookup_prefix: string;
  stripe_monthly_variant_id: string;
  stripe_annual_variant_id: string;
  stripe_biennial_variant_id: string;
}> {
  const pack = (await pocketbaseAdmin.getRecord('packs', packId)) as Record<string, unknown>;
  return {
    id: String(pack.id || ''),
    name: String(pack.name || ''),
    slug: String(pack.slug || ''),
    sort: Number(pack.sort || 0),
    monthly_price: Number(pack.monthly_price || 0),
    annual_price: Number(pack.annual_price || 0),
    biennial_price: Number(pack.biennial_price || 0),
    stripe_product_id: String(pack.stripe_product_id || ''),
    stripe_lookup_prefix: String(pack.stripe_lookup_prefix || ''),
    stripe_monthly_variant_id: String(pack.stripe_monthly_variant_id || ''),
    stripe_annual_variant_id: String(pack.stripe_annual_variant_id || ''),
    stripe_biennial_variant_id: String(pack.stripe_biennial_variant_id || ''),
  };
}

/**
 * Resolves the Stripe price id for a pack + billing period, read exclusively
 * from the pack record in database (stripe_*_variant_id). No price id or
 * amount is hardcoded, and the Stripe lookup_key API is not called at
 * checkout time — the active price id is the one stored on the pack.
 */
export async function resolvePriceId(
  pack: Awaited<ReturnType<typeof loadPack>>,
  billing: string,
): Promise<string> {
  const id = priceIdForBilling(pack, billing);
  if (!id) {
    throw new Error(`Aucun prix Stripe configuré pour la formule ${billing} du pack ${pack.name}.`);
  }
  return id;
}

/** Returns the stored variant id for a billing period (fallback only). */
export function priceIdForBilling(
  pack: { stripe_monthly_variant_id: string; stripe_annual_variant_id: string; stripe_biennial_variant_id: string },
  billing: string,
): string {
  if (billing === 'annual') return pack.stripe_annual_variant_id;
  if (billing === 'biennial') return pack.stripe_biennial_variant_id;
  return pack.stripe_monthly_variant_id;
}

/** Engagement duration in months for a billing period. */
export function engagementMonths(billing: string): number {
  if (billing === 'biennial') return 24;
  return 12; // monthly and annual both = 12-month engagement
}

/** Billing rank for comparing formulas (monthly < annual < 24 months). */
export function billingRank(billing: string): number {
  if (billing === 'annual') return 2;
  if (billing === 'biennial') return 3;
  return 1;
}

/** True when the active STRIPE_SECRET_KEY is a live key (sk_live_*). */
export function stripeLiveMode(): boolean {
  return String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live');
}

/**
 * Splits a French single-line address (as returned by the SIREN API / typed in
 * the profile) into Stripe's distinct fields. Never dumps the full address into
 * line1 when a postal code can be extracted.
 */
export function parseFrenchAddress(addr?: string): {
  line1: string;
  postal_code: string;
  city: string;
  country: 'FR';
} {
  if (!addr || !addr.trim()) return { line1: '', postal_code: '', city: '', country: 'FR' };
  const s = addr.trim().replace(/\s+/g, ' ');
  const m = s.match(/^(.*?)\s+(\d{5})\s+(.+)$/);
  if (m) return { line1: m[1].trim(), postal_code: m[2], city: m[3].trim(), country: 'FR' };
  return { line1: s, postal_code: '', city: '', country: 'FR' };
}

/** Account email of the profile's owner (users record). */
async function getAccountEmail(userId: string): Promise<string> {
  try {
    const user = (await pocketbaseAdmin.getRecord('users', userId)) as Record<string, unknown>;
    return String(user.email || '');
  } catch {
    return '';
  }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/**
 * Customer name: company name, else the merchant / representative name.
 */
function customerDisplayName(profile: StripeProfile): string {
  return (
    profile.company_name ||
    [profile.rep_firstname, profile.rep_lastname].filter(Boolean).join(' ').trim() ||
    profile.trade_name ||
    ''
  );
}

/**
 * Creates or retrieves the Stripe customer for a client profile.
 *
 * - If a customer id is stored AND its recorded mode (stripe_livemode) matches
 *   the active key mode AND the customer still exists on Stripe, reuse it.
 * - Otherwise create a new customer with the same idempotency key
 *   `profile-<id>` (so a double-create cannot produce two customers), the
 *   split address, account email, phone, preferred_locales and metadata, then
 *   persist the returned cus_ id and the current live mode.
 * - If the profile carries an EU VAT number, attach it as an eu_vat tax id.
 *
 * This is the reliable fallback used at checkout / portal time. The
 * PocketBase hook (stripe-customer-sync.pb.js) performs the same sync
 * best-effort on profile create/update.
 */
export async function ensureStripeCustomer(profile: StripeProfile): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const liveMode = stripeLiveMode();

  if (profile.stripe_customer_id) {
    const storedMode = Boolean(profile.stripe_livemode);
    if (storedMode === liveMode) {
      try {
        const existing = await stripe.customers.retrieve(profile.stripe_customer_id);
        if (existing && !('deleted' in existing)) return existing as Stripe.Customer;
      } catch {
        // customer was deleted on Stripe side — fall through to recreate
      }
    }
    // Mode mismatch or deleted customer — recreate below.
  }

  const accountEmail = await getAccountEmail(profile.owner);
  const address = parseFrenchAddress(profile.hq_address);

  const customer = await stripe.customers.create(
    {
      name: customerDisplayName(profile) || undefined,
      email: accountEmail || profile.rep_email || undefined,
      phone: profile.phone || profile.rep_mobile || undefined,
      address: address.line1 ? address : { country: 'FR' },
      preferred_locales: ['fr'],
      metadata: {
        pocketbase_user_id: profile.owner,
        profile_id: profile.id,
      },
    },
    { idempotencyKey: `profile-${profile.id}` },
  );

  await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
    stripe_customer_id: customer.id,
    stripe_livemode: liveMode,
  });

  // Attach the EU VAT tax id when the profile carries one.
  const vat = (profile.vat_number || '').trim();
  if (vat) {
    try {
      await stripe.customers.createTaxId(customer.id, { type: 'eu_vat', value: vat });
    } catch (err) {
      logger.error(`Failed to attach EU VAT tax id for customer ${customer.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return customer;
}

/**
 * Creates a Stripe Checkout session for step 2.1.
 *
 * - No creation fees, no advance monthly payments, no free trial: a plain
 *   subscription that bills on its natural cycle.
 * - automatic_tax enabled (Stripe Tax computes VAT from the HT price).
 * - billing_address_collection required + tax_id_collection enabled.
 * - customer_update address+name = auto (keeps the customer record fresh).
 * - Payment methods: card + SEPA debit.
 */
export async function createCheckoutSession(
  profile: StripeProfile,
  pack: Awaited<ReturnType<typeof loadPack>>,
  billing: string,
  origin: string,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const customer = await ensureStripeCustomer(profile);
  const priceId = await resolvePriceId(pack, billing);

  const params: Stripe.Checkout.SessionCreateParams = {
    customer: customer.id,
    // client_reference_id carries the PocketBase user id onto the session so
    // the webhook can resolve the client even if metadata is stripped.
    client_reference_id: profile.owner,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/espace/etapes/2.1?status=success`,
    cancel_url: `${origin}/espace/etapes/2.1?status=cancel`,
    locale: 'fr',
    currency: 'eur',
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    payment_method_options: { card: { request_three_d_secure: 'automatic' } },
    allowed_payment_method_types: ['card', 'sepa_debit'],
    metadata: {
      profile_id: profile.id,
      user_id: profile.owner,
      pack_id: pack.id,
      billing,
    },
    subscription_data: {
      metadata: {
        profile_id: profile.id,
        user_id: profile.owner,
        pack_id: pack.id,
        billing,
      },
    },
  };

  return stripe.checkout.sessions.create(params);
}

/**
 * Syncs subscription state from Stripe into the client profile.
 *
 * Does NOT touch `engagement_end_date` or `pack` — those are business concepts
 * set explicitly at checkout / on plan changes, not on every subscription
 * update (renewals must not move the engagement date).
 */
export async function syncSubscriptionToProfile(
  profile: StripeProfile,
  subscription: Stripe.Subscription,
): Promise<void> {
  const billing = String(subscription.metadata?.billing || profile.pack_billing || 'monthly');
  const firstItem = subscription.items.data[0];
  const currentPeriodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : '';

  const status = subscription.status === 'trialing' ? 'trialing'
    : subscription.status === 'past_due' ? 'past_due'
    : subscription.status === 'canceled' ? 'canceled'
    : subscription.status === 'unpaid' ? 'unpaid'
    : subscription.status === 'incomplete' ? 'incomplete'
    : subscription.status === 'incomplete_expired' ? 'canceled'
    : subscription.status === 'paused' ? 'paused'
    : 'active';

  await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    subscription_billing: billing,
    subscription_current_period_end: currentPeriodEnd || null,
    next_invoice_date: currentPeriodEnd || null,
    subscription_canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    payment_alert: status === 'past_due' || status === 'unpaid',
  });
}

/** Lists Stripe invoices for a customer, most recent first. */
export async function listStripeInvoices(customerId: string, limit = 20): Promise<Stripe.Invoice[]> {
  const stripe = getStripe();
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data;
}

/** Opens a Stripe billing portal session (payment method + invoices, no cancellation). */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  const params: Stripe.BillingPortal.SessionCreateParams = {
    customer: customerId,
    return_url: returnUrl,
  };
  // Use a pre-configured portal configuration (without cancellation) if set.
  const portalConfigId = process.env.STRIPE_PORTAL_CONFIG_ID;
  if (portalConfigId) {
    params.configuration = portalConfigId;
  }
  return stripe.billingPortal.sessions.create(params);
}

/**
 * Upgrades to a higher pack (same formula): immediate, prorated, engagement
 * end date unchanged.
 */
export async function upgradeSubscription(
  profile: StripeProfile,
  newPack: Awaited<ReturnType<typeof loadPack>>,
  newBilling: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (!profile.stripe_subscription_id) throw new Error('Aucun abonnement actif.');

  const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const newPriceId = await resolvePriceId(newPack, newBilling);
  if (!newPriceId) throw new Error(`Prix Stripe manquant pour ${newBilling}.`);

  const updated = await stripe.subscriptions.update(sub.id, {
    items: [{ id: sub.items.data[0].id, price: newPriceId }],
    proration_behavior: 'create_prorations',
    metadata: { ...sub.metadata, pack_id: newPack.id, billing: newBilling },
  });

  // Update pack on profile; engagement_end_date is intentionally preserved.
  await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
    pack: newPack.id,
    pack_billing: newBilling,
  });

  await syncSubscriptionToProfile(profile, updated);
  return updated;
}

/**
 * Upgrades the formula (monthly → annual or 24 months, or annual → 24 months):
 * immediate, prorated (credit deducted), new engagement end date from now.
 */
export async function upgradeFormula(
  profile: StripeProfile,
  newPack: Awaited<ReturnType<typeof loadPack>>,
  newBilling: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (!profile.stripe_subscription_id) throw new Error('Aucun abonnement actif.');

  const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const newPriceId = await resolvePriceId(newPack, newBilling);
  if (!newPriceId) throw new Error(`Prix Stripe manquant pour ${newBilling}.`);

  const updated = await stripe.subscriptions.update(sub.id, {
    items: [{ id: sub.items.data[0].id, price: newPriceId }],
    proration_behavior: 'create_prorations',
    metadata: { ...sub.metadata, pack_id: newPack.id, billing: newBilling },
  });

  // New engagement end date from the change date.
  const newEngagementEnd = addMonths(new Date(), engagementMonths(newBilling)).toISOString();
  await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
    pack: newPack.id,
    pack_billing: newBilling,
    engagement_end_date: newEngagementEnd,
  });

  await syncSubscriptionToProfile(profile, updated);
  return updated;
}

/**
 * Re-reads the subscription and latest invoice from Stripe and reconciles the
 * client profile's payment status. Used by the admin "Resynchroniser avec
 * Stripe" action when a webhook was missed or arrived out of order.
 *
 * Honors the no-regression rule: a "Réalisé" status is never demoted to
 * "En cours".
 */
export async function resyncProfileFromStripe(profile: StripeProfile): Promise<{
  subscriptionStatus: string;
  paymentStatus: string;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  invoiceNumber: string;
  advanced: boolean;
}> {
  const stripe = getStripe();
  let paymentStatus = String(profile.statut_paiement || 'non_commence');
  let lastPaymentDate = profile.last_payment_date ? String(profile.last_payment_date) : null;
  let lastPaymentAmount = profile.last_payment_amount != null ? Number(profile.last_payment_amount) : null;
  let invoiceNumber = '';
  let advanced = false;

  if (!profile.stripe_subscription_id) {
    return { subscriptionStatus: String(profile.subscription_status || 'none'), paymentStatus, lastPaymentDate, lastPaymentAmount, invoiceNumber, advanced };
  }

  const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  await syncSubscriptionToProfile(profile, sub);

  // Latest invoice tells us whether the most recent payment succeeded.
  let invoice: Stripe.Invoice | null = null;
  if (sub.latest_invoice) {
    const invId = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : String((sub.latest_invoice as Stripe.Invoice).id);
    try { invoice = await stripe.invoices.retrieve(invId); } catch { invoice = null; }
  }

  if (invoice) {
    invoiceNumber = invoice.number || '';
    if (invoice.status === 'paid') {
      paymentStatus = 'realise';
      if (invoice.created) lastPaymentDate = new Date(invoice.created * 1000).toISOString();
      if (typeof invoice.total === 'number') lastPaymentAmount = invoice.total;
    } else if (invoice.status === 'open' || invoice.status === 'void') {
      // Pending — don't demote a realised payment.
      if (paymentStatus !== 'realise') paymentStatus = 'en_cours';
    }
  }

  if (sub.status === 'past_due' || sub.status === 'unpaid') {
    paymentStatus = 'echoue';
  }

  const refreshed = await loadOwnedProfile(profile.owner);
  const currentStatut = String(refreshed.statut_paiement || 'non_commence');
  const updates: Record<string, unknown> = {};
  if (!(currentStatut === 'realise' && paymentStatus === 'en_cours') && currentStatut !== paymentStatus) {
    updates.statut_paiement = paymentStatus;
  }
  if (lastPaymentDate) updates.last_payment_date = lastPaymentDate;
  if (lastPaymentAmount != null) updates.last_payment_amount = lastPaymentAmount;
  if (Object.keys(updates).length) {
    await pocketbaseAdmin.updateRecord('client_profiles', refreshed.id, updates);
  }

  // Advance to 3.1 if the subscription is active and the client is still on 2.1.
  const isActive = sub.status === 'active' || sub.status === 'trialing';
  if (isActive && paymentStatus === 'realise' && refreshed.current_step === '2.1') {
    await pocketbaseAdmin.updateRecord('client_profiles', refreshed.id, { current_step: '3.1' });
    await pocketbaseAdmin.createRecord('step_history', {
      owner: profile.owner,
      step: '3.1',
      action: 'advance',
      author: 'system',
      comment: 'Resynchronisation Stripe — abonnement actif',
    });
    advanced = true;
  }

  const finalProfile = await loadOwnedProfile(profile.owner);
  return {
    subscriptionStatus: String(finalProfile.subscription_status || 'none'),
    paymentStatus: String(finalProfile.statut_paiement || paymentStatus),
    lastPaymentDate,
    lastPaymentAmount,
    invoiceNumber,
    advanced,
  };
}

/**
 * Schedules a downgrade (lower pack or shorter formula) to take effect at the
 * end of the current engagement, via a Stripe Subscription Schedule.
 *
 * Phase 1 = current price until engagement_end_date; phase 2 = new price.
 */
export async function scheduleDowngrade(
  profile: StripeProfile,
  newPack: Awaited<ReturnType<typeof loadPack>>,
  newBilling: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (!profile.stripe_subscription_id) throw new Error('Aucun abonnement actif.');

  const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const newPriceId = await resolvePriceId(newPack, newBilling);
  if (!newPriceId) throw new Error(`Prix Stripe manquant pour ${newBilling}.`);

  const currentPriceId = sub.items.data[0].price.id;
  const periodStart = sub.items.data[0].current_period_start;
  const periodEnd = sub.items.data[0].current_period_end;
  const engEnd = profile.engagement_end_date
    ? Math.floor(new Date(profile.engagement_end_date).getTime() / 1000)
    : periodEnd;
  const phaseOneEnd = engEnd;

  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: sub.id,
  });

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    phases: [
      {
        items: [{ price: currentPriceId, quantity: 1 }],
        start_date: periodStart,
        end_date: phaseOneEnd,
      },
      {
        items: [{ price: newPriceId, quantity: 1 }],
        start_date: phaseOneEnd,
      },
    ],
  });

  // Record the target pack/billing; it takes effect at the schedule boundary.
  await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
    pack: newPack.id,
    pack_billing: newBilling,
  });

  return sub;
}

/** Cancels the subscription at the end of the current (paid) period. */
export async function cancelAtPeriodEnd(profile: StripeProfile): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (!profile.stripe_subscription_id) throw new Error('Aucun abonnement actif.');

  const sub = await stripe.subscriptions.update(profile.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  await syncSubscriptionToProfile(profile, sub);
  return sub;
}

export function logStripeEvent(event: Stripe.Event): void {
  logger.info(`Stripe webhook: ${event.type} (${event.id})`);
}
