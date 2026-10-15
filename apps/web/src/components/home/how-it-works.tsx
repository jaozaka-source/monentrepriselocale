import { ArrowUpRight, MousePointer2, MessageCircleMore, MonitorCheck } from 'lucide-react';

const steps = [
  { number: '01', icon: MousePointer2, title: 'Choisissez votre activité', text: 'Dites-nous quel commerce vous anime et ce que vous attendez de votre site.' },
  { number: '02', icon: MessageCircleMore, title: 'Racontez-nous votre projet', text: 'Partagez votre nom, votre ville et vos envies en quelques instants.' },
  { number: '03', icon: MonitorCheck, title: 'On s’occupe de la suite', text: 'Nous revenons vers vous pour imaginer une vitrine qui vous correspond.' },
];

export function HowItWorks() {
  return (
    <section className="process-section" id="comment-ca-marche" aria-labelledby="process-title">
      <div className="process-inner section-pad">
        <div className="process-lead"><span className="section-kicker">02 — COMMENT ÇA MARCHE</span><h2 id="process-title">Simple à lancer.<br /><em>Beau à regarder.</em></h2><p>Vous connaissez votre métier. Nous savons comment le mettre en lumière sur le web. Commençons par faire connaissance.</p><a href="#contact" className="button-light">Parler de mon projet <ArrowUpRight size={19} /></a></div>
        <div className="process-steps">{steps.map((step) => <div className="process-step" key={step.number}><span className="step-number">{step.number}</span><div className="step-icon"><step.icon size={23} strokeWidth={1.6} /></div><div><h3>{step.title}</h3><p>{step.text}</p></div></div>)}</div>
      </div>
      <div className="process-watermark" aria-hidden="true">PROXIMITÉ</div>
    </section>
  );
}
