// ═══════════════════════════════════════════════════════════════════════════
// ParaPass — Registre d'icônes vectorielles du sous-système Académie
// ═══════════════════════════════════════════════════════════════════════════
// Remplace les emojis système (grades, thèmes quiz, badges quiz/drill, catégories
// drill, modules) par la famille vectorielle unique (Lucide + glyphe parachute).
// Un seul point de vérité ; rendu identique tous OS/navigateurs.

import type { ComponentType, CSSProperties } from 'react';
import {
  Siren, ClipboardList, CloudSun, Navigation, Mountain,
  BookOpen, Target, Star, Medal, Award, Crown, Sparkles,
  GraduationCap, Gem, Zap, Flame, CalendarDays, Brain, Trophy,
  LifeBuoy, AlertTriangle, Trees, Plane, Snowflake, Globe,
  Package, Euro, Users, Video, Wrench, ShoppingCart, ShieldCheck,
} from 'lucide-react';
import { ParachuteGlyph } from './BadgeIcon';

type GlyphProps = { className?: string; style?: CSSProperties; role?: string; 'aria-label'?: string };
type Glyph = ComponentType<GlyphProps>;

// ── Mappings (clé/id/nom → icône) ──────────────────────────────────────────
const QUIZ_THEME: Record<string, Glyph> = {
  securite: Siren, reglementation: ClipboardList, materiel: ParachuteGlyph,
  meteo: CloudSun, pilotage: Navigation, procedures_dz: Mountain,
};
const GRADE: Record<string, Glyph> = {
  'Élève': BookOpen, 'Breveté': Target, 'Confirmé': Star, 'Expert': Medal,
  'As du savoir': Award, 'Maître du ciel': Crown, 'Légende': Sparkles,
};
const QUIZ_BADGE: Record<string, Glyph> = {
  quiz_premier: GraduationCap, quiz_sans_faute: Gem, quiz_eclair: Zap,
  quiz_streak_3: Flame, quiz_streak_7: CalendarDays, quiz_streak_30: Trophy,
  quiz_xp_100: Medal, quiz_xp_500: Brain, quiz_xp_1200: Crown,
  quiz_theme_securite: Siren, quiz_perfectionniste: Sparkles,
};
const DRILL_CATEGORY: Record<string, Glyph> = {
  incidents_ouverture: ParachuteGlyph, procedures_secours: LifeBuoy,
  collisions_priorites: AlertTriangle, atterrissage_hors_zone: Trees,
  urgences_avion: Plane, meteo_degradee: CloudSun,
};
const DRILL_BADGE: Record<string, Glyph> = {
  drill_premier: Target, drill_streak_7: Flame, drill_streak_30: Zap,
  drill_streak_100: Trophy, drill_sang_froid_5: Snowflake, drill_sang_froid_20: Medal,
  drill_all_categories: Globe, drill_cat_incidents: ParachuteGlyph,
  drill_cat_secours: LifeBuoy, drill_cat_collisions: AlertTriangle,
};
const MODULE: Record<string, Glyph> = {
  pliage: Package, finances: Euro, tandem: Users, academy: GraduationCap,
  studio: Video, materiel: Wrench, manifest: Plane, boutique: ShoppingCart,
  securite: ShieldCheck, evenements: Trophy,
};

function render(map: Record<string, Glyph>, key: string, label: string, color?: string, className = 'w-6 h-6') {
  const G = map[key] ?? Award;
  return <G className={className} style={{ color: color ?? 'currentColor' }} role="img" aria-label={label} />;
}

export const GradeIcon = ({ nom, color, className }: { nom: string; color?: string; className?: string }) => render(GRADE, nom, nom, color, className);
export const QuizThemeIcon = ({ theme, label, color, className }: { theme: string; label: string; color?: string; className?: string }) => render(QUIZ_THEME, theme, label, color, className);
export const QuizBadgeIcon = ({ id, nom, color, className }: { id: string; nom: string; color?: string; className?: string }) => render(QUIZ_BADGE, id, nom, color, className);
export const DrillCategoryIcon = ({ categorie, label, color, className }: { categorie: string; label: string; color?: string; className?: string }) => render(DRILL_CATEGORY, categorie, label, color, className);
export const DrillBadgeIcon = ({ id, nom, color, className }: { id: string; nom: string; color?: string; className?: string }) => render(DRILL_BADGE, id, nom, color, className);
export const ModuleIcon = ({ id, label, color, className }: { id: string; label: string; color?: string; className?: string }) => render(MODULE, id, label, color, className);
