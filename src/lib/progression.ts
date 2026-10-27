// ─── Progression technique — source unique ───────────────────────────────────
// Le même calcul « éléments maîtrisés » doit alimenter le widget du dashboard
// ET la page /progression (sinon 8/11 vs 11/11). On centralise ici.

export type TechValue = 'maitrise' | 'en_cours' | 'non' | null | undefined;
export type TechStatus = 'maitrise' | 'en_cours' | 'non' | 'unevaluated';

/** Les 11 éléments techniques suivis (ordre d'affichage). */
export const TECH_ELEMENTS = [
  { key: 'sortie_avion', label: 'Sortie avion' },
  { key: 'retour_face_sol', label: 'Retour face sol' },
  { key: 'vigilance_altitude', label: 'Vigilance altitude' },
  { key: 'ouverture', label: 'Ouverture' },
  { key: 'separation', label: 'Séparation' },
  { key: 'trajectoire', label: 'Trajectoire' },
  { key: 'declenchement', label: 'Déclenchement' },
  { key: 'pilotage_voile', label: 'Pilotage voile' },
  { key: 'circuit_atterro', label: 'Circuit atterro' },
  { key: 'precision_atterro', label: 'Précision atterro' },
  { key: 'gestion_urgences', label: 'Gestion urgences' },
] as const;

/** Nombre de sauts évalués pris en compte pour statuer sur un élément. */
const FENETRE = 10;

/**
 * Statut agrégé d'un élément technique sur les `FENETRE` sauts les plus récents.
 * `jumps` doit être trié du plus récent au plus ancien.
 */
export function techStatus(
  key: string,
  jumps: ReadonlyArray<Record<string, unknown>>
): { status: TechStatus; pct: number } {
  const vals = jumps.slice(0, FENETRE).map((d) => d[key]).filter(Boolean) as string[];
  if (!vals.length) return { status: 'unevaluated', pct: 0 };
  const m = vals.filter((v) => v === 'maitrise').length;
  const e = vals.filter((v) => v === 'en_cours').length;
  const n = vals.filter((v) => v === 'non').length;
  const total = m + e + n;
  if (m >= e && m >= n) return { status: 'maitrise', pct: (m / total) * 100 };
  if (e >= n) return { status: 'en_cours', pct: (e / total) * 100 };
  return { status: 'non', pct: (n / total) * 100 };
}

/**
 * Sauts « à évaluer » (Prompt R) — UNE règle, partagée par l'accueil et la page
 * Progression, qui affichaient 28 et 200 pour le même parachutiste.
 *
 * Comptent : les vrais sauts (hors soufflerie) VALIDÉS ou EN ATTENTE de
 * validation — on évalue son saut au retour du posé, avant que le moniteur
 * signe. Ne comptent pas : l'historique importé d'un carnet papier (personne
 * n'évalue un saut d'il y a dix ans), les déclarations sur l'honneur, les
 * sauts refusés. Un saut est évalué dès qu'il a une note globale.
 */
const STATUTS_EVALUABLES = new Set(['valide', 'en_attente']);

export function sautsAEvaluer<T extends { id: string; is_tunnel?: boolean | null; statut?: string | null }>(
  sauts: ReadonlyArray<T>,
  evaluatedJumpIds: ReadonlySet<string>
): T[] {
  return sauts.filter(s => s.is_tunnel !== true && STATUTS_EVALUABLES.has(s.statut ?? '') && !evaluatedJumpIds.has(s.id));
}

export function countSautsAEvaluer(
  sauts: ReadonlyArray<{ id: string; is_tunnel?: boolean | null; statut?: string | null }>,
  evaluatedJumpIds: ReadonlySet<string>
): number {
  return sautsAEvaluer(sauts, evaluatedJumpIds).length;
}

/**
 * Nombre d'éléments techniques (sur `TECH_ELEMENTS.length`) actuellement
 * maîtrisés. Source unique pour le widget dashboard et la page détail.
 */
export function countMasteredElements(
  jumps: ReadonlyArray<Record<string, unknown>>
): { mastered: number; total: number } {
  const mastered = TECH_ELEMENTS.filter(
    ({ key }) => techStatus(key, jumps).status === 'maitrise'
  ).length;
  return { mastered, total: TECH_ELEMENTS.length };
}
