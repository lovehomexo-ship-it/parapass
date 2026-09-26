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
 * L'échelle de la progression française. BPA (brevet de parachutiste
 * autonome) précède A, puis B, C, D.
 *
 * Ce qui n'est PAS dans cette liste n'est pas un brevet de niveau : WS1, B2…
 * sont des qualifications. Elles se rangent à 0 et ne peuvent jamais devenir
 * le brevet principal — mais elles restent affichées ailleurs, on ne les perd
 * pas, on ne les confond plus.
 */
export const ECHELLE_BREVET: Record<string, number> = {
  BPA: 1, A: 2, B: 3, C: 4, D: 5,
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
  const niveau = ECHELLE_BREVET[type];
  if (niveau === undefined) return false;
  // Le BPA CLÔT la progression PAC : quelqu'un encore en PAC ne l'a pas. Mon
  // premier seuil, à 0, laissait passer un BPA à 7 sauts en pleine PAC —
  // l'incohérence déplacée d'un cran, pas corrigée.
  const planchers: Record<number, number> = { 1: 15, 2: 30, 3: 60, 4: 150, 5: 400 };
  return nbSauts < planchers[niveau];
}
