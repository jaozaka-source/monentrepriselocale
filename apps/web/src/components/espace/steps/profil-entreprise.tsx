import { useState } from 'react';
import { Search, Upload, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { updateProfile, type ClientProfile } from '@/lib/client-steps';
import { useStepAdvance } from '@/hooks/use-step-advance';
import { isSirenValid, computeVatNumber, sanitizeSiren } from '@/lib/siren';
import { COMMON_LEGAL_FORMS, LEGAL_FORMS, isIndividualForm, legalFormLabel, requiresShareCapital } from '@/data/legal-forms';
import { useFormErrors } from '@/hooks/use-form-errors';

type Fields = {
  siren: string;
  company_name: string;
  hq_address: string;
  hq_siret: string;
  naf_code: string;
  creation_date: string;
  admin_state: string;
  vat_number: string;
  share_capital: string;
  rcs_city: string;
  billing_address: string;
  phone: string;
  legal_form: string;
  legal_form_code: string;
  domain_name: string;
  domain_holder: string;
};

export function ProfilEntreprise({ profile }: { profile: ClientProfile }) {
  const { advance, advancing, error } = useStepAdvance();
  const [fields, setFields] = useState<Fields>({
    siren: profile.siren || '',
    company_name: profile.company_name || '',
    hq_address: profile.hq_address || '',
    hq_siret: profile.hq_siret || '',
    naf_code: profile.naf_code || '',
    creation_date: profile.creation_date || '',
    admin_state: profile.admin_state || '',
    vat_number: profile.vat_number || '',
    share_capital: profile.share_capital || '',
    rcs_city: profile.rcs_city || '',
    billing_address: profile.billing_address || '',
    phone: profile.phone || '',
    legal_form: profile.legal_form || '',
    legal_form_code: profile.legal_form_code || '',
    domain_name: profile.domain_name || '',
    domain_holder: profile.domain_holder || '',
  });
  const [vatSubject, setVatSubject] = useState<boolean | null>(profile.vat_subject ?? null);
  const [employees, setEmployees] = useState(profile.employee_count || '');
  const [mainActivity, setMainActivity] = useState<boolean | null>(profile.website_main_activity ?? null);
  const [domainMode, setDomainMode] = useState(profile.domain_mode || '');
  const [apiSnapshot, setApiSnapshot] = useState<Record<string, unknown> | null>(profile.api_snapshot || null);
  const [companyCeased, setCompanyCeased] = useState(Boolean(profile.company_ceased));
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [saving, setSaving] = useState(false);
  const [kbisName, setKbisName] = useState(profile.kbis_doc ? 'Document déjà déposé' : '');
  const { errors, clearError, showErrors, setErrorRef } = useFormErrors<string>();

  const set = (k: keyof Fields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const lookup = async () => {
    setLookupError('');
    const siren = sanitizeSiren(fields.siren);
    if (!isSirenValid(siren)) {
      setLookupError('SIREN invalide : 9 chiffres avec clé de contrôle correcte.');
      return;
    }
    setLooking(true);
    try {
      const res = await fetch('/api/siren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siren }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || 'La recherche a échoué.');
        setLooking(false);
        return;
      }
      if (!data.available) {
        setLookupError(data.message || 'Entreprise introuvable. Vous pouvez saisir les informations manuellement.');
        setLooking(false);
        return;
      }
      setFields((f) => ({
        ...f,
        siren,
        company_name: data.company_name || f.company_name,
        hq_address: data.hq_address || f.hq_address,
        hq_siret: data.hq_siret || f.hq_siret,
        naf_code: data.naf_code || f.naf_code,
        creation_date: data.creation_date || f.creation_date,
        admin_state: data.admin_state || f.admin_state,
        vat_number: data.vat_number || computeVatNumber(siren),
        legal_form_code: data.legal_form_code || f.legal_form_code,
        legal_form: data.legal_form || f.legal_form,
        rcs_city: isIndividualForm(data.legal_form_code || '', data.legal_form || '') ? 'RNE' : f.rcs_city,
      }));
      setApiSnapshot(data);
      setCompanyCeased(Boolean(data.company_ceased));
    } catch {
      setLookupError('La recherche a échoué. Vous pouvez saisir les informations manuellement.');
    }
    setLooking(false);
  };

  const onKbis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('kbis_doc', file);
    try {
      await pb.collection('client_profiles').update(profile.id, fd);
      setKbisName(file.name);
    } catch {
      setLookupError("Le dépôt de l'extrait Kbis a échoué.");
    }
  };

  const save = async () => {
    setSaving(true);
    setLookupError('');
    const errs: Record<string, string> = {};
    if (!fields.company_name.trim()) errs.company_name = 'Ce champ est obligatoire';
    if (!fields.hq_address.trim()) errs.hq_address = 'Ce champ est obligatoire';
    if (!fields.hq_siret.trim()) errs.hq_siret = 'Ce champ est obligatoire';
    if (!fields.phone.trim()) errs.phone = 'Ce champ est obligatoire';
    if (!fields.legal_form_code) errs.legal_form_code = 'Ce champ est obligatoire';
    if (!employees) errs.employees = 'Ce champ est obligatoire';
    if (mainActivity === null) errs.mainActivity = 'Ce champ est obligatoire';
    if (vatSubject === null) errs.vatSubject = 'Ce champ est obligatoire';
    if (vatSubject && !fields.vat_number.trim()) errs.vat_number = 'Ce champ est obligatoire';
    if (requiresShareCapital(fields.legal_form_code, fields.legal_form) && !fields.share_capital.trim()) errs.share_capital = 'Ce champ est obligatoire';
    if (!fields.rcs_city.trim()) errs.rcs_city = 'Ce champ est obligatoire';
    // Domain is now optional.
    if (Object.keys(errs).length > 0) {
      showErrors(errs);
      setSaving(false);
      return;
    }
    try {
      await updateProfile({
        ...fields,
        vat_subject: vatSubject,
        employee_count: employees,
        website_main_activity: mainActivity,
        domain_mode: domainMode,
        api_snapshot: apiSnapshot,
        company_ceased: companyCeased,
      } as Partial<ClientProfile>);
      await advance();
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'L’enregistrement a échoué.');
    }
    setSaving(false);
  };

  return (
    <>
      {Object.keys(errors).length > 0 ? (
        <div className="espace-form-banner">Merci de compléter les champs en rouge</div>
      ) : null}
      <div className="espace-card">
        <h2>Recherche par SIREN</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
          Saisissez votre numéro SIREN (9 chiffres). Nous récupérons automatiquement les informations légales de votre entreprise.
        </p>
        <div className="espace-row" style={{ alignItems: 'flex-end' }}>
          <div className="espace-field">
            <label htmlFor="siren">Numéro SIREN</label>
            <input id="siren" className="espace-input" inputMode="numeric" maxLength={9} value={fields.siren}
              onChange={(e) => set('siren', sanitizeSiren(e.target.value))} placeholder="123 456 789" />
          </div>
          <button type="button" className="espace-btn-secondary espace-btn" onClick={lookup} disabled={looking}>
            {looking ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Rechercher
          </button>
        </div>
        {lookupError ? <div className="espace-alert espace-alert-error" style={{ marginTop: 14 }}>{lookupError}</div> : null}
      </div>

      {companyCeased ? (
        <div className="espace-alert espace-alert-error" style={{ marginTop: 20 }}>
          Cette entreprise est en état de cessation. La création du site ne peut pas continuer. Contactez-nous à contact@monentrepriselocale.fr.
        </div>
      ) : null}

      <div className="espace-card" style={{ opacity: companyCeased ? 0.6 : 1, pointerEvents: companyCeased ? 'none' : 'auto' }}>
        <h2>Informations de l’entreprise</h2>
        <div className="espace-grid">
          <div className="espace-field">
            <label>Dénomination <span className="espace-required">*</span></label>
            <input ref={setErrorRef('company_name')} className={`espace-input ${errors.company_name ? 'is-error' : ''}`} aria-invalid={!!errors.company_name} value={fields.company_name} onChange={(e) => { set('company_name', e.target.value); clearError('company_name'); }} />
            {errors.company_name ? <span className="espace-field-error">{errors.company_name}</span> : null}
          </div>
          <div className="espace-field">
            <label>Adresse du siège <span className="espace-required">*</span></label>
            <input ref={setErrorRef('hq_address')} className={`espace-input ${errors.hq_address ? 'is-error' : ''}`} aria-invalid={!!errors.hq_address} value={fields.hq_address} onChange={(e) => { set('hq_address', e.target.value); clearError('hq_address'); }} />
            {errors.hq_address ? <span className="espace-field-error">{errors.hq_address}</span> : null}
          </div>
          <div className="espace-field">
            <label>SIRET du siège <span className="espace-required">*</span></label>
            <input ref={setErrorRef('hq_siret')} className={`espace-input ${errors.hq_siret ? 'is-error' : ''}`} aria-invalid={!!errors.hq_siret} value={fields.hq_siret} onChange={(e) => { set('hq_siret', e.target.value); clearError('hq_siret'); }} />
            {errors.hq_siret ? <span className="espace-field-error">{errors.hq_siret}</span> : null}
          </div>
          <div className="espace-field">
            <label>Code NAF</label>
            <input className="espace-input" value={fields.naf_code} onChange={(e) => set('naf_code', e.target.value)} />
          </div>
          <div className="espace-field">
            <label>Date de création</label>
            <input className="espace-input" value={fields.creation_date} onChange={(e) => set('creation_date', e.target.value)} />
          </div>
          <div className="espace-field">
            <label>État administratif</label>
            <input className="espace-input" value={fields.admin_state} disabled onChange={(e) => set('admin_state', e.target.value)} />
          </div>
          <div className="espace-field">
            <label>Forme juridique <span className="espace-required">*</span></label>
            <select ref={setErrorRef('legal_form_code')} className={`espace-select ${errors.legal_form_code ? 'is-error' : ''}`} aria-invalid={!!errors.legal_form_code} value={fields.legal_form_code} onChange={(e) => {
              const code = e.target.value;
              const label = legalFormLabel(code);
              set('legal_form_code', code);
              set('legal_form', label);
              if (isIndividualForm(code, label)) set('rcs_city', 'RNE');
              clearError('legal_form_code');
            }}>
              <option value="">— Choisir —</option>
              {fields.legal_form_code && !COMMON_LEGAL_FORMS.includes(fields.legal_form_code as typeof COMMON_LEGAL_FORMS[number]) ? (
                <option value={fields.legal_form_code}>{fields.legal_form || fields.legal_form_code}</option>
              ) : null}
              {COMMON_LEGAL_FORMS.map((code) => (
                <option key={code} value={code}>{LEGAL_FORMS[code]}</option>
              ))}
            </select>
            {fields.legal_form ? <span className="hint">Code {fields.legal_form_code} — {fields.legal_form}</span> : null}
          </div>
          {requiresShareCapital(fields.legal_form_code, fields.legal_form) ? (
            <div className="espace-field">
              <label>Capital social <span className="espace-required">*</span></label>
              <input ref={setErrorRef('share_capital')} className={`espace-input ${errors.share_capital ? 'is-error' : ''}`} aria-invalid={!!errors.share_capital} value={fields.share_capital} onChange={(e) => { set('share_capital', e.target.value); clearError('share_capital'); }} placeholder="10 000 EUR" />
              {errors.share_capital ? <span className="espace-field-error">{errors.share_capital}</span> : null}
            </div>
          ) : null}
          <div className="espace-field">
            <label>{isIndividualForm(fields.legal_form_code, fields.legal_form) ? 'Lieu d’immatriculation' : 'Ville du RCS'}</label>
            <input ref={setErrorRef('rcs_city')} className={`espace-input ${errors.rcs_city ? 'is-error' : ''}`} aria-invalid={!!errors.rcs_city} value={fields.rcs_city} onChange={(e) => { set('rcs_city', e.target.value); clearError('rcs_city'); }} placeholder={isIndividualForm(fields.legal_form_code, fields.legal_form) ? 'RNE' : 'Paris'} />
            {errors.rcs_city ? <span className="espace-field-error">{errors.rcs_city}</span> : null}
            {isIndividualForm(fields.legal_form_code, fields.legal_form) ? <span className="hint">Artisans et entrepreneurs individuels : RNE</span> : null}
          </div>
          <div className="espace-field">
            <label>Assujetti à la TVA <span className="espace-required">*</span></label>
            <select ref={setErrorRef('vatSubject')} className={`espace-select ${errors.vatSubject ? 'is-error' : ''}`} aria-invalid={!!errors.vatSubject} value={vatSubject === null ? '' : vatSubject ? 'yes' : 'no'} onChange={(e) => {
              const yes = e.target.value === 'yes';
              setVatSubject(e.target.value === '' ? null : yes);
              if (yes && !fields.vat_number) set('vat_number', computeVatNumber(fields.siren));
              clearError('vatSubject');
            }}>
              <option value="">— Choisir —</option>
              <option value="yes">Oui</option>
              <option value="no">Non (franchise en base)</option>
            </select>
          </div>
          {vatSubject ? (
            <div className="espace-field">
              <label>N° TVA intracommunautaire</label>
              <input className="espace-input" value={fields.vat_number} onChange={(e) => set('vat_number', e.target.value)} />
              <span className="hint">Calculé automatiquement, modifiable</span>
            </div>
          ) : null}
          <div className="espace-field">
            <label>Nombre de salariés <span className="espace-required">*</span></label>
            <select ref={setErrorRef('employees')} className={`espace-select ${errors.employees ? 'is-error' : ''}`} aria-invalid={!!errors.employees} value={employees} onChange={(e) => { setEmployees(e.target.value); clearError('employees'); }}>
              <option value="">— Choisir —</option>
              <option value="0">0</option>
              <option value="1-5">1 à 5</option>
              <option value="6+">Plus de 5</option>
            </select>
            {errors.employees ? <span className="espace-field-error">{errors.employees}</span> : null}
          </div>
          <div className="espace-field">
            <label>La création d’un site web relève-t-elle de votre activité principale ? <span className="espace-required">*</span></label>
            <select ref={setErrorRef('mainActivity')} className={`espace-select ${errors.mainActivity ? 'is-error' : ''}`} aria-invalid={!!errors.mainActivity} value={mainActivity === null ? '' : mainActivity ? 'yes' : 'no'} onChange={(e) => { setMainActivity(e.target.value === '' ? null : e.target.value === 'yes'); clearError('mainActivity'); }}>
              <option value="">— Choisir —</option>
              <option value="yes">Oui</option>
              <option value="no">Non</option>
            </select>
            {errors.mainActivity ? <span className="espace-field-error">{errors.mainActivity}</span> : null}
          </div>
          <div className="espace-field">
            <label>Nom de domaine</label>
            <select className="espace-select" value={domainMode} onChange={(e) => setDomainMode(e.target.value)}>
              <option value="">— Choisir —</option>
              <option value="existing">J’en ai déjà un</option>
              <option value="create">À créer</option>
            </select>
          </div>
          {domainMode ? (
            <div className="espace-field">
              <label>{domainMode === 'existing' ? 'Domaine actuel' : 'Domaine souhaité'}</label>
              <input className="espace-input" value={fields.domain_name} onChange={(e) => set('domain_name', e.target.value)} placeholder="exemple.fr" />
            </div>
          ) : null}
          {domainMode === 'existing' ? (
            <div className="espace-field">
              <label>Qui détient le domaine ?</label>
              <input className="espace-input" value={fields.domain_holder} onChange={(e) => set('domain_holder', e.target.value)} placeholder="Le client, l’agence actuelle…" />
            </div>
          ) : null}
          <div className="espace-field">
            <label>Adresse de facturation <span className="hint">(si différente)</span></label>
            <input className="espace-input" value={fields.billing_address} onChange={(e) => set('billing_address', e.target.value)} />
          </div>
          <div className="espace-field">
            <label>Téléphone <span className="espace-required">*</span></label>
            <input ref={setErrorRef('phone')} className={`espace-input ${errors.phone ? 'is-error' : ''}`} aria-invalid={!!errors.phone} type="tel" value={fields.phone} onChange={(e) => { set('phone', e.target.value); clearError('phone'); }} placeholder="01 23 45 67 89" />
            {errors.phone ? <span className="espace-field-error">{errors.phone}</span> : null}
          </div>
        </div>

        <div className="espace-field" style={{ marginTop: 18 }}>
          <label>Extrait Kbis (PDF, optionnel)</label>
          <label className="espace-btn-secondary espace-btn" style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto' }}>
            <Upload size={16} /> {kbisName || 'Déposer un fichier'}
            <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={onKbis} />
          </label>
        </div>
      </div>

      {error ? <div className="espace-alert espace-alert-error" style={{ marginTop: 16 }}>{error}</div> : null}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="espace-btn" onClick={save} disabled={advancing || saving || companyCeased}>
          {advancing || saving ? 'Enregistrement…' : 'Enregistrer et continuer'}
        </button>
      </div>
    </>
  );
}
