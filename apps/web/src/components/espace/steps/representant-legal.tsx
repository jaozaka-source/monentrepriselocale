import { useState } from 'react';
import { Upload } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { updateProfile, type ClientProfile } from '@/lib/client-steps';
import { useStepAdvance } from '@/hooks/use-step-advance';
import { useFormErrors } from '@/hooks/use-form-errors';

type Dirigeant = { nom: string; prenoms: string; qualite: string; label: string };

export function RepresentantLegal({ profile }: { profile: ClientProfile }) {
  const { advance, advancing, error } = useStepAdvance();
  const snapshot = (profile.api_snapshot as { dirigeants?: Dirigeant[] } | null) || null;
  const dirigeants = snapshot?.dirigeants || [];

  const [civility, setCivility] = useState(profile.rep_civility || 'M.');
  const [lastname, setLastname] = useState(profile.rep_lastname || '');
  const [firstname, setFirstname] = useState(profile.rep_firstname || '');
  const [quality, setQuality] = useState(profile.rep_quality || '');
  const [email, setEmail] = useState(profile.rep_email || '');
  const [mobile, setMobile] = useState(profile.rep_mobile || '');
  const [fromList, setFromList] = useState(profile.rep_from_list ?? dirigeants.length > 0);
  const [certified, setCertified] = useState(Boolean(profile.rep_certified));
  const [saving, setSaving] = useState(false);
  const [delegationName, setDelegationName] = useState(profile.rep_delegation_doc ? 'Document déjà déposé' : '');
  const [formError, setFormError] = useState('');
  const { errors, clearError, showErrors, setErrorRef } = useFormErrors<string>();

  // Operational contact mirrors the signatory by default. It only diverges
  // once the user manually edits a given field. We track which op fields
  // have been touched so signatory changes keep propagating to the rest.
  const [opDirty, setOpDirty] = useState<Record<'name' | 'email' | 'phone', boolean>>({
    name: Boolean(profile.op_name && profile.op_name !== [profile.rep_firstname, profile.rep_lastname].filter(Boolean).join(' ')),
    email: Boolean(profile.op_email && profile.op_email !== profile.rep_email),
    phone: Boolean(profile.op_phone && profile.op_phone !== profile.rep_mobile),
  });
  const signatoryName = () => [firstname, lastname].filter(Boolean).join(' ');
  const [opName, setOpName] = useState(profile.op_name || signatoryName());
  const [opEmail, setOpEmail] = useState(profile.op_email || profile.rep_email || '');
  const [opPhone, setOpPhone] = useState(profile.op_phone || profile.rep_mobile || '');

  const markOpDirty = (field: 'name' | 'email' | 'phone') =>
    setOpDirty((d) => (d[field] ? d : { ...d, [field]: true }));

  const onLastname = (v: string) => {
    setLastname(v);
    if (!opDirty.name) setOpName([firstname, v].filter(Boolean).join(' '));
  };
  const onFirstname = (v: string) => {
    setFirstname(v);
    if (!opDirty.name) setOpName([v, lastname].filter(Boolean).join(' '));
  };
  const onEmail = (v: string) => {
    setEmail(v);
    if (!opDirty.email) setOpEmail(v);
  };
  const onMobile = (v: string) => {
    setMobile(v);
    if (!opDirty.phone) setOpPhone(v);
  };

  const pickDirigeant = (label: string) => {
    if (label === '__manual') {
      setFromList(false);
      return;
    }
    const d = dirigeants.find((x) => x.label === label);
    if (d) {
      setFromList(true);
      setLastname(d.nom);
      setFirstname(d.prenoms);
      setQuality(d.qualite);
      // Picking a known dirigeant resets the op contact to mirror them,
      // unless the user had already customised a field.
      if (!opDirty.name) setOpName([d.prenoms, d.nom].filter(Boolean).join(' '));
    }
  };

  const onDelegation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('rep_delegation_doc', file);
    try {
      await pb.collection('client_profiles').update(profile.id, fd);
      setDelegationName(file.name);
    } catch {
      setFormError("Le dépôt de la délégation a échoué.");
    }
  };

  const save = async () => {
    setFormError('');
    const errs: Record<string, string> = {};
    if (!lastname) errs.lastname = 'Ce champ est obligatoire';
    if (!firstname) errs.firstname = 'Ce champ est obligatoire';
    if (!quality) errs.quality = 'Ce champ est obligatoire';
    if (!email) errs.email = 'Ce champ est obligatoire';
    if (!mobile) errs.mobile = 'Ce champ est obligatoire';
    if (!opName) errs.opName = 'Ce champ est obligatoire';
    if (!opEmail) errs.opEmail = 'Ce champ est obligatoire';
    if (!opPhone) errs.opPhone = 'Ce champ est obligatoire';
    if (!fromList && !certified) errs.certified = 'Vous devez certifier être habilité à engager l’entreprise.';
    if (Object.keys(errs).length > 0) {
      showErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        rep_civility: civility,
        rep_lastname: lastname,
        rep_firstname: firstname,
        rep_quality: quality,
        rep_email: email,
        rep_mobile: mobile,
        rep_from_list: fromList,
        rep_certified: certified,
        op_name: opName,
        op_email: opEmail,
        op_phone: opPhone,
      } as Partial<ClientProfile>);
      await advance();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'L’enregistrement a échoué.');
    }
    setSaving(false);
  };

  return (
    <>
      {Object.keys(errors).length > 0 ? (
        <div className="espace-form-banner">Merci de compléter les champs en rouge</div>
      ) : null}
      {dirigeants.length > 0 ? (
        <div className="espace-card">
          <h2>Choisir le signataire</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Sélectionnez un dirigeant issu de votre SIREN, ou saisissez manuellement un autre signataire.
          </p>
          <div className="espace-field">
            <label>Dirigeants connus</label>
            <select className="espace-select" defaultValue="" onChange={(e) => pickDirigeant(e.target.value)}>
              <option value="">— Choisir un dirigeant —</option>
              {dirigeants.map((d) => (
                <option key={d.label} value={d.label}>{d.label} ({d.qualite})</option>
              ))}
              <option value="__manual">Autre personne (saisie manuelle)</option>
            </select>
          </div>
        </div>
      ) : null}

      <div className="espace-card">
        <h2>Informations du signataire</h2>
        <div className="espace-grid">
          <div className="espace-field">
            <label>Civilité</label>
            <select className="espace-select" value={civility} onChange={(e) => setCivility(e.target.value)}>
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
            </select>
          </div>
          <div className="espace-field">
            <label>Nom <span className="espace-required">*</span></label>
            <input ref={setErrorRef('lastname')} className={`espace-input ${errors.lastname ? 'is-error' : ''}`} aria-invalid={!!errors.lastname} value={lastname} onChange={(e) => { onLastname(e.target.value); clearError('lastname'); }} />
            {errors.lastname ? <span className="espace-field-error">{errors.lastname}</span> : null}
          </div>
          <div className="espace-field">
            <label>Prénom <span className="espace-required">*</span></label>
            <input ref={setErrorRef('firstname')} className={`espace-input ${errors.firstname ? 'is-error' : ''}`} aria-invalid={!!errors.firstname} value={firstname} onChange={(e) => { onFirstname(e.target.value); clearError('firstname'); }} />
            {errors.firstname ? <span className="espace-field-error">{errors.firstname}</span> : null}
          </div>
          <div className="espace-field">
            <label>Qualité <span className="espace-required">*</span></label>
            <input ref={setErrorRef('quality')} className={`espace-input ${errors.quality ? 'is-error' : ''}`} aria-invalid={!!errors.quality} value={quality} onChange={(e) => { setQuality(e.target.value); clearError('quality'); }} placeholder="Gérant, président…" />
            {errors.quality ? <span className="espace-field-error">{errors.quality}</span> : null}
          </div>
          <div className="espace-field">
            <label>E-mail <span className="espace-required">*</span></label>
            <input ref={setErrorRef('email')} className={`espace-input ${errors.email ? 'is-error' : ''}`} aria-invalid={!!errors.email} type="email" value={email} onChange={(e) => { onEmail(e.target.value); clearError('email'); }} />
            {errors.email ? <span className="espace-field-error">{errors.email}</span> : null}
          </div>
          <div className="espace-field">
            <label>Téléphone mobile <span className="espace-required">*</span></label>
            <input ref={setErrorRef('mobile')} className={`espace-input ${errors.mobile ? 'is-error' : ''}`} aria-invalid={!!errors.mobile} type="tel" value={mobile} onChange={(e) => { onMobile(e.target.value); clearError('mobile'); }} placeholder="06 12 34 56 78" />
            {errors.mobile ? <span className="espace-field-error">{errors.mobile}</span> : null}
          </div>
        </div>
        <h2 style={{ marginTop: 28 }}>Contact opérationnel</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 14px' }}>Identique au signataire par défaut. Modifiez un champ si une autre personne suit le projet.</p>
        <div className="espace-grid">
          <div className="espace-field">
            <label>Nom <span className="espace-required">*</span></label>
            <input ref={setErrorRef('opName')} className={`espace-input ${errors.opName ? 'is-error' : ''}`} aria-invalid={!!errors.opName} value={opName} onChange={(e) => { setOpName(e.target.value); markOpDirty('name'); clearError('opName'); }} />
            {errors.opName ? <span className="espace-field-error">{errors.opName}</span> : null}
          </div>
          <div className="espace-field">
            <label>E-mail <span className="espace-required">*</span></label>
            <input ref={setErrorRef('opEmail')} className={`espace-input ${errors.opEmail ? 'is-error' : ''}`} aria-invalid={!!errors.opEmail} type="email" value={opEmail} onChange={(e) => { setOpEmail(e.target.value); markOpDirty('email'); clearError('opEmail'); }} />
            {errors.opEmail ? <span className="espace-field-error">{errors.opEmail}</span> : null}
          </div>
          <div className="espace-field">
            <label>Téléphone <span className="espace-required">*</span></label>
            <input ref={setErrorRef('opPhone')} className={`espace-input ${errors.opPhone ? 'is-error' : ''}`} aria-invalid={!!errors.opPhone} type="tel" value={opPhone} onChange={(e) => { setOpPhone(e.target.value); markOpDirty('phone'); clearError('opPhone'); }} />
            {errors.opPhone ? <span className="espace-field-error">{errors.opPhone}</span> : null}
          </div>
        </div>

        {!fromList ? (
          <>
            <label className="espace-check" style={{ marginTop: 18 }}>
              <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} />
              <span>Je certifie être dûment habilité(e) à engager l’entreprise.</span>
            </label>
            <div className="espace-field" style={{ marginTop: 14 }}>
              <label>Délégation de pouvoir (PDF, optionnel)</label>
              <label className="espace-btn-secondary espace-btn" style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto' }}>
                <Upload size={16} /> {delegationName || 'Déposer un fichier'}
                <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={onDelegation} />
              </label>
            </div>
          </>
        ) : null}
      </div>

      {formError ? <div className="espace-alert espace-alert-error" style={{ marginTop: 16 }}>{formError}</div> : null}
      {error ? <div className="espace-alert espace-alert-error" style={{ marginTop: 16 }}>{error}</div> : null}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="espace-btn" onClick={save} disabled={advancing || saving}>
          {advancing || saving ? 'Enregistrement…' : 'Enregistrer et continuer'}
        </button>
      </div>
    </>
  );
}
