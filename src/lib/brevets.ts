// ═══════════════════════════════════════════════════════════════════════════
// LE BREVET PRINCIPAL — une seule règle, pour tous les écrans.
//
// CE QUI N'ALLAIT PAS : deux sources répondaient à « quel brevet a cette
// personne ». La carte de licence lisait la table `brevets`, la planche
// d'avionnage lisait `profiles.type_brevet_principal`. Les deux divergeaient —
// mesuré sur BigAir : Antoine BERGER, 7 sauts, « pas de brevet » sur la
// planche et « brevet C » sur sa licence ; Thomas LAURENT, « C » d'un côté,
// « B » de l'autre ; Sophie MARTIN, rien d'un côté, « B » de l'autre.
//
// La table `brevets` fait foi : elle porte une DATE D'OBTENTION et un numéro,
// donc une preuve. Un champ texte sur le profil n'en porte aucune.
//
// LE PLUS HAUT, PAS LE PLUS RÉCENT. La carte prenait `brevets[0]` trié par
// date : quelqu'un qui passe une qualification wingsuit après son brevet D
// voyait « WS1 » s'afficher comme brevet principal. On classe donc par NIVEAU.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * L'échelle de la progression française, RECOPIÉE du référentiel FFP tel qu'il
 * est saisi en base (`brevets_referentiel.ordre`, source « Manuel FFP 2026
 * (CA 27-03-2026) + DT49 ») :
 *
 *     A (1) · B (2) · B1…B5, Bi4, Bi5 (3-9) · BPA (10) · C (11) · D (12)
 *
 * LE BPA N'EST PAS LE PREMIER ÉCHELON, C'EST LE PIVOT. Le référentiel le
 * décrit ainsi : « Pivot central. Prérogatives : pratique autonome ; vidéo
 * chute/sous voile ; ACCÈS C ET D ; accès CQP plieur secours. » Il se situe
 * après le B, avant le C. Ce module le classait sous le A — une invention, et
 * elle contredisait la seule source citée de l'application.
 *
 * Les rangs 3 à 9 du référentiel (B1…B5, Bi4, Bi5) sont des QUALIFICATIONS, pas
 * des échelons : on ne « monte » pas de B2 à B3. Elles restent hors de cette
 * liste, se rangent à 0, ne peuvent jamais devenir le brevet principal — mais
 * elles sont affichées, on ne les perd pas, on ne les confond plus.
 */
export const ECHELLE_BREVET: Record<string, number> = {
  A: 1, B: 2, BPA: 3, C: 4, D: 5,
};

export interface BrevetLu {
  type_brevet: string;
  date_obtention?: string | null;
}

/** Le brevet de plus haut niveau réellement détenu. null si aucun. */
export function brevetPrincipal<T extends BrevetLu>(brevets: T[] | null | undefined): T | null {
  if (!brevets || brevets.length === 0) return null;
  const classes = brevets.filter(b => ECHELLE_BREVET[b.type_brevet] !== undefined);
  if (classes.length === 0) return null;
  return classes.reduce((a, b) =>
    ECHELLE_BREVET[b.type_brevet] > ECHELLE_BREVET[a.type_brevet] ? b : a);
}

/** Les qualifications présentes dans la table des brevets — jamais un niveau. */
export function qualificationsHorsEchelle<T extends BrevetLu>(brevets: T[] | null | undefined): T[] {
  return (brevets ?? []).filter(b => ECHELLE_BREVET[b.type_brevet] === undefined);
}

/**
 * Le brevet attendu au vu de l'expérience — pour SIGNALER une incohérence,
 * jamais pour en déduire un brevet.
 *
 * ParaPass ne connaît AUCUN texte fédéral fixant un nombre de sauts par
 * brevet, et P2 interdit d'en inventer un. Ces bornes servent uniquement à
 * dire « ce dossier mérite un coup d'œil » : un brevet C avec 7 sauts est
 * une saisie douteuse, pas une infraction.
 */
export function brevetIncoherent(type: string | null | undefined, nbSauts: number): boolean {
  if (!type) return false;
  // Ces bornes sont attachées au CODE du brevet, pas à son rang. Corriger la
  // place du BPA dans l'échelle ne doit pas déplacer en silence un seuil que
  // le référentiel ne fixe nulle part : le référentiel donne un ORDRE, il ne
  // donne aucun nombre de sauts. P2 — on ne dérive pas une règle d'une autre.
  //
  // Le BPA clôt la progression PAC : quelqu'un encore en PAC ne l'a pas. Un
  // premier seuil à 0 laissait passer un BPA à 7 sauts en pleine PAC.
  const PLANCHERS: Record<string, number> = { BPA: 15, A: 30, B: 60, C: 150, D: 400 };
  const plancher = PLANCHERS[type];
  if (plancher === undefined) return false;
  return nbSauts < plancher;
}

/**
 * Les AUTRES brevets détenus — tout sauf le principal, le plus haut d'abord,
 * les qualifications à la suite.
 *
 * La carte de licence n'affichait que le principal. Un brevet A délivré à
 * quelqu'un qui détient déjà le BPA n'apparaissait donc nulle part : la
 * délivrance était bien enregistrée, et invisible.
 */
export function autresBrevets<T extends BrevetLu>(brevets: T[] | null | undefined): T[] {
  const principal = brevetPrincipal(brevets);
  return (brevets ?? [])
    .filter(b => b !== principal)
    .sort((a, b) => (ECHELLE_BREVET[b.type_brevet] ?? 0) - (ECHELLE_BREVET[a.type_brevet] ?? 0));
}
