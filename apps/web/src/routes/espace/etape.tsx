import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Route } from './+types/etape';
import { seo } from '@/lib/seo';
import { Loader2, Lock } from 'lucide-react';
import { useClientData } from '@/components/espace/client-data-context';
import { canAccessStep, stepByCode } from '@/data/steps';
import { ProfilEntreprise } from '@/components/espace/steps/profil-entreprise';
import { RepresentantLegal } from '@/components/espace/steps/representant-legal';
import { ChoixPack } from '@/components/espace/steps/choix-pack';
import { ContratStep } from '@/components/espace/steps/contrat';
import { SignatureStep } from '@/components/espace/steps/signature';
import { Paiement } from '@/components/espace/steps/paiement';
import { Rencontre } from '@/components/espace/steps/rencontre';
import { VosContenus } from '@/components/espace/steps/vos-contenus';
import { Creation } from '@/components/espace/steps/creation';
import { ControleQualite } from '@/components/espace/steps/controle-qualite';
import { Presentation } from '@/components/espace/steps/presentation';
import { MiseEnLigne } from '@/components/espace/steps/mise-en-ligne';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Étape — Espace client Mon Entreprise Locale',
    description: 'Complétez l’étape en cours de votre projet de site web.',
    noindex: true,
  });
}

export default function Etape() {
  const { step } = useParams();
  const { profile, loading } = useClientData();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile && step && !canAccessStep(profile.current_step, step)) {
      navigate('/espace');
    }
  }, [loading, profile, step, navigate]);

  if (loading || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} />
      </div>
    );
  }

  if (!step || !canAccessStep(profile.current_step, step)) {
    return null;
  }

  const stepDef = stepByCode(step);
  if (!stepDef) {
    return <div className="espace-alert espace-alert-error">Étape inconnue.</div>;
  }

  const renderStep = () => {
    switch (step) {
      case '1.1':
        return <ProfilEntreprise profile={profile} />;
      case '1.2':
        return <RepresentantLegal profile={profile} />;
      case '1.3':
        return <ChoixPack profile={profile} />;
      case '1.4':
        return <ContratStep profile={profile} />;
      case '1.5':
        return <SignatureStep profile={profile} />;
      case '2.1':
        return <Paiement profile={profile} />;
      case '3.1':
        return <Rencontre profile={profile} />;
      case '3.2':
        return <VosContenus />;
      case '3.3':
        return <Creation profile={profile} />;
      case '3.4':
        return <ControleQualite profile={profile} />;
      case '3.5':
        return <Presentation profile={profile} />;
      case '3.6':
        return <MiseEnLigne profile={profile} />;
      case '4.1':
        return <MiseEnLigne profile={profile} />;
      default:
        // Phase 3 / 4 — admin-advanced; the client views but cannot continue.
        return (
          <div className="espace-alert espace-alert-info" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Lock size={20} style={{ flex: 'none', marginTop: 1 }} />
            <div>
              <strong>Cette étape est gérée par notre équipe.</strong>
              <p style={{ margin: '6px 0 0', fontWeight: 500 }}>
                Vous serez notifié(e) par e-mail à chaque avancement. Aucune action n’est requise de votre part pour le moment.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div className="espace-page-head">
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Phase {stepDef.phase} · {stepDef.phaseTitle}
        </div>
        <h1>{stepDef.title}</h1>
        <p>{stepDef.description}</p>
      </div>
      {renderStep()}
    </>
  );
}
