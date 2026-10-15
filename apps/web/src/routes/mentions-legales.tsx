import type { Route } from './+types/mentions-legales';
import { seo } from '@/lib/seo';
import { LegalLayout } from '@/components/legal-layout';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Mentions légales — Mon Entreprise Locale',
    description: 'Mentions légales du site monentrepriselocale.fr, édité par JRConsulting.',
  });
}

export default function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>
        JRConsulting, SASU au capital de 500 €<br />
        Siège social : 60 rue François-Iᵉʳ, 75008 Paris<br />
        RCS Paris 934244948 – TVA intracommunautaire FR75934244948<br />
        Email : contact@monentrepriselocale.fr – Téléphone : 06.47.39.39.38<br />
        Directeur de la publication : RAZAFIMAHAZO Jaozaka, président
      </p>

      <h2>Hébergeur</h2>
      <p>Hostinger International Ltd, 61 Lordou Vironos Street, 6023 Larnaca, Chypre – www.hostinger.fr</p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L’ensemble des éléments du site (textes, images, logo, code) est la propriété de JRConsulting, sauf mention
        contraire. Toute reproduction sans autorisation écrite est interdite.
      </p>

      <h2>Données personnelles</h2>
      <p>Voir la Politique de confidentialité (/politique-de-confidentialite).</p>
    </LegalLayout>
  );
}
