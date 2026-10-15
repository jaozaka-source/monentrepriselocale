import { apiError, json, withApi } from '@/lib/api.server';
import { callerFrom, loadOwnedProfile, listStripeInvoices } from '@/lib/stripe.server';

/**
 * POST /api/stripe/status — returns the client's subscription status and
 * Stripe invoices for the "Mon abonnement" page.
 *
 * Body: {}
 * Returns: { status, invoices: [{ id, number, amount, currency, created, paid, pdfUrl }] }
 */
export const action = withApi(async ({ request }) => {
  const user = await callerFrom(request);
  const profile = await loadOwnedProfile(user.id);

  if (!profile.stripe_customer_id) {
    return json({ status: 'none', invoices: [] });
  }

  const invoices = await listStripeInvoices(profile.stripe_customer_id, 20);

  return json({
    status: profile.subscription_status || 'none',
    billing: profile.subscription_billing || profile.pack_billing || 'monthly',
    engagementEndDate: profile.engagement_end_date || null,
    nextInvoiceDate: profile.next_invoice_date || null,
    currentPeriodEnd: profile.subscription_current_period_end || null,
    canceledAt: profile.subscription_canceled_at || null,
    paymentAlert: Boolean(profile.payment_alert),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      number: inv.number || '',
      amount: inv.total,
      currency: inv.currency,
      created: inv.created ? new Date(inv.created * 1000).toISOString() : '',
      paid: inv.status === 'paid',
      status: inv.status,
      pdfUrl: inv.invoice_pdf || '',
    })),
  });
});
