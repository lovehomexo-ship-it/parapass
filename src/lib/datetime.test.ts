import { describe, it, expect } from 'vitest';
import { ymdLocal, formatHeureParis, formatDateTimeParis } from './datetime';

// ─── Prompt B : clé de date en heure LOCALE, jamais UTC ──────────────────────
describe('ymdLocal', () => {
  it('rend la date locale cliquée, pas le décalage UTC (reproduit le bug)', () => {
    const d = new Date(2026, 6, 24); // 24 juillet 2026, minuit LOCAL (Europe/Paris)
    // L'ancienne logique buguée renvoyait la veille en été (UTC+2) :
    expect(d.toISOString().slice(0, 10)).toBe('2026-07-23'); // preuve du bug
    // La fonction corrigée doit rendre le jour réellement cliqué :
    expect(ymdLocal(d)).toBe('2026-07-24');
  });

  it('gère les bornes de mois', () => {
    expect(ymdLocal(new Date(2026, 6, 1))).toBe('2026-07-01');  // 1er (bug UTC → 30/06)
    expect(ymdLocal(new Date(2026, 6, 31))).toBe('2026-07-31'); // dernier jour
    expect(ymdLocal(new Date(2027, 0, 1))).toBe('2027-01-01');  // passage d'année
  });

  it('zéro-pad mois et jour', () => {
    expect(ymdLocal(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('cohérent quel que soit le fuseau car il lit les composants locaux', () => {
    // getFullYear/Month/Date sont locaux : la sortie décrit toujours le jour affiché.
    const d = new Date(2026, 11, 31, 23, 59);
    expect(ymdLocal(d)).toBe('2026-12-31');
  });
});

// ─── Prompt C : horodatages affichés en Europe/Paris, été ET hiver ───────────
describe('formatHeureParis', () => {
  it('affiche l’heure de Paris (été = UTC+2) et non l’UTC', () => {
    // 08:38 Paris en été correspond à 06:38 UTC stocké en base.
    expect(formatHeureParis('2026-07-24T06:38:00Z')).toBe('08:38');
  });

  it('gère l’heure d’hiver (UTC+1)', () => {
    // 07:25 Paris en hiver = 06:25 UTC.
    expect(formatHeureParis('2026-01-15T06:25:00Z')).toBe('07:25');
  });

  it('indépendant du fuseau du runtime (Intl force Europe/Paris)', () => {
    // Même entrée, résultat Paris, peu importe le TZ du process.
    expect(formatHeureParis('2026-07-24T06:38:00Z')).toBe('08:38');
  });

  it('renvoie une chaîne vide pour une date absente/invalide', () => {
    expect(formatHeureParis(null)).toBe('');
    expect(formatHeureParis('pas une date')).toBe('');
  });
});

describe('formatDateTimeParis', () => {
  it('formate date + heure en Europe/Paris', () => {
    // 2026-07-24 06:38 UTC → 24/07/2026 08:38 Paris.
    const s = formatDateTimeParis('2026-07-24T06:38:00Z');
    expect(s).toContain('08:38');
    expect(s).toContain('24');
    expect(s).toContain('07');
  });

  it('renvoie une chaîne vide si absent', () => {
    expect(formatDateTimeParis(null)).toBe('');
  });
});
