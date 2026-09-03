import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contraste, aplatir, versRVB, seuilAA } from './contraste';

// ═══════════════════════════════════════════════════════════════════════════
// P14.1 — Le contrôle de contraste, en test pour qu'il tourne à chaque build.
//
// PORTÉE ET LIMITE, dites franchement : ce test vérifie la PALETTE — chaque
// jeton de couleur contre le fond sur lequel il est effectivement posé, dans
// les deux thèmes. Il n'arpente pas le DOM de /centre/journee : cela
// demanderait un navigateur authentifié en CI. Il attrape donc les fautes de
// SYSTÈME (une couleur d'état illisible en thème clair, un bouton dont le
// libellé blanc passe sous le seuil) et pas les fautes de POSE (un 11 px gris
// écrit à la main dans un composant). Le plancher de 12 px de jetons.ts est là
// pour la seconde catégorie.
// ═══════════════════════════════════════════════════════════════════════════

// Les commentaires sont retirés d'abord : un commentaire contenant « --x : y; »
// serait sinon lu comme une déclaration (c'est arrivé).
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function bloc(selecteur: string): Record<string, string> {
  const i = css.indexOf(selecteur);
  if (i < 0) throw new Error(`Bloc introuvable : ${selecteur}`);
  const corps = css.slice(i, css.indexOf('\n}', i));
  const out: Record<string, string> = {};
  for (const m of corps.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const THEMES = [
  { nom: 'sombre', jetons: bloc('[data-theme="dark"]') },
  { nom: 'clair',  jetons: bloc('[data-theme="light"]') },
] as const;

// Chaque jeton de texte, avec le fond réel et la taille minimale à laquelle on
// s'autorise à l'employer.
const A_VERIFIER: { jeton: string; sur: '--c-bg' | '--c-surface'; px: number; gras?: boolean }[] = [
  { jeton: '--c-text',         sur: '--c-surface', px: 12 },
  { jeton: '--c-text2',        sur: '--c-surface', px: 12 },
  { jeton: '--c-muted',        sur: '--c-surface', px: 12 },
  { jeton: '--sev-critique',   sur: '--c-surface', px: 12 },
  { jeton: '--sev-vigilance',  sur: '--c-surface', px: 12 },
  { jeton: '--sev-conforme',   sur: '--c-surface', px: 12 },
  { jeton: '--sev-neutre',     sur: '--c-surface', px: 12 },
  { jeton: '--action-texte',   sur: '--c-surface', px: 12 },
  { jeton: '--sev-critique',   sur: '--c-bg',      px: 12 },
  { jeton: '--sev-vigilance',  sur: '--c-bg',      px: 12 },
  { jeton: '--sev-conforme',   sur: '--c-bg',      px: 12 },
  { jeton: '--action-texte',   sur: '--c-bg',      px: 12 },
];

describe('P14 — contraste AA de la palette', () => {
  for (const { nom, jetons } of THEMES) {
    for (const { jeton, sur, px, gras } of A_VERIFIER) {
      it(`${nom} · ${jeton} sur ${sur} atteint AA`, () => {
        const fondPage = versRVB(jetons['--c-bg']);
        const fond = sur === '--c-bg' ? fondPage : aplatir(jetons['--c-surface'], fondPage);
        const texte = aplatir(jetons[jeton], fond);
        const r = contraste(texte, fond);
        expect(r, `${jeton} = ${jetons[jeton]} → ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(seuilAA(px, gras));
      });
    }

    it(`${nom} · le blanc du bouton principal atteint AA sur --action-fond`, () => {
      const r = contraste([255, 255, 255], versRVB(jetons['--action-fond']));
      expect(r, `${jetons['--action-fond']} → ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(seuilAA(14, true));
    });

    it(`${nom} · l'anneau de focus se distingue du fond`, () => {
      const fond = versRVB(jetons['--c-bg']);
      const r = contraste(aplatir(jetons['--focus-anneau'], fond), fond);
      expect(r, `${jetons['--focus-anneau']} → ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });
  }

  it('le bleu de marque #1C8CE8 ne peut pas porter de texte blanc — le régression-test le rappelle', () => {
    // Ce test documente POURQUOI --action-fond n'est pas #1C8CE8. Si quelqu'un
    // « rétablit » le bleu de marque sur un bouton plein, il repassera sous AA.
    expect(contraste([255, 255, 255], versRVB('#1C8CE8'))).toBeLessThan(4.5);
  });
});
