export type StepDef = {
  code: string;
  title: string;
  description: string;
  phase: number;
  phaseTitle: string;
  /** true = the client advances the step themselves; false = admin only. */
  autonomous: boolean;
};

export const PHASES: { n: number; title: string; autonomous: boolean }[] = [
  { n: 1, title: 'Signature du contrat', autonomous: true },
  { n: 2, title: 'Paiement', autonomous: true },
  { n: 3, title: 'Développement', autonomous: false },
  { n: 4, title: 'Exploitation', autonomous: false },
];

export const STEPS: StepDef[] = [
  {
    code: '1.1',
    title: 'Profil entreprise',
    description: 'Renseignez ou vérifiez les informations légales de votre entreprise à partir de votre SIREN.',
    phase: 1,
    phaseTitle: 'Signature du contrat',
    autonomous: true,
  },
  {
    code: '1.2',
    title: 'Représentant légal',
    description: 'Désignez la personne habilitée à signer le contrat au nom de votre entreprise.',
    phase: 1,
    phaseTitle: 'Signature du contrat',
    autonomous: true,
  },
  {
    code: '1.3',
    title: 'Choix du pack',
    description: 'Sélectionnez la formule adaptée à votre activité et à vos besoins.',
    phase: 1,
    phaseTitle: 'Signature du contrat',
    autonomous: true,
  },
  {
    code: '1.4',
    title: 'Contrat',
    description: 'Prenez connaissance de votre contrat de prestation de services.',
    phase: 1,
    phaseTitle: 'Signature du contrat',
    autonomous: true,
  },
  {
    code: '1.5',
    title: 'Signature du contrat',
    description: 'Signez électroniquement le contrat cadre et l’annexe RGPD pour lancer la création de votre site.',
    phase: 1,
    phaseTitle: 'Signature du contrat',
    autonomous: true,
  },
  {
    code: '2.1',
    title: 'Paiement',
    description: 'Réglez votre abonnement pour démarrer la création de votre site.',
    phase: 2,
    phaseTitle: 'Paiement',
    autonomous: true,
  },
  {
    code: '3.1',
    title: 'Rencontre',
    description: 'Un échange de 30 minutes pour comprendre votre activité et vos attentes.',
    phase: 3,
    phaseTitle: 'Développement',
    autonomous: false,
  },
  {
    code: '3.2',
    title: 'Vos contenus',
    description: 'Transmettez vos textes, photos, logo et informations pratiques.',
    phase: 3,
    phaseTitle: 'Développement',
    autonomous: false,
  },
  {
    code: '3.3',
    title: 'Création',
    description: 'Notre équipe conçoit votre site sur mesure, à votre image.',
    phase: 3,
    phaseTitle: 'Développement',
    autonomous: false,
  },
  {
    code: '3.4',
    title: 'Contrôle qualité',
    description: 'Vérifications techniques, mobile, référencement et performance.',
    phase: 3,
    phaseTitle: 'Développement',
    autonomous: false,
  },
  {
    code: '3.5',
    title: 'Présentation',
    description: 'Découvrez votre site et partagez vos retours avant la mise en ligne.',
    phase: 3,
    phaseTitle: 'Développement',
    autonomous: false,
  },
  {
    code: '3.6',
    title: 'Mise en ligne',
    description: 'Votre site est publié sur votre domaine et indexé par Google.',
    phase: 3,
    phaseTitle: 'Développement',
    autonomous: false,
  },
  {
    code: '4.1',
    title: 'Site en ligne',
    description: 'Votre site est en ligne. Signalez un incident via un ticket si besoin.',
    phase: 4,
    phaseTitle: 'Exploitation',
    autonomous: false,
  },
];

export const STEP_CODES = STEPS.map((s) => s.code);

export const FIRST_STEP = STEP_CODES[0];
export const LAST_STEP = STEP_CODES[STEP_CODES.length - 1];

export function stepByCode(code: string): StepDef | undefined {
  return STEPS.find((s) => s.code === code);
}

export function stepIndex(code: string): number {
  return STEP_CODES.indexOf(code);
}

export function nextStep(code: string): string | null {
  const i = stepIndex(code);
  if (i < 0 || i >= STEP_CODES.length - 1) return null;
  return STEP_CODES[i + 1];
}

export function prevStep(code: string): string | null {
  const i = stepIndex(code);
  if (i <= 0) return null;
  return STEP_CODES[i - 1];
}

/** A step is viewable when it is at or before the current step (no skipping). */
export function canAccessStep(currentStep: string, target: string): boolean {
  const current = stepIndex(currentStep);
  const targetIdx = stepIndex(target);
  if (current < 0 || targetIdx < 0) return false;
  return targetIdx <= current;
}

/** Whether the client is in phase 4 (tickets visible). */
export function isInPhase4(currentStep: string): boolean {
  return stepIndex(currentStep) >= stepIndex('4.1');
}
