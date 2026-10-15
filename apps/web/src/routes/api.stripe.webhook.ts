import { json, withApi } from '@/lib/api.server';
import type Stripe from 'stripe';
import logger from '@/lib/logger.server';
import {
  getStripe,
  syncSubscriptionToProfile,
  loadOwnedProfile,
  loadPack,
  engagementMonths,
} from '@/lib/stripe.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';

type EventStatus = 'pending' | 'success' | 'failed' | 'ignored';

type StripeEventRow = { id: string; status: EventStatus };

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function billingLabel(billing: string): string {
  if (billing === 'annual') return 'Annuel (1 an)';
  if (billing === 'biennial') return 'Biennal (24 mois)';
  return 'Mensuel';
}

function formatAmountTtc(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' € TTC';
}

function formatPaymentDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function computeAmountTtc(pack: { monthly_price: number; annual_price: number; biennial_price: number }, billing: string): number {
  const ht = billing === 'annual' ? pack.annual_price : billing === 'biennial' ? pack.biennial_price : pack.monthly_price;
  return Math.round(ht * 1.2);
}

type ProfileRec = Record<string, unknown> & { id: string; owner: string };

/**
 * Status ordering: a "Réalisé" payment must never be demoted back to "En cours"
 * if Stripe events arrive out of order (e.g. an async_payment_succeeded lands
 * after a stray invoice.paid). Only this specific regression is blocked —
 * "Échoué" (a later recurring failure) and "Réalisé" (recovery) are allowed.
 */
function canApplyStatus(current: string, next: string): boolean {
  if (current === 'realise' && next === 'en_cours') return false;
  return true;
}

/** Finds an existing stripe_events row by Stripe event id. */
async function findEventRow(eventId: string): Promise<StripeEventRow | null> {
  try {
    const result = await pocketbaseAdmin.listRecords<StripeEventRow>('stripe_events', {
      filter: `event_id = "${eventId}"`,
      perPage: 1,
    });
    return result.items[0] ?? null;
  } catch {
    return null;
  }
}

/** Creates a pending stripe_events row, tolerating a concurrent duplicate. */
async function logEventPending(eventId: string, type: string): Promise<string | null> {
  try {
    const rec = await pocketbaseAdmin.createRecord<{ id: string }>('stripe_events', {
      event_id: eventId,
      type,
      status: 'pending',
      result: '',
      error: '',
      profile_id: '',
      customer_id: '',
    });
    return rec.id;
  } catch {
    // Duplicate event_id from a concurrent delivery — fetch the existing row.
    return (await findEventRow(eventId))?.id ?? null;
  }
}

async function updateEventStatus(rowId: string, status: EventStatus, result: string, error: string, profileId: string, customerId: string): Promise<void> {
  try {
    await pocketbaseAdmin.updateRecord('stripe_events', rowId, {
      status,
      result: result || '',
      error: error || '',
      profile_id: profileId || '',
      customer_id: customerId || '',
    });
  } catch {
    // best-effort logging — must not block the 200 response
  }
}

/**
 * Idempotently queues a payment notification email by creating a record in the
 * `payment_emails` collection. A PB hook sends the actual email on create.
 *
 * The key is composite (not the raw Stripe event id) so that different Stripe
 * events for the same payment don't produce duplicate emails. The unique index
 * on event_id guarantees single delivery even when Stripe retries.
 */
async function queuePaymentEmail(opts: {
  eventId: string;
  type: 'confirmed' | 'failed';
  profile: ProfileRec;
  packName: string;
  billing: string;
  amountTtc: number;
  invoiceUrl?: string;
  paymentDate?: string;
}): Promise<void> {
  try {
    await pocketbaseAdmin.createRecord('payment_emails', {
      event_id: opts.eventId,
      email_type: opts.type,
      client_email: String(opts.profile.rep_email || ''),
      company_name: String(opts.profile.company_name || ''),
      siren: String(opts.profile.siren || ''),
      pack_name: opts.packName,
      billing_label: billingLabel(opts.billing),
      amount_ttc_text: formatAmountTtc(opts.amountTtc),
      payment_date: formatPaymentDate(opts.paymentDate),
      profile_id: opts.profile.id,
      owner: opts.profile.owner,
      invoice_url: opts.invoiceUrl || '',
    });
  } catch {
    // Duplicate event_id — email already queued for this payment. Ignore.
  }
}

/** Finds a client profile by Stripe customer id. */
async function findProfileByCustomer(customerId: string): Promise<ProfileRec | null> {
  const result = await pocketbaseAdmin.listRecords<ProfileRec>('client_profiles', {
    filter: `stripe_customer_id = "${customerId}"`,
    perPage: 1,
  });
  return result.items[0] ?? null;
}

