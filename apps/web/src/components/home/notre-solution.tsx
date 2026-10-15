import { Handshake, Paintbrush, Store, Shield } from 'lucide-react';

const pillars = [
  {
    icon: Handshake,
    title: 'Clé en main',
    text: 'On s’occupe de tout : textes, mise en page, photos, mise en ligne, fiche Google. Vous validez, c’est tout.',
  },
  {
    icon: Paintbrush,
    title: '100 % personnalisé',
    text: 'Vos couleurs, votre ambiance, vos prestations, vos produits, vos horaires : le site vous ressemble.',
  },
  {
    icon: Store,
    title: 'Conçu par métier',
    text: 'Des modèles éprouvés pour chaque commerce : réservation pour les salons, commande en ligne pour les artisans.',
  },
  {
    icon: Shield,
    title: 'Toujours à jour',
    text: 'Hébergement, sécurité, sauvegardes et modifications inclus pendant toute la durée du contrat.',
  },
];

const stats = [
  { value: '10 jours', label: 'pour être en ligne*' },
  { value: '0 %', label: 'de commission sur vos ventes' },
  { value: '1', label: 'interlocuteur dédié en France' },
];

export function NotreSolution() {
  return (
    <section className="notre-solution-section section-pad" id="notre-solution" aria-labelledby="notre-solution-title">
      <div className="notre-solution-inner">
        <p className="section-kicker packs-kicker">
          <span className="eyebrow-line" />
          NOTRE SOLUTION
        </p>
        <h2 id="notre-solution-title">Un site clé en main, pensé pour votre métier</h2>

        <div className="notre-solution-layout">
          <ul className="notre-solution-list">
            {pillars.map((item) => (
              <li key={item.title} className="notre-solution-item">
                <span className="notre-solution-icon" aria-hidden="true">
                  <item.icon size={22} strokeWidth={1.8} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <aside className="notre-solution-stats" aria-label="Chiffres clés">
            {stats.map((stat) => (
              <div key={stat.value} className="notre-solution-stat">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </aside>
        </div>

        <p className="notre-solution-footnote">
          * Pack Boutique, à réception de vos contenus. 5 jours pour le Pack Essentiel.
        </p>
      </div>
    </section>
  );
}
