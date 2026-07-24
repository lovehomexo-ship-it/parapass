import { describe, it, expect } from 'vitest';
import { licenceStatus, segmentsLicencies, type LicenceInfo } from './compliance';

// Date ISO (YYYY-MM-DD) décalée de n jours par rapport à aujourd'hui.
function dayOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── Prompt D : une licence valide n'est jamais « Expiré » ───────────────────
describe('licenceStatus', () => {
  it('licence ACTIF à expiration future ⇒ jamais expire', () => {
    // Cas Sophie MARTIN : ACTIF, valable jusqu'au 31/12/2026.
    expect(licenceStatus({ statut: 'actif', date_expiration: '2026-12-31' }))
      .not.toBe('expire');
  });

  it('expiration lointaine ⇒ ok', () => {
    expect(licenceStatus({ statut: 'actif', date_expiration: dayOffset(200) })).toBe('ok');
  });

  it('bornes : demain ⇒ pas expire, hier ⇒ expire, aujourd’hui ⇒ pas expire', () => {
    expect(licenceStatus({ statut: 'actif', date_expiration: dayOffset(1) })).not.toBe('expire');
    expect(licenceStatus({ statut: 'actif', date_expiration: dayOffset(-1) })).toBe('expire');
    expect(licenceStatus({ statut: 'actif', date_expiration: dayOffset(0) })).not.toBe('expire');
  });

  it('expiration proche (≤ seuil) ⇒ bientot', () => {
    expect(licenceStatus({ statut: 'actif', date_expiration: dayOffset(10) })).toBe('bientot');
  });

  it('aucune licence / pas de date ⇒ inconnu (pas expire)', () => {
    expect(licenceStatus(null)).toBe('inconnu');
    expect(licenceStatus({ statut: 'actif', date_expiration: null })).toBe('inconnu');
  });

  it('statut fédéral non actif ⇒ non « à jour » même si date future', () => {
    expect(licenceStatus({ statut: 'suspendu', date_expiration: dayOffset(200) })).not.toBe('ok');
  });
});

// ─── Prompt E : segments dérivés d'une source unique, Σ = effectif ───────────
describe('segmentsLicencies', () => {
  const effectif: Array<{ licence: LicenceInfo | null }> = [
    { licence: { statut: 'actif', date_expiration: dayOffset(300) } }, // ok
    { licence: { statut: 'actif', date_expiration: dayOffset(300) } }, // ok
    { licence: { statut: 'actif', date_expiration: dayOffset(10) } },  // bientot
    { licence: { statut: 'actif', date_expiration: dayOffset(-5) } },  // expire
    { licence: null },                                                 // inconnu
    { licence: { statut: 'actif', date_expiration: null } },           // inconnu
  ];

  it('la somme des segments égale l’effectif total', () => {
    const s = segmentsLicencies(effectif);
    expect(s.ok + s.bientot + s.expire + s.inconnu).toBe(effectif.length);
    expect(s.total).toBe(effectif.length);
  });

  it('compte correctement chaque bucket', () => {
    const s = segmentsLicencies(effectif);
    expect(s).toMatchObject({ ok: 2, bientot: 1, expire: 1, inconnu: 2, total: 6 });
  });

  it('le nombre « expire » du filtre = ce qu’un compteur dashboard licence-only doit afficher', () => {
    // Dashboard et filtre partagent segmentsLicencies ⇒ même chiffre par construction.
    const s = segmentsLicencies(effectif);
    const dashboardExpirees = effectif.filter(
      l => licenceStatus(l.licence) === 'expire'
    ).length;
    expect(dashboardExpirees).toBe(s.expire);
  });
});