/** Safely sets statut_paiement, honoring the no-regression rule. */
async function applyPaymentStatus(profileId: string, currentStatus: string, nextStatus: string): Promise<void> {
  if (!canApplyStatus(currentStatus, nextStatus)) return;
  if (currentStatus === nextStatus) return;
  await pocketbaseAdmin.updateRecord('client_profiles', profileId, { statut_paiement: nextStatus });
}

type ProcessOutcome = { status: EventStatus; result: string; error?: string; profileId: string; customerId: string };

/**
 * Processes a verified Stripe event. Returns the outcome for logging.
 * Never throws — errors are captured and returned as status 'failed'.
 */
async function processEvent(stripe: Stripe, event: Stripe.Event): Promise<ProcessOutcome> {
  const base: ProcessOutcome = { status: 'ignored', result: `Type ${event.type} non traité`, profileId: '', customerId: '' };

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        id: string;
        customer?: string;
        subscription?: string;
        payment_status?: string;
        client_reference_id?: string;
        metadata?: Record<string, string>;
      };
      const userId = String(session.client_reference_id || session.metadata?.user_id || '');
      const customerId = String(session.customer || '');
      if (!userId) {
        // Fall back to customer lookup if no user id was carried.
        if (customerId) {
          const p = await findProfileByCustomer(customerId);
          if (p) return { ...base, status: 'success', result: 'Client retrouvé via customer (pas de user_id)', profileId: p.id, customerId };
        }
        return { ...base, status: 'ignored', result: 'Aucun user_id / client_reference_id', customerId };
      }

      const profile = await loadOwnedProfile(userId);
      const billing = String(session.metadata?.billing || profile.pack_billing || 'monthly');
      const packId = String(session.metadata?.pack_id || profile.pack || '');
      let pack: Awaited<ReturnType<typeof loadPack>> | null = null;
      if (packId) {
        try { pack = await loadPack(packId); } catch { pack = null; }
      }

      const updates: Record<string, unknown> = {
        stripe_customer_id: session.customer || profile.stripe_customer_id || '',
      };
      if (session.subscription) updates.stripe_subscription_id = session.subscription;
      if (session.metadata?.pack_id) updates.pack = session.metadata.pack_id;
      if (session.metadata?.billing) updates.pack_billing = session.metadata.billing;

      const paymentStatus = String(session.payment_status || '');
      const nowIso = new Date().toISOString();
      const currentStatut = String(profile.statut_paiement || 'non_commence');

      if (paymentStatus === 'paid') {
        updates.statut_paiement = canApplyStatus(currentStatut, 'realise') ? 'realise' : currentStatut;
        updates.last_payment_date = nowIso;
        if (pack) updates.last_payment_amount = computeAmountTtc(pack, billing);
      } else {
        // unpaid → SEPA pending (async flow not yet resolved)
        if (canApplyStatus(currentStatut, 'en_cours')) updates.statut_paiement = 'en_cours';
      }

      await pocketbaseAdmin.updateRecord('client_profiles', profile.id, updates);

      // Sync the subscription details (status, period end, etc.).
      let invoiceUrl = '';
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const refreshed = await loadOwnedProfile(userId);
        await syncSubscriptionToProfile(refreshed, sub);

        // Set the engagement end date once (signature + 12 or 24 months).
        const billingFinal = String(session.metadata?.billing || refreshed.pack_billing || 'monthly');
        if (!refreshed.engagement_end_date) {
          const engEnd = addMonths(new Date(), engagementMonths(billingFinal)).toISOString();
          await pocketbaseAdmin.updateRecord('client_profiles', refreshed.id, { engagement_end_date: engEnd });
        }

        if (sub.latest_invoice) {
          try {
            const inv = await stripe.invoices.retrieve(String(sub.latest_invoice));
            invoiceUrl = inv.hosted_invoice_url || '';
          } catch { /* ignore */ }
        }

        // Queue the confirmation email (idempotent by subscription id).
        if (paymentStatus === 'paid' && pack) {
          const afterSync = await loadOwnedProfile(userId);
          await queuePaymentEmail({
            eventId: `confirmed_${session.subscription}`,
            type: 'confirmed',
            profile: afterSync,
            packName: pack.name,
            billing,
            amountTtc: computeAmountTtc(pack, billing),
            invoiceUrl,
            paymentDate: nowIso,
          });
        }
      }

      // Advance to step 3.1 on first successful payment (idempotent).
      const afterSync = await loadOwnedProfile(userId);
      if (afterSync.current_step === '2.1' && paymentStatus === 'paid') {
        await pocketbaseAdmin.updateRecord('client_profiles', afterSync.id, { current_step: '3.1' });
        await pocketbaseAdmin.createRecord('step_history', {
          owner: userId,
          step: '3.1',
          action: 'advance',
          author: 'system',
          comment: 'Paiement confirmé — abonnement actif',
        });
      }

      return { status: 'success', result: `checkout.completed (payment_status=${paymentStatus})`, profileId: profile.id, customerId };
    }

    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as {
        customer?: string;
        subscription?: string;
        client_reference_id?: string;
        metadata?: Record<string, string>;
      };
      const userId = String(session.client_reference_id || session.metadata?.user_id || '');
      const customerId = String(session.customer || '');
      const profile = userId ? await loadOwnedProfile(userId) : (customerId ? await findProfileByCustomer(customerId) : null);
      if (!profile) return { ...base, status: 'ignored', result: 'Profil introuvable', customerId };

      const billing = String(session.metadata?.billing || profile.pack_billing || 'monthly');
      const packId = String(session.metadata?.pack_id || profile.pack || '');
      let pack: Awaited<ReturnType<typeof loadPack>> | null = null;
      if (packId) {
        try { pack = await loadPack(packId); } catch { pack = null; }
      }

      const nowIso = new Date().toISOString();
      const currentStatut = String(profile.statut_paiement || 'non_commence');
      await applyPaymentStatus(profile.id, currentStatut, 'realise');
      const updates: Record<string, unknown> = { last_payment_date: nowIso };
      if (pack) updates.last_payment_amount = computeAmountTtc(pack, billing);
      await pocketbaseAdmin.updateRecord('client_profiles', profile.id, updates);

      if (pack && session.subscription) {
        await queuePaymentEmail({
          eventId: `confirmed_${session.subscription}`,
          type: 'confirmed',
          profile,
          packName: pack.name,
          billing,
          amountTtc: computeAmountTtc(pack, billing),
          paymentDate: nowIso,
        });
      }

      // Advance to 3.1 if still at 2.1.
      if (profile.current_step === '2.1') {
        await pocketbaseAdmin.updateRecord('client_profiles', profile.id, { current_step: '3.1' });
        await pocketbaseAdmin.createRecord('step_history', {
          owner: profile.owner,
          step: '3.1',
          action: 'advance',
          author: 'system',
          comment: 'Paiement confirmé — abonnement actif',
        });
      }

      return { status: 'success', result: 'async_payment_succeeded → réalisé', profileId: profile.id, customerId };
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as {
        customer?: string;
        subscription?: string;
        client_reference_id?: string;
        metadata?: Record<string, string>;
      };
      const userId = String(session.client_reference_id || session.metadata?.user_id || '');
      const customerId = String(session.customer || '');
      const profile = userId ? await loadOwnedProfile(userId) : (customerId ? await findProfileByCustomer(customerId) : null);
      if (!profile) return { ...base, status: 'ignored', result: 'Profil introuvable', customerId };

      const billing = String(session.metadata?.billing || profile.pack_billing || 'monthly');
      const packId = String(session.metadata?.pack_id || profile.pack || '');
      let pack: Awaited<ReturnType<typeof loadPack>> | null = null;
      if (packId) {
        try { pack = await loadPack(packId); } catch { pack = null; }
      }

      const nowIso = new Date().toISOString();
      await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
        statut_paiement: 'echoue',
        payment_alert: true,
      });

      // Dedup key: prefer the failed invoice id, else the subscription.
      let dedupKey = session.subscription ? `failed_${session.subscription}` : `failed_${event.id}`;
      if (session.subscription) {
        try {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          if (sub.latest_invoice) {
            const inv = await stripe.invoices.retrieve(String(sub.latest_invoice));
            if (inv.id) dedupKey = `failed_${inv.id}`;
          }
        } catch { /* keep subscription key */ }
      }

      if (pack) {
        await queuePaymentEmail({
          eventId: dedupKey,
          type: 'failed',
          profile,
          packName: pack.name,
          billing,
          amountTtc: computeAmountTtc(pack, billing),
          paymentDate: nowIso,
        });
      }

      return { status: 'success', result: 'async_payment_failed → échoué', profileId: profile.id, customerId };
    }

    case 'invoice.paid': {
      const invoice = event.data.object as {
        customer?: string;
        subscription?: string;
        period_end?: number;
        total?: number;
        currency?: string;
        billing_reason?: string;
        hosted_invoice_url?: string;
        number?: string;
        id?: string;
        lines?: { data: Array<{ period?: { end?: number } }> };
      };
      const customerId = String(invoice.customer || '');
      if (!customerId) return { ...base, status: 'ignored', result: 'Pas de customer' };

      const profile = await findProfileByCustomer(customerId);
      if (!profile) return { ...base, status: 'ignored', result: 'Profil introuvable', customerId };

      const periodEnd = invoice.lines?.data?.[0]?.period?.end || invoice.period_end;
      const nowIso = new Date().toISOString();
      const currentStatut = String(profile.statut_paiement || 'non_commence');
      await applyPaymentStatus(profile.id, currentStatut, 'realise');
      const updates: Record<string, unknown> = {
        last_payment_date: nowIso,
        payment_alert: false,
      };
      if (periodEnd) updates.next_invoice_date = new Date(periodEnd * 1000).toISOString();
      if (typeof invoice.total === 'number') updates.last_payment_amount = invoice.total;
      await pocketbaseAdmin.updateRecord('client_profiles', profile.id, updates);

      // Send the confirmation email only for the first invoice
      // (subscription_create). Recurring invoices don't re-notify.
      if (invoice.billing_reason === 'subscription_create' && invoice.subscription) {
        const billing = String(profile.pack_billing || 'monthly');
        const packId = String(profile.pack || '');
        let pack: Awaited<ReturnType<typeof loadPack>> | null = null;
        if (packId) {
          try { pack = await loadPack(packId); } catch { pack = null; }
        }
        if (pack) {
          const amount = typeof invoice.total === 'number' ? invoice.total : computeAmountTtc(pack, billing);
          await queuePaymentEmail({
            eventId: `confirmed_${String(invoice.subscription)}`,
            type: 'confirmed',
            profile,
            packName: pack.name,
            billing,
            amountTtc: amount,
            invoiceUrl: invoice.hosted_invoice_url || '',
            paymentDate: nowIso,
          });
        }
      }

      return { status: 'success', result: `invoice.paid (${invoice.number || invoice.id || ''})`, profileId: profile.id, customerId };
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as {
        customer?: string;
        subscription?: string;
        total?: number;
        billing_reason?: string;
        id?: string;
      };
      const customerId = String(invoice.customer || '');
      if (!customerId) return { ...base, status: 'ignored', result: 'Pas de customer' };

      const profile = await findProfileByCustomer(customerId);
      if (!profile) return { ...base, status: 'ignored', result: 'Profil introuvable', customerId };

      await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
        payment_alert: true,
        subscription_status: 'past_due',
        statut_paiement: 'echoue',
      });

      const billing = String(profile.pack_billing || 'monthly');
      const packId = String(profile.pack || '');
      let pack: Awaited<ReturnType<typeof loadPack>> | null = null;
      if (packId) {
        try { pack = await loadPack(packId); } catch { pack = null; }
      }
      if (pack) {
        await queuePaymentEmail({
          eventId: `failed_${invoice.id || invoice.subscription || event.id}`,
          type: 'failed',
          profile,
          packName: pack.name,
          billing,
          amountTtc: typeof invoice.total === 'number' ? invoice.total : computeAmountTtc(pack, billing),
          paymentDate: new Date().toISOString(),
        });
      }

      return { status: 'success', result: 'invoice.payment_failed → échoué', profileId: profile.id, customerId };
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as { id: string; customer?: string };
      const customerId = String(sub.customer || '');
      if (!customerId) return { ...base, status: 'ignored', result: 'Pas de customer' };

      const profile = await findProfileByCustomer(customerId);
      if (!profile) return { ...base, status: 'ignored', result: 'Profil introuvable', customerId };

      const fullSub = await stripe.subscriptions.retrieve(sub.id);
      const refreshed = await loadOwnedProfile(String(profile.owner));
      // Engagement end date is intentionally NOT changed on updates.
      await syncSubscriptionToProfile(refreshed, fullSub);
      return { status: 'success', result: 'subscription.updated synchronisé', profileId: profile.id, customerId };
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as { id: string; customer?: string; canceled_at?: number };
      const customerId = String(sub.customer || '');
      if (!customerId) return { ...base, status: 'ignored', result: 'Pas de customer' };

      const profile = await findProfileByCustomer(customerId);
      if (!profile) return { ...base, status: 'ignored', result: 'Profil introuvable', customerId };

      await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
        subscription_status: 'canceled',
        subscription_canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : new Date().toISOString(),
        stripe_subscription_id: '',
      });
      return { status: 'success', result: 'subscription.deleted → résilié', profileId: profile.id, customerId };
    }

    default:
      return base;
  }
}

