import { useState } from 'react';
import { Check } from 'lucide-react';
import { formatEuro } from '@/data/tariffs';
import type { Pack } from '@/lib/client-steps';

export type Billing = 'monthly' | 'annual' | 'biennial';

const INCLUDES = [
  'Création du site',
  'Hébergement',
  'Nom de domaine',
  'Certificat de sécurité',
  'Sauvegardes',
  'Mises à jour',
  '2 modifications par mois',
  'Support par tickets',
];

const SELECTOR: { id: Billing; label: string }[] = [
  { id: 'monthly', label: 'Mensuel' },
  { id: 'annual', label: 'Annuel -20 %' },
  { id: 'biennial', label: '24 mois -40 %' },
];

function priceFor(pack: Pack, billing: Billing) {
  const htCents =
    billing === 'annual'
      ? pack.annual_price
      : billing === 'biennial'
        ? pack.biennial_price
        : pack.monthly_price;
  const ttcCents = Math.round(htCents * 1.2);
  if (billing === 'monthly') {
    return {
      large: `${formatEuro(htCents / 100)} HT`,
      small: `${formatEuro(ttcCents / 100)} TTC / mois`,
    };
  }
  const months = billing === 'annual' ? 12 : 24;
  const equivCents = htCents / months;
  return {
    large: `${formatEuro(equivCents / 100)} HT / mois`,
    small: `soit ${formatEuro(htCents / 100)} HT payés en une fois (${formatEuro(ttcCents / 100)} TTC)`,
  };
}

export function PricingCards({
  packs,
  initialBilling = 'monthly',
  ctaLabel,
  onChoose,
  busy = false,
}: {
  packs: Pack[];
  initialBilling?: Billing;
  ctaLabel: string;
  onChoose: (packId: string, billing: Billing) => void;
  busy?: boolean;
}) {
  const [billing, setBilling] = useState<Billing>(initialBilling);
  const activePacks = packs
    .filter((p) => p.active)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));

  return (
    <>
      <div className="pricing-v2-selector" role="tablist" aria-label="Formule">
        {SELECTOR.map((s) => (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={billing === s.id}
            className={billing === s.id ? 'active' : ''}
            onClick={() => setBilling(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="pricing-v2-grid">
        {activePacks.map((pack) => {
          const price = priceFor(pack, billing);
          return (
            <article key={pack.id} className="pricing-v2-card">
              <h3>{pack.name}</h3>
              <p className="pv2-sub">{pack.subtitle}</p>
              <div className="pricing-v2-price">
                <span className="pv2-large">{price.large}</span>
                <span className="pv2-small">{price.small}</span>
              </div>
              <p className="pricing-v2-desc">{pack.description}</p>
              <div className="pricing-v2-cta">
                <button
                  type="button"
                  className="espace-btn"
                  style={{ width: '100%' }}
                  onClick={() => onChoose(pack.id, billing)}
                  disabled={busy}
                >
                  {ctaLabel}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="pricing-v2-includes">
        <h3>Inclus dans tous les packs</h3>
        <ul>
          {INCLUDES.map((item) => (
            <li key={item}>
              <Check size={15} /> {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="pricing-v2-mention">
        Sans frais de création. Mensuel avec engagement 12 mois. Prix HT, TVA 20 % en sus.
      </p>
    </>
  );
}
