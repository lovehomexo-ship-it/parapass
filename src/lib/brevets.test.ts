import { describe, it, expect } from 'vitest';
import { brevetPrincipal, qualificationsHorsEchelle, brevetIncoherent, ECHELLE_BREVET } from './brevets';

// ═══════════════════════════════════════════════════════════════════════════
// Deux écrans donnaient deux brevets pour la même personne. Cette règle est
// désormais la seule, et ces tests la tiennent.
// ═══════════════════════════════════════════════════════════════════════════

describe('brevetPrincipal — le plus HAUT, pas le plus récent', () => {
  it('rend le niveau le plus élevé, quel que soit l’ordre', () => {
    expect(brevetPrincipal([{ type_brevet: 'A' }, { type_brevet: 'C' }, { type_brevet: 'B' }])!.type_brevet)
      .toBe('C');
  });

  it('une qualification passée APRÈS un brevet ne devient pas le brevet', () => {
    // C'est le défaut réel : la carte triait par date, et « WS1 » obtenu après
    // le D s'affichait comme brevet principal.
    const b = brevetPrincipal([
      { type_brevet: 'D', date_obtention: '2020-01-01' },
      { type_brevet: 'WS1', date_obtention: '2024-01-01' },
    ])!;
    expect(b.type_brevet).toBe('D');
  });

  it('BPA est un brevet, et le plus bas de l’échelle', () => {
    expect(brevetPrincipal([{ type_brevet: 'BPA' }])!.type_brevet).toBe('BPA');
    expect(ECHELLE_BREVET.BPA).toBeLessThan(ECHELLE_BREVET.A);
  });

  it('aucun brevet de niveau : null, jamais un repli inventé', () => {
    expect(brevetPrincipal([{ type_brevet: 'WS1' }, { type_brevet: 'B2' }])).toBeNull();
    expect(brevetPrincipal([])).toBeNull();
    expect(brevetPrincipal(null)).toBeNull();
  });
});

describe('qualificationsHorsEchelle — on ne les perd pas, on ne les confond plus', () => {
  it('sépare les qualifications des niveaux', () => {
    const tout = [{ type_brevet: 'D' }, { type_brevet: 'WS1' }, { type_brevet: 'B2' }];
    expect(qualificationsHorsEchelle(tout).map(b => b.type_brevet)).toEqual(['WS1', 'B2']);
  });
});

describe('brevetIncoherent — SIGNALER, jamais déduire', () => {
  it('un brevet C avec 7 sauts se signale', () => {
    // Le cas réel : Antoine BERGER, 7 sauts, brevet C sur sa licence.
    expect(brevetIncoherent('C', 7)).toBe(true);
  });

  it('un brevet cohérent ne dit rien', () => {
    expect(brevetIncoherent('C', 250)).toBe(false);
    expect(brevetIncoherent('BPA', 20)).toBe(false);
  });

  it('un BPA en pleine PAC se signale — le BPA CLÔT la PAC', () => {
    // Cas réel : Antoine BERGER, 7 sauts, en PAC, à qui mon premier seuil
    // avait donné le BPA. L'incohérence n'était pas corrigée, elle avait
    // changé de place.
    expect(brevetIncoherent('BPA', 7)).toBe(true);
  });

  it('ne se prononce PAS sur ce qu’il ne connaît pas', () => {
    // Aucun texte fédéral connu de ParaPass ne fixe un seuil par brevet :
    // ces bornes signalent une saisie douteuse, elles ne jugent rien.
    expect(brevetIncoherent('WS1', 0)).toBe(false);
    expect(brevetIncoherent(null, 0)).toBe(false);
  });
});
