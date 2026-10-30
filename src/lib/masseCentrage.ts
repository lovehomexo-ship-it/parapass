// ═══════════════════════════════════════════════════════════════════════════
// MASSE ET CENTRAGE — ce que le pilote vérifie avant de mettre les gaz.
//
// La planche additionnait les masses des sauteurs et les comparait à une
// « masse max » : ni l'avion à vide, ni le pilote, ni le carburant n'entraient
// dans le compte, et personne ne savait si l'avion était centré.
//
// Ici, le calcul de la fiche de pesée :
//   moment = Σ masse × bras de levier
//   centre de gravité x = Σ moments / Σ masses          (mètres, depuis la référence)
//   % de corde = (x − distance de référence) / corde aérodynamique moyenne × 100
// puis le point (masse, % de corde) doit tomber dans le domaine de centrage.
//
// Doctrine inchangée : une donnée inconnue n'est JAMAIS inventée. Une masse de
// sauteur absente rend le bilan « incomplet » — c'est un minimum, et l'écran
// le dit — et un bras de levier manquant rend le centrage incalculable.
// ═══════════════════════════════════════════════════════════════════════════

/** Le parachute du pilote, compté dans la masse quand la fiche le demande. */
export const MASSE_PARACHUTE_PILOTE_KG = 10;
const PIEDS_PAR_METRE = 3.28084;

export interface FicheAeronef {
  places: number;
  masse_a_vide_kg?: number | null;
  /** MTOW. */
  masse_max_kg?: number | null;
  /** MLW. */
  masse_max_atterrissage_kg?: number | null;
  parachute_pilote?: boolean | null;
  masse_pilote_kg?: number | null;
  vario_montee_min_ftmin?: number | null;
  vario_montee_max_ftmin?: number | null;
  taux_descente_max_ftmin?: number | null;
  temps_kero_min?: number | null;
  conso_rotation_l?: number | null;
  rotations_par_plein?: number | null;
  reserve_kero_l?: number | null;
  densite_carburant?: number | null;
  corde_mac_m?: number | null;
  distance_reference_m?: number | null;
  domaine_centrage?: [number, number][] | null;
  bras_vide_m?: number | null;
  bras_pilote_m?: number | null;
  bras_carburant_m?: number | null;
  bras_places_m?: (number | null)[] | null;
}

const connu = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const arrondi = (v: number, pas = 1) => Math.round(Math.round(v / pas) * pas * 10) / 10;

// ── Le domaine de centrage ──────────────────────────────────────────────────

/**
 * Lit le domaine tel qu'on le saisit sur une fiche de pesée :
 * « [0,11],[1450,11],[2200,25] » (avec ou sans crochets extérieurs, espaces
 * tolérés). Renvoie null si le texte ne décrit pas au moins un triangle.
 */
export function lireDomaine(texte: string): [number, number][] | null {
  const t = texte.trim();
  if (!t) return null;
  const paires = [...t.matchAll(/\[\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)\s*\]/g)]
    .map(m => [Number(m[1].replace(',', '.')), Number(m[2].replace(',', '.'))] as [number, number]);
  return paires.length >= 3 ? paires : null;
}

export function ecrireDomaine(d: [number, number][] | null | undefined): string {
  return (d ?? []).map(([kg, pct]) => `[${kg},${pct}]`).join(',');
}

