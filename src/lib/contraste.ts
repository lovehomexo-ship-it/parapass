// ═══════════════════════════════════════════════════════════════════════════
// P14 — Le calcul de contraste WCAG, isolé pour être testable.
// ═══════════════════════════════════════════════════════════════════════════

export type RVB = [number, number, number];

export function versRVB(couleur: string): RVB {
  const c = couleur.trim();
  const h = c.match(/^#([0-9a-f]{6})$/i);
  if (h) return [0, 2, 4].map(i => parseInt(h[1].slice(i, i + 2), 16)) as RVB;
  const r = c.match(/^rgba?\(([^)]+)\)$/i);
  if (r) {
    const n = r[1].split(',').map(v => parseFloat(v));
    return [n[0], n[1], n[2]] as RVB;
  }
  throw new Error(`Couleur non reconnue : ${couleur}`);
}

/** Alpha d'un rgba(), 1 sinon. */
export function alphaDe(couleur: string): number {
  const r = couleur.trim().match(/^rgba\(([^)]+)\)$/i);
  if (!r) return 1;
  const n = r[1].split(',').map(v => parseFloat(v));
  return n.length > 3 ? n[3] : 1;
}

/** Aplatit une couleur translucide sur son fond — sans quoi le calcul ment. */
export function aplatir(couleur: string, fond: RVB): RVB {
  const a = alphaDe(couleur);
  const c = versRVB(couleur);
  return c.map((v, i) => v * a + fond[i] * (1 - a)) as RVB;
}

export function luminance([r, g, b]: RVB): number {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contraste(a: RVB, b: RVB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Seuil AA : 3:1 pour ≥18 px, ou ≥14 px gras ; 4,5:1 sinon. */
export function seuilAA(taillePx: number, gras = false): number {
  return taillePx >= 18 || (gras && taillePx >= 14) ? 3 : 4.5;
}
