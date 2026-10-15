export type PackId = 'essentiel' | 'rendez-vous' | 'boutique';

export type FeatureValue = boolean | string;

export interface PackFeature {
  label: string;
  values: Record<PackId, FeatureValue>;
}

export interface Pack {
  id: PackId;
  name: string;
  subtitle: string;
  color: string;
  headerBg: string;
}

export const packs: Pack[] = [
  {
    id: 'essentiel',
    name: 'Essentiel',
    subtitle: 'Site vitrine',
    color: '#3d5a80',
    headerBg: '#3d5a80',
  },
  {
    id: 'rendez-vous',
    name: 'Rendez-vous',
    subtitle: 'Coiffure, beauté, bien-être',
    color: '#1e4d8c',
    headerBg: '#1e4d8c',
  },
  {
    id: 'boutique',
    name: 'Boutique',
    subtitle: 'Artisans et commerces de bouche',
    color: '#2a6bb5',
    headerBg: '#2a6bb5',
  },
];

export const packFeatures: PackFeature[] = [
  {
    label: 'Site mobile jusqu’à 5 pages, à vos couleurs',
    values: { essentiel: true, 'rendez-vous': true, boutique: true },
  },
  {
    label: 'Textes rédigés et référencement local',
    values: { essentiel: true, 'rendez-vous': true, boutique: true },
  },
  {
    label: 'Fiche Google Business optimisée',
    values: { essentiel: true, 'rendez-vous': true, boutique: true },
  },
  {
    label: 'Hébergement, sécurité, sauvegardes',
    values: { essentiel: true, 'rendez-vous': true, boutique: true },
  },
  {
    label: 'Modifications incluses chaque mois',
    values: { essentiel: '30 min', 'rendez-vous': '1 h', boutique: '1 h' },
  },
  {
    label: 'Réservation en ligne + agenda',
    values: { essentiel: false, 'rendez-vous': true, boutique: false },
  },
  {
    label: 'Rappels par mail',
    values: { essentiel: false, 'rendez-vous': true, boutique: false },
  },
  {
    label: 'Acompte ou prépaiement',
    values: { essentiel: false, 'rendez-vous': 'Option', boutique: true },
  },
  {
    label: 'Catalogue produits (30 inclus)',
    values: { essentiel: false, 'rendez-vous': false, boutique: true },
  },
  {
    label: 'Paiement en ligne sécurisé',
    values: { essentiel: false, 'rendez-vous': 'Option', boutique: true },
  },
  {
    label: 'Retrait sur créneau / livraison locale',
    values: { essentiel: false, 'rendez-vous': false, boutique: true },
  },
  {
    label: 'Support téléphonique',
    values: { essentiel: 'E-mail', 'rendez-vous': true, boutique: true },
  },
  {
    label: 'Mise en ligne',
    values: { essentiel: '5 jours', 'rendez-vous': '7 jours', boutique: '10 jours' },
  },
];
