import { describe, it, expect } from 'vitest';
import { brevetPrincipal, qualificationsHorsEchelle, autresBrevets, brevetIncoherent, ECHELLE_BREVET } from './brevets';

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

  it('le BPA est le PIVOT, pas le premier échelon — il passe devant A et B', () => {
    // Référentiel FFP en base : A (1) · B (2) · … · BPA (10) · C (11) · D (12).
    // Le BPA y est décrit « pivot central… accès C et D ». Ce module le
    // classait sous le A : le brevet A délivré à Florian PUYBAREAU, qui détient
    // déjà le BPA, serait passé devant sur sa carte de licence.
    expect(ECHELLE_BREVET.A).toBeLessThan(ECHELLE_BREVET.B);
    expect(ECHELLE_BREVET.B).toBeLessThan(ECHELLE_BREVET.BPA);
    expect(ECHELLE_BREVET.BPA).toBeLessThan(ECHELLE_BREVET.C);
    expect(brevetPrincipal([{ type_brevet: 'BPA' }])!.type_brevet).toBe('BPA');
    expect(brevetPrincipal([{ type_brevet: 'A' }, { type_brevet: 'BPA' }])!.type_brevet).toBe('BPA');
  });

  it('B1…B5, Bi4, Bi5 sont des qualifications, jamais des échelons', () => {
    // Elles ont pourtant un `ordre` au référentiel (3 à 9) : on ne « monte »
    // pas de B2 à B3, et un B5 ne vaut pas plus qu'un B.
    expect(brevetPrincipal([{ type_brevet: 'B' }, { type_brevet: 'B5' }])!.type_brevet).toBe('B');
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

  it('les seuils tiennent au CODE, pas au rang dans l’échelle', () => {
    // Le référentiel donne un ORDRE, aucun nombre de sauts. Déplacer le BPA
    // dans l'échelle ne doit donc déplacer aucun seuil : les quatre bornes
    // ci-dessous sont exactement celles d'avant la correction de l'échelle.
    expect(brevetIncoherent('BPA', 14)).toBe(true);
    expect(brevetIncoherent('BPA', 15)).toBe(false);
    expect(brevetIncoherent('A', 29)).toBe(true);
    expect(brevetIncoherent('A', 30)).toBe(false);
    expect(brevetIncoherent('B', 59)).toBe(true);
    expect(brevetIncoherent('B', 60)).toBe(false);
    expect(brevetIncoherent('D', 399)).toBe(true);
    expect(brevetIncoherent('D', 400)).toBe(false);
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

describe('autresBrevets — ce qu’on détient et qui n’est pas le principal', () => {
  it('rend les autres brevets, le plus haut d’abord', () => {
    // Le cas réel : Florian PUYBAREAU, BPA obtenu à Big'Air, brevet A délivré
    // par Royan. La carte n'affichait que le principal — le A, pourtant
    // enregistré, n'apparaissait nulle part.
    const tout = [{ type_brevet: 'A' }, { type_brevet: 'BPA' }, { type_brevet: 'WS1' }];
    expect(autresBrevets(tout).map(b => b.type_brevet)).toEqual(['A', 'WS1']);
  });

  it('rien à côté d’un brevet seul', () => {
    expect(autresBrevets([{ type_brevet: 'BPA' }])).toEqual([]);
    expect(autresBrevets([])).toEqual([]);
    expect(autresBrevets(null)).toEqual([]);
  });
});
