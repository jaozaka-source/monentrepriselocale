import { useNavigate } from 'react-router';
import pb from '@/lib/pocketbase-client';
import { PricingCards, type Billing } from '@/components/pricing-cards';
import type { Pack } from '@/lib/client-steps';

export function Pricing({ packs }: { packs: Pack[] }) {
  const navigate = useNavigate();

  const onChoose = (packId: string, billing: Billing) => {
    try {
      sessionStorage.setItem('pending_pack', JSON.stringify({ packId, billing }));
    } catch {
      // ignore storage errors
    }
    if (pb.authStore.isValid && pb.authStore.record) {
      navigate(`/espace/etapes/1.3?pack=${encodeURIComponent(packId)}&billing=${billing}`);
    } else {
      navigate('/signup');
    }
  };

  return (
    <section id="tarifs" className="pricing-section section-pad">
      <div className="pricing-inner">
        <p className="section-kicker">
          <span className="eyebrow-line" />
          Tarifs
        </p>
        <h2>Plus vous vous engagez, moins vous payez</h2>
        <PricingCards packs={packs} ctaLabel="Choisir ce pack" onChoose={onChoose} />
      </div>
    </section>
  );
}
