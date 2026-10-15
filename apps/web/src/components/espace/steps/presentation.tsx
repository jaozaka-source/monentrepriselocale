import { useState } from 'react';
import { ExternalLink, CheckCircle2, Edit3, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { ClientProfile } from '@/lib/client-steps';
import { useClientData } from '@/components/espace/client-data-context';

export function Presentation({ profile }: { profile: ClientProfile }) {
  const { refresh } = useClientData();
  const [mode, setMode] = useState<'idle' | 'changes'>('idle');
  const [feedback, setFeedback] = useState(profile.mockup_feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const mockupUrl = profile.mockup_url?.trim() || '';
  const status = profile.mockup_status ?? 'pending';

  const submit = async (kind: 'validated' | 'changes_requested') => {
    if (kind === 'changes_requested' && !feedback.trim()) {
      setError('Veuillez décrire les modifications souhaitées.');
      return;
    }
    setBusy(true);
    setError('');
    setDone('');
    try {
      const now = new Date().toISOString();
      await pb.collection('client_profiles').update(profile.id, {
        mockup_status: kind,
        mockup_feedback: kind === 'changes_requested' ? feedback.trim() : '',
        mockup_feedback_at: now,
      });
      await refresh();
      setMode('idle');
      setDone(kind === 'validated' ? 'Merci ! Votre validation a été transmise à notre équipe.' : 'Vos demandes de modifications ont été transmises.');
    } catch {
      setError("La transmission a échoué.");
    }
    setBusy(false);
  };

  const alreadyAnswered = status === 'validated' || status === 'changes_requested';

  return (
    <>
      {done ? (
        <div className="espace-alert espace-alert-success" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <CheckCircle2 size={20} style={{ flex: 'none', marginTop: 1 }} />
          <div>{done}</div>
        </div>
      ) : null}

      <div className="espace-card" style={{ marginBottom: 20 }}>
        <h2>Votre maquette</h2>
        <p style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.7, margin: '0 0 18px' }}>
          Découvrez l’aperçu de votre futur site. Parcourez les différentes pages et vérifiez que
          les contenus, couleurs et la mise en page vous conviennent.
        </p>
        {mockupUrl ? (
          <a href={mockupUrl} target="_blank" rel="noopener noreferrer" className="espace-btn">
            <ExternalLink size={16} /> Ouvrir la maquette
          </a>
        ) : (
          <div className="espace-alert espace-alert-info">
            Le lien de votre maquette sera disponible prochainement. Vous serez notifié(e) par e-mail.
          </div>
        )}
      </div>

      {alreadyAnswered && mode === 'idle' ? (
        <div className="espace-card">
          <h2>Votre retour</h2>
          {status === 'validated' ? (
            <div className="espace-alert espace-alert-success" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <CheckCircle2 size={20} style={{ flex: 'none', marginTop: 1 }} />
              <div>Vous avez validé la maquette. Notre équipe procède à la mise en ligne.</div>
            </div>
          ) : (
            <div className="espace-alert espace-alert-info" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Edit3 size={20} style={{ flex: 'none', marginTop: 1 }} />
              <div>
                <strong>Vous avez demandé des modifications.</strong>
                {profile.mockup_feedback ? <p style={{ margin: '6px 0 0', fontWeight: 500, lineHeight: 1.6 }}>{profile.mockup_feedback}</p> : null}
              </div>
            </div>
          )}
          <button type="button" className="espace-btn espace-btn-ghost" style={{ marginTop: 16 }} onClick={() => { setMode('changes'); setFeedback(profile.mockup_feedback ?? ''); }}>
            Modifier mon retour
          </button>
        </div>
      ) : (
        <div className="espace-card">
          <h2>Donnez votre avis</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
            La maquette vous convient ? Validez-la pour lancer la mise en ligne. Sinon, demandez des
            modifications en décrivant vos retours.
          </p>
          {error ? <div className="espace-alert espace-alert-error" style={{ marginBottom: 14 }}>{error}</div> : null}

          {mode === 'changes' ? (
            <div className="espace-field" style={{ marginBottom: 18 }}>
              <label>Modifications souhaitées</label>
              <textarea className="espace-textarea" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Décrivez les ajustements à apporter…" />
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {mode === 'changes' ? (
              <>
                <button type="button" className="espace-btn" onClick={() => submit('changes_requested')} disabled={busy}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Edit3 size={15} />} Envoyer mes demandes
                </button>
                <button type="button" className="espace-btn espace-btn-secondary" onClick={() => setMode('idle')} disabled={busy}>Annuler</button>
              </>
            ) : (
              <>
                <button type="button" className="espace-btn" onClick={() => submit('validated')} disabled={busy}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Je valide la maquette
                </button>
                <button type="button" className="espace-btn espace-btn-secondary" onClick={() => setMode('changes')} disabled={busy}>
                  <Edit3 size={15} /> Je demande des modifications
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
