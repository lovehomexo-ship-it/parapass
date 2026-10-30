import { describe, it, expect } from 'vitest';
import { fichePilote, type SortiePilote } from './fichePilote';

const s = (id: string, rang: number, altitudeM: number | null = null): SortiePilote =>
  ({ id, nom: `Sauteur ${id}`, rang, typeSaut: 'solo', altitudeM });

describe('fiche pilote', () => {
  it('regroupe par palier, dans l’ordre de la montée', () => {
    const f = fichePilote([s('a', 1), s('b', 2), s('c', 3, 1500), s('d', 4)], 4000);
    expect(f.paliers.map(p => [p.altitudeM, p.sorties.map(x => x.id)])).toEqual([[1500, ['c']], [4000, ['a', 'b', 'd']]]);
    expect(f.paliers[1].principal).toBe(true);
    expect(f.paliers[1].dernier.id).toBe('d');
  });

  it('alerte le pilote d’un palier bas, et nomme le dernier à sortir', () => {
    const f = fichePilote([s('a', 1), s('b', 2, 1500), s('c', 3, 1500)], 4000);
    expect(f.alertes).toHaveLength(1);
    expect(f.alertes[0].replace(/\s/g, ' ')).toBe(
      'Palier à 1 500 m : 2 sauteurs — tenir le palier jusqu’à la sortie de Sauteur c, pas de remise de puissance avant.');
  });

  it('ne dit rien quand tout le monde sort à l’altitude de l’avion', () => {
    expect(fichePilote([s('a', 1), s('b', 2)], 4000).alertes).toEqual([]);
  });

  it('signale les altitudes inconnues', () => {
    const f = fichePilote([s('a', 1), s('b', 2)], null);
    expect(f.paliers).toEqual([]);
    expect(f.alertes[0]).toMatch(/^2 sauteurs sans altitude/);
  });

  it('sans altitude d’avion, prend le palier le plus peuplé comme principal', () => {
    const f = fichePilote([s('a', 1, 4000), s('b', 2, 4000), s('c', 3, 1200)], null);
    expect(f.paliers.find(p => p.principal)?.altitudeM).toBe(4000);
    expect(f.alertes[0]).toMatch(/^Palier à 1/);
  });
});
