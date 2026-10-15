import { useEffect, useState } from 'react';
import { Loader2, Save, Send, Upload, FileText, X, CheckCircle2 } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { getOrCreateContent, type ClientContent } from '@/lib/client-steps';

const MAX_FILES = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const FIELDS: { name: keyof ClientContent; label: string; placeholder: string; area?: boolean; hint?: string }[] = [
  { name: 'presentation', label: 'Présentation du commerce', placeholder: 'Décrivez votre activité, votre histoire, ce qui vous distingue…', area: true },
  { name: 'services', label: 'Services et tarifs', placeholder: 'Listez vos prestations et leurs prix…', area: true },
  { name: 'hours', label: 'Horaires d’ouverture', placeholder: 'Lun–Ven : 9h–19h, Sam : 10h–18h…', area: true },
  { name: 'address', label: 'Adresse', placeholder: '12 rue de la Paix, 75002 Paris' },
  { name: 'website', label: 'Site web actuel (si existant)', placeholder: 'https://…' },
  { name: 'social_facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
  { name: 'social_instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { name: 'social_linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/…' },
  { name: 'social_other', label: 'Autre réseau / lien', placeholder: 'TikTok, YouTube, etc.' },
];

export function VosContenus() {
  const [content, setContent] = useState<ClientContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = async () => {
    try {
      const c = await getOrCreateContent();
      setContent(c);
    } catch {
      setError('Le chargement de vos contenus a échoué.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (name: keyof ClientContent, val: string) => {
    setContent((prev) => (prev ? { ...prev, [name]: val } : prev));
  };

  const save = async () => {
    if (!content) return;
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const patch: Record<string, string> = {};
      for (const f of FIELDS) patch[f.name] = String(content[f.name] ?? '');
      const rec = await pb.collection('client_contents').update(content.id, patch);
      setContent(rec as unknown as ClientContent);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("L'enregistrement a échoué.");
    }
    setSaving(false);
  };

  const submit = async () => {
    if (!content) return;
    setSubmitting(true);
    setError('');
    setInfo('');
    try {
      const now = new Date().toISOString();
      const rec = await pb.collection('client_contents').update(content.id, {
        submitted: true,
        submitted_at: now,
      });
      setContent(rec as unknown as ClientContent);
      setInfo('Vos contenus ont été transmis à notre équipe. Vous serez notifié(e) de la suite.');
    } catch {
      setError("La transmission a échoué.");
    }
    setSubmitting(false);
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || !content) return;
    const currentCount = content.files?.length ?? 0;
    const incoming = Array.from(fileList);
    if (currentCount + incoming.length > MAX_FILES) {
      setError(`Vous ne pouvez déposer que ${MAX_FILES} fichiers au maximum.`);
      e.target.value = '';
      return;
    }
    for (const f of incoming) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`Le fichier « ${f.name} » dépasse 10 Mo.`);
        e.target.value = '';
        return;
      }
    }
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of incoming) fd.append('files', f);
      const rec = await pb.collection('client_contents').update(content.id, fd);
      setContent(rec as unknown as ClientContent);
    } catch {
      setError("Le dépôt des fichiers a échoué.");
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeFile = async (filename: string) => {
    if (!content?.files) return;
    setUploading(true);
    setError('');
    try {
      const remaining = content.files.filter((f) => f !== filename);
      const rec = await pb.collection('client_contents').update(content.id, { files: remaining });
      setContent(rec as unknown as ClientContent);
    } catch {
      setError("La suppression a échoué.");
    }
    setUploading(false);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  const submitted = Boolean(content?.submitted);

  return (
    <>
      {submitted ? (
        <div className="espace-alert espace-alert-success" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
          <CheckCircle2 size={20} style={{ flex: 'none', marginTop: 1 }} />
          <div>
            <strong>Contenus transmis.</strong>
            <p style={{ margin: '6px 0 0', fontWeight: 500 }}>Notre équipe a bien reçu vos contenus et fichiers. Vous serez notifié(e) à chaque avancement.</p>
          </div>
        </div>
      ) : null}

      <div className="espace-card" style={{ marginBottom: 20 }}>
        <h2>Présentez votre commerce</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 22px' }}>
          Renseignez les informations qui apparaîtront sur votre site. Vous pouvez sauvegarder et
          revenir plus tard ; cliquez sur « J’ai tout envoyé » une fois terminé.
        </p>
        <div className="espace-grid" style={{ gridTemplateColumns: '1fr' }}>
          {FIELDS.map((f) => (
            <div key={f.name} className="espace-field">
              <label>{f.label}</label>
              {f.area ? (
                <textarea
                  className="espace-textarea"
                  value={String(content?.[f.name] ?? '')}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  disabled={submitted}
                />
              ) : (
                <input
                  className="espace-input"
                  value={String(content?.[f.name] ?? '')}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  disabled={submitted}
                />
              )}
            </div>
          ))}
        </div>
        {error ? <div className="espace-alert espace-alert-error" style={{ marginTop: 14 }}>{error}</div> : null}
        {!submitted ? (
          <button type="button" className="espace-btn espace-btn-secondary" onClick={save} disabled={saving} style={{ marginTop: 18 }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
            {saving ? 'Enregistrement…' : saved ? 'Enregistré' : 'Sauvegarder'}
          </button>
        ) : null}
      </div>

      <div className="espace-card" style={{ marginBottom: 20 }}>
        <h2>Fichiers (logo, photos)</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 14px' }}>
          Jusqu’à {MAX_FILES} fichiers, 10 Mo chacun. Formats acceptés : images (JPG, PNG, WebP, SVG) et PDF.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <label className="espace-btn espace-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto' }}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Ajouter des fichiers
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf" style={{ display: 'none' }} onChange={onFiles} disabled={uploading || submitted} />
          </label>
          <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            {content?.files?.length ?? 0} / {MAX_FILES} fichiers
          </span>
        </div>

        {content?.files?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
            {content.files.map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid #e3eaf0', borderRadius: 8 }}>
                <FileText size={18} style={{ color: 'var(--blue)', flex: 'none' }} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                {!submitted ? (
                  <button type="button" onClick={() => removeFile(f)} style={{ background: 'none', border: 0, color: 'var(--logo-red)', display: 'flex' }} aria-label={`Supprimer ${f}`}>
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!submitted ? (
        <div className="espace-card">
          <h2>Transmettre à notre équipe</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
            Une fois vos informations et fichiers complets, cliquez ci-dessous. Notre équipe sera
            notifiée et pourra démarrer la création de votre site.
          </p>
          {info ? <div className="espace-alert espace-alert-success" style={{ marginBottom: 14 }}>{info}</div> : null}
          <button type="button" className="espace-btn" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? 'Envoi…' : 'J’ai tout envoyé'}
          </button>
        </div>
      ) : null}
    </>
  );
}
