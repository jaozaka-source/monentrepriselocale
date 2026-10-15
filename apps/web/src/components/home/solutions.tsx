import { ArrowUpRight } from 'lucide-react';
import { showcases } from '@/data/site-content';

export function Solutions() {
  return (
    <section className="solutions-section section-pad" id="solutions" aria-labelledby="solutions-title">
      <div className="section-heading solutions-heading">
        <div><span className="section-kicker">01 — POUR VOTRE ACTIVITÉ</span><h2 id="solutions-title">Une vitrine qui vous<br /><em>ressemble vraiment.</em></h2></div>
        <p>Pas besoin de partir de zéro. Nous adaptons votre site à ce qui fait la singularité de votre commerce, de vos services à votre quartier.</p>
      </div>
      <div className="showcase-grid">
        {showcases.map((item, index) => (
          <article className="showcase-card" key={item.label}>
            <div className="showcase-image"><img src={item.image} alt={`Intérieur d’un commerce : ${item.label.toLowerCase()}`} loading="lazy" /><span className="showcase-number">0{index + 1}</span></div>
            <div className="showcase-meta"><span>{item.label}</span><ArrowUpRight size={20} strokeWidth={1.7} /></div>
            <h3>{item.title}</h3><p>{item.description}</p>
          </article>
        ))}
      </div>
      <div className="solutions-note"><span>Et aussi pour les ongleries, boutiques et autres commerces de proximité.</span><a href="#contact">Parlez-nous de votre activité <ArrowUpRight size={17} /></a></div>
    </section>
  );
}
