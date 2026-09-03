import { describe, it, expect } from 'vitest';
import {
  kmhEnKt, formaterVent, libelleOrigine, libelleVent,
  ecartAngulaire, ecartVent, SEUIL_DERIVE_KT, SEUIL_DERIVE_DEG, type Vent,
} from './vent';

const brief = (vitesseKt: number | null, directionDeg: number | null): Vent =>
  ({ vitesseKt, directionDeg, origine: 'briefing', horodatage: '2026-09-03T08:12:00' });
const prev = (vitesseKt: number | null, directionDeg: number | null): Vent =>
  ({ vitesseKt, directionDeg, origine: 'prevision', horodatage: '2026-09-03T14:00:00' });

describe('P3 — une unité, une origine, un horodatage', () => {
  it('le nœud est la seule unité d’affichage', () => {
    expect(kmhEnKt(0)).toBe(0);
    expect(kmhEnKt(37)).toBe(20);       // 37 km/h ≈ 20 kt
    expect(formaterVent(brief(18, 240))).toBe('18 kt · 240°');
  });

  it('un vent non renseigné le dit, au lieu d’afficher un zéro', () => {
    // Un « 0 kt » affiché pour une donnée absente est un mensonge : le DT
    // lirait « pas de vent » là où il n'y a pas de mesure.
    expect(formaterVent(brief(null, null))).toBe('non renseigné');
  });

  it('l’origine et l’heure accompagnent toujours la valeur', () => {
    expect(libelleOrigine(brief(18, 240))).toBe('relevé au briefing de 08 h 12');
    expect(libelleOrigine(prev(22, 250))).toBe('prévision Open-Meteo pour 14 h 00');
    expect(libelleVent(brief(18, 240))).toBe('18 kt · 240° — relevé au briefing de 08 h 12');
  });

  it('un horodatage invalide ne fait pas planter l’écran', () => {
    expect(libelleOrigine({ ...brief(18, 240), horodatage: 'n’importe quoi' }))
      .toBe('relevé au briefing de —');
  });
});

describe('P3 — la dérive du relevé', () => {
  it('l’écart angulaire passe le nord sans se tromper', () => {
    expect(ecartAngulaire(350, 10)).toBe(20);   // et non 340
    expect(ecartAngulaire(10, 350)).toBe(20);
    expect(ecartAngulaire(0, 180)).toBe(180);
    expect(ecartAngulaire(240, 240)).toBe(0);
  });

  it('sous les deux seuils, rien n’est signalé', () => {
    const d = ecartVent(brief(15, 240), prev(15 + SEUIL_DERIVE_KT - 1, 240 + SEUIL_DERIVE_DEG - 1));
    expect(d.derive).toBe(false);
    expect(d.message).toBeNull();
  });

  it('le vent qui forcit est signalé au seuil, pas au-delà', () => {
    const d = ecartVent(brief(12, 240), prev(12 + SEUIL_DERIVE_KT, 240));
    expect(d.derive).toBe(true);
    expect(d.message).toContain('a forci de 5 kt');
    expect(d.message).toContain('briefing de 08 h 12');
  });

  it('le vent qui tombe est dit comme tel, pas comme un écart abstrait', () => {
    const d = ecartVent(brief(20, 240), prev(12, 240));
    expect(d.message).toContain('est tombé de 8 kt');
  });

  it('la rotation seule suffit à alerter', () => {
    const d = ecartVent(brief(15, 350), prev(15, 30));
    expect(d.derive).toBe(true);
    expect(d.ecartDeg).toBe(40);
    expect(d.message).toContain('a tourné de 40°');
  });

  it('les deux dérives se cumulent dans une seule phrase', () => {
    const d = ecartVent(brief(10, 200), prev(20, 260));
    expect(d.message).toContain('a forci de 10 kt et a tourné de 60°');
    // Le circuit est ce que le DT risque d'oublier : la phrase le nomme.
    expect(d.message).toContain('circuit');
  });

  it('sans relevé au briefing, aucune dérive n’est inventée', () => {
    const d = ecartVent(brief(null, null), prev(25, 90));
    expect(d.derive).toBe(false);
    expect(d.ecartKt).toBeNull();
  });
});
