export type ModuleStatus = 'live' | 'pack' | 'soon';

export interface Module {
  id: string;
  nom: string;
  desc: string;
  status: ModuleStatus;
  prix?: number; // undefined for roadmap
  // stripe_price_id: string; // TODO: fill in after creating Stripe products
  // Placeholders:
  // pliage   → price_XXXXXXXXXXXXXXXXXXXXXXXX
  // finances → price_XXXXXXXXXXXXXXXXXXXXXXXX
  // tandem   → price_XXXXXXXXXXXXXXXXXXXXXXXX
  // studio   → price_XXXXXXXXXXXXXXXXXXXXXXXX (pack)
  icon: string; // emoji
}

export const MODULES: Module[] = [
  // ── LIVE ──────────────────────────────────────────────────────────────────
  {
    id: 'pliage',
    nom: 'ParaPass Pliage',
    desc: 'Gestion du pliage DT053, QR codes sacs, suivi des plieurs.',
    status: 'live',
    prix: 29.99,
    icon: '🪂',
  },
  {
    id: 'finances',
    nom: 'ParaPass Finances',
    desc: 'Comptabilité DZ, encaissements, exports.',
    status: 'live',
    prix: 19.99,
    icon: '💶',
  },
  {
    id: 'tandem',
    nom: 'ParaPass Tandem',
    desc: 'Réservations et marketplace tandem.',
    status: 'live',
    prix: 19.99,
    icon: '👥',
  },
  // ── PACK ──────────────────────────────────────────────────────────────────
  {
    id: 'studio',
    nom: 'ParaPass Studio',
    desc: 'Tous les modules, présents et à venir. Le plus avantageux.',
    status: 'pack',
    prix: 49.99,
    icon: '⭐',
  },
  // ── ROADMAP ───────────────────────────────────────────────────────────────
  {
    id: 'materiel',
    nom: 'ParaPass Matériel',
    desc: 'Suivi matériel, cycles de pliage secours, échéances DAA/Cypres, contrôles harnais.',
    status: 'soon',
    icon: '🔧',
  },
  {
    id: 'manifest',
    nom: 'ParaPass Manifest',
    desc: 'Rotations avion, gestion des slots, optimisation des chargements.',
    status: 'soon',
    icon: '✈️',
  },
  {
    id: 'boutique',
    nom: 'ParaPass Boutique',
    desc: 'Pro-shop, location de matériel, ventes.',
    status: 'soon',
    icon: '🛒',
  },
  {
    id: 'securite',
    nom: 'ParaPass Sécurité',
    desc: 'Déclaration et suivi des incidents, remontée FFP, statistiques sécurité.',
    status: 'soon',
    icon: '🛡️',
  },
  {
    id: 'evenements',
    nom: 'ParaPass Événements',
    desc: 'Gestion des boogies et compétitions, inscriptions.',
    status: 'soon',
    icon: '🏆',
  },
];

export const LIVE_MODULE_IDS = MODULES.filter((m) => m.status === 'live').map((m) => m.id);

/** Prix total si achetés séparément */
export const PRIX_MODULES_SEPARES = MODULES
  .filter((m) => m.status === 'live')
  .reduce((sum, m) => sum + (m.prix ?? 0), 0);

export const STUDIO = MODULES.find((m) => m.id === 'studio')!;
export const ECONOMIE_STUDIO = Math.round(PRIX_MODULES_SEPARES - STUDIO.prix!);
