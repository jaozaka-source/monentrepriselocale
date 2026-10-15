import { ArrowUpRight, Check, MoveDownRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="hero-section" id="accueil" aria-labelledby="hero-title">
      <div className="hero-stage">
        <div className="hero-stage-top"><span>VOTRE COMMERCE MÉRITE D’ÊTRE VU.</span></div>
        <div className="hero-copy">
          <div className="hero-eyebrow"><span className="eyebrow-line" /> LA VITRINE DIGITALE DES COMMERCES DE PROXIMITÉ</div>
          <h1 id="hero-title">Votre métier,<br />notre <em>vitrine.</em></h1>
          <p>Des sites web prêts à l’emploi, pensés pour les commerces d’ici. Présentez votre savoir-faire et faites-vous trouver là où vos clients vous cherchent.</p>
          <div className="hero-actions">
            <a href="#contact" className="button-primary">Contactez-nous <ArrowUpRight size={19} strokeWidth={2} /></a>
            <a href="#solutions" className="button-text">Découvrir les solutions <span>↗</span></a>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="hero-image-wrap"><img src="https://images.hostinger.com/d71236b3-d3bf-437d-a6fa-0527de310202.png" alt="" /></div>
          <div className="hero-float"><span className="float-icon"><Check size={15} strokeWidth={2.5} /></span><span>Une présence en ligne<br /><strong>à votre image</strong></span></div>
        </div>
        <div className="hero-stage-bottom"><span>COIFFEUR / BARBIER · ONGLERIE / ESTHÉTIQUE · MASSAGE / BIEN-ÊTRE · FROMAGER / CRÉMERIE · BOULANGER / PÂTISSIER · BOUCHER / TRAITEUR · FLEURISTE · CAVISTE · ARTISAN DU BÂTIMENT, GARAGE · ET BIEN PLUS</span><a href="#solutions" aria-label="Découvrir nos solutions"><MoveDownRight size={24} strokeWidth={1.5} /></a></div>
        <div className="hero-cropped-word" aria-hidden="true">LOCAL</div>
      </div>
      <div className="hero-underbar"><span><span className="underbar-dot" /> POUR LES COMMERCES INDÉPENDANTS</span><span>Une belle adresse mérite une belle présence en ligne.</span><span>FAIT POUR VOUS, TOUT SIMPLEMENT.</span></div>
    </section>
  );
}
