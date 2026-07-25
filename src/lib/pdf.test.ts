import { describe, it, expect } from 'vitest';
import { resolveTotals } from './pdf';

type S = { is_tunnel: boolean; statut: string };
const sauts: S[] = [
  { is_tunnel: false, statut: 'valide' },
  { is_tunnel: false, statut: 'historique' },
  { is_tunnel: false, statut: 'en_attente' },
  { is_tunnel: true, statut: 'valide' }, // soufflerie exclue
];

describe('resolveTotals (export == source unique)', () => {
  it('utilise la source unique quand fournie, sans recompter', () => {
    // Même si le tableau dirait autre chose, on fait autorité au snapshot.
    expect(resolveTotals(sauts, { total: 57, valid: 57 })).toEqual({ total: 57, valid: 57 });
  });

  it('repli sur le tableau si aucune source fournie', () => {
    expect(resolveTotals(sauts)).toEqual({ total: 3, valid: 2 });
  });
});
