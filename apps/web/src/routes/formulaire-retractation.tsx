import type { Route } from './+types/formulaire-retractation';
import { seo } from '@/lib/seo';
import { LegalLayout } from '@/components/legal-layout';
import { PROVIDER } from '@/data/provider';

export function meta({ matches, location }: Route.MetaArgs) {
  return seo({ matches, location }, {
    title: 'Formulaire de rétractation — Mon Entreprise Locale',
    description: 'Formulaire type de rétractation, à adresser à JRConsulting dans le délai de 14 jours lorsqu’il s’applique.',
  });
}

export default function FormulaireRetractation() {
  return (
    <LegalLayout title="Formulaire de rétractation" updated="octobre 2026">
      <p>
        À compléter et à renvoyer uniquement si le droit de rétractation de 14 jours s’applique à votre contrat.
        Adressez-le à {PROVIDER.name}, {PROVIDER.address}, ou par e-mail à {PROVIDER.email}.
      </p>
      <h2>Formulaire type</h2>
      <p>
        À l’attention de {PROVIDER.name}, {PROVIDER.address}, {PROVIDER.email} :
      </p>
      <p>
        Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de création de site web
        commandée le ______________ (date de signature).
      </p>
      <ul>
        <li>Nom du consommateur : ______________________________</li>
        <li>Dénomination : ______________________________</li>
        <li>Adresse : ______________________________</li>
        <li>E-mail : ______________________________</li>
        <li>Date : ______________________________</li>
        <li>Signature (si envoi papier) : ______________________________</li>
      </ul>
      <p>
        Si vous avez demandé que les travaux commencent avant la fin du délai, un montant proportionné au service déjà
        fourni peut rester dû.
      </p>
    </LegalLayout>
  );
}
