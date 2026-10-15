import { useEffect, useState } from 'react';
import type { Route } from './+types/informations';
import { seo } from '@/lib/seo';
import { Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { useClientData } from '@/components/espace/client-data-context';
import { fetchPacks, type Pack } from '@/lib/client-steps';
import { stepByCode } from '@/data/steps';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Mes informations — Espace client Mon Entreprise Locale',
    description: 'Consultez les informations de votre entreprise et de votre représentant légal.',
    noindex: true,
  });
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #eef2f6', gap: 16 }}>
      <span style={{ flex: '0 0 200px', fontSize: 13, color: 'var(--ink-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--navy)', fontWeight: 500 }}>{value || '—'}</span>
    </div>
  );
}

export default function Informations() {
  const { profile, loading } = useClientData();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [user, setUser] = useState<typeof pb.authStore.record>(null);

  useEffect(() => {
    setUser(pb.authStore.record);
    fetchPacks().then(setPacks).catch(() => {});
  }, []);

  if (loading || !profile) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  const pack = packs.find((p) => p.id === profile.pack);

  return (
    <>
      <div className="espace-page-head">
        <h1>Mes informations</h1>
        <p>Les informations fournies lors de votre parcours. Pour modifier une étape, revenez sur celle-ci depuis le tableau de bord.</p>
      </div>

      <div className="espace-card">
        <h2>Compte</h2>
        <Row label="Nom" value={user?.name || ''} />
        <Row label="E-mail" value={user?.email || ''} />
        <Row label="Étape actuelle" value={`${profile.current_step} · ${stepByCode(profile.current_step)?.title || ''}`} />
      </div>

      <div className="espace-card">
        <h2>Entreprise</h2>
        <Row label="SIREN" value={profile.siren} />
        <Row label="Dénomination" value={profile.company_name} />
        <Row label="Nom commercial" value={profile.trade_name} />
        <Row label="Forme juridique" value={profile.legal_form} />
        <Row label="Adresse du siège" value={profile.hq_address} />
        <Row label="SIRET du siège" value={profile.hq_siret} />
        <Row label="Code NAF" value={profile.naf_code} />
        <Row label="N° TVA intracommunautaire" value={profile.vat_number} />
        <Row label="Capital social" value={profile.share_capital} />
        <Row label="Ville RCS" value={profile.rcs_city} />
        <Row label="Téléphone" value={profile.phone} />
      </div>

      <div className="espace-card">
        <h2>Représentant légal</h2>
        <Row label="Civilité" value={profile.rep_civility} />
        <Row label="Nom" value={profile.rep_lastname} />
        <Row label="Prénom" value={profile.rep_firstname} />
        <Row label="Qualité" value={profile.rep_quality} />
        <Row label="E-mail" value={profile.rep_email} />
        <Row label="Téléphone mobile" value={profile.rep_mobile} />
      </div>

      <div className="espace-card">
        <h2>Abonnement</h2>
        <Row label="Pack" value={pack?.name || 'Non choisi'} />
        <Row label="Formule" value={profile.pack_billing === 'biennial' ? '24 mois d’avance' : profile.pack_billing === 'annual' ? '1 an d’avance' : profile.pack_billing === 'monthly' ? 'Mensuel · 12 mois' : '—'} />
      </div>
    </>
  );
}
