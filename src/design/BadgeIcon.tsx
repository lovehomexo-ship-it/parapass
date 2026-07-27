// ═══════════════════════════════════════════════════════════════════════════
// ParaPass — Registre CENTRAL des icônes de badges (famille vectorielle unique)
// ═══════════════════════════════════════════════════════════════════════════
// Remplace les emojis système (🪂🚀🐙🟦💯…) par une seule famille d'icônes
// vectorielles (Lucide + un glyphe parachute maison au même style). Rendu
// strictement identique quel que soit l'OS/navigateur, teinté par la palette
// du design system (couleur du badge). Un seul point de vérité : ajouter/
// modifier un badge = éditer BADGE_ICON_MAP ici.

import type { ComponentType, CSSProperties } from 'react';
import {
  Rocket, PlaneTakeoff, Star, Medal, Trophy, Crown, Sparkles, Zap,
  Moon, Bird, GraduationCap, Users, Target, Globe, Map as MapIcon, Heart, Mountain,
  Cake, PartyPopper, Flame, CalendarDays,
  Circle, Square, Waypoints, Repeat, ListOrdered, Award,
  Armchair, ArrowDown, ArrowUp, CircleDot, Wind,
  ArrowUpRight, Navigation, Feather, RefreshCw, RotateCw, Triangle, PersonStanding,
  Spline, Waves, Gauge, Camera, Clapperboard, Video, Film, Aperture, Images,
} from 'lucide-react';

type GlyphProps = { className?: string; style?: CSSProperties; role?: string; 'aria-label'?: string };
type Glyph = ComponentType<GlyphProps>;

/** Glyphe parachute vectoriel maison — Lucide n'en fournit pas ; même grammaire
 *  (stroke currentColor, 24×24, bouts arrondis) pour rester dans la famille. */
export function ParachuteGlyph({ className, style, ...rest }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true" {...rest}>
      <path d="M2 10a10 7 0 0 1 20 0" />
      <path d="M2 10l4.5 0M22 10l-4.5 0M12 10v0" />
      <path d="M2 10l10 5M22 10l-10 5M7.5 10l4.5 5M16.5 10l-4.5 5" />
      <circle cx="12" cy="16.6" r="1.3" />
      <path d="M12 17.9v3.1" />
    </svg>
  );
}

// ── Mapping badge → icône vectorielle ──────────────────────────────────────
// Choix sémantique par badge ; les réutilisations (Medal/Trophy/Users) restent
// lisibles car chaque badge porte sa propre couleur (rareté/tier).
const BADGE_ICON_MAP: Record<string, Glyph> = {
  // Volume
  premier_saut: ParachuteGlyph, decollage: Rocket, en_route: PlaneTakeoff,
  confirme: Star, centenaire: Medal, veteran: Award, expert: Medal,
  maitre: Trophy, legende: Trophy, icone: Crown, mythe: Sparkles, immortel: Zap,
  // Discipline
  noctambule: Moon, aile: Bird, instructeur_badge: GraduationCap, tandem_badge: Users,
  competiteur: Target, globetrotter: Globe, explorateur: MapIcon, fidele: Heart, altitude_max: Mountain,
  // Temporel
  anniversaire_1an: Cake, anniversaire_5ans: PartyPopper, saison_active: Flame, regulier: CalendarDays,
  // Figures VR
  vr_first_formation: Circle, vr_2way: Users, vr_4way: Square, vr_8way: Waypoints,
  vr_4way_10x: Repeat, vr_sequential: ListOrdered, vr_rw_specialist: Award,
  // Figures freefly
  ff_first_sit: Armchair, ff_first_head_down: ArrowDown, ff_head_up_stable: ArrowUp,
  ff_tube: CircleDot, ff_dynamic: Wind, ff_specialist: Award,
  // Tracking
  track_first: ArrowUpRight, track_group: Users, track_angle_dive: Navigation,
  // Belly / voile
  belly_first_stable: Feather, belly_backfly: RefreshCw, belly_flip: RotateCw,
  belly_delta: Triangle, belly_track_solo: PersonStanding,
  canopy_first_hook: Spline, canopy_swoop: Waves,
  // Disciplines spéciales
  wingsuit_first: Bird, wingsuit_formation: Users, speed_first: Gauge,
  // Équipement / caméra
  camera_first_jump: Camera, camera_10_jumps: Clapperboard, camera_50_jumps: Video,
  camera_tandem_pro: Film, gopro_head: Aperture, two_cameras: Images,
};

/** Icône vectorielle d'un badge par son `type`. Award par défaut (jamais d'emoji). */
export function badgeGlyph(type: string): Glyph {
  return BADGE_ICON_MAP[type] ?? Award;
}

/**
 * Rendu unifié de l'icône d'un badge.
 * - `couleur` : teinte du design system (couleur du badge) ; ignorée si `locked`.
 * - `nom` : libellé accessible (le badge est porteur de sens → role="img").
 * - `locked` : dégrise sans emoji ni filtre sur glyphe raster.
 */
export function BadgeIcon({
  type, nom, couleur, locked = false, className = 'w-8 h-8',
}: {
  type: string; nom: string; couleur?: string; locked?: boolean; className?: string;
}) {
  const Glyph = badgeGlyph(type);
  return (
    <Glyph
      className={className}
      style={{ color: locked ? '#64748B' : (couleur ?? 'currentColor'), opacity: locked ? 0.6 : 1 }}
      role="img"
      aria-label={nom}
    />
  );
}
