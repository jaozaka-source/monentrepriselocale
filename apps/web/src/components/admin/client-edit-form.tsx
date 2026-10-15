import { useState } from 'react';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';

type Profile = RecordModel;

const EDIT_FIELDS = [
  { section: 'Entreprise', fields: [
    { name: 'company_name', label: 'Dénomination' },
    { name: 'trade_name', label: 'Nom commercial' },
    { name: 'legal_form', label: 'Forme juridique' },
    { name: 'siren', label: 'SIREN' },
    { name: 'hq_address', label: 'Adresse du siège', full: true },
    { name: 'hq_siret', label: 'SIRET du siège' },
    { name: 'naf_code', label: 'Code NAF' },
    { name: 'vat_number', label: 'N° TVA' },
    { name: 'share_capital', label: 'Capital social' },
    { name: 'rcs_city', label: 'Ville RCS' },
    { name: 'phone', label: 'Téléphone' },
    { name: 'billing_address', label: 'Adresse de facturation', full: true },
  ]},
  { section: 'Représentant légal', fields: [
    { name: 'rep_civility', label: 'Civilité' },
    { name: 'rep_lastname', label: 'Nom' },
    { name: 'rep_firstname', label: 'Prénom' },
    { name: 'rep_quality', label: 'Qualité' },
    { name: 'rep_email', label: 'E-mail' },
    { name: 'rep_mobile', label: 'Téléphone mobile' },
  ]},
  { section: 'Contact opérationnel', fields: [
    { name: 'op_name', label: 'Nom' },
    { name: 'op_email', label: 'E-mail' },
    { name: 'op_phone', label: 'Téléphone' },
  ]},
  { section: 'Nom de domaine', fields: [
    { name: 'domain_mode', label: 'Mode (existing/create)' },
    { name: 'domain_name', label: 'Nom de domaine' },
    { name: 'domain_holder', label: 'Titulaire' },
  ]},
];

export function ClientEditForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const s of EDIT_FIELDS) for (const f of s.fields) v[f.name] = String((profile as Record<string, unknown>)[f.name] ?? '');
    v.mockup_url = String(profile.mockup_url ?? '');
    v.live_site_url = String(profile.live_site_url ?? '');
    v.internal_notes = String(profile.internal_notes ?? '');
    v.meeting_date = String(profile.meeting_date ?? '').slice(0, 10);
    v.meeting_link = String(profile.meeting_link ?? '');
    v.creation_comment = String(profile.creation_comment ?? '');
    v.qa_comment = String(profile.qa_comment ?? '');
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (name: string, val: string) => setValues((prev) => ({ ...prev, [name]: val }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await pb.collection('client_profiles').update(profile.id, values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch {
      setError("L'enregistrement a échoué.");
    }
    setSaving(false);
  };

  return (
    <div className="espace-card" style={{ marginBottom: 22 }}>
      <h2>Données entreprise et signataire</h2>
      {error ? <div className="espace-alert espace-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {saved ? <div className="espace-alert espace-alert-success" style={{ marginBottom: 12 }}>Modifications enregistrées.</div> : null}

      {EDIT_FIELDS.map((section) => (
        <div key={section.section} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>{section.section}</div>
          <div className="espace-row">
            {section.fields.map((f) => (
              <div key={f.name} className="espace-field" style={f.full ? { gridColumn: '1 / -1' } : undefined}>
                <label>{f.label}</label>
                <input className="espace-input" value={values[f.name] || ''} onChange={(e) => set(f.name, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Pilotage projet</div>
        <div className="espace-row">
          <div className="espace-field">
            <label>Date du rendez-vous (étape 3.1)</label>
            <input type="date" className="espace-input" value={values.meeting_date || ''} onChange={(e) => set('meeting_date', e.target.value)} />
          </div>
          <div className="espace-field">
            <label>Lien de prise de rendez-vous</label>
            <input className="espace-input" value={values.meeting_link || ''} onChange={(e) => set('meeting_link', e.target.value)} placeholder="https://calendly.com/…" />
          </div>
        </div>
        <div className="espace-field" style={{ marginTop: 14 }}>
          <label>Commentaire création (étape 3.3)</label>
          <textarea className="espace-textarea" value={values.creation_comment || ''} onChange={(e) => set('creation_comment', e.target.value)} placeholder="Message affiché au client sur l’écran de création…" />
        </div>
        <div className="espace-field" style={{ marginTop: 14 }}>
          <label>Commentaire contrôle qualité (étape 3.4)</label>
          <textarea className="espace-textarea" value={values.qa_comment || ''} onChange={(e) => set('qa_comment', e.target.value)} placeholder="Message affiché au client sur l’écran de contrôle…" />
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--logo-red)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Maquette & site en ligne</div>
        <div className="espace-row">
          <div className="espace-field">
            <label>URL de la maquette (étape 3.5)</label>
            <input className="espace-input" value={values.mockup_url || ''} onChange={(e) => set('mockup_url', e.target.value)} placeholder="https://…" />
          </div>
          <div className="espace-field">
            <label>URL du site en ligne (étape 3.6 / phase 4)</label>
            <input className="espace-input" value={values.live_site_url || ''} onChange={(e) => set('live_site_url', e.target.value)} placeholder="https://…" />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Notes internes ( invisibles au client)</div>
        <textarea className="espace-textarea" value={values.internal_notes || ''} onChange={(e) => set('internal_notes', e.target.value)} placeholder="Notes privées…" />
      </div>

      <button type="button" className="espace-btn" onClick={save} disabled={saving}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
        Enregistrer les modifications
      </button>
    </div>
  );
}
