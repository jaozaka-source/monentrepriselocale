import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import { isSirenFormat, isSirenValid, computeVatNumber } from '@/lib/siren';
import { legalFormLabel } from '@/data/legal-forms';

type Dirigeant = { nom?: string; prenoms?: string; qualite?: string };

type ApiResult = {
  nom_complet?: string;
  nom_raison_sociale?: string;
  nature_juridique?: string;
  libelle_nature_juridique?: string;
  activite_principale?: string;
  date_creation?: string;
  etat_administratif?: string;
  siege?: {
    siret?: string;
    adresse?: string;
    date_creation?: string;
  };
  dirigeants?: Dirigeant[];
};

/**
 * POST /api/siren — looks up a French company by SIREN using the free public
 * API recherche-entreprises.api.gouv.fr and returns normalized data plus the
 * computed EU VAT number. Server-side so the external call and any future
 * enrichment stay off the browser.
 */
export const action = withApi(async ({ request }) => {
  const { siren } = await readJsonBody<{ siren?: string }>(request);

  if (!siren) {
    return apiError(422, 'Le numéro SIREN est requis.');
  }

  if (!isSirenFormat(siren)) {
    return apiError(422, 'Le SIREN doit comporter 9 chiffres.');
  }

  if (!isSirenValid(siren)) {
    return apiError(422, 'Le numéro SIREN est invalide (clé de contrôle incorrecte).');
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siren)}`,
      { headers: { Accept: 'application/json' } },
    );
  } catch {
    return json(
      { available: false, siren, message: "L'API entreprises est indisponible. Vous pouvez saisir les informations manuellement." },
      { status: 200 },
    );
  }

  if (!upstream.ok) {
    return json(
      { available: false, siren, message: "L'API entreprises a renvoyé une erreur. Vous pouvez saisir les informations manuellement." },
      { status: 200 },
    );
  }

  const payload = (await upstream.json()) as { results?: ApiResult[] };
  const result = payload.results?.find((r) => r.nom_complet || r.nom_raison_sociale);

  if (!result) {
    return json(
      { available: false, siren, message: 'Aucune entreprise trouvée pour ce SIREN. Vérifiez le numéro ou saisissez les informations manuellement.' },
      { status: 200 },
    );
  }

  const hqAddress = result.siege?.adresse || '';
  const ceased = result.etat_administratif === 'C';

  // date_creation is returned as an ISO string (YYYY-MM-DD); format as DD/MM/YYYY.
  const rawDate = result.date_creation || result.siege?.date_creation || '';
  const creationDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? `${rawDate.slice(8, 10)}/${rawDate.slice(5, 7)}/${rawDate.slice(0, 4)}`
    : rawDate;

  const dirigeants = (result.dirigeants || []).map((d) => ({
    nom: d.nom || '',
    prenoms: d.prenoms || '',
    qualite: d.qualite || '',
    label: [d.prenoms, d.nom].filter(Boolean).join(' '),
  }));

  return json({
    available: true,
    siren,
    company_name: result.nom_raison_sociale || result.nom_complet || '',
    hq_address: hqAddress,
    hq_siret: result.siege?.siret || '',
    naf_code: result.activite_principale || '',
    creation_date: creationDate,
    admin_state: result.etat_administratif === 'A' ? 'En activité' : 'Cessée',
    company_ceased: ceased,
    vat_number: computeVatNumber(siren),
    legal_form_code: result.nature_juridique || '',
    legal_form: legalFormLabel(result.nature_juridique || '') || result.libelle_nature_juridique || '',
    dirigeants,
  });
});
