import { createHash } from 'node:crypto';
import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import logger from '@/lib/logger.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import {
  checkboxLabels,
  adminNotifyEmail,
  loadOwnedProfile,
  retractationApplicable,
  buildContractContext,
  interpolateHtml,
  signedTemplateVersions,
} from '@/lib/contract.server';
import { renderContractPdf, sha256Hex } from '@/lib/contract-pdf.server';

const pocketbaseUrl = () => process.env.POCKETBASE_URL || 'http://localhost:8090';

async function callerFrom(request: Request): Promise<{ id: string; email: string; role: string }> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) throw apiError(401, 'Non authentifié');
  const refresh = await fetch(`${pocketbaseUrl()}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: token },
  });
  if (!refresh.ok) throw apiError(401, 'Session invalide');
  const record = (await refresh.json()).record;
  return { id: record.id, email: record.email, role: record.role || 'client' };
}

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    ''
  );
}

export const action = withApi(async ({ request }) => {
  const user = await callerFrom(request);
  const body = await readJsonBody<{
    intent?: string;
    code?: string;
    checks?: string[];
  }>(request);

  const profile = await loadOwnedProfile(user.id);

  if (body.intent === 'preview') {
    const ctx = await buildContractContext(profile);
    return json({
      cadreHtml: interpolateHtml(ctx.cadreBody, ctx.fields),
      annexBody: ctx.annexBody ? interpolateHtml(ctx.annexBody, ctx.fields) : '',
      annexTitle: ctx.annexTitle,
      version: ctx.cadreVersion,
      retractation: ctx.retractation,
      checks: checkboxLabels(ctx),
      signerEmail: ctx.signerEmail,
      signerName: ctx.signerName,
    });
  }

  if (body.intent === 'download') {
    const ctx = await buildContractContext(profile);
    const cadreHtml = interpolateHtml(ctx.cadreBody, ctx.fields);
    const pdf = await renderContractPdf(cadreHtml, ctx.annexTitle, ctx.annexBody);
    return json({ pdf: Buffer.from(pdf).toString('base64'), version: ctx.cadreVersion });
  }

  if (body.intent === 'send-code') {
    if (profile.current_step !== '1.5') return apiError(422, 'La signature est disponible à l’étape 1.5.');
    const ctx = await buildContractContext(profile);
    if (!ctx.signerEmail) return apiError(422, 'L’e-mail du signataire est manquant.');

    const already = await signedTemplateVersions(user.id);
    if (ctx.cadreVersion && already.has(ctx.cadreVersion) && (!ctx.annexVersion || already.has(ctx.annexVersion))) {
      return apiError(422, 'Le contrat est déjà signé.');
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace('T', ' ');
    const recent = await pocketbaseAdmin.listRecords('signature_challenges', {
      filter: `owner = "${user.id}" && created >= "${since}"`,
      perPage: 10,
    });
    if (recent.items.length >= 3) {
      return apiError(429, 'Trois codes maximum par heure. Réessayez plus tard.');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const created = await pocketbaseAdmin.createRecord<{ id: string; created: string }>('signature_challenges', {
      owner: user.id,
      email: ctx.signerEmail,
      code,
      expires,
      attempts: 0,
      verified: false,
    });
    return json({ ok: true, id: created.id, email: ctx.signerEmail, sentAt: created.created });
  }

  if (body.intent === 'sign') {
    if (profile.current_step !== '1.5') return apiError(422, 'La signature est disponible à l’étape 1.5.');

    const ctx = await buildContractContext(profile);
    const labels = checkboxLabels(ctx);
    const given = new Set(body.checks || []);
    const missing = labels.filter((item) => item.required && !given.has(item.label));
    if (missing.length) return apiError(422, 'Toutes les cases obligatoires doivent être cochées.');
    if (!body.code || !/^\d{6}$/.test(body.code.trim())) return apiError(422, 'Saisissez le code à 6 chiffres.');

    const alreadySigned = await signedTemplateVersions(user.id);
    const toSign: { version: string; title: string }[] = [];
    if (ctx.cadreVersion && !alreadySigned.has(ctx.cadreVersion)) {
      toSign.push({ version: ctx.cadreVersion, title: 'Contrat cadre' });
    }
    if (ctx.annexVersion && ctx.annexBody && !alreadySigned.has(ctx.annexVersion)) {
      toSign.push({ version: ctx.annexVersion, title: ctx.annexTitle || 'Annexe RGPD' });
    }
    if (!toSign.length) {
      // Already fully signed — just advance.
      if (profile.current_step === '1.5') {
        await pocketbaseAdmin.updateRecord('client_profiles', profile.id, { current_step: '2.1' });
        await pocketbaseAdmin.createRecord('step_history', {
          owner: user.id,
          step: '2.1',
          action: 'advance',
          author: user.email,
          comment: 'Contrat déjà signé',
        });
      }
      return json({ ok: true, current_step: '2.1' });
    }

    const challenges = await pocketbaseAdmin.listRecords<{
      id: string; code: string; expires: string; attempts: number; verified: boolean; created: string;
    }>('signature_challenges', {
      filter: `owner = "${user.id}" && verified = false`,
      sort: '-created',
      perPage: 1,
    });
    const challenge = challenges.items[0];
    if (!challenge) return apiError(422, 'Demandez d’abord un code de signature.');
    if (challenge.attempts >= 5) return apiError(422, 'Nombre d’essais dépassé. Demandez un nouveau code.');
    if (Date.now() > new Date(challenge.expires).getTime()) return apiError(422, 'Ce code a expiré. Demandez un nouveau code.');
    if (String(challenge.code) !== body.code.trim()) {
      await pocketbaseAdmin.updateRecord('signature_challenges', challenge.id, {
        attempts: Number(challenge.attempts || 0) + 1,
      });
      return apiError(422, 'Code incorrect.');
    }

    const verifiedAt = new Date().toISOString();
    await pocketbaseAdmin.updateRecord('signature_challenges', challenge.id, { verified: true });

    const demandeExpresse = ctx.retractation && given.has('early_start');
    const signCtx = await buildContractContext(profile, { signedAt: new Date(verifiedAt), demandeExpresse });
    const cadreHtml = interpolateHtml(signCtx.cadreBody, signCtx.fields);

    // Unsigned combined PDF (cadre + annex) for the SHA-256 fingerprint.
    const unsigned = await renderContractPdf(cadreHtml, signCtx.annexTitle, signCtx.annexBody);
    const hash = sha256Hex(unsigned);

    const proof = {
      signerName: signCtx.signerName,
      signerQuality: signCtx.signerQuality,
      signerEmail: signCtx.signerEmail,
      signedAtUtc: verifiedAt,
      ip: clientIp(request),
      userAgent: request.headers.get('user-agent') || '',
      checks: labels.map((item) => item.label),
      frameworkVersion: signCtx.cadreVersion,
      sha256: hash,
      codeSentAt: challenge.created,
      codeVerifiedAt: verifiedAt,
    };
    const finalPdf = await renderContractPdf(cadreHtml, signCtx.annexTitle, signCtx.annexBody, proof);

    // One signature record per signed template version (cadre + annex).
    for (const item of toSign) {
      const fd = new FormData();
      fd.append('owner', user.id);
      fd.append('template_version', item.version);
      fd.append('sha256', hash);
      fd.append('signer_name', signCtx.signerName);
      fd.append('signer_quality', signCtx.signerQuality);
      fd.append('signer_email', signCtx.signerEmail);
      fd.append('signed_at', verifiedAt);
      fd.append('ip', proof.ip);
      fd.append('user_agent', proof.userAgent.slice(0, 400));
      fd.append('checks', JSON.stringify(labels.map((l) => l.label)));
      fd.append('code_sent_at', challenge.created);
      fd.append('code_verified_at', verifiedAt);
      fd.append('admin_email', adminNotifyEmail());
      fd.append('snapshot', JSON.stringify({ version: item.version, title: item.title }));
      fd.append('pdf', new File([Buffer.from(finalPdf)], 'contrat-signe.pdf', { type: 'application/pdf' }));
      await pocketbaseAdmin.createRecord('signatures', fd);
    }

    // Store the combined signed contract in the client's documents.
    try {
      const docFd = new FormData();
      docFd.append('owner', user.id);
      docFd.append('title', `Contrat signé — cadre v${signCtx.cadreVersion} + annexe RGPD`);
      docFd.append('type', 'contract');
      docFd.append('file', new File([Buffer.from(finalPdf)], 'contrat-signe.pdf', { type: 'application/pdf' }));
      await pocketbaseAdmin.createRecord('documents', docFd);
    } catch (err) {
      logger.error('Copie du contrat signé impossible', err instanceof Error ? err.message : String(err));
    }

    await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
      current_step: '2.1',
      retractation_applicable: retractationApplicable(profile),
    });
    await pocketbaseAdmin.createRecord('step_history', {
      owner: user.id,
      step: '2.1',
      action: 'advance',
      author: user.email,
      comment: 'Contrat cadre et annexe RGPD signés',
    });

    return json({ ok: true, current_step: '2.1', sha256: hash });
  }

  return apiError(400, 'Action inconnue.');
});
