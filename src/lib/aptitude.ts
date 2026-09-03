// ═══════════════════════════════════════════════════════════════════════════
// P5 / F06 — evaluerAptitude : la RÈGLE D'AGRÉGATION, et rien d'autre.
//
// CE QUE CE MODULE NE FAIT PAS, ET POURQUOI
// Il ne recalcule pas les motifs. Ceux-ci viennent de get_aptitude_du_jour,
// qui lit regles_aptitude — une table PARAMÉTRABLE PAR CENTRE. Réimplémenter
// ici « licence expirée ? certificat périmé ? » créerait un second calcul
// parallèle qui finirait par diverger du premier. C'est très exactement ce qui
// avait produit une jauge de conformité à 112 %.
//
// Ce module ne détient donc qu'une chose, mais la détient seule : COMMENT une
// liste de motifs devient un statut. Trois lignes de règle, employées à
// l'écran comme au test.
//
// SÉVÉRITÉ DU BRIEFING — décision prise et assumée
// Le briefing non acquitté reste `vigilance`, pas `blocage`. Le briefing
// s'acquitte le matin : le rendre bloquant mettrait tout le monde en rouge
// chaque jour jusqu'à 9 h, et un rouge vrai tous les matins cesse d'être lu.
// La règle du projet le dit d'ailleurs : « l'application n'interdit jamais un
// saut. Elle informe, elle trace, le DT décide. »
// C'est une DONNÉE, pas du code : regles_aptitude.severite, par centre. Un
// centre qui veut le rendre bloquant le fait sans redéploiement.
// ═══════════════════════════════════════════════════════════════════════════

export type SeveriteMotif = 'info' | 'vigilance' | 'blocage';
export type StatutAptitude = 'vert' | 'orange' | 'rouge';

export interface MotifAptitude {
  code: string;
  severite: SeveriteMotif;
  /** Dérogation posée par le DT ce jour : le motif reste visible, il ne pèse plus. */
  levee: boolean;
}

export interface Aptitude {
  statut: StatutAptitude;
  /** Blocages NON levés. Les motifs levés restent affichés mais ne comptent pas. */
  blocages: number;
  vigilances: number;
}

/**
 * @example  // un blocage non levé l'emporte sur tout
 *   evaluerAptitude([{ code: 'licence_ffp', severite: 'blocage', levee: false }])
 *   // → { statut: 'rouge', blocages: 1, vigilances: 0 }
 *
 * @example  // levé par le DT : le motif reste, la couleur tombe
 *   evaluerAptitude([{ code: 'licence_ffp', severite: 'blocage', levee: true }])
 *   // → { statut: 'vert', blocages: 0, vigilances: 0 }
 */
export function evaluerAptitude(motifs: readonly MotifAptitude[]): Aptitude {
  const vifs = motifs.filter(m => !m.levee);
  const blocages = vifs.filter(m => m.severite === 'blocage').length;
  const vigilances = vifs.filter(m => m.severite === 'vigilance').length;
  // `info` ne colore rien : c'est un renseignement, pas un manquement.
  const statut: StatutAptitude = blocages > 0 ? 'rouge' : vigilances > 0 ? 'orange' : 'vert';
  return { statut, blocages, vigilances };
}

/** Ordre d'affichage : ce qui coince en premier (règle 2 — l'ordre du geste). */
export const RANG_STATUT: Record<StatutAptitude, number> = { rouge: 0, orange: 1, vert: 2 };

/**
 * Compare le statut calculé ici à celui rendu par le serveur.
 *
 * Le but n'est pas de corriger le serveur — c'est lui qui fait autorité — mais
 * de RENDRE VISIBLE une divergence au lieu de la laisser s'installer. Deux
 * chiffres qui se contredisent en silence, c'est la panne qu'on ne voit qu'au
 * moment où un DT prend une décision dessus.
 *
 * N'écrit qu'en console, et seulement en développement.
 */
export function signalerDivergence(
  qui: string, statutServeur: StatutAptitude, motifs: readonly MotifAptitude[],
): void {
  if (!import.meta.env?.DEV) return;
  const local = evaluerAptitude(motifs).statut;
  if (local !== statutServeur) {
    console.warn(
      `[aptitude] divergence pour ${qui} : le serveur dit « ${statutServeur} », `
      + `les motifs disent « ${local} ». Motifs :`, motifs);
  }
}
