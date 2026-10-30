import { describe, it, expect } from 'vitest';
import {
  bilanMasseCentrage, dansDomaine, lireDomaine, ecrireDomaine, limitesA,
  dureeRotation, suivreCarburant, capacitePlein, type FicheAeronef,
} from './masseCentrage';

// Le Pilatus de démo : valeurs d'exemple d'un PC-6 (corde 1,9 m, référence 3,0 m).
const PC6: FicheAeronef = {
  places: 10, masse_a_vide_kg: 1410, masse_max_kg: 2800, masse_max_atterrissage_kg: 2660,
  parachute_pilote: true, masse_pilote_kg: 85, densite_carburant: 0.8,
  vario_montee_min_ftmin: 1000, vario_montee_max_ftmin: 1500, taux_descente_max_ftmin: 4500,
  conso_rotation_l: 55, rotations_par_plein: 4, reserve_kero_l: 100,
  corde_mac_m: 1.9, distance_reference_m: 3.0,
  domaine_centrage: [[0, 11], [1450, 11], [2200, 25], [2800, 32], [2800, 38], [0, 38]],
  bras_vide_m: 3.376, bras_pilote_m: 3.05, bras_carburant_m: 3.93,
  bras_places_m: [3.05, 3.55, 4.05, 4.55, 5.05, 3.65, 4.15, 4.65, 5.15, 3.55],
};

describe('domaine de centrage', () => {
  it('se lit comme sur la fiche de pesée, et se réécrit', () => {
    const d = lireDomaine('[0,11],[1450,11],[2200,25],[2200,34],[0,34]');
    expect(d).toEqual([[0, 11], [1450, 11], [2200, 25], [2200, 34], [0, 34]]);
    expect(ecrireDomaine(d)).toBe('[0,11],[1450,11],[2200,25],[2200,34],[0,34]');
    expect(lireDomaine(' [ 0 ; 11,5 ] , [1450,11] [2200,25] ')).toEqual([[0, 11.5], [1450, 11], [2200, 25]]);
    expect(lireDomaine('[0,11],[1450,11]')).toBeNull();
    expect(lireDomaine('')).toBeNull();
  });

  it('dit si un point est dedans, bord compris', () => {
    const d = PC6.domaine_centrage!;
    expect(dansDomaine(d, 2500, 30)).toBe(true);
    expect(dansDomaine(d, 2500, 27)).toBe(false);   // devant la limite avant (28,6 %)
    expect(dansDomaine(d, 2500, 39)).toBe(false);
    expect(dansDomaine(d, 2900, 35)).toBe(false);   // au-dessus de la MTOW du domaine
    expect(dansDomaine(d, 1000, 11)).toBe(true);    // sur le bord
  });

  it('donne les limites avant et arrière à une masse', () => {
    const l = limitesA(PC6.domaine_centrage!, 2500)!;
    expect(l.avant).toBeCloseTo(28.5, 1);
    expect(l.arriere).toBe(38);
  });
});

