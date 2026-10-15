import pb from '@/lib/pocketbase-client';
import { nextStep, stepByCode } from '@/data/steps';

export type ClientProfile = {
  id: string;
  owner: string;
  current_step: string;
  siren?: string;
  company_name?: string;
  trade_name?: string;
  legal_form?: string;
  legal_form_code?: string;
  vat_subject?: boolean;
  employee_count?: string;
  website_main_activity?: boolean;
  retractation_applicable?: boolean;
  op_name?: string;
  op_email?: string;
  op_phone?: string;
  domain_mode?: string;
  domain_name?: string;
  domain_holder?: string;
  hq_address?: string;
  hq_siret?: string;
  naf_code?: string;
  naf_label?: string;
  creation_date?: string;
  admin_state?: string;
  vat_number?: string;
  company_ceased?: boolean;
  api_snapshot?: Record<string, unknown> | null;
  share_capital?: string;
  rcs_city?: string;
  billing_address?: string;
  phone?: string;
  kbis_doc?: string;
  rep_civility?: string;
  rep_lastname?: string;
  rep_firstname?: string;
  rep_quality?: string;
  rep_email?: string;
  rep_mobile?: string;
  rep_from_list?: boolean;
  rep_certified?: boolean;
  rep_delegation_doc?: string;
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
  mockup_url?: string;
  live_site_url?: string;
  internal_notes?: string;
  meeting_date?: string;
  meeting_link?: string;
  rdv_debut?: string;
  rdv_fin?: string;
  rdv_statut?: string;
  rdv_lieu?: string;
  rdv_lien_modifier?: string;
  rdv_lien_annuler?: string;
  rdv_event_uri?: string;
  rdv_invitee_uri?: string;
  creation_comment?: string;
  qa_comment?: string;
  mockup_status?: string;
  mockup_feedback?: string;
  mockup_feedback_at?: string;
  statut_paiement?: string;
  last_payment_date?: string;
  last_payment_amount?: number;
  created?: string;
  updated?: string;
};

export type ClientContent = {
  id: string;
  owner: string;
  presentation?: string;
  services?: string;
  hours?: string;
  address?: string;
  website?: string;
  social_facebook?: string;
  social_instagram?: string;
  social_linkedin?: string;
  social_other?: string;
  files?: string[];
  submitted?: boolean;
  submitted_at?: string;
  created?: string;
  updated?: string;
};

/**
 * Confirms the current PocketBase session is still accepted server-side.
 * `pb.authStore.isValid` only checks the JWT expiry, not the tokenKey, so a
 * token whose tokenKey was rotated elsewhere (another tab refreshed, the
 * record was re-authed) is reported as valid locally. `authRefresh` is the one
 * call that actually validates the token against the server: it returns 401
 * when the token is no longer accepted. On failure the store is cleared and
 * the visitor is sent to /login.
 */
async function ensureValidSession(): Promise<void> {
  try {
    await pb.collection('users').authRefresh();
  } catch {
    pb.authStore.clear();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Session expirée, veuillez vous reconnecter.');
  }
}

/** Fetches (or creates) the signed-in user's content record (step 3.2). */
export async function getOrCreateContent(): Promise<ClientContent> {
  const userId = pb.authStore.record?.id;
  if (!userId) throw new Error('Not authenticated');

  const fetchOwned = () =>
    pb.collection('client_contents').getFirstListItem(`owner = "${userId}"`, { requestKey: null });

  // 1. Try to fetch the existing content record.
  try {
    return (await fetchOwned()) as unknown as ClientContent;
  } catch (err: unknown) {
    // A 404 is ambiguous: "no record yet" OR "invalid session, so the
    // listRule (@request.auth.id != '') hid every row". Anything else is real.
    if ((err as { status?: number })?.status !== 404) throw err;
  }

  // 2. Validate the session before creating, otherwise a stale token makes
  // the create 400 with a create-rule failure.
  await ensureValidSession();

  // 3. Session is valid but no record exists — create one.
  try {
    const record = await pb.collection('client_contents').create({ owner: userId });
    return record as unknown as ClientContent;
  } catch (err: unknown) {
    // A 400 here usually means a record was created concurrently (StrictMode
    // double-invoke raced us) — fetch it.
    if ((err as { status?: number })?.status === 400) {
      return (await fetchOwned()) as unknown as ClientContent;
    }
    throw err;
  }
}

