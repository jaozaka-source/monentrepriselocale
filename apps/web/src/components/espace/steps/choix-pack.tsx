import { useState } from 'react';
import { PricingCards, type Billing } from '@/components/pricing-cards';
import { updateProfile, type ClientProfile } from '@/lib/client-steps';
import { useClientData } from '@/components/espace/client-data-context';
import { useStepAdvance } from '@/hooks/use-step-advance';

function readPreselection(profile: ClientProfile): { packId: string; billing: Billing } {
  const fallback: Billing =
    profile.pack_billing === 'annual' || profile.pack_billing === 'biennial'
      ? profile.pack_billing
      : 'monthly';
  if (typeof window === 'undefined') {
    return { packId: profile.pack || '', billing: fallback };
  }
  const params = new URLSearchParams(window.location.search);
  let packId = params.get('pack') || profile.pack || '';
  let billing: Billing = (params.get('billing') as Billing) || fallback;
  const stored = sessionStorage.getItem('pending_pack');
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { packId?: string; billing?: Billing };
      if (parsed.packId) packId = parsed.packId;
      if (parsed.billing === 'monthly' || parsed.billing === 'annual' || parsed.billing === 'biennial') {
        billing = parsed.billing;
      }
    } catch {
      // ignore malformed entry
    }
    sessionStorage.removeItem('pending_pack');
  }
  return { packId, billing };
}

export function ChoixPack({ profile }: { profile: ClientProfile }) {
  const { packs } = useClientData();
  const { advance, advancing, error } = useStepAdvance();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const preselect = readPreselection(profile);

  const onChoose = async (packId: string, billing: Billing) => {
    setFormError('');
    setSaving(true);
    try {
      await updateProfile({ pack: packId, pack_billing: billing } as Partial<ClientProfile>);
      await advance();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'L’enregistrement a échoué.');
    }
    setSaving(false);
  };

  return (
    <>
      <div className="espace-alert espace-alert-info" style={{ marginBottom: 28 }}>
        <strong>Aucun frais de création.</strong> Le mensuel est un engagement de 12 mois. En payant 1 an ou 24 mois
        d’avance, vous économisez 20 % ou 40 %. Hébergement, maintenance et modifications sont inclus.
      </div>

      <PricingCards
        packs={packs}
        initialBilling={preselect.billing}
        ctaLabel="Choisir ce pack"
        onChoose={onChoose}
        busy={advancing || saving}
      />

      {formError ? (
        <div className="espace-alert espace-alert-error" style={{ marginTop: 20 }}>{formError}</div>
      ) : null}
      {error ? (
        <div className="espace-alert espace-alert-error" style={{ marginTop: 20 }}>{error}</div>
      ) : null}
    </>
  );
}
