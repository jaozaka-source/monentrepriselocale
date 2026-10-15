import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import { FRAMEWORK_BODY, FRAMEWORK_TITLE, FRAMEWORK_VERSION } from '@/data/contract-framework';
import { legalFormLabel, isIndividualForm, requiresShareCapital } from '@/data/legal-forms';
import { PROVIDER } from '@/data/provider';

type Profile = Record<string, unknown> & { id: string; owner: string; current_step: string };

export function adminNotifyEmail(): string {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim())
    .find(Boolean);
  return fromEnv || PROVIDER.email;
}

export function retractationApplicable(profile: Profile): boolean {
  const employees = String(profile.employee_count || '');
  const small = employees === '0' || employees === '1-5';
  return small && profile.website_main_activity === false;
}

export async function loadOwnedProfile(userId: string): Promise<Profile> {
  const result = await pocketbaseAdmin.listRecords('client_profiles', {
    filter: `owner = "${userId}"`,
    perPage: 1,
  });
  const profile = result.items[0] as Profile | undefined;
  if (!profile) throw new Error('Profil client introuvable.');
  return profile;
}

type TemplateRow = { version: string; title: string; body: string };

export async function activeTemplate(): Promise<TemplateRow> {
  try {
    const result = await pocketbaseAdmin.listRecords<TemplateRow>(
      'contract_templates',
      { filter: 'category = "framework" && active = true', sort: '-created', perPage: 1 },
    );
    const row = result.items[0];
    if (row?.body) return { version: row.version, title: row.title, body: row.body };
  } catch {
    // fall back to the versioned source shipped with the app
  }
  return { version: FRAMEWORK_VERSION, title: FRAMEWORK_TITLE, body: FRAMEWORK_BODY };
}

export async function activeAnnexTemplate(): Promise<TemplateRow> {
  try {
    const result = await pocketbaseAdmin.listRecords<TemplateRow>(
      'contract_templates',
      { filter: 'category = "annex_rgpd" && active = true', sort: '-created', perPage: 1 },
    );
    const row = result.items[0];
    if (row?.body) return { version: row.version, title: row.title, body: row.body };
  } catch {
    // no annex configured
  }
  return { version: '', title: '', body: '' };
}

