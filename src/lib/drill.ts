// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrillScenario {
  id: string;
  situation: string;
  propositions: { id: string; texte: string }[];
  categorie: string;
  niveau_brevet_mini: string | null;
  // bonne_reponse / explication retournés uniquement via RPC
}

export interface DrillResult {
  est_correct: boolean;
  bonne_reponse: string;
  explication: string;
  reference: string | null;
  categorie: string;
  xp_gagnes: number;
  xp_total: number;
  bonus_vitesse: number;
  streak: number;
}

// ─── Catégories ───────────────────────────────────────────────────────────────

export const DRILL_CATEGORIES: Record<string, {
  label: string;
  icone: string;
  color: string;
  bg: string;
  description: string;
}> = {
  incidents_ouverture: {
    label: 'Incidents d\'ouverture',
    icone: '🪂',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.12)',
    description: 'Torsades, déploiements partiels, streamers',
  },
  procedures_secours: {
    label: 'Procédures de secours',
    icone: '🔴',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.12)',
    description: 'Couper, ouvrir secours, altitude de décision',
  },
  collisions_priorites: {
    label: 'Collisions & priorités',
    icone: '⚠️',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    description: 'Face-à-face, priorité au plus bas, dépassements',
  },
  atterrissage_hors_zone: {
    label: 'Atterrissage hors zone',
    icone: '🌲',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    description: 'Câbles, arbres, obstacles, terrain inconnu',
  },
  urgences_avion: {
    label: 'Urgences avion',
    icone: '✈️',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)',
    description: 'Évacuation, moteur, largage d\'urgence',
  },
  meteo_degradee: {
    label: 'Météo dégradée',
    icone: '⛅',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    description: 'Brume, thermiques, vent fort en vol',
  },
};

// ─── Badges drill ─────────────────────────────────────────────────────────────

export const DRILL_BADGES = [
  { id: 'drill_premier',      nom: 'Premier réflexe',     icone: '🔴', description: 'Compléter son premier Réflexe du jour',            rarete: 'commun'    as const },
  { id: 'drill_streak_7',     nom: 'Réflexes affûtés',    icone: '🔥', description: '7 jours consécutifs de réflexe',                  rarete: 'rare'      as const },
  { id: 'drill_streak_30',    nom: 'Automatisme',         icone: '⚡', description: '30 jours consécutifs de réflexe',                 rarete: 'epique'    as const },
  { id: 'drill_streak_100',   nom: 'Instinct',            icone: '🏆', description: '100 jours consécutifs de réflexe',                rarete: 'legendaire'as const },
  { id: 'drill_sang_froid_5', nom: 'Sang-froid',          icone: '🧊', description: '5 bons réflexes d\'affilée',                     rarete: 'rare'      as const },
  { id: 'drill_sang_froid_20',nom: 'Pilote de l\'urgence',icone: '🎖️', description: '20 bons réflexes d\'affilée',                    rarete: 'epique'    as const },
  { id: 'drill_all_categories',nom: 'Toutes situations',  icone: '🌐', description: 'Au moins un bon réflexe dans chaque catégorie',  rarete: 'epique'    as const },
  { id: 'drill_cat_incidents', nom: 'Expert ouvertures',  icone: '🪂', description: 'Maîtriser les incidents d\'ouverture',            rarete: 'rare'      as const },
  { id: 'drill_cat_secours',   nom: 'Expert secours',     icone: '🔴', description: 'Maîtriser les procédures de secours',            rarete: 'rare'      as const },
  { id: 'drill_cat_collisions',nom: 'Expert priorités',   icone: '⚠️', description: 'Maîtriser les collisions & priorités',           rarete: 'rare'      as const },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const DRILL_TIMER_SEC = 15;

export const DRILL_PROP_COLORS = [
  { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)',   label: '#FCA5A5'  },
  { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.4)', label: '#FED7AA'  },
  { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.4)', label: '#93C5FD'  },
  { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.4)', label: '#DDD6FE'  },
];