/**
 * GET /api/stripe/webhook — configuration status (no secrets disclosed).
 *
 * Returns booleans only — whether each required environment variable is set —
 * so an operator can confirm production config without exposing key values.
 * Used to diagnose why the webhook might return 500.
 */
export const loader = withApi(async () => {
  return {
    ok: true,
    stripeKey: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    notificationEmail: Boolean(process.env.NOTIFICATION_EMAIL),
  };
});

/**
 * POST /api/stripe/webhook — Stripe webhook receiver.
 *
 * THE WEBHOOK URL TO REGISTER IN STRIPE:
 *   https://<your-public-domain>/api/stripe/webhook
 *
 * Verification uses the RAW request body (never parsed as JSON first), the
 * `stripe-signature` header, and STRIPE_WEBHOOK_SECRET. Not wrapped in withApi:
 * Stripe sends a raw body that must be verified before any rate limiting or
 * JSON parsing, and the handler must return 200 fast.
 *
 * Flow: config check (500 if incomplete) → verify signature (400 if invalid) →
 * idempotency check on event.id → log to stripe_events (pending) → process →
 * update stripe_events → 200. Processing errors never prevent the 200 (they
 * are recorded as status=failed in stripe_events and logged with the stack).
 */
export const action = async ({ request }: { request: Request }) => {
  // 1. Config validation — fail fast with a clear message if a secret is
  //    missing. This prevents the unhandled throw from getStripe() that
  //    produced the generic "Unexpected Server Error" 500 in production.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret || !process.env.NOTIFICATION_EMAIL) {
    const missing: string[] = [];
    if (!process.env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
    if (!webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET');
    if (!process.env.NOTIFICATION_EMAIL) missing.push('NOTIFICATION_EMAIL');
    const msg = `Configuration Stripe manquante: ${missing.join(', ')}`;
    logger.error(`[stripe-webhook] ${msg}`);
    return json({ error: 'Configuration incomplète', missing }, { status: 500 });
  }

  // 2. Signature header must be present.
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return json({ error: 'Missing signature' }, { status: 400 });
  }

  // 3. Read the RAW body — must NOT be parsed as JSON before signature verification.
  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(await request.arrayBuffer());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[stripe-webhook] Failed to read raw body: ${msg}`);
    return json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // 4. Initialize Stripe and verify the signature — 400 if the signature is
  //    invalid, 500 if Stripe cannot be initialized (e.g. bad key format).
  //    getStripe() is wrapped so it can never produce an unhandled throw.
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[stripe-webhook] Stripe initialization failed: ${msg}`);
    return json({ error: 'Stripe initialization failed' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[stripe-webhook] Signature verification failed: ${msg}`);
    return json({ error: 'Invalid signature' }, { status: 400 });
  }

  logger.info(`[stripe-webhook] Received: ${event.type} (${event.id})`);

  // 5. Idempotency + record the event as pending in stripe_events.
  let rowId: string | null = null;
  try {
    const existing = await findEventRow(event.id);
    if (existing && (existing.status === 'success' || existing.status === 'ignored')) {
      logger.info(`[stripe-webhook] Event ${event.id} already processed (${existing.status}), skipping.`);
      return json({ received: true, skipped: true });
    }
    rowId = existing?.id ?? (await logEventPending(event.id, event.type));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[stripe-webhook] Idempotency/log error for ${event.id}: ${msg}`);
  }

  // If we could not record the event, return 500 so Stripe retries later.
  if (!rowId) {
    logger.error(`[stripe-webhook] Could not record event ${event.id} — returning 500 for retry.`);
    return json({ error: 'Failed to record event' }, { status: 500 });
  }

  // 6. Process — never let a processing error block the 200. Errors are
  //    recorded as status=failed in stripe_events and logged with the stack.
  let outcome: ProcessOutcome;
  try {
    outcome = await processEvent(stripe, event);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? '' : '';
    logger.error(`[stripe-webhook] Processing error (${event.type} ${event.id}): ${msg}${stack ? `\n${stack}` : ''}`);
    outcome = { status: 'failed', result: '', error: msg, profileId: '', customerId: '' };
  }

  // 7. Update the event status in stripe_events (best-effort).
  try {
    await updateEventStatus(rowId, outcome.status, outcome.result, outcome.error || '', outcome.profileId, outcome.customerId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[stripe-webhook] Failed to update event status for ${event.id}: ${msg}`);
  }

  // 8. Return 200 — event recorded and processed (or failure logged).
  return json({ received: true });
};
