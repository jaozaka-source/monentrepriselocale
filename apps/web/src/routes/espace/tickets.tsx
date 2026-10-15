import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Route } from './+types/tickets';
import { seo } from '@/lib/seo';
import { Loader2, Plus, ChevronRight, Image as ImageIcon } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { useClientData } from '@/components/espace/client-data-context';
import { isInPhase4 } from '@/data/steps';
import { useNavigate } from 'react-router';
import { useFormErrors } from '@/hooks/use-form-errors';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Mes tickets — Espace client Mon Entreprise Locale',
    description: 'Signalez un incident sur votre site en ligne.',
    noindex: true,
  });
}

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  category: string;
  priority: string;
  created: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  site_inaccessible: 'Site inaccessible',
  display_error: 'Erreur d’affichage',
  content_modification: 'Modification de contenu',
  question: 'Question',
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  blocking: { label: 'Bloquant', color: 'var(--logo-red)' },
  annoying: { label: 'Gênant', color: '#b8860b' },
  minor: { label: 'Mineur', color: 'var(--ink-muted)' },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Ouvert', cls: 'espace-alert-info' },
  in_progress: { label: 'En cours', cls: 'espace-alert-info' },
  resolved: { label: 'Résolu', cls: 'espace-alert-success' },
  closed: { label: 'Fermé', cls: 'espace-alert-error' },
};

export default function Tickets() {
  const { profile, loading } = useClientData();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('site_inaccessible');
  const [priority, setPriority] = useState('annoying');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const { errors, clearError, showErrors, setErrorRef } = useFormErrors<string>();

  useEffect(() => {
    if (!loading && profile && !isInPhase4(profile.current_step)) {
      navigate('/espace');
    }
  }, [loading, profile, navigate]);

  const load = async () => {
    const userId = pb.authStore.record?.id;
    if (!userId) return;
    try {
      const records = await pb.collection('tickets').getFullList({ filter: `owner = "${userId}"`, sort: '-created', requestKey: null });
      setTickets(records as unknown as Ticket[]);
    } catch {
      setTickets([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (profile && isInPhase4(profile.current_step)) load();
    else setListLoading(false);
  }, [profile]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errs: Record<string, string> = {};
    if (!subject.trim()) errs.subject = 'Ce champ est obligatoire';
    if (!message.trim()) errs.message = 'Ce champ est obligatoire';
    if (Object.keys(errs).length > 0) {
      showErrors(errs);
      return;
    }
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('subject', subject.trim());
      fd.append('category', category);
      fd.append('priority', priority);
      fd.append('message', message.trim());
      fd.append('status', 'open');
      fd.append('owner', pb.authStore.record!.id);
      if (screenshot) fd.append('screenshot', screenshot);
      await pb.collection('tickets').create(fd);
      setSubject('');
      setMessage('');
      setScreenshot(null);
      await load();
    } catch {
      setError('La création du ticket a échoué.');
    }
    setCreating(false);
  };

  if (loading || (profile && !isInPhase4(profile.current_step))) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  return (
    <>
      <div className="espace-page-head">
        <h1>Mes tickets</h1>
        <p>Votre site est en ligne. Signalez ici tout incident ou demande d’intervention technique.</p>
      </div>

      <div className="espace-card">
        <h2>Nouveau ticket</h2>
        {Object.keys(errors).length > 0 ? (
          <div className="espace-form-banner">Merci de compléter les champs en rouge</div>
        ) : null}
        <form className="espace-grid" onSubmit={create}>
          <div className="espace-field" style={{ gridColumn: '1 / -1' }}>
            <label>Titre <span className="espace-required">*</span></label>
            <input ref={setErrorRef('subject')} className={`espace-input ${errors.subject ? 'is-error' : ''}`} aria-invalid={!!errors.subject} value={subject} onChange={(e) => { setSubject(e.target.value); clearError('subject'); }} placeholder="Mon site ne s’affiche plus" />
            {errors.subject ? <span className="espace-field-error">{errors.subject}</span> : null}
          </div>
          <div className="espace-field">
            <label>Catégorie <span className="espace-required">*</span></label>
            <select className="espace-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="espace-field">
            <label>Priorité <span className="espace-required">*</span></label>
            <select className="espace-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {Object.entries(PRIORITY_LABELS).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}
            </select>
          </div>
          <div className="espace-field" style={{ gridColumn: '1 / -1' }}>
            <label>Description <span className="espace-required">*</span></label>
            <textarea ref={setErrorRef('message')} className={`espace-textarea ${errors.message ? 'is-error' : ''}`} aria-invalid={!!errors.message} value={message} onChange={(e) => { setMessage(e.target.value); clearError('message'); }} placeholder="Décrivez le problème rencontré…" />
            {errors.message ? <span className="espace-field-error">{errors.message}</span> : null}
          </div>
          <div className="espace-field" style={{ gridColumn: '1 / -1' }}>
            <label>Capture d’écran (optionnel)</label>
            <label className="espace-btn espace-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto' }}>
              <ImageIcon size={16} /> {screenshot ? screenshot.name : 'Joindre une image'}
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {error ? <div className="espace-alert espace-alert-error" style={{ gridColumn: '1 / -1' }}>{error}</div> : null}
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="espace-btn" disabled={creating}>
              {creating ? 'Envoi…' : <><Plus size={16} /> Créer le ticket</>}
            </button>
          </div>
        </form>
      </div>

      <div className="espace-card">
        <h2>Tickets ({tickets.length})</h2>
        {listLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={22} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>
        ) : tickets.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun ticket pour l’instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tickets.map((t) => {
              const st = STATUS_LABELS[t.status] || { label: t.status, cls: 'espace-alert-info' };
              const pr = PRIORITY_LABELS[t.priority] || { label: t.priority, color: 'var(--ink-muted)' };
              return (
                <Link key={t.id} to={`/espace/tickets/${t.id}`} style={{ border: '1px solid #e3eaf0', borderRadius: 8, padding: 16, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <strong style={{ fontSize: 15, color: 'var(--navy)' }}>{t.subject}</strong>
                    <ChevronRight size={18} style={{ color: 'var(--ink-muted)', flex: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`espace-alert ${st.cls}`} style={{ padding: '3px 9px', fontSize: 11 }}>{st.label}</span>
                    <span className="espace-alert espace-alert-info" style={{ padding: '3px 9px', fontSize: 11, background: '#eef4fa', color: 'var(--ink-muted)' }}>{CATEGORY_LABELS[t.category] || t.category}</span>
                    <span style={{ padding: '3px 9px', fontSize: 11, fontWeight: 700, color: pr.color }}>{pr.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
