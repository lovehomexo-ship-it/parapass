import { describe, it, expect } from 'vitest';
import { verdictMeteo, computeReadiness, DEFAULT_METEO_SEUILS, type PresentDecision } from './decision';
import { DEFAULT_CURRENCY_RULES } from './currency';

describe('verdictMeteo', () => {
  const s = DEFAULT_METEO_SEUILS; // vent 15/20, rafales 18/25, plafond 1200

  it('vert quand tout est dans les seuils', () => {
    expect(verdictMeteo({ ventKt: 10, rafalesKt: 14, plafondM: 2500 }, s).level).toBe('vert');
  });

  it('rouge si rafales au-dessus du max', () => {
    const v = verdictMeteo({ ventKt: 10, rafalesKt: 27, plafondM: 2500 }, s);
    expect(v.level).toBe('rouge');
    expect(v.reason).toMatch(/Rafales/);
  });

  it('rouge si vent moyen au-dessus du max', () => {
    expect(verdictMeteo({ ventKt: 22, rafalesKt: 10, plafondM: 2500 }, s).level).toBe('rouge');
  });

  it('orange en zone de vigilance', () => {
    expect(verdictMeteo({ ventKt: 17, rafalesKt: 10, plafondM: 2500 }, s).level).toBe('orange');
    expect(verdictMeteo({ ventKt: 10, rafalesKt: 20, plafondM: 2500 }, s).level).toBe('orange');
  });

  it('orange si plafond bas connu', () => {
    expect(verdictMeteo({ ventKt: 5, rafalesKt: 5, plafondM: 900 }, s).level).toBe('orange');
  });

  it('plafond inconnu (null) n’aggrave pas le verdict', () => {
    expect(verdictMeteo({ ventKt: 5, rafalesKt: 5, plafondM: null }, s).level).toBe('vert');
  });

  it('seuils paramétrables : un seuil plus strict change le verdict', () => {
    const strict = { ...s, rafales_max_kt: 12 };
    expect(verdictMeteo({ ventKt: 5, rafalesKt: 14, plafondM: null }, strict).level).toBe('rouge');
  });
});

describe('computeReadiness', () => {
  const base = (over: Partial<PresentDecision>): PresentDecision => ({
    user_id: 'u', prenom: 'A', nom: 'B',
    licence_status: 'ok', medical_status: 'ok', dernier_saut: new Date().toISOString().slice(0, 10), niveau: 'C',
    ...over,
  });

  it('tous prêts quand licence+médical OK et reprise à jour', () => {
    const r = computeReadiness([base({}), base({})], DEFAULT_CURRENCY_RULES);
    expect(r).toMatchObject({ presents: 2, prets: 2, bloques: 0 });
  });

  it('bloque sur licence expirée', () => {
    const r = computeReadiness([base({ licence_status: 'expire' })], DEFAULT_CURRENCY_RULES);
    expect(r.bloques).toBe(1);
    expect(r.bloquesDetail[0].raison).toMatch(/Licence/);
  });

  it('bloque sur médical expiré', () => {
    const r = computeReadiness([base({ medical_status: 'expire' })], DEFAULT_CURRENCY_RULES);
    expect(r.bloquesDetail[0].raison).toMatch(/médical/);
  });

  it('bloque sur reprise obligatoire (dernier saut très ancien)', () => {
    const r = computeReadiness([base({ dernier_saut: '2000-01-01', niveau: 'C' })], DEFAULT_CURRENCY_RULES);
    expect(r.bloquesDetail[0].raison).toMatch(/Reprise/);
  });

  it('la somme prêts + bloqués égale le nombre de présents', () => {
    const r = computeReadiness(
      [base({}), base({ licence_status: 'expire' }), base({ medical_status: 'expire' })],
      DEFAULT_CURRENCY_RULES,
    );
    expect(r.prets + r.bloques).toBe(r.presents);
  });
});
