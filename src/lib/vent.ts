// ═══════════════════════════════════════════════════════════════════════════
// P3 / F04 — LE VENT : une unité, une origine, un horodatage.
//
// Constat mesuré : le vent vient de DEUX endroits qui ne disent pas la même
// chose, et l'écran ne précise jamais lequel il montre.
//
//   1. dz_briefings.vent_vitesse_kt / vent_direction_deg
//      → une OBSERVATION, saisie par le DT au moment du briefing. Horodatée
//        par published_at. Elle vieillit : à 16 h, le vent de 8 h ne dit plus
//        rien.
//   2. Open-Meteo (meteoAltitude)
//      → une PRÉVISION de modèle, en km/h, reconvertie en nœuds à quatre
//        endroits différents. Ni aéronautique, ni certifiée.
//
// Les confondre est le genre d'erreur qui se paie au sol. Ce module impose
// donc que tout vent affiché porte son origine ET son heure, et signale au DT
// quand son relevé du matin a dérivé de la prévision courante.
//
// Le nœud est l'unité d'affichage unique : c'est celle des seuils du centre
// (vent_max_kt, vent_orange_kt) et celle du milieu aéronautique. Le km/h ne
// survit que comme unité d'entrée de l'API.
// ═══════════════════════════════════════════════════════════════════════════

/** LA conversion. Une seule dans le projet — meteoAltitude la ré-exporte. */
export const kmhEnKt = (kmh: number): number => Math.round(kmh * 0.539957);

export type OrigineVent = 'briefing' | 'prevision';

export interface Vent {
  /** Nul quand le DT n'a pas renseigné le vent au briefing. */
  vitesseKt: number | null;
  /** Direction D'OÙ VIENT le vent, en degrés. */
  directionDeg: number | null;
  origine: OrigineVent;
  /** ISO. Pour le briefing : published_at. Pour la prévision : l'heure visée. */
  horodatage: string;
}

const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function heureDe(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : HEURE.format(d).replace(':', ' h ');
}

/**
 * Valeur seule, sans origine. À n'employer que si le libellé d'origine est
 * déjà porté par le conteneur.
 *
 * @example  formaterVent({ vitesseKt: 18, directionDeg: 240, … }) // "18 kt · 240°"
 */
export function formaterVent(v: Vent): string {
  if (v.vitesseKt == null && v.directionDeg == null) return 'non renseigné';
  const bouts: string[] = [];
  if (v.vitesseKt != null) bouts.push(`${Math.round(v.vitesseKt)} kt`);
  if (v.directionDeg != null) bouts.push(`${Math.round(v.directionDeg)}°`);
  return bouts.join(' · ');
}

/**
 * D'où vient ce chiffre, et de quand il date. JAMAIS optionnel à l'affichage :
 * un vent sans origine ni heure est un vent sur lequel on ne peut pas décider.
 *
 * @example  "relevé au briefing de 08 h 12"
 * @example  "prévision Open-Meteo pour 14 h 00"
 */
export function libelleOrigine(v: Vent): string {
  return v.origine === 'briefing'
    ? `relevé au briefing de ${heureDe(v.horodatage)}`
    : `prévision Open-Meteo pour ${heureDe(v.horodatage)}`;
}

/** Vent complet, prêt à poser à l'écran. */
export function libelleVent(v: Vent): string {
  return `${formaterVent(v)} — ${libelleOrigine(v)}`;
}

// ── Dérive ─────────────────────────────────────────────────────────────────

/** Au-delà, le relevé du briefing ne décrit plus le vent qu'il y a dehors. */
export const SEUIL_DERIVE_KT = 5;
export const SEUIL_DERIVE_DEG = 30;

/** Écart angulaire le plus court entre deux caps, dans [0, 180]. */
export function ecartAngulaire(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

export interface Derive {
  ecartKt: number | null;
  ecartDeg: number | null;
  /** Vrai dès qu'un des deux seuils est franchi. */
  derive: boolean;
  /** Phrase prête à afficher, ou null s'il n'y a rien à signaler. */
  message: string | null;
}

/**
 * Compare le relevé du briefing à la prévision de l'heure courante.
 *
 * L'application n'interdit rien (règle du projet) : elle dit au DT que son
 * relevé du matin a vieilli, et le laisse décider de le reprendre.
 *
 * @example
 *   ecartVent({ vitesseKt: 12, directionDeg: 240, … }, { vitesseKt: 19, … })
 *   // → derive: true, "Le vent a forci de 7 kt depuis le briefing de 08 h 12."
 */
export function ecartVent(briefing: Vent, prevision: Vent): Derive {
  const ecartKt = briefing.vitesseKt != null && prevision.vitesseKt != null
    ? Math.round(prevision.vitesseKt - briefing.vitesseKt) : null;
  const ecartDeg = briefing.directionDeg != null && prevision.directionDeg != null
    ? Math.round(ecartAngulaire(briefing.directionDeg, prevision.directionDeg)) : null;

  const tropFort = ecartKt != null && Math.abs(ecartKt) >= SEUIL_DERIVE_KT;
  const tropTourne = ecartDeg != null && ecartDeg >= SEUIL_DERIVE_DEG;
  if (!tropFort && !tropTourne) return { ecartKt, ecartDeg, derive: false, message: null };

  const bouts: string[] = [];
  if (tropFort) {
    bouts.push(ecartKt! > 0
      ? `a forci de ${ecartKt} kt`
      : `est tombé de ${Math.abs(ecartKt!)} kt`);
  }
  if (tropTourne) bouts.push(`a tourné de ${ecartDeg}°`);
  return {
    ecartKt, ecartDeg, derive: true,
    message: `Le vent ${bouts.join(' et ')} depuis le ${libelleOrigine(briefing)}. `
           + 'Le circuit affiché peut ne plus correspondre.',
  };
}
