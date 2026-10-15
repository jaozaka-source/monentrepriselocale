import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import { callerFrom, listStripeInvoices, createPortalSession } from '@/lib/stripe.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';

type Profile = Record<string, unknown> & {
  id: string;
  owner: string;
  stripe_customer_id?: string;
  subscription_status?: string;
  pack_billing?: string;
  engagement_end_date?: string;
  next_invoice_date?: string;
  payment_alert?: boolean;
};

/**
 * POST /api/admin/stripe — admin view of a client's subscription and invoices.
 *
 * Body: { profileId, intent? }
 *   intent = 'portal' → opens a Stripe billing portal session for the customer.
 *   otherwise         → returns status, invoices and a Stripe dashboard link.
 */
export const action = withApi(async ({ request }) => {
  const user = await callerFrom(request);
  if (user.role !== 'admin') {
    return apiError(403, 'Réservé à l’administrateur.');
  }

  const body = await readJsonBody<{ profileId?: string; intent?: string }>(request);
  if (!body.profileId) {
    return apiError(422, 'profileId est requis.');
  }

  const profile = (await pocketbaseAdmin.getRecord('client_profiles', body.profileId)) as Profile;
  const customerId = String(profile.stripe_customer_id || '');

  if (body.intent === 'portal') {
    if (!customerId) return apiError(422, 'Aucun client Stripe associé.');
    const returnUrl = new URL(request.url).origin + `/espace/admin/clients/${profile.id}`;
    const session = await createPortalSession(customerId, returnUrl);
    return json({ url: session.url });
  }

  const key = process.env.STRIPE_SECRET_KEY || '';
  const isTest = key.startsWith('sk_test_');
  const dashboardUrl = customerId
    ? `https://dashboard.stripe.com/${isTest ? 'test/' : ''}customers/${customerId}`
    : '';

  let invoices: Awaited<ReturnType<typeof listStripeInvoices>> = [];
  if (customerId) {
    try {
      invoices = await listStripeInvoices(customerId, 20);
    } catch {
      invoices = [];
    }
  }

  return json({
    status: profile.subscription_status || 'none',
    billing: profile.pack_billing || 'monthly',
    engagementEndDate: profile.engagement_end_date || null,
    nextInvoiceDate: profile.next_invoice_date || null,
    paymentAlert: Boolean(profile.payment_alert),
    customerId,
    dashboardUrl,
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
