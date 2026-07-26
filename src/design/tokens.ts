// ═══════════════════════════════════════════════════════════════════════════
// ParaPass — Système de design : SOURCE UNIQUE DE VÉRITÉ VISUELLE
// ═══════════════════════════════════════════════════════════════════════════
// Ce fichier centralise couleurs, espacements et règles visuelles. Les écrans et
// composants doivent piocher ICI plutôt que de redéfinir des valeurs en dur.
//
// Les surfaces/texte/bordures pointent vers les variables CSS thème-aware
// (définies dans index.css / ThemeContext) → clair & sombre gérés automatiquement.
// Les couleurs d'ACTION et de STATUT sont des constantes de marque (mêmes hex
// partout), volontairement indépendantes du thème.
//
// Ce module ne contient AUCUNE donnée métier. Il ne fait que nommer le visuel.

// ─── Couleurs (tokens sémantiques) ──────────────────────────────────────────
export const color = {
  // Surfaces
  bg: 'var(--c-bg)',                 // fond bleu nuit de page
  surface: 'var(--c-surface)',       // surface de carte
  surfaceElevated: 'var(--c-dropdown)', // carte surélevée / panneau
  hover: 'var(--c-hover)',

  // Texte (niveaux)
  textPrimary: 'var(--c-text)',
  textSecondary: 'var(--c-text2)',
  textTertiary: 'var(--c-muted)',
  textDim: 'var(--c-dim)',

  // Action — UNE SEULE couleur d'action (orange ParaPass), CTA primaires & héros
  action: '#F97316',
  actionSoftBg: 'rgba(249,115,22,0.12)',
  actionSoftBorder: 'rgba(249,115,22,0.40)',

  // Statuts — strictement réservés à leur sens, jamais décoratifs
  ok: '#10B981',       // succès / conforme / validé
  warn: '#F59E0B',     // attention
  danger: '#EF4444',   // danger / expiré / bloquant
  neutral: 'var(--c-muted)', // informatif simple

  // Bordures & séparateurs
  border: 'var(--c-border)',
  borderStrong: 'var(--c-border-f)',
  separator: 'var(--c-border-s)',
} as const;

// Fond + bordure adoucis d'un statut (pastilles, cartes d'alerte).
export const statusSoft = {
  ok:      { color: color.ok,     bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
  warn:    { color: color.warn,   bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
  danger:  { color: color.danger, bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)' },
  neutral: { color: color.neutral, bg: 'var(--c-hover)',        border: color.border },
} as const;
export type StatusKind = keyof typeof statusSoft;

// ─── Règle de couleur des CHIFFRES / compteurs (documentée, sans ambiguïté) ──
// Chaque grand chiffre porte exactement UNE nature → UNE couleur :
//   actionnable  → couleur d'ACTION (orange)      ex. « 21 carnets à valider »
//   conforme     → SUCCÈS (vert)                  ex. « 15 licences à jour »
//   alerte       → ATTENTION (ambre)              ex. « 2 certificats expirants »
//   danger       → DANGER (rouge)                 ex. « 1 licence expirée »
//   informatif   → NEUTRE (texte primaire)        ex. « 12 sauts aujourd'hui »
// Aucune couleur décorative hors de cette règle (pas de violet, cyan, etc.).
export type NumberKind = 'actionnable' | 'conforme' | 'alerte' | 'danger' | 'informatif';
export function numberColor(kind: NumberKind): string {
  switch (kind) {
    case 'actionnable': return color.action;
    case 'conforme':    return color.ok;
    case 'alerte':      return color.warn;
    case 'danger':      return color.danger;
    case 'informatif':  return color.textPrimary;
  }
}

// ─── Échelle d'espacement (multiples d'une unité de base de 4 px) ────────────
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 } as const;

// Règle de rythme : PLUS d'espace entre grandes zones qu'entre cartes d'une même
// zone → le regroupement se lit sans même lire les titres.
export const layout = {
  zoneGap: space['2xl'],    // 32 px — entre grandes zones (Aujourd'hui / Progression…)
  cardGap: space.md,        // 12 px — entre cartes d'une même zone
  cardPadding: space.lg,    // 16 px — marge interne d'une carte
  radius: 16,               // arrondi de carte homogène
} as const;
