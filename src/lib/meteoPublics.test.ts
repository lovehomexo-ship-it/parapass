import { describe, it, expect } from 'vitest';
import {
  evaluerPublic, evaluerTousPublics, calculerDerive,
  type SeuilsPublic, type MesuresMeteo,
} from './meteoPublics';

// Seuils de référence : ceux livrés par défaut pour un élève.
const ELEVE: SeuilsPublic = {
  public_cible: 'eleve', ordre: 1,
  vent_vigilance_kt: 12, vent_max_kt: 15,
  rafales_vigilance_kt: 15, rafales_max_kt: 18,
  vent_altitude_max_kt: 35, ecart_sol_alt_max_kt: 25,
  plafond_min_m: 1200, visibilite_min_km: 5, actif: true,
};
const CONFIRME: SeuilsPublic = {
  ...ELEVE, public_cible: 'confirme', ordre: 3,
  vent_vigilance_kt: 20, vent_max_kt: 25,
  rafales_vigilance_kt: 26, rafales_max_kt: 32,
  plafond_min_m: 900, visibilite_min_km: 3,
};

const calme: MesuresMeteo = {
  ventKt: 8, rafalesKt: 11, ventAltitudeKt: 20, plafondM: 2000, visibiliteKm: 10,
};

describe('evaluerPublic', () => {
  it('rend vert quand tout est dans les seuils', () => {
    const v = evaluerPublic(ELEVE, calme);
    expect(v.feu).toBe('vert');
    expect(v.declencheur).toBeNull();
  });

  it('passe en orange dès le seuil de vigilance, sans fermer', () => {
    const v = evaluerPublic(ELEVE, { ...calme, ventKt: 13 });
    expect(v.feu).toBe('orange');
    expect(v.declencheur).toContain('Vent 13 kt');
  });

  it('passe en rouge au-delà du maximum, et NOMME le paramètre', () => {
    const v = evaluerPublic(ELEVE, { ...calme, rafalesKt: 22 });
    expect(v.feu).toBe('rouge');
    expect(v.declencheur).toBe('Rafales 22 kt (max 18)');
  });

  it('distingue les publics : le même vent ferme les élèves, pas les confirmés', () => {
    const vent22: MesuresMeteo = { ...calme, ventKt: 22, rafalesKt: 24 };
    expect(evaluerPublic(ELEVE, vent22).feu).toBe('rouge');
    expect(evaluerPublic(CONFIRME, vent22).feu).toBe('orange');
  });

  it('ferme sur un plafond bas même par vent nul', () => {
    const v = evaluerPublic(ELEVE, { ...calme, ventKt: 0, rafalesKt: 0, plafondM: 800 });
    expect(v.feu).toBe('rouge');
    expect(v.declencheur).toContain('Plafond');
  });

  it('ferme sur une visibilité insuffisante', () => {
    const v = evaluerPublic(ELEVE, { ...calme, visibiliteKm: 2 });
    expect(v.feu).toBe('rouge');
    expect(v.declencheur).toContain('Visibilité');
  });

  it('signale un cisaillement sol/altitude en vigilance', () => {
    const v = evaluerPublic(ELEVE, { ...calme, ventKt: 5, ventAltitudeKt: 34 });
    expect(v.feu).toBe('orange');
    expect(v.declencheur).toContain('Écart sol/altitude');
  });

  it('retient le paramètre le PLUS défavorable', () => {
    // vent orange ET rafales rouges → rouge, et c'est la rafale qui est nommée
    const v = evaluerPublic(ELEVE, { ...calme, ventKt: 13, rafalesKt: 25 });
    expect(v.feu).toBe('rouge');
    expect(v.declencheur).toContain('Rafales');
  });

  it('ignore un paramètre non mesuré plutôt que de le supposer bon', () => {
    const v = evaluerPublic(ELEVE, { ...calme, plafondM: null, visibiliteKm: null });
    expect(v.details.some(d => d.label === 'Plafond')).toBe(false);
    expect(v.details.some(d => d.label === 'Visibilité')).toBe(false);
  });
});

describe('evaluerTousPublics', () => {
  it("respecte l'ordre d'affichage et écarte les publics inactifs", () => {
    const res = evaluerTousPublics(
      [{ ...CONFIRME, ordre: 3 }, { ...ELEVE, ordre: 1 }, { ...ELEVE, public_cible: 'tandem', ordre: 2, actif: false }],
      calme);
    expect(res.map(r => r.public_cible)).toEqual(['eleve', 'confirme']);
  });
});

describe('calculerDerive', () => {
  it('sans profil de vent, ne propose rien plutôt que zéro', () => {
    expect(calculerDerive([], 4000)).toBeNull();
  });

  it('place le point de largage FACE au vent, vu depuis la cible', () => {
    // Vent du 270° (ouest) : la voile dérive vers l'est, donc on largue à l'ouest.
    const r = calculerDerive(
      [{ altitudeM: 1000, vitesseKt: 20, directionDeg: 270 }], 1000, 5);
    expect(r).not.toBeNull();
    expect(r!.capDeg).toBeCloseTo(270, 0);
    expect(r!.distanceM).toBeGreaterThan(0);
  });

  it('une dérive plus forte éloigne le point de largage', () => {
    const faible = calculerDerive([{ altitudeM: 1000, vitesseKt: 5, directionDeg: 0 }], 1000, 5)!;
    const forte  = calculerDerive([{ altitudeM: 1000, vitesseKt: 25, directionDeg: 0 }], 1000, 5)!;
    expect(forte.distanceM).toBeGreaterThan(faible.distanceM);
  });
});
