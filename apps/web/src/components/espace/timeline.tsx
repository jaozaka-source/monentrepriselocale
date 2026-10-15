import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { STEPS, PHASES, stepIndex } from '@/data/steps';

export function Timeline({ currentStep }: { currentStep: string }) {
  const currentIdx = stepIndex(currentStep);

  return (
    <div className="timeline">
      {PHASES.map((phase) => {
        const phaseSteps = STEPS.filter((s) => s.phase === phase.n);
        const firstIdx = stepIndex(phaseSteps[0].code);
        const lastIdx = stepIndex(phaseSteps[phaseSteps.length - 1].code);
        const isDone = currentIdx > lastIdx;
        const isCurrent = currentIdx >= firstIdx && currentIdx <= lastIdx;

        return (
          <div
            key={phase.n}
            className={`timeline-phase${isCurrent ? ' current' : ''}${isDone ? ' done' : ''}`}
          >
            <div className="timeline-phase-head">
              <span className="timeline-phase-num">{phase.n}</span>
              {phase.title}
            </div>
            <div className="timeline-steps">
              {phaseSteps.map((step) => {
                const idx = stepIndex(step.code);
                const done = idx < currentIdx;
                const current = idx === currentIdx;
                const locked = idx > currentIdx;
                const cls = `timeline-step${done ? ' done' : ''}${current ? ' current' : ''}${locked ? ' locked' : ''}`;
                const inner = (
                  <>
                    <span className="ts-dot">{done ? <Check size={8} strokeWidth={3} /> : null}</span>
                    <span>{step.code} · {step.title}</span>
                  </>
                );
                return locked ? (
                  <div key={step.code} className={cls}>{inner}</div>
                ) : (
                  <Link key={step.code} to={`/espace/etapes/${step.code}`} className={cls}>{inner}</Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
