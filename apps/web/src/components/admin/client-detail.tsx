import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft, History, Calendar } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';
import { ClientEditForm } from './client-edit-form';
import { ClientDocuments } from './client-documents';
import { ClientSubscription } from './client-subscription';
import { ClientStripeEvents } from './client-stripe-events';
import { stepByCode, nextStep, prevStep } from '@/data/steps';
import { formatEuro } from '@/data/tariffs';
import { getRdvInfo, formatRdvDateFr, formatRdvDateFrManual } from '@/lib/rdv';

type Profile = RecordModel & {
  id: string;
  owner: string;
  current_step: string;
  company_name?: string;
  expand?: { owner?: { email?: string; name?: string }; pack?: RecordModel };
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ClientDetail() {
  const { id: profileId = '' } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<RecordModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const p = await pb.collection('client_profiles').getOne(profileId, { expand: 'owner,pack', requestKey: null });
      setProfile(p as unknown as Profile);
      const ownerId = String((p as RecordModel).owner || '');
      const [hist] = await Promise.all([
        pb.collection('step_history').getFullList({ filter: `owner = "${ownerId}"`, sort: '-created', requestKey: null }).catch(() => [] as RecordModel[]),
      ]);
      setHistory(hist);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStep = async (direction: 'advance' | 'back') => {
    if (!profile) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/steps/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ profileId: profile.id, comment: comment.trim(), direction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'L’opération a échoué.');
      setComment('');
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    }
    setBusy(false);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  if (!profile) {
    return (
      <div className="espace-alert espace-alert-error">
        Client introuvable. <Link to="/espace/admin/clients" style={{ color: 'inherit', fontWeight: 700 }}>Retour au portefeuille</Link>
      </div>
    );
  }

  const current = profile.current_step;
  const next = nextStep(current);
  const prev = prevStep(current);
  const statutPaiement = String(profile.statut_paiement || 'non_commence');
  const paymentBlocked = current === '2.1' && statutPaiement !== 'realise';

  const pmtInfo: { label: string; cls: string } =
    statutPaiement === 'en_cours' ? { label: 'En cours', cls: 'pmt-badge-en_cours' }
    : statutPaiement === 'realise' ? { label: 'Réalisé', cls: 'pmt-badge-realise' }
    : statutPaiement === 'echoue' ? { label: 'Échoué', cls: 'pmt-badge-echoue' }
    : { label: 'Non commencé', cls: 'pmt-badge-non_commence' };

  return (
    <>
      <Link to="/espace/admin/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-muted)', fontWeight: 600, marginBottom: 16 }}>
        <ArrowLeft size={15} /> Portefeuille
      </Link>

      <div className="espace-card" style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>{profile.company_name || profile.expand?.owner?.email || 'Client'}</h2>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              {profile.expand?.owner?.email || ''}
              {profile.expand?.owner?.name ? ` · ${profile.expand?.owner.name}` : ''}
            </div>
            <div style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 700, marginTop: 6 }}>
              Étape {current} · {stepByCode(current)?.title || ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <span className={`pmt-badge ${pmtInfo.cls}`}>Paiement : {pmtInfo.label}</span>
              {profile.last_payment_date ? (
                <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  Dernier paiement : {formatDate(String(profile.last_payment_date))}
                  {profile.last_payment_amount ? ` · ${formatEuro(Number(profile.last_payment_amount) / 100)} TTC` : ''}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="espace-card" style={{ marginBottom: 22 }}>
        <h2>Pilotage de l’étape</h2>
        <div className="espace-field" style={{ marginBottom: 14 }}>
          <label>Commentaire (visible par le client, envoyé par e-mail)</label>
          <textarea className="espace-textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ex : votre maquette est prête, vous pouvez la consulter ci-dessous." />
        </div>
        {error ? <div className="espace-alert espace-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
        {saved ? <div className="espace-alert espace-alert-success" style={{ marginBottom: 12 }}>Étape mise à jour. Le client a été notifié par e-mail.</div> : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {next ? (
            paymentBlocked ? (
              <button type="button" className="espace-btn" disabled style={{ opacity: 0.55, cursor: 'default' }}>
                En attente du paiement
              </button>
            ) : (
              <button type="button" className="espace-btn" onClick={() => changeStep('advance')} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />}
                Passer à l’étape suivante
              </button>
            )
          ) : null}
          {prev ? (
            <button type="button" className="espace-btn espace-btn-secondary" onClick={() => changeStep('back')} disabled={busy}>
              <ChevronLeft size={15} /> Revenir à l’étape précédente
            </button>
          ) : null}
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 10 }}>
          {paymentBlocked
            ? 'Le client doit réaliser son paiement avant de passer à l’étape suivante.'
            : next ? `Suivante : ${stepByCode(next)?.title || next}` : 'Dernière étape atteinte.'}
          {prev ? ` · Précédente : ${stepByCode(prev)?.title || prev}` : ''}
        </p>
      </div>

      <div className="espace-card" style={{ marginBottom: 22 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} /> Rendez-vous de lancement
        </h2>
        {(() => {
          const rdv = getRdvInfo(profile);
          if (!rdv) {
            return <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun rendez-vous planifié. Vous pouvez saisir une date manuellement ci-dessous.</p>;
          }
          const label = rdv.source === 'manual' ? formatRdvDateFrManual(rdv.debut) : formatRdvDateFr(rdv.debut);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>
                {profile.rdv_statut === 'canceled' ? <span style={{ color: 'var(--logo-red)' }}>Annulé — </span> : null}
                {label}
              </div>
              {rdv.source === 'calendly' ? (
                <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                  Source : Calendly{rdv.lieu ? ` · ${rdv.lieu}` : ''}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Source : saisie manuelle (téléphone)</div>
              )}
              {rdv.source === 'calendly' && (rdv.lienModifier || rdv.lienAnnuler) ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  {rdv.lienModifier ? <a href={rdv.lienModifier} target="_blank" rel="noreferrer" className="espace-btn espace-btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }}>Modifier</a> : null}
                  {rdv.lienAnnuler ? <a href={rdv.lienAnnuler} target="_blank" rel="noreferrer" className="espace-btn espace-btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }}>Annuler</a> : null}
                </div>
              ) : null}
            </div>
          );
        })()}
      </div>

      <ClientEditForm profile={profile} onSaved={load} />

      <ClientDocuments ownerId={profile.owner} />

      <ClientSubscription profile={profile} />

      <ClientStripeEvents profileId={profile.id} />

      <div className="espace-card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={18} /> Journal d’activité
        </h2>
        {history.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun changement d’étape enregistré.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h) => (
              <div key={h.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #eef2f6' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-muted)', whiteSpace: 'nowrap', minWidth: 120 }}>
                  {formatDateTime(String(h.created || ''))}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                    {String(h.action || '') === 'reset' ? 'Revenu à' : 'Passé à'} {String(h.step || '')} · {stepByCode(String(h.step || ''))?.title || ''}
                  </div>
                  {h.comment ? <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 2 }}>{String(h.comment)}</div> : null}
                  {h.author ? <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>par {String(h.author)}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
