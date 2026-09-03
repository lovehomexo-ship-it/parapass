import type { CSSProperties } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// P12 / P13 / P15 — LE SYSTÈME VISUEL, EN UN SEUL ENDROIT.
//
// Constat F09 : les quatorze blocs de l'écran partageaient le même rayon, le
// même fond, la même bordure et la même ombre. La gravité n'était portée que
// par la couleur d'un mot. Rien ne disait par où commencer.
//
// Trois niveaux, quatre sévérités, une couleur d'action. Le type interdit un
// quatrième niveau : si un bloc n'entre dans aucun des trois, il est mal placé
// dans la page — c'est un problème de composition, pas de style.
//
// Les valeurs vivent dans src/index.css (jetons --n1/--n2/--n3, --sev-*,
// --action-*) pour être dépendantes du thème. Ce module ne fait que les
// assembler en objets de style réutilisables.
// ═══════════════════════════════════════════════════════════════════════════

/** 1 = décision (un seul par écran) · 2 = travail · 3 = rappel. Pas de 4. */
export type NiveauSurface = 1 | 2 | 3;

/** La rayure porte la gravité (règle 5) ; la couleur ne fait que confirmer. */
export type Severite = 'critique' | 'vigilance' | 'conforme' | 'neutre';

/**
 * Surface d'un bloc.
 *
 * @example  // le bloc de décision du jour, unique
 *   <section style={surface(1)}>…</section>
 * @example  // un bloc de travail : le tableau du terrain
 *   <section style={surface(2)}>…</section>
 * @example  // un rappel : une rangée séparée par un filet, sans conteneur
 *   <div style={surface(3)}>Dernière météo relevée à 08 h 12</div>
 */
export function surface(niveau: NiveauSurface): CSSProperties {
  switch (niveau) {
    case 1:
      // Dégradé + bordure marquée + ombre portée. L'élévation est ce qui
      // survit à la désaturation : en niveaux de gris, ce bloc reste le seul
      // à décoller de la page.
      return {
        background: 'var(--n1-fond)',
        border: '1px solid var(--n1-bord)',
        boxShadow: 'var(--n1-ombre)',
        borderRadius: 20,
      };
    case 2:
      // Plat, bordure fine, aucune ombre. C'est la masse de l'écran.
      return {
        background: 'var(--n2-fond)',
        border: '1px solid var(--n2-bord)',
        borderRadius: 16,
      };
    case 3:
      // Pas de conteneur du tout : un filet, et c'est tout.
      return {
        background: 'transparent',
        borderTop: '1px solid var(--n3-filet)',
        borderRadius: 0,
      };
  }
}

/** Couleur d'une sévérité. À n'utiliser QUE via {@link rayure} ou {@link pastille}. */
export const SEVERITE_COULEUR: Record<Severite, string> = {
  critique:  'var(--sev-critique)',
  vigilance: 'var(--sev-vigilance)',
  conforme:  'var(--sev-conforme)',
  neutre:    'var(--sev-neutre)',
};

/**
 * Rayure de bord — SIGNAL PRIMAIRE de gravité.
 *
 * MESURÉ : avec une rayure de 3 px identique pour les quatre sévérités, la
 * capture désaturée les rend indiscernables — les quatre gris ont presque la
 * même luminance. La couleur portait donc encore tout le travail, ce que la
 * règle 5 interdit. Chaque sévérité a désormais son ÉPAISSEUR et son TRACÉ :
 *
 *   critique   5 px plein     — le plus épais, le plus sombre
 *   vigilance  5 px tireté    — même poids, tracé interrompu
 *   conforme   2 px plein     — discret
 *   neutre     1 px plein     — presque un filet
 *
 * @example
 *   <li style={rayure('critique')}>Licence FFP expirée</li>
 */
const TRAIT: Record<Severite, { px: number; style: string }> = {
  critique:  { px: 5, style: 'solid' },
  vigilance: { px: 5, style: 'dashed' },
  conforme:  { px: 2, style: 'solid' },
  neutre:    { px: 1, style: 'solid' },
};

export function rayure(s: Severite): CSSProperties {
  const t = TRAIT[s];
  // La largeur totale reste constante (5 px) : les libellés restent alignés
  // d'une ligne à l'autre, seul le trait change de poids.
  return {
    borderLeft: `${t.px}px ${t.style} ${SEVERITE_COULEUR[s]}`,
    paddingLeft: 5 - t.px,
  };
}

/**
 * Pastille de texte — SIGNAL SECONDAIRE. Ne remplace jamais la rayure.
 *
 * @example
 *   <span style={pastille('vigilance')}>Vigilance</span>
 */
export function pastille(s: Severite): CSSProperties {
  return {
    color: SEVERITE_COULEUR[s],
    // Teinte à faible opacité — jamais couleur saturée sur couleur saturée
    // (P14.4 : « Plafond 900 m » faisait 1,09:1 en rouge sur rouge sombre).
    background: `color-mix(in srgb, ${SEVERITE_COULEUR[s]} 14%, transparent)`,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  };
}

// ── P13 — Action ≠ état ────────────────────────────────────────────────────
// Vert, ambre et rouge ne décrivent que des états et ne sont jamais cliquables
// en tant que tels. Un seul bouton PLEIN par bloc.

/**
 * @example  <button style={action('principal')}>Ouvrir le briefing</button>
 * @example  <button style={action('secondaire')}>Reporter</button>
 * @example  <button style={action('texte')}>lever avec motif</button>
 */
export function action(rang: 'principal' | 'secondaire' | 'texte'): CSSProperties {
  const base: CSSProperties = {
    minHeight: 44, borderRadius: 12, fontWeight: 700, fontSize: 14,
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px',
  };
  if (rang === 'principal') {
    // #136FBC et non #1C8CE8 : le blanc sur le bleu de marque ne fait que
    // 3,52:1 et échoue AA. Même bleu, assombri de ce qu'il faut (5,21:1).
    return { ...base, background: 'var(--action-fond)', color: '#fff', border: '1px solid transparent' };
  }
  if (rang === 'secondaire') {
    return { ...base, background: 'transparent', color: 'var(--action-texte)',
             border: '1px solid var(--action-texte)' };
  }
  return { ...base, background: 'transparent', color: 'var(--action-texte)',
           border: 'none', padding: 0, minHeight: 32, fontSize: 13, textDecoration: 'underline' };
}

// ── P14 — Typographie ──────────────────────────────────────────────────────

/**
 * En-tête de section : 13 px / 700 / 0,08 em, posé sur un filet qui traverse
 * la colonne. Avant : 12 px gris à 2,5:1 — la structure existait dans le code,
 * pas à l'écran.
 *
 * @example  <h2 style={enTeteSection}>Décision du jour</h2>
 */
export const enTeteSection: CSSProperties = {
  fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--c-text2)', paddingBottom: 6, marginBottom: 12,
  borderBottom: '1px solid var(--n3-filet)',
};

/** Plancher typographique : aucun texte informatif sous 12 px. */
export const TAILLE_MIN_INFORMATIVE = 12;
