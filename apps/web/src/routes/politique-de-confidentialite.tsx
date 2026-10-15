import type { Route } from './+types/politique-de-confidentialite';
import { seo } from '@/lib/seo';
import { LegalLayout } from '@/components/legal-layout';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Politique de confidentialité — Mon Entreprise Locale',
    description: 'Comment JRConsulting collecte et utilise les données personnelles des utilisateurs du site et de l’espace client monentrepriselocale.fr.',
  });
}

export default function PolitiqueDeConfidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="10/10/2026">
      <p>
        Cette politique explique comment JRConsulting, qui exploite le service monentrepriselocale.fr, collecte et
        utilise les données personnelles des utilisateurs du site et de l’espace client.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        JRConsulting, SASU au capital de 500 €, 60 rue François-Iᵉʳ, 75008 Paris, RCS Paris 934244948.
        Contact pour toute question sur vos données : contact@monentrepriselocale.fr
      </p>

      <h2>2. Données que nous collectons</h2>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Données</th>
              <th>Origine</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Compte</td>
              <td>Nom, prénom, adresse email, mot de passe (chiffré)</td>
              <td>Vous, à l’inscription</td>
            </tr>
            <tr>
              <td>Connexion avec Google</td>
              <td>Nom, adresse email et identifiant de compte Google</td>
              <td>Google, avec votre accord</td>
            </tr>
            <tr>
              <td>Entreprise</td>
              <td>Dénomination, SIREN, forme juridique, adresse, n° TVA, dirigeants</td>
              <td>Vous, et l’annuaire public des entreprises (recherche-entreprises.api.gouv.fr)</td>
            </tr>
            <tr>
              <td>Signataire</td>
              <td>Civilité, nom, prénom, qualité, email, téléphone</td>
              <td>Vous</td>
            </tr>
            <tr>
              <td>Contrat et signature</td>
              <td>Contrat signé, date et heure, adresse IP, navigateur, cases cochées, code de signature</td>
              <td>Générées lors de la signature</td>
            </tr>
            <tr>
              <td>Paiement</td>
              <td>Formule choisie, historique des paiements et factures</td>
              <td>Stripe (nous ne voyons ni ne stockons vos numéros de carte ou d’IBAN complets)</td>
            </tr>
            <tr>
              <td>Rendez-vous</td>
              <td>Date, heure et lien du rendez-vous</td>
              <td>Calendly, lorsque vous réservez un créneau</td>
            </tr>
            <tr>
              <td>Contenus et échanges</td>
              <td>Textes, photos, logos, tickets d’assistance, messages</td>
              <td>Vous</td>
            </tr>
            <tr>
              <td>Données techniques</td>
              <td>Adresse IP, journaux de connexion</td>
              <td>Votre navigateur</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>3. Pourquoi nous les utilisons</h2>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Finalité</th>
              <th>Base légale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Créer et gérer votre compte et votre espace client</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Préparer, faire signer et conserver le contrat</td>
              <td>Exécution du contrat ; preuve</td>
            </tr>
            <tr>
              <td>Encaisser l’abonnement et émettre les factures</td>
              <td>Exécution du contrat ; obligation légale</td>
            </tr>
            <tr>
              <td>Créer, héberger et maintenir votre site, traiter vos tickets</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Organiser le rendez-vous de lancement</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Sécuriser le service et prévenir la fraude</td>
              <td>Intérêt légitime</td>
            </tr>
            <tr>
              <td>Respecter nos obligations comptables et fiscales</td>
              <td>Obligation légale</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Nous ne vendons pas vos données et ne les utilisons pas à des fins publicitaires.</p>

      <h2>4. Données issues de votre compte Google</h2>
      <p>
        Si vous choisissez « Continuer avec Google », nous recevons uniquement votre nom, votre adresse email et
        l’identifiant de votre compte Google. Ces informations servent seulement à créer votre compte et à vous
        connecter. Nous n’accédons ni à vos emails, ni à vos contacts, ni à vos fichiers Google.
      </p>
      <p>
        L’utilisation et le transfert à toute autre application des informations reçues des API Google respecteront
        le Règlement sur les données utilisateur des services d’API Google, y compris les exigences d’utilisation
        limitée.
      </p>
      <p>
        Vous pouvez retirer l’accès à tout moment depuis la page de sécurité de votre compte Google
        (myaccount.google.com/permissions).
      </p>

      <h2>5. Qui y a accès</h2>
      <p>
        Vos données sont accessibles à l’équipe de JRConsulting et, pour ce qui est nécessaire à leur mission, aux
        prestataires suivants :
      </p>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prestataire</th>
              <th>Rôle</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Hostinger</td>
              <td>Hébergement du site et de la base de données</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Paiement et facturation</td>
            </tr>
            <tr>
              <td>Google</td>
              <td>Connexion avec Google (si vous la choisissez)</td>
            </tr>
            <tr>
              <td>Calendly</td>
              <td>Prise de rendez-vous</td>
            </tr>
            <tr>
              <td>Hostinger</td>
              <td>Envoi des emails du service</td>
            </tr>
            <tr>
              <td>TriumphConsulting à Madagascar</td>
              <td>Création et maintenance des sites, uniquement pour les contenus du projet</td>
            </tr>
            <tr>
              <td>Expert-comptable de JRConsulting</td>
              <td>Comptabilité</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>6. Transferts hors de l’Union européenne</h2>
      <p>Certains prestataires peuvent traiter des données hors de l’Union européenne :</p>
      <ul>
        <li>
          Stripe, Google et Calendly (États-Unis) : transferts encadrés par le cadre de protection des données
          UE–États-Unis ou par les clauses contractuelles types de la Commission européenne ;
        </li>
        <li>
          développeurs à Madagascar : transferts encadrés par les clauses contractuelles types de la Commission
          européenne et limités aux contenus nécessaires au projet.
        </li>
      </ul>

      <h2>7. Durée de conservation</h2>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Données</th>
              <th>Durée</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Compte et espace client</td>
              <td>Pendant la relation contractuelle, puis 3 ans après le dernier contact</td>
            </tr>
            <tr>
              <td>Compte créé sans souscription</td>
              <td>3 ans après la dernière connexion</td>
            </tr>
            <tr>
              <td>Contrat signé et preuves de signature</td>
              <td>5 ans après la fin du contrat</td>
            </tr>
            <tr>
              <td>Factures et pièces comptables</td>
              <td>10 ans</td>
            </tr>
            <tr>
              <td>Contenus de votre site</td>
              <td>Pendant le contrat, puis supprimés 3 mois après sa fin</td>
            </tr>
            <tr>
              <td>Journaux de connexion</td>
              <td>1 an</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>8. Sécurité</h2>
      <p>
        Le site utilise une connexion chiffrée (HTTPS). Les mots de passe sont chiffrés, les accès à
        l’administration sont nominatifs et limités, les documents sont stockés de façon privée et les données sont
        sauvegardées régulièrement.
      </p>

      <h2>9. Vos droits</h2>
      <p>
        Vous pouvez à tout moment accéder à vos données, les rectifier, les supprimer, en limiter l’utilisation, vous
        opposer à leur traitement ou en demander la copie dans un format courant (portabilité). Pour exercer ces
        droits, écrivez à contact@monentrepriselocale.fr. Nous répondons sous un mois.
      </p>
      <p>
        Certaines données ne peuvent pas être supprimées tant que la loi nous oblige à les conserver (contrat,
        factures).
      </p>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (www.cnil.fr).</p>

      <h2>10. Cookies</h2>
      <p>
        Le site utilise uniquement des cookies nécessaires à son fonctionnement (session de connexion, sécurité,
        paiement). Ils ne nécessitent pas votre consentement. Si nous ajoutons un jour des outils de mesure
        d’audience ou de publicité, nous vous demanderons votre accord au préalable.
      </p>

      <h2>11. Sites réalisés pour nos clients</h2>
      <p>
        Pour les données collectées sur les sites que nous créons pour nos clients (formulaires de contact,
        rendez-vous, commandes), le commerçant est responsable du traitement et JRConsulting agit en tant que
        sous-traitant, selon l’accord de traitement des données annexé au contrat.
      </p>

      <h2>12. Modifications</h2>
      <p>
        Nous pouvons modifier cette politique. La date de mise à jour figure en haut de la page. En cas de changement
        important, nous vous prévenons par email.
      </p>
    </LegalLayout>
  );
}
