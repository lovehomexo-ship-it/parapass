import { describe, it, expect } from 'vitest';
import { verdictControle, type ControlePayload } from './verdictControle';

function futur(n = 200): string { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function passe(n = 5): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

const ok: ControlePayload = { active: true, lic_exp: futur(), med_exp: futur() };

describe('verdictControle', () => {
  it('EN RÈGLE si signature ok, QR valide, licence active + non expirée, médical non expiré', () => {
    expect(verdictControle(ok, true, false).enRegle).toBe(true);
  });

  it('À VÉRIFIER si signature invalide (prioritaire)', () => {
    const v = verdictControle(ok, false, false);
    expect(v.enRegle).toBe(false);
    expect(v.motif).toMatch(/[Ss]ignature/);
  });

  it('À VÉRIFIER si QR expiré', () => {
    expect(verdictControle(ok, true, true).enRegle).toBe(false);
  });

  it('À VÉRIFIER si licence non active', () => {
    expect(verdictControle({ ...ok, active: false }, true, false).enRegle).toBe(false);
  });

  it('À VÉRIFIER si licence expirée', () => {
    expect(verdictControle({ ...ok, lic_exp: passe() }, true, false).enRegle).toBe(false);
  });

  it('À VÉRIFIER si médical expiré', () => {
    expect(verdictControle({ ...ok, med_exp: passe() }, true, false).enRegle).toBe(false);
  });

  it('licence expirant aujourd’hui reste EN RÈGLE (jour calendaire)', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(verdictControle({ active: true, lic_exp: today, med_exp: futur() }, true, false).enRegle).toBe(true);
  });
});
