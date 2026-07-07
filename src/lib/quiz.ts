// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  enonce: string;
  propositions: { id: string; texte: string }[];
  theme: string;
  niveau_brevet_mini: string | null;
  difficulte: 1 | 2 | 3;
  // bonne_reponse / explication NOT returned to client until answered (RPC handles it)
}

export interface QuizResult {
  est_correcte: boolean;
  bonne_reponse: string;
  explication: string;
  reference: string | null;
  xp_gagnes: number;
  xp_total: number;
  bonus_vitesse: number;
  bonus_diff: number;
}

export interface QuizBadgeDef {
  id: string;
  nom: string;
  icone: string;
  description: string;
  rarete: 'commun' | 'rare' | 'epique' | 'legendaire';
  couleur: string;
}

// ─── Thèmes ───────────────────────────────────────────────────────────────────

export const THEMES: Record<string, { label: string; icone: string; color: string; bg: string }> = {
  securite:      { label: 'Sécurité & urgences',  icone: '🚨', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  reglementation:{ label: 'Réglementation',        icone: '📋', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  materiel:      { label: 'Matériel',              icone: '🪂', color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
  meteo:         { label: 'Météo & aérologie',     icone: '🌤',  color: '#06B6D4', bg: 'rgba(6,182,212,0.1)' },
  pilotage:      { label: 'Pilotage sous voile',   icone: '🎮', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  procedures_dz: { label: 'Procédures DZ',         icone: '🏔️',  color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
};

// ─── Grades par XP cumulé ─────────────────────────────────────────────────────

export const GRADES = [
  { min: 0,    max: 49,    nom: 'Élève',         icone: '📚', color: '#94A3B8' },
  { min: 50,   max: 149,   nom: 'Breveté',       icone: '🎯', color: '#64748B' },
  { min: 150,  max: 349,   nom: 'Confirmé',      icone: '⭐', color: '#16A34A' },
  { min: 350,  max: 699,   nom: 'Expert',        icone: '🏅', color: '#2563EB' },
  { min: 700,  max: 1199,  nom: 'As du savoir',  icone: '🥇', color: '#7C3AED' },
  { min: 1200, max: 1999,  nom: 'Maître du ciel',icone: '👑', color: '#D97706' },
  { min: 2000, max: Infinity, nom: 'Légende',    icone: '🌟', color: '#F59E0B' },
];

export function getGrade(xp: number) {
  return GRADES.find(g => xp >= g.min && xp <= g.max) ?? GRADES[0];
}

export function getProgressToNextGrade(xp: number): { current: number; needed: number; pct: number } {
  const grade = getGrade(xp);
  if (grade.max === Infinity) return { current: xp - grade.min, needed: 0, pct: 100 };
  const current = xp - grade.min;
  const needed = grade.max - grade.min + 1;
  return { current, needed, pct: Math.min(100, Math.round((current / needed) * 100)) };
}

// ─── Badges quiz ──────────────────────────────────────────────────────────────

export const QUIZ_BADGES: QuizBadgeDef[] = [
  { id: 'quiz_premier',       nom: 'Premiers pas',      icone: '🎓', description: 'Compléter son premier quiz', rarete: 'commun',      couleur: '#64748B' },
  { id: 'quiz_sans_faute',    nom: 'Sans faute',        icone: '💎', description: '100% de réponses correctes sur un quiz', rarete: 'rare',   couleur: '#2563EB' },
  { id: 'quiz_eclair',        nom: 'Éclair',            icone: '⚡', description: 'Répondre à 5 questions en moins de 5s chacune', rarete: 'rare', couleur: '#F59E0B' },
  { id: 'quiz_streak_3',      nom: 'Série de 3',        icone: '🔥', description: '3 jours consécutifs de quiz', rarete: 'commun',     couleur: '#F97316' },
  { id: 'quiz_streak_7',      nom: 'Une semaine',       icone: '📅', description: '7 jours consécutifs de quiz', rarete: 'rare',       couleur: '#EF4444' },
  { id: 'quiz_streak_30',     nom: 'Iron Man',          icone: '🏆', description: '30 jours consécutifs de quiz', rarete: 'legendaire', couleur: '#D97706' },
  { id: 'quiz_xp_100',        nom: 'Cent points',       icone: '💯', description: '100 XP Académie cumulés',    rarete: 'commun',      couleur: '#10B981' },
  { id: 'quiz_xp_500',        nom: 'Expert théorique',  icone: '🧠', description: '500 XP Académie cumulés',    rarete: 'epique',      couleur: '#7C3AED' },
  { id: 'quiz_xp_1200',       nom: 'Maître',            icone: '👑', description: '1 200 XP Académie cumulés',  rarete: 'legendaire',  couleur: '#D97706' },
  { id: 'quiz_theme_securite', nom: 'Chef de la sécu',  icone: '🚨', description: 'Maîtriser le thème Sécurité (80%+ sur 10+ questions)', rarete: 'rare', couleur: '#EF4444' },
  { id: 'quiz_perfectionniste',nom: 'Perfectionniste',  icone: '✨', description: '3 quiz parfaits d\'affilée',  rarete: 'epique',      couleur: '#8B5CF6' },
];

export const RARETE_COLORS: Record<string, string> = {
  commun:     '#94A3B8',
  rare:       '#3B82F6',
  epique:     '#8B5CF6',
  legendaire: '#D97706',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const PROPOSITION_COLORS = [
  { bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.5)',  label: '#93C5FD' },
  { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.5)',  label: '#6EE7B7' },
  { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.5)',  label: '#FED7AA' },
  { bg: 'rgba(167,139,250,0.15)',border: 'rgba(167,139,250,0.5)', label: '#DDD6FE' },
];

export function diffLabel(d: number) {
  return d === 1 ? { label: 'Facile', color: '#10B981' }
       : d === 2 ? { label: 'Moyen',  color: '#F59E0B' }
       :           { label: 'Difficile', color: '#EF4444' };
}
