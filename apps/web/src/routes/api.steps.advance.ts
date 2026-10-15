import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import { STEPS, stepByCode, stepIndex, nextStep, prevStep, isInPhase4 } from '@/data/steps';

type Profile = Record<string, unknown> & { id: string; current_step: string; owner: string };

const pocketbaseUrl = () => process.env.POCKETBASE_URL || 'http://localhost:8090';

async function refreshRecord(token: string): Promise<{ id: string; email: string; role: string }> {
  const refresh = await fetch(`${pocketbaseUrl()}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: token },
  });
  if (!refresh.ok) {
    throw apiError(401, 'Session invalide');
  }
  const record = (await refresh.json()).record;
  return { id: record.id, email: record.email, role: record.role || 'client' };
}

/** Returns the validation error for a step, or null when the step is complete. */
function validateStep(step: string, profile: Profile): string | null {
  const get = (k: string) => (profile[k] ?? '').toString().trim();

  switch (step) {
    case '1.1': {
      if (!get('siren')) return 'Le SIREN est requis.';
      if (!get('company_name')) return 'La dénomination est requise.';
      if (!get('hq_address')) return "L'adresse du siège est requise.";
      if (!get('hq_siret')) return 'Le SIRET du siège est requis.';
      if (!get('phone')) return 'Le téléphone est requis.';
      if (!get('legal_form') && !get('legal_form_code')) return 'La forme juridique est requise.';
      if (!get('employee_count')) return 'Le nombre de salariés est requis.';
      if (profile.website_main_activity !== true && profile.website_main_activity !== false) {
        return 'Indiquez si la création du site relève de votre activité principale.';
      }
      if (profile.vat_subject !== true && profile.vat_subject !== false) return 'Indiquez si vous êtes assujetti à la TVA.';
      if (profile.vat_subject && !get('vat_number')) return 'Le numéro de TVA est requis.';
      // Domain is now optional — it can be defined later with the project lead.
      if (!get('rcs_city')) return "Le lieu d'immatriculation est requis.";
      const capitalForms = ['5498', '5499', '5710', '5720', '5599', '5605', '5202'];
      const form = `${get('legal_form')} ${get('legal_form_code')}`.toUpperCase();
      const needsCapital = capitalForms.includes(get('legal_form_code')) || /\b(EURL|SARL|SASU|SAS|SNC)\b/.test(form) || (/\bSA\b/.test(form) && !form.includes('SAS'));
      if (needsCapital && !get('share_capital')) return 'Le capital social est requis pour cette forme juridique.';
      if (profile.company_ceased) return 'Cette entreprise est cessée. La suite est bloquée.';
      return null;
    }
    case '1.2':
      if (!get('rep_lastname')) return 'Le nom du représentant est requis.';
      if (!get('rep_firstname')) return 'Le prénom du représentant est requis.';
      if (!get('rep_quality')) return 'La qualité est requise.';
      if (!get('rep_email')) return "L'e-mail du représentant est requis.";
      if (!get('rep_mobile')) return 'Le téléphone mobile est requis.';
      if (!get('op_name') || !get('op_email') || !get('op_phone')) return 'Le contact opérationnel est requis.';
      if (profile.rep_from_list === false && !profile.rep_certified) {
        return 'Vous devez certifier être habilité à engager l’entreprise.';
      }
      return null;
    case '1.5':
      return 'La signature se fait avec le bouton « Signer le contrat ».';
    case '2.1':
      // The client can only leave the payment step once the payment is realised.
      if (String(profile.statut_paiement || 'non_commence') !== 'realise') {
        return 'Le paiement doit être réalisé pour passer à l’étape suivante.';
      }
      return null;
    case '1.3':
      if (!get('pack')) return 'Vous devez choisir un pack.';
      return null;
    default:
      // 1.4, 1.5, 2.1 are placeholders — no validation yet.
      return null;
  }
}

/**
 * POST /api/steps/advance — validates the current step and advances the
 * client's profile to the next step, recording the change in step_history
 * (which triggers the notification email hook).
 *
 * - Without `profileId`: advances the signed-in user's own step. Only allowed
 *   for autonomous steps (phases 1 and 2); phase 3 is admin-only.
 * - With `profileId` (admin only): advances any client's step.
 */
export const action = withApi(async ({ request }) => {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) {
    return apiError(401, 'Non authentifié');
  }

  const caller = await refreshRecord(token);
  const body = await readJsonBody<{ profileId?: string; comment?: string; direction?: string }>(request).catch(
    () => ({ profileId: undefined, comment: undefined, direction: undefined }),
  );

  let profile: Profile;

  if (body.profileId) {
    if (caller.role !== 'admin') {
      return apiError(403, 'Réservé à l’administrateur.');
    }
    profile = (await pocketbaseAdmin.getRecord('client_profiles', body.profileId)) as Profile;
  } else {
    const result = await pocketbaseAdmin.listRecords('client_profiles', {
      filter: `owner = "${caller.id}"`,
    });
    profile = result.items[0] as Profile;
    if (!profile) {
      return apiError(404, 'Profil client introuvable.');
    }
  }

  const current = profile.current_step;
  const stepDef = stepByCode(current);
  if (!stepDef) {
    return apiError(422, 'Étape inconnue.');
  }

  // --- Back to previous step (admin only) --------------------------------
  if (body.direction === 'back') {
    if (caller.role !== 'admin') {
      return apiError(403, 'Réservé à l’administrateur.');
    }
    const prev = prevStep(current);
    if (!prev) {
      return apiError(422, 'Le client est à la première étape.');
    }
    await pocketbaseAdmin.updateRecord('client_profiles', profile.id, { current_step: prev });
    await pocketbaseAdmin.createRecord('step_history', {
      owner: profile.owner,
      step: prev,
      action: 'reset',
      author: caller.email,
      comment: body.comment || '',
    });
    return json({ current_step: prev, phase4: isInPhase4(prev) });
  }

  // --- Advance to next step ----------------------------------------------
  // Non-autonomous steps (phase 3, 4) can only be advanced by an admin.
  if (!stepDef.autonomous && caller.role !== 'admin') {
    return apiError(403, 'Cette étape est avancée par notre équipe. Vous serez notifié(e).');
  }

  const error = validateStep(current, profile);
  if (error) {
    return apiError(422, error);
  }

  const next = nextStep(current);
  if (!next) {
    return apiError(422, 'Vous êtes à la dernière étape.');
  }

  await pocketbaseAdmin.updateRecord('client_profiles', profile.id, { current_step: next });

  await pocketbaseAdmin.createRecord('step_history', {
    owner: profile.owner,
    step: next,
    action: 'advance',
    author: caller.email,
    comment: body.comment || '',
  });

  return json({ current_step: next, phase4: isInPhase4(next) });
});