describe('bilan de masse et centrage', () => {
  // Neuf sauteurs de 85 kg aux sièges 1 à 9, 300 L de kérosène.
  const neuf = Array(9).fill(85);

  it('compte l’avion, le pilote et son parachute, le carburant et les sauteurs', () => {
    const b = bilanMasseCentrage(PC6, neuf, 300);
    // 1410 + (85 + 10) + 300 × 0,8 + 9 × 85
    expect(b.decollage!.masseKg).toBe(2510);
    expect(b.margeDecollageKg).toBe(290);
    // Σ moments 9210,36 / 2510 = 3,6695 m → (0,6695 / 1,9) = 35,2 %
    expect(b.decollage!.pct).toBe(35.2);
    expect(b.decollage!.dansDomaine).toBe(true);
    expect(b.severite).toBe('conforme');
    expect(b.resume.replace(/\s/g, ' ')).toBe('Décollage 2 510 kg / 2 800 · centrage 35,2 %');
  });

  it('calcule l’atterrissage sans les sauteurs et avec une rotation de moins', () => {
    const b = bilanMasseCentrage(PC6, neuf, 300);
    // 1410 + 95 + (300 − 55) × 0,8 = 1701 kg ; centrage 22,2 %
    expect(b.atterrissage!.masseKg).toBe(1701);
    expect(b.atterrissage!.pct).toBe(22.2);
    expect(b.margeAtterrissageKg).toBe(959);
  });

  it('signale un dépassement de MTOW, même avec des masses inconnues', () => {
    const lourds = [...Array(9).fill(140), null];
    const b = bilanMasseCentrage(PC6, lourds, 600);
    expect(b.margeDecollageKg).toBeLessThan(0);
    expect(b.severite).toBe('critique');
    expect(b.resume).toMatch(/^Décollage ≥ /);
    expect(b.resume).toMatch(/kg de trop$/);
  });

  it('signale un avion centré trop en arrière', () => {
    // Quatre sauteurs lourds aux sièges du fond (5 et 9), presque sans carburant.
    const sieges = [null, null, null, null, 130, null, null, null, 130, null].map(v => v ?? 0);
    const b = bilanMasseCentrage({ ...PC6, bras_places_m: PC6.bras_places_m!.map(b => (b ?? 0) + 2) }, sieges, 40);
    expect(b.decollage!.dansDomaine).toBe(false);
    expect(b.severite).toBe('critique');
    expect(b.resume).toMatch(/hors domaine de centrage$/);
  });

  it('dit « à compléter » plutôt que d’inventer', () => {
    const b = bilanMasseCentrage(PC6, [85, null, 90], 300);
    expect(b.massesInconnues).toBe(1);
    expect(b.severite).toBe('neutre');

    const sansVide = bilanMasseCentrage({ ...PC6, masse_a_vide_kg: null }, neuf, 300);
    expect(sansVide.decollage).toBeNull();
    expect(sansVide.manques).toContain('masse à vide');

    const sansBras = bilanMasseCentrage({ ...PC6, bras_vide_m: null }, neuf, 300);
    expect(sansBras.decollage!.pct).toBeNull();
    expect(sansBras.manques).toContain('bras de levier');

    const sansCarb = bilanMasseCentrage(PC6, neuf, null);
    expect(sansCarb.manques).toContain('carburant');
    expect(sansCarb.severite).toBe('neutre');
  });

  it('ne compte pas le parachute du pilote quand la fiche le décoche', () => {
    expect(bilanMasseCentrage({ ...PC6, parachute_pilote: false }, neuf, 300).decollage!.masseKg).toBe(2500);
  });

  it('passe en vigilance sous 50 kg de marge', () => {
    // 1410 + 95 + 10 × 85 + 506 × 0,8 = 2 760 kg : 40 kg sous la MTOW.
    expect(bilanMasseCentrage(PC6, Array(10).fill(85), 506).severite).toBe('vigilance');
  });
});

describe('durée d’une rotation', () => {
  it('se déduit des varios et du taux de descente', () => {
    // 4 000 m = 13 123 ft ; montée 13 123 / 1 500 ≈ 9 min à 13 123 / 1 000 ≈ 13 min ; descente ≈ 3 min.
    expect(dureeRotation(PC6, 4000)).toEqual({ monteeMin: 9, monteeMax: 13, descente: 3, tour: 14 });
  });
  it('se tait sans vario ni altitude', () => {
    expect(dureeRotation({ places: 10 }, 4000)).toBeNull();
    expect(dureeRotation(PC6, null)).toBeNull();
  });
});

describe('carburant au fil de la journée', () => {
  it('déduit le plein de la fiche', () => {
    expect(capacitePlein(PC6)).toBe(320);   // 4 × 55 + 100
  });

  it('estime les tours non relevés et annonce le passage au kéro', () => {
    const c = suivreCarburant(PC6, [320, null, null, null, null]);
    expect(c.map(x => x.litres)).toEqual([320, 265, 210, 155, 320]);
    expect(c.map(x => x.estime)).toEqual([false, true, true, true, true]);
    // Après le 4e tour (155 − 55 = 100 L, pile la réserve), le suivant
    // l'entamerait : kéro. Le 5e repart plein.
    expect(c[3].keroApres).toBe(true);
    expect(c[4].plein).toBe(true);
    expect(c.some(x => x.sousReserve)).toBe(false);
  });

  it('fait foi d’un relevé, et repère un plein fait entre deux tours', () => {
    const c = suivreCarburant(PC6, [200, 300]);
    expect(c[1]).toMatchObject({ litres: 300, estime: false, plein: true });
  });

  it('signale un tour qui entame la réserve', () => {
    expect(suivreCarburant(PC6, [140])[0].sousReserve).toBe(true);
  });
});
