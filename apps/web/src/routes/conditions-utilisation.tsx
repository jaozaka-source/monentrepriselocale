import type { Route } from './+types/conditions-utilisation';
import { seo } from '@/lib/seo';
import { LegalLayout } from '@/components/legal-layout';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: "Conditions d'utilisation — Mon Entreprise Locale",
    description: "Conditions d'utilisation du site monentrepriselocale.fr et de son espace client, édités par JRConsulting.",
  });
}

export default function ConditionsUtilisation() {
  return (
    <LegalLayout title="Conditions d’utilisation" updated="10/10/2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions encadrent l’utilisation du site monentrepriselocale.fr et de son espace client,
        édités par JRConsulting. La création, l’hébergement et la maintenance de votre site sont régis par le contrat
        cadre que vous signez dans l’espace client ; en cas de différence, le contrat cadre prévaut.
      </p>

      <h2>2. Accès au service</h2>
      <p>
        L’espace client est réservé aux professionnels (entreprises, commerçants, artisans, indépendants) agissant
        pour les besoins de leur activité. La création d’un compte est gratuite. L’inscription vaut acceptation des
        présentes conditions.
      </p>

      <h2>3. Compte et connexion</h2>
      <p>
        Vous pouvez vous inscrire avec une adresse email et un mot de passe, ou avec votre compte Google. Vous vous
        engagez à fournir des informations exactes et à les tenir à jour. Vous êtes responsable de la confidentialité
        de vos identifiants et de toute action réalisée depuis votre compte. Prévenez-nous immédiatement à
        contact@monentrepriselocale.fr en cas d’utilisation non autorisée.
      </p>

      <h2>4. Utilisation de l’espace client</h2>
      <p>
        L’espace client vous permet de renseigner les informations de votre entreprise, de choisir une offre, de
        signer votre contrat en ligne, de payer votre abonnement, de suivre la création de votre site, de déposer
        vos contenus et de signaler des incidents.
      </p>
      <p>Vous vous engagez à ne pas :</p>
      <ul>
        <li>usurper l’identité d’une personne ou d’une entreprise, ou engager une entreprise sans en avoir le pouvoir ;</li>
        <li>déposer des contenus illicites, trompeurs ou portant atteinte aux droits de tiers ;</li>
        <li>tenter d’accéder aux données d’autres utilisateurs ou de perturber le fonctionnement du service.</li>
      </ul>

      <h2>5. Contenus que vous déposez</h2>
      <p>
        Vous restez propriétaire des textes, photos, logos et autres contenus que vous déposez. Vous garantissez
        disposer des droits nécessaires et nous autorisez à les utiliser pour réaliser et faire fonctionner votre
        site, dans les conditions du contrat cadre.
      </p>

      <h2>6. Disponibilité</h2>
      <p>
        Nous faisons notre possible pour que le site et l’espace client soient accessibles en permanence, sans pouvoir
        le garantir. L’accès peut être interrompu pour maintenance, mise à jour ou en cas d’incident technique.
      </p>

      <h2>7. Propriété intellectuelle</h2>
      <p>
        Le site monentrepriselocale.fr, sa marque, ses textes, son design et son code sont la propriété de
        JRConsulting. Toute reproduction sans autorisation est interdite.
      </p>

      <h2>8. Responsabilité</h2>
      <p>
        JRConsulting n’est pas responsable des dommages résultant d’une mauvaise utilisation du service,
        d’informations inexactes fournies par l’utilisateur ou d’une interruption due à un prestataire technique
        (hébergeur, paiement, réseau).
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans notre Politique de confidentialité
        (/politique-de-confidentialite).
      </p>

      <h2>10. Suspension et suppression du compte</h2>
      <p>
        Vous pouvez demander la suppression de votre compte à tout moment à contact@monentrepriselocale.fr, sous
        réserve des engagements pris dans votre contrat. Nous pouvons suspendre ou fermer un compte en cas de
        non-respect des présentes conditions, après vous en avoir informé, sauf urgence.
      </p>

      <h2>11. Modification des conditions</h2>
      <p>
        Nous pouvons modifier ces conditions. La version en vigueur est celle publiée sur cette page, avec sa date de
        mise à jour. En cas de changement important, nous vous prévenons par email.
      </p>

      <h2>12. Droit applicable</h2>
      <p>
        Les présentes conditions sont soumises au droit français. En cas de litige, et après une tentative de
        règlement amiable, les tribunaux compétents sont ceux désignés par le contrat cadre ou, à défaut, par le
        droit commun.
      </p>

      <h2>13. Contact</h2>
      <p>
        JRConsulting – monentrepriselocale.fr, 60 rue François-Iᵉʳ, 75008 Paris –
        contact@monentrepriselocale.fr
      </p>
    </LegalLayout>
  );
}
