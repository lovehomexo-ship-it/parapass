import { describe, it, expect } from 'vitest';
import { libelleCreneau, heureFr, verifierPlages, cleDePlage, PLAGES_DEMI_JOURNEE } from './tandemPlages';

describe('plages tandem', () => {
  it('écrit les heures à la française', () => {
    expect(heureFr('09:00:00')).toBe('9 h');
    expect(heureFr('10:30')).toBe('10 h 30');
  });

  it('nomme un créneau par sa plage, sinon par son heure', () => {
    expect(libelleCreneau({ heure: '09:00', plage: 'matin' }, PLAGES_DEMI_JOURNEE)).toBe('Matin · 9 h – 13 h');
    expect(libelleCreneau({ heure: '14:30:00', plage: null }, PLAGES_DEMI_JOURNEE)).toBe('14 h 30');
    expect(libelleCreneau({ heure: '09:00', plage: 'soir' }, PLAGES_DEMI_JOURNEE)).toBe('soir');
  });

  it('refuse des plages incohérentes', () => {
    expect(verifierPlages(PLAGES_DEMI_JOURNEE)).toBeNull();
    expect(verifierPlages([])).toMatch(/au moins une/);
    expect(verifierPlages([{ cle: 'a', libelle: 'A', debut: '14:00', fin: '13:00' }])).toMatch(/finir après/);
    expect(verifierPlages([{ cle: 'a', libelle: 'A', debut: '9h', fin: '13:00' }])).toMatch(/illisibles/);
    expect(verifierPlages([{ cle: 'a', libelle: 'A', debut: '09:00', fin: '10:00' }, { cle: 'a', libelle: 'B', debut: '10:00', fin: '11:00' }])).toMatch(/même nom/);
  });

  it('tire une clé stable du nom', () => {
    expect(cleDePlage('Fin d’après-midi')).toBe('fin_d_apres_midi');
    expect(cleDePlage('Matin')).toBe('matin');
  });
});
