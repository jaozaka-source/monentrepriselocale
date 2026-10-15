import type { Route } from './+types/dashboard';
import { seo } from '@/lib/seo';
import { Link } from 'react-router';
import { ArrowRight, Loader2, Calendar } from 'lucide-react';
import { useClientData } from '@/components/espace/client-data-context';
import { Timeline } from '@/components/espace/timeline';
import { stepByCode, nextStep } from '@/data/steps';
import { getRdvInfo, formatRdvDateFr, formatRdvDateFrManual } from '@/lib/rdv';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Tableau de bord — Espace client Mon Entreprise Locale',
    description: 'Suivez la création de votre site web étape par étape.',
    noindex: true,
  });
}

export default function Dashboard() {
  const { profile, loading } = useClientData();

  if (loading || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} />
      </div>
    );
  }

  const current = profile.current_step;
  const stepDef = stepByCode(current);
  const next = nextStep(current);
  const rdv = getRdvInfo(profile);
  const rdvLabel = rdv ? (rdv.source === 'manual' ? formatRdvDateFrManual(rdv.debut) : formatRdvDateFr(rdv.debut)) : '';

  return (
    <>
      <div className="espace-page-head">
        <h1>Tableau de bord</h1>
        <p>Suivez l’avancement de votre projet en temps réel. Chaque étape franchie vous rapproche de la mise en ligne de votre site.</p>
      </div>

      {rdv ? (
        <div className="espace-alert espace-alert-success" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Calendar size={20} style={{ flex: 'none' }} />
          <div>
            <strong>Votre rendez-vous aura lieu le {rdvLabel}</strong>
            {rdv.lieu ? <div style={{ fontSize: 13, marginTop: 2 }}>{rdv.lieu}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="espace-card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Étape en cours · {current}
        </div>
        <h2 style={{ margin: '8px 0 6px', fontSize: 24 }}>{stepDef?.title}</h2>
        <p style={{ color: 'var(--ink-muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px', maxWidth: '55ch' }}>
          {stepDef?.description}
        </p>
        <Link to={`/espace/etapes/${current}`} className="espace-btn" style={{ fontSize: 15, padding: '14px 28px' }}>
          Continuer <ArrowRight size={18} />
        </Link>
        {next ? (
          <span style={{ marginLeft: 16, fontSize: 13, color: 'var(--ink-muted)' }}>
            Prochaine étape : {stepByCode(next)?.title}
          </span>
        ) : null}
      </div>

      <div className="espace-card">
        <h2>Avancement du projet</h2>
        <Timeline currentStep={current} />
      </div>
    </>
  );
}
