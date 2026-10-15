import { Check } from 'lucide-react';
import { packFeatures, packs, type FeatureValue, type PackId } from '@/data/packs';

function CellValue({ value }: { value: FeatureValue }) {
  if (value === true) {
    return (
      <span className="pack-check" aria-label="Inclus">
        <Check size={18} strokeWidth={2.5} />
      </span>
    );
  }
  if (value === false) {
    return <span className="pack-dash" aria-label="Non inclus">—</span>;
  }
  return <span className="pack-text-val">{value}</span>;
}

export function Packs() {
  const ids = packs.map((p) => p.id) as PackId[];

  return (
    <section id="packs" className="packs-section section-pad">
      <div className="packs-inner">
        <p className="section-kicker packs-kicker">
          <span className="eyebrow-line" />
          NOS PACKS
        </p>
        <h2>Trois packs, une même exigence</h2>

        <div className="packs-table-wrap">
          <table className="packs-table">
            <thead>
              <tr>
                <th scope="col" className="packs-corner" />
                {packs.map((pack) => (
                  <th key={pack.id} scope="col" style={{ background: pack.headerBg }}>
                    <span className="pack-th-name">{pack.name}</span>
                    <span className="pack-th-sub">{pack.subtitle}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {packFeatures.map((feature, i) => (
                <tr key={feature.label} className={i % 2 === 0 ? 'row-alt' : undefined}>
                  <th scope="row">{feature.label}</th>
                  {ids.map((id) => (
                    <td key={id}>
                      <CellValue value={feature.values[id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