/** Le point (masse, % de corde) est-il dans le polygone ? Bord compris. */
export function dansDomaine(domaine: [number, number][], masseKg: number, pct: number): boolean {
  let dedans = false;
  for (let i = 0, j = domaine.length - 1; i < domaine.length; j = i++) {
    const [yi, xi] = domaine[i], [yj, xj] = domaine[j];
    // Sur un bord : dedans.
    const cross = (pct - xi) * (yj - yi) - (masseKg - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-9 && pct >= Math.min(xi, xj) - 1e-9 && pct <= Math.max(xi, xj) + 1e-9
        && masseKg >= Math.min(yi, yj) - 1e-9 && masseKg <= Math.max(yi, yj) + 1e-9) return true;
    if ((yi > masseKg) !== (yj > masseKg)
        && pct < ((xj - xi) * (masseKg - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Les limites avant/arrière du domaine à une masse donnée (pour l'affichage). */
export function limitesA(domaine: [number, number][], masseKg: number): { avant: number; arriere: number } | null {
  const xs: number[] = [];
  for (let i = 0, j = domaine.length - 1; i < domaine.length; j = i++) {
    const [yi, xi] = domaine[i], [yj, xj] = domaine[j];
    if (yi === yj) { if (Math.abs(yi - masseKg) < 1e-9) xs.push(xi, xj); continue; }
    if (masseKg >= Math.min(yi, yj) && masseKg <= Math.max(yi, yj))
      xs.push(xi + ((masseKg - yi) * (xj - xi)) / (yj - yi));
  }
  return xs.length ? { avant: Math.min(...xs), arriere: Math.max(...xs) } : null;
}

// ── Le bilan ────────────────────────────────────────────────────────────────

export type Severite = 'conforme' | 'vigilance' | 'critique' | 'neutre';

export interface PointCentrage {
  masseKg: number;
  /** Centre de gravité en % de corde ; null si un bras manque. */
  pct: number | null;
  dansDomaine: boolean | null;
}

export interface BilanMasse {
  /** Ce qui manque pour un bilan complet, en mots. */
  manques: string[];
  /** Masses de sauteurs inconnues : le total est alors un minimum. */
  massesInconnues: number;
  decollage: PointCentrage | null;
  atterrissage: PointCentrage | null;
  /** Charge restante avant la MTOW (négatif = dépassement). */
  margeDecollageKg: number | null;
  margeAtterrissageKg: number | null;
  /** Le carburant pris en compte au décollage, en litres. */
  carburantL: number | null;
  severite: Severite;
  /** La phrase de la pastille. */
  resume: string;
}

/**
 * @param sieges les masses des sauteurs, DANS L'ORDRE DES SIÈGES (siège n°1
 *               d'abord) — null = masse inconnue.
 * @param carburantL le carburant embarqué ; null = non renseigné.
 */
export function bilanMasseCentrage(av: FicheAeronef, sieges: (number | null)[], carburantL: number | null): BilanMasse {
  const manques: string[] = [];
  if (!connu(av.masse_a_vide_kg)) manques.push('masse à vide');
  if (!connu(av.masse_pilote_kg)) manques.push('masse du pilote');
  if (!connu(carburantL)) manques.push('carburant');

  const massesInconnues = sieges.filter(m => !connu(m)).length;
  const densite = connu(av.densite_carburant) ? av.densite_carburant : 0.8;

  // Sans l'avion à vide, aucun total n'a de sens : on ne dit rien de faux.
  if (!connu(av.masse_a_vide_kg)) {
    return { manques, massesInconnues, decollage: null, atterrissage: null,
      margeDecollageKg: null, margeAtterrissageKg: null, carburantL,
      severite: 'neutre', resume: 'Masse et centrage : fiche de l’avion à compléter' };
  }

  const pilote = (connu(av.masse_pilote_kg) ? av.masse_pilote_kg : 0)
    + (av.parachute_pilote !== false ? MASSE_PARACHUTE_PILOTE_KG : 0);
  const carbDecollageKg = connu(carburantL) ? carburantL * densite : 0;
  const conso = connu(av.conso_rotation_l) ? av.conso_rotation_l : null;
  const carbAtterroL = connu(carburantL) && conso !== null ? Math.max(0, carburantL - conso) : null;
  const carbAtterroKg = carbAtterroL !== null ? carbAtterroL * densite : carbDecollageKg;

  const sauteurs = sieges.reduce<number>((s, m) => s + (connu(m) ? m : 0), 0);

  const bras = av.bras_places_m ?? [];
  const centrageCalculable = connu(av.corde_mac_m) && av.corde_mac_m > 0 && connu(av.distance_reference_m)
    && connu(av.bras_vide_m) && connu(av.bras_pilote_m) && connu(av.bras_carburant_m)
    && sieges.every((m, i) => !connu(m) || connu(bras[i]));
  if (!centrageCalculable && (av.corde_mac_m || av.bras_vide_m || bras.length)) manques.push('bras de levier');
  else if (!centrageCalculable) manques.push('centrage');

  const point = (masseSauteurs: number, carbKg: number, avecSauteurs: boolean): PointCentrage => {
    const masse = av.masse_a_vide_kg! + pilote + carbKg + masseSauteurs;
    if (!centrageCalculable) return { masseKg: arrondi(masse), pct: null, dansDomaine: null };
    let moment = av.masse_a_vide_kg! * av.bras_vide_m! + pilote * av.bras_pilote_m! + carbKg * av.bras_carburant_m!;
    if (avecSauteurs) sieges.forEach((m, i) => { if (connu(m)) moment += m * (bras[i] as number); });
    const x = moment / masse;
    const pct = ((x - av.distance_reference_m!) / av.corde_mac_m!) * 100;
    const d = av.domaine_centrage && av.domaine_centrage.length >= 3 ? dansDomaine(av.domaine_centrage, masse, pct) : null;
    return { masseKg: arrondi(masse), pct: arrondi(pct, 0.1), dansDomaine: d };
  };

  const decollage = point(sauteurs, carbDecollageKg, true);
  // Après le largage, les sauteurs (largueur compris) ont quitté l'avion ;
  // il redescend avec le pilote et le carburant restant.
  const atterrissage = point(0, carbAtterroKg, false);

  const margeDecollageKg = connu(av.masse_max_kg) ? arrondi(av.masse_max_kg - decollage.masseKg) : null;
  const margeAtterrissageKg = connu(av.masse_max_atterrissage_kg)
    ? arrondi(av.masse_max_atterrissage_kg - atterrissage.masseKg) : null;

  // La sévérité : un dépassement CERTAIN est critique même incomplet (un
  // minimum déjà au-dessus de la MTOW le restera) ; un bilan complet et dans
  // les limites est conforme ; le reste se lit « à compléter ».
  let severite: Severite;
  const hors = decollage.dansDomaine === false || atterrissage.dansDomaine === false;
  if ((margeDecollageKg !== null && margeDecollageKg < 0)
      || (margeAtterrissageKg !== null && margeAtterrissageKg < 0) || hors) severite = 'critique';
  else if (massesInconnues > 0 || manques.length > 0) severite = 'neutre';
  else if (margeDecollageKg !== null && margeDecollageKg < 50) severite = 'vigilance';
  else severite = 'conforme';

  const nf = new Intl.NumberFormat('fr-FR');
  const parts: string[] = [];
  parts.push(`${massesInconnues > 0 ? '≥ ' : ''}${nf.format(decollage.masseKg)} kg`
    + (connu(av.masse_max_kg) ? ` / ${nf.format(av.masse_max_kg)}` : ''));
  if (decollage.pct !== null) parts.push(`centrage ${nf.format(decollage.pct)} %`);
  let resume = `Décollage ${parts.join(' · ')}`;
  if (margeDecollageKg !== null && margeDecollageKg < 0) resume += ` — ${nf.format(-margeDecollageKg)} kg de trop`;
  else if (hors) resume += ' — hors domaine de centrage';
  else if (massesInconnues > 0) resume += ` — ${massesInconnues} masse${massesInconnues > 1 ? 's' : ''} inconnue${massesInconnues > 1 ? 's' : ''}`;

  return { manques, massesInconnues, decollage, atterrissage, margeDecollageKg, margeAtterrissageKg,
    carburantL, severite, resume };
}

// ── Le temps d'une rotation ─────────────────────────────────────────────────

export interface DureeRotation {
  /** Montée au vario maximal (la plus rapide) et minimal, en minutes. */
  monteeMin: number; monteeMax: number;
  descente: number | null;
  /** Montée moyenne + descente : le temps d'un tour, hors embarquement. */
  tour: number | null;
}

export function dureeRotation(av: FicheAeronef, altitudeM: number | null): DureeRotation | null {
  if (!connu(altitudeM) || altitudeM <= 0) return null;
  const vmin = connu(av.vario_montee_min_ftmin) && av.vario_montee_min_ftmin > 0 ? av.vario_montee_min_ftmin : null;
  const vmax = connu(av.vario_montee_max_ftmin) && av.vario_montee_max_ftmin > 0 ? av.vario_montee_max_ftmin : vmin;
  if (!vmin || !vmax) return null;
  const pieds = altitudeM * PIEDS_PAR_METRE;
  const monteeMin = Math.round(pieds / vmax), monteeMax = Math.round(pieds / vmin);
  const descente = connu(av.taux_descente_max_ftmin) && av.taux_descente_max_ftmin > 0
    ? Math.round(pieds / av.taux_descente_max_ftmin) : null;
  return { monteeMin, monteeMax, descente,
    tour: descente !== null ? Math.round((monteeMin + monteeMax) / 2) + descente : null };
}

// ── Le carburant au fil de la journée ───────────────────────────────────────

/** Le plein, déduit de la fiche : N rotations + la réserve. */
export function capacitePlein(av: FicheAeronef): number | null {
  return connu(av.conso_rotation_l) && connu(av.rotations_par_plein) && connu(av.reserve_kero_l)
    ? av.conso_rotation_l * av.rotations_par_plein + av.reserve_kero_l : null;
}

export interface CarburantRotation {
  /** Au décollage : relevé si renseigné, sinon estimé. */
  litres: number | null;
  estime: boolean;
  /** Un plein a été (ou doit être) fait avant ce décollage. */
  plein: boolean;
  /** Après ce tour, il ne restera plus de quoi faire le suivant au-dessus de la réserve. */
  keroApres: boolean;
  /** Ce tour entame la réserve. */
  sousReserve: boolean;
}

/**
 * Suit le carburant d'UN avion, rotation après rotation (dans l'ordre des
 * décollages). Un relevé saisi fait foi ; à défaut, on part du relevé
 * précédent moins une consommation, et l'on compte un plein quand le tour ne
 * passerait plus au-dessus de la réserve.
 */
export function suivreCarburant(av: FicheAeronef, releves: (number | null)[]): CarburantRotation[] {
  const conso = connu(av.conso_rotation_l) ? av.conso_rotation_l : null;
  const reserve = connu(av.reserve_kero_l) ? av.reserve_kero_l : 0;
  const plein = capacitePlein(av);
  const out: CarburantRotation[] = [];
  let precedent: number | null = null;
  for (const releve of releves) {
    let litres: number | null; let estime = false; let fait = false;
    if (connu(releve)) {
      litres = releve;
      fait = precedent !== null && conso !== null && releve > precedent - conso + 1;
    } else if (precedent !== null && conso !== null) {
      estime = true;
      litres = precedent - conso;
      if (litres - conso < reserve && plein !== null) { litres = plein; fait = true; }
    } else { litres = null; }
    const apres = litres !== null && conso !== null ? litres - conso : null;
    out.push({
      litres: litres !== null ? Math.round(litres) : null, estime, plein: fait,
      sousReserve: apres !== null && apres < reserve,
      keroApres: apres !== null && conso !== null && apres - conso < reserve,
    });
    precedent = litres;
  }
  return out;
}
