import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PROVIDER } from '@/data/provider';
import { renderHtmlInto, renderTextInto, PAGE_W, PAGE_H } from '@/lib/html-pdf.server';

export type SignatureProof = {
  signerName: string;
  signerQuality: string;
  signerEmail: string;
  signedAtUtc: string;
  ip: string;
  userAgent: string;
  checks: string[];
  frameworkVersion: string;
  sha256: string;
  codeSentAt: string;
  codeVerifiedAt: string;
};

function pdfSafe(value: string): string {
  return (value || '')
    .replace(/€/g, ' EUR')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x0A\x0D\x20-\xFF]/g, ' ');
}

/**
 * Renders the contract: cadre (HTML body) + RGPD annex (text body), with an
 * optional signature certificate page appended at the end.
 *
 * `cadreHtml` is the already-interpolated HTML of the cadre template.
 * `annexBody` is the RGPD annex body (plain text or HTML).
 */
export async function renderContractPdf(
  cadreHtml: string,
  annexTitle: string,
  annexBody: string,
  proof?: SignatureProof,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  // 1) Cadre — rendered as HTML.
  await renderHtmlInto(doc, cadreHtml);

  // 2) RGPD annex — rendered as text or HTML (starts on a new page).
  if (annexBody.trim().startsWith('<')) {
    await renderHtmlInto(doc, annexBody);
  } else {
    await renderTextInto(doc, annexBody, annexTitle);
  }

  // 3) Signature certificate page.
  if (proof) {
    await renderCertificate(doc, proof);
  }

  doc.setTitle(`Contrat ${proof?.signerName || 'client'}`);
  doc.setAuthor(PROVIDER.name);
  return doc.save();
}

/** Renders only the cadre (HTML) — used for the unsigned hash and the framework copy. */
export async function renderCadrePdf(cadreHtml: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  await renderHtmlInto(doc, cadreHtml);
  doc.setTitle('Contrat cadre');
  doc.setAuthor(PROVIDER.name);
  return doc.save();
}

async function renderCertificate(doc: PDFDocument, proof: SignatureProof) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const M = 48;
  let y = PAGE_H - M;
  const draw = (text: string, size: number, face: typeof font, gap = 6) => {
    if (y < M + 16) return;
    page.drawText(pdfSafe(text), { x: M, y, size, font: face, color: rgb(0.1, 0.16, 0.24) });
    y -= size + gap;
  };
  draw('Certificat de signature électronique', 14, bold, 12);
  draw(`Signataire : ${proof.signerName}`, 10, font);
  draw(`Qualité : ${proof.signerQuality}`, 10, font);
  draw(`E-mail : ${proof.signerEmail}`, 10, font);
  draw(`Date et heure UTC de signature : ${proof.signedAtUtc}`, 10, font);
  draw(`Adresse IP : ${proof.ip || 'non disponible'}`, 10, font);
  draw(`Navigateur : ${proof.userAgent || 'non disponible'}`, 10, font);
  draw(`Contrat cadre version : ${proof.frameworkVersion}`, 10, font);
  draw(`Empreinte SHA-256 du document (avant ce certificat) : ${proof.sha256}`, 9, font);
  draw(`Code envoyé le (UTC) : ${proof.codeSentAt}`, 10, font);
  draw(`Code validé le (UTC) : ${proof.codeVerifiedAt}`, 10, font, 10);
  draw('Cases cochées, libellé exact :', 10, bold, 6);
  for (const label of proof.checks) draw(`- ${label}`, 9, font, 4);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
