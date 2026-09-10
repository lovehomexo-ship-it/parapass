import { describe, it, expect } from 'vitest';
import { circuitModifie, sensAtterrissageDerive, type DzCircuit } from './briefing';
import { ecartAngulaire, SEUIL_DERIVE_DEG } from './vent';

// ═══════════════════════════════════════════════════════════════════════════
// Changer de circuit remplace le brouillon affiché. La question « est-il
// modifié ? » est donc ce qui sépare un changement d'écran d'une perte de
// travail. Elle mérite d'être testée seule.
// ═══════════════════════════════════════════════════════════════════════════

const BASE: DzCircuit = {
  id: 'c1', dz_id: 'dz', nom: 'Main droite', sens: 'main_droite',
  trace: [[10, 10], [20, 20]], lz_x: 30, lz_y: 30,
  zone_evolution: [[1, 1], [2, 2], [3, 3]], altitude_debut_m: 300, actif: true,
  vent_reference_deg: 90,
};

describe('circuitModifie', () => {
  it('deux copies identiques ne sont pas modifiées', () => {
    expect(circuitModifie({ ...BASE }, BASE)).toBe(false);
  });

  it('une copie profonde du tracé non plus — c’est le cas RÉEL de l’écran', () => {
    // L'hydratation clone trace et zone_evolution : une comparaison par
    // référence aurait déclaré « modifié » à chaque changement de circuit,
    // et posé la question à chaque fois pour rien.
    expect(circuitModifie(
      { ...BASE, trace: [...BASE.trace], zone_evolution: [...BASE.zone_evolution!] },
      BASE)).toBe(false);
  });

  it('repère chaque champ que l’écran sait modifier', () => {
    const cas: Partial<DzCircuit>[] = [
      { nom: 'Autre' }, { sens: 'main_gauche' }, { altitude_debut_m: 350 },
      { actif: false }, { lz_x: 31 }, { lz_y: 31 }, { vent_reference_deg: 270 },
      { vent_reference_deg: null },
      { trace: [[10, 10]] }, { zone_evolution: null },
    ];
    for (const patch of cas) {
      expect(circuitModifie({ ...BASE, ...patch }, BASE)).toBe(true);
    }
  });

  it('un point ajouté au tracé compte, même en fin de liste', () => {
    expect(circuitModifie({ ...BASE, trace: [...BASE.trace, [40, 40]] }, BASE)).toBe(true);
  });

  it('sans brouillon, rien à perdre', () => {
    expect(circuitModifie(null, BASE)).toBe(false);
  });

  it('sans contrepartie en base, tout est à perdre', () => {
    expect(circuitModifie(BASE, undefined)).toBe(true);
  });
});

describe('sensAtterrissageDerive — deux circuits, deux caps', () => {
  it('le dernier segment donne le cap, et deux tracés distincts en donnent deux', () => {
    // C'est ce que la carte doit refléter quand on bascule de circuit : sans
    // changement de tracé affiché, le DT publie un cap qu'il n'a pas vu.
    expect(sensAtterrissageDerive([[50, 50], [50, 40]])).toBe(0);
    expect(sensAtterrissageDerive([[50, 50], [60, 50]])).toBe(90);
  });
});

describe('vent de référence — le circuit dit pour quel vent il est prévu', () => {
  it('ce n’est PAS le vent du jour : il reste nullable, et null n’est pas 0°', () => {
    // Un centre qui n'a pas déclaré la condition d'emploi ne doit pas être
    // traité comme s'il avait déclaré « vent de nord ». null se propage.
    expect(BASE.vent_reference_deg).toBe(90);
    expect(circuitModifie({ ...BASE, vent_reference_deg: null }, BASE)).toBe(true);
    expect(circuitModifie({ ...BASE, vent_reference_deg: 0 },
                          { ...BASE, vent_reference_deg: null })).toBe(true);
  });
});

describe('écart au vent du jour — le seuil vient de lib/vent, pas d’un second calcul', () => {
  it('l’écart est angulaire : 350° et 10° sont à 20°, pas à 340°', () => {
    expect(ecartAngulaire(350, 10)).toBe(20);
    expect(ecartAngulaire(10, 350)).toBe(20);
    expect(ecartAngulaire(90, 270)).toBe(180);
  });

  it('un circuit prévu pour 90° ne discorde pas d’un vent à 110°, mais si à 200°', () => {
    expect(ecartAngulaire(110, 90) <= SEUIL_DERIVE_DEG).toBe(true);
    expect(ecartAngulaire(200, 90) <= SEUIL_DERIVE_DEG).toBe(false);
  });
});