/** Which template versions are already signed by the client. */
export async function signedTemplateVersions(userId: string): Promise<Set<string>> {
  try {
    const result = await pocketbaseAdmin.listRecords<{ template_version: string }>('signatures', {
      filter: `owner = "${userId}"`,
      perPage: 100,
    });
    return new Set(result.items.map((r) => String((r as Record<string, unknown>).template_version || '')));
  } catch {
    return new Set();
  }
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function billingInfo(profile: Profile, pack: Record<string, unknown> | null) {
  const billing = String(profile.pack_billing || 'monthly');
  const monthly = Number(pack?.monthly_price || 0);
  const annual = Number(pack?.annual_price || 0);
  const biennial = Number(pack?.biennial_price || 0);
  if (billing === 'biennial') {
    return { formule: '24 mois (−40 %)', prixHt: euro(biennial), periodicite: 'pour 24 mois', months: 24 };
  }
  if (billing === 'annual') {
    return { formule: 'Annuelle (−20 %)', prixHt: euro(annual), periodicite: 'par an', months: 12 };
  }
  return { formule: 'Mensuelle (engagement 12 mois)', prixHt: euro(monthly), periodicite: 'par mois', months: 12 };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function fmtDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export type ContractContext = {
  fields: Record<string, string>;
  cadreBody: string;
  cadreVersion: string;
  annexBody: string;
  annexTitle: string;
  annexVersion: string;
  signerName: string;
  signerQuality: string;
  signerEmail: string;
  retractation: boolean;
};

/**
 * Builds the interpolation map for the {{field}} placeholders, plus the
 * signer/template metadata needed for the signature proof.
 *
 * `opts.signedAt` / `opts.demandeExpresse` are undefined at preview time and
 * filled at signing time.
 */
export async function buildContractContext(
  profile: Profile,
  opts: { signedAt?: Date; demandeExpresse?: boolean } = {},
): Promise<ContractContext> {
  const cadre = await activeTemplate();
  const annex = await activeAnnexTemplate();

  let pack: Record<string, unknown> | null = null;
  if (profile.pack) {
    try {
      pack = (await pocketbaseAdmin.getRecord('packs', String(profile.pack))) as Record<string, unknown>;
    } catch {
      pack = null;
    }
  }

  const retract = retractationApplicable(profile);
  const code = String(profile.legal_form_code || '');
  const form = String(profile.legal_form || legalFormLabel(code));
  const capitalNeeded = requiresShareCapital(code, form);
  const individual = isIndividualForm(code, form);

  const billing = billingInfo(profile, pack);
  const signedAt = opts.signedAt ?? null;
  const engagementEnd = signedAt ? addMonths(signedAt, billing.months) : null;

  const prixHt = billing.prixHt;
  let billingCents = 0;
  if (pack) {
    if (billing.periodicite === 'par mois') billingCents = Number(pack.monthly_price) || 0;
    else if (billing.periodicite === 'par an') billingCents = Number(pack.annual_price) || 0;
    else billingCents = Number(pack.biennial_price) || 0;
  }
  const prixTtc = (billingCents / 100) * 1.2;

  const orDash = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s || '—';
  };

  const orPlaceholder = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s || 'À définir avec votre chef de projet';
  };

  const fields: Record<string, string> = {
    version: cadre.version,
    denomination: orDash(profile.company_name),
    nom_commercial: orDash(profile.trade_name),
    forme_juridique: orDash(form),
    capital: capitalNeeded ? orDash(profile.share_capital) : '—',
    adresse_siege: orDash(profile.hq_address),
    siren: orDash(profile.siren),
    rcs_ou_rne: individual ? 'RNE' : orDash(profile.rcs_city),
    tva: profile.vat_subject ? orDash(profile.vat_number) : 'Non (franchise en base de TVA)',
    civilite: orDash(profile.rep_civility),
    prenom: orDash(profile.rep_firstname),
    nom: orDash(profile.rep_lastname),
    qualite: orDash(profile.rep_quality),
    email_signataire: orDash(profile.rep_email),
    mobile: orDash(profile.rep_mobile),
    contact_nom: orDash(profile.op_name),
    contact_email: orDash(profile.op_email),
    contact_tel: orDash(profile.op_phone),
    adresse_facturation: orDash(profile.billing_address || profile.hq_address),
    pack: orDash(pack?.name),
    formule: billing.formule,
    prix_ht: prixHt,
    prix_ttc: euro(Math.round(prixTtc * 100)),
    periodicite: billing.periodicite,
    date_debut: fmtDate(signedAt),
    date_fin_engagement: fmtDate(engagementEnd),
    domaine: orPlaceholder(profile.domain_name),
    titulaire_domaine: profile.domain_mode === 'existing' ? orPlaceholder(profile.domain_holder) : 'le Client',
    retractation: retract ? 'Oui — 14 jours' : 'Non (activité principale)',
    demande_expresse: opts.demandeExpresse !== undefined ? (opts.demandeExpresse ? 'Oui' : 'Non') : (retract ? '—' : 'Non applicable'),
    date_heure_signature: fmtDateTime(signedAt),
  };

  return {
    fields,
    cadreBody: cadre.body,
    cadreVersion: cadre.version,
    annexBody: annex.body,
    annexTitle: annex.title,
    annexVersion: annex.version,
    signerName: [profile.rep_civility, profile.rep_firstname, profile.rep_lastname].filter(Boolean).join(' '),
    signerQuality: String(profile.rep_quality || ''),
    signerEmail: String(profile.rep_email || ''),
    retractation: retract,
  };
}

/** Replaces every {{field}} with its value (or "—" when empty/unknown). */
export function interpolateHtml(html: string, fields: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const v = fields[key];
    return v && v.trim() ? v : '—';
  });
}

export function checkboxLabels(ctx: ContractContext): { id: string; label: string; required: boolean }[] {
  const items = [
    {
      id: 'framework',
      label: `J'ai lu et j'accepte le contrat cadre version ${ctx.cadreVersion}`,
      required: true,
    },
    {
      id: 'annex',
      label: "J'accepte l'annexe RGPD (traitement des données personnelles)",
      required: true,
    },
    {
      id: 'authority',
      label: `Je certifie être habilité à engager ${ctx.fields.denomination !== '—' ? ctx.fields.denomination : 'l’entreprise'}`,
      required: true,
    },
  ];
  if (ctx.retractation) {
    items.push({
      id: 'early_start',
      label: 'Je demande expressément que les travaux commencent avant la fin du délai de rétractation',
      required: true,
    });
  }
  return items;
}
