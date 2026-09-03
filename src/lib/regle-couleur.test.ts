import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rayure } from './jetons';

// ═══════════════════════════════════════════════════════════════════════════
// P13 — « Bleu = action, couleurs d'état = état », rendu vérifiable.
//
// Constat F10 : l'orange portait trois sens sur le même écran — bouton
// principal, alerte, et mesure dégradée. L'utilisateur apprend alors à n'en
// tirer aucune conclusion.
//
// La règle ne tient que si elle est contrôlée. Ce test surveille le PÉRIMÈTRE
// JOURNÉE : les couleurs d'état y passent par les jetons --sev-*, jamais par
// un hexadécimal écrit à la main — ce qui rend impossible d'en faire un fond
// de bouton sans que ça se voie en revue.
//
// Limite assumée : c'est une analyse de source, pas de DOM. Elle n'attrape pas
// un état colorié via une variable calculée ailleurs.
// ═══════════════════════════════════════════════════════════════════════════

const PERIMETRE_JOURNEE = [
  'src/components/DecisionDuJour.tsx',
  'src/components/BarreEtat.tsx',
  'src/components/BasculeMode.tsx',
  'src/components/Tiroir.tsx',
  'src/pages/centre/SurLeTerrain.tsx',
];

/** Couleurs d'ÉTAT du thème sombre, telles qu'elles traînaient en dur. */
const ETATS_EN_DUR = /#(F87171|FBBF24|34D399|F59E0B|F97316|EF4444|10B981|B91C1C|047857)\b/gi;

describe('P13 — action et état ne partagent plus de couleur', () => {
  for (const f of PERIMETRE_JOURNEE) {
    const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    it(`${f} — aucune couleur d'état en dur (elles passent par --sev-*)`, () => {
      expect(src.match(ETATS_EN_DUR) ?? []).toEqual([]);
    });

    it(`${f} — le bleu de marque ne sert pas de fond de bouton`, () => {
      // #1C8CE8 en fond porte du blanc à 3,52:1 : sous AA. Le fond d'action
      // est --action-fond (#136FBC) ; #1C8CE8 reste l'accent d'identité.
      expect(src).not.toMatch(/background:\s*['"]#1C8CE8/i);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// P12.3 — « L'écran reste-t-il lisible en niveaux de gris ? »
//
// La capture désaturée a répondu non, et la mesure l'a confirmé : entre elles,
// les quatre couleurs de sévérité ne dépassent pas 1,5:1 une fois désaturées
// (critique vs neutre : 1,03:1 en thème sombre ; critique vs vigilance : 1,00:1
// en thème clair). Autrement dit la couleur ne pouvait PAS porter la gravité,
// quelle que soit la palette.
//
// Ce sont donc l'ÉPAISSEUR et le TRACÉ qui la portent. Ce test garantit que
// les quatre sévérités restent quatre formes distinctes — si quelqu'un
// réuniformise les rayures à 3 px, il casse la lisibilité en gris et le test
// le dit.
// ═══════════════════════════════════════════════════════════════════════════
describe('P12.3 — la gravité survit à la désaturation', () => {
  it('les quatre sévérités ont quatre rayures de forme différente', () => {
    const formes = (['critique', 'vigilance', 'conforme', 'neutre'] as const)
      .map(s => String(rayure(s).borderLeft).replace(/var\(--sev-\w+\)/, '').trim());
    expect(new Set(formes).size).toBe(4);
  });

  it('la rayure ne se réduit jamais à une couleur seule', () => {
    for (const s of ['critique', 'vigilance', 'conforme', 'neutre'] as const) {
      // Une largeur et un style explicites, pas seulement une teinte.
      expect(String(rayure(s).borderLeft)).toMatch(/^\d+px (solid|dashed|double|dotted) /);
    }
  });
});