export type Pack = {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  biennial_price: number;
  features: string[];
  stripe_product_id: string;
  stripe_monthly_variant_id: string;
  stripe_annual_variant_id: string;
  stripe_biennial_variant_id: string;
  sort: number;
  active: boolean;
};

/** Fetches (or creates) the signed-in user's client profile. */
export async function getOrCreateProfile(): Promise<ClientProfile> {
  const userId = pb.authStore.record?.id;
  if (!userId) throw new Error('Not authenticated');

  const fetchOwned = () =>
    pb.collection('client_profiles').getFirstListItem(`owner = "${userId}"`, {
      requestKey: null,
    });

  // 1. Try to fetch the existing profile.
  try {
    return (await fetchOwned()) as unknown as ClientProfile;
  } catch (err: unknown) {
    // A 404 is ambiguous: it can mean "no profile yet" OR "the session token
    // is invalid, so the listRule (@request.auth.id != '') hid every row".
    // Abort/network errors (status 0, common under React StrictMode
    // double-invoke) must not trigger a create either.
    const status = (err as { status?: number })?.status;
    if (status !== 404) throw err;
  }

  // 2. Validate the session before creating. `pb.authStore.isValid` only
  // checks the JWT expiry, not the tokenKey, so a token whose tokenKey was
  // rotated server-side (a prior auth-refresh, another tab) is reported as
  // valid locally. `authRefresh` confirms it against the server; a stale
  // token is caught here and the visitor is redirected to /login instead of
  // attempting a create that would 400 with a create-rule failure.
  await ensureValidSession();

  // 3. Session is valid but no profile exists — create one.
  try {
    const record = await pb.collection('client_profiles').create({
      owner: userId,
      current_step: '1.1',
    });
    return record as unknown as ClientProfile;
  } catch (err: unknown) {
    // A 400 here usually means a profile was created concurrently (StrictMode
    // double-invoke raced us on the unique-owner constraint) — fetch it.
    if ((err as { status?: number })?.status === 400) {
      return (await fetchOwned()) as unknown as ClientProfile;
    }
    throw err;
  }
}

export async function fetchProfile(): Promise<ClientProfile | null> {
  const userId = pb.authStore.record?.id;
  if (!userId) return null;

  try {
    const record = await pb.collection('client_profiles').getFirstListItem(`owner = "${userId}"`, {
      requestKey: null,
    });
    return record as unknown as ClientProfile;
  } catch {
    return null;
  }
}

export async function fetchPacks(): Promise<Pack[]> {
  const records = await pb.collection('packs').getFullList({ sort: 'sort', requestKey: null });
  return records as unknown as Pack[];
}

export async function updateProfile(patch: Partial<ClientProfile>): Promise<ClientProfile> {
  const userId = pb.authStore.record?.id;
  if (!userId) throw new Error('Not authenticated');

  const profile = await getOrCreateProfile();
  const record = await pb.collection('client_profiles').update(profile.id, patch);
  return record as unknown as ClientProfile;
}

/**
 * Saves the step data then asks the server to validate and advance the step.
 * The server (superuser) is the only thing that can change current_step, so
 * the client cannot skip ahead.
 */
export async function advanceStep(comment?: string): Promise<{ current_step: string }> {
  const response = await fetch('/api/steps/advance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pb.authStore.token}`,
    },
    body: JSON.stringify({ comment }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Échec (${response.status})`);
  }

  return (await response.json()) as { current_step: string };
}

export function stepTitle(code: string): string {
  return stepByCode(code)?.title ?? code;
}

export function nextStepCode(code: string): string | null {
  return nextStep(code);
}
