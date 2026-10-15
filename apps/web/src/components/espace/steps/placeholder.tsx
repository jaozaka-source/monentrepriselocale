import { useStepAdvance } from '@/hooks/use-step-advance';
import { stepByCode } from '@/data/steps';

export function PlaceholderStep({ step }: { step: string }) {
  const { advance, advancing, error } = useStepAdvance();
  const def = stepByCode(step);

  return (
    <>
      <div className="espace-card">
        <div className="espace-alert espace-alert-info">
          Cet écran sera construit dans une prochaine étape. Pour l’instant, vous pouvez passer à l’étape suivante.
        </div>
        <p style={{ color: 'var(--ink-muted)', fontSize: 14, lineHeight: 1.7, margin: '20px 0 0' }}>
          {def?.description}
        </p>
      </div>
      {error ? <div className="espace-alert espace-alert-error" style={{ marginTop: 16 }}>{error}</div> : null}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="espace-btn" onClick={() => advance()} disabled={advancing}>
          {advancing ? 'Enregistrement…' : 'Continuer'}
        </button>
      </div>
    </>
  );
}
