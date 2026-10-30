import { describe, it, expect } from 'vitest';
import { rappelsAPrevoir } from './rappelsSecurite';
import { DEFAULT_CURRENCY_RULES } from './currency';

describe('rappels de sécurité à prévoir', () => {
  const regles = DEFAULT_CURRENCY_RULES; // A : conseillé 60 j, obligatoire 180 j

  it('mesure l’interruption à la date de venue, pas aujourd’hui', () => {
    const r = rappelsAPrevoir(
      [{ userId: 'u', date: '2026-11-05' }],
      { u: '2026-05-01' }, { u: 'A' }, regles);
    // 1er mai → 5 novembre : 188 jours, au-delà des 180 j du brevet A.
    expect(r).toEqual([{ userId: 'u', date: '2026-11-05', jours: 188, niveau: 'A', obligatoire: true }]);
  });

  it('distingue conseillé et obligatoire, et ignore qui est à jour', () => {
    const r = rappelsAPrevoir(
      [{ userId: 'a', date: '2026-11-01' }, { userId: 'b', date: '2026-11-01' }, { userId: 'c', date: '2026-11-01' }],
      { a: '2026-10-20', b: '2026-08-01', c: '2026-01-01' }, { a: 'A', b: 'A', c: 'A' }, regles);
    expect(r.map(x => [x.userId, x.obligatoire])).toEqual([['c', true], ['b', false]]);
  });

  it('retient la première venue d’une personne annoncée plusieurs jours', () => {
    const r = rappelsAPrevoir(
      [{ userId: 'u', date: '2026-11-08' }, { userId: 'u', date: '2026-11-02' }],
      { u: '2026-01-01' }, { u: 'D' }, regles);
    expect(r).toHaveLength(1);
    expect(r[0].date).toBe('2026-11-02');
  });

  it('n’invente rien sans saut connu', () => {
    expect(rappelsAPrevoir([{ userId: 'u', date: '2026-11-02' }], {}, { u: 'A' }, regles)).toEqual([]);
  });
});
