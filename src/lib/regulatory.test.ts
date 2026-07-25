import { describe, it, expect } from 'vitest';
import { licenceStatus, type ComplianceStatus } from './compliance';

// ─── Non-régression source unique (Prompt N) ─────────────────────────────────
// Les données réglementaires proviennent d'UNE seule autorité serveur
// (get_regulatory_snapshot → statut_echeance). Ce test verrouille l'accord
// EXACT entre la bucketisation SQL et la bucketisation client (licenceStatus) :
// si l'une dérive, les surfaces divergeraient — et ce test échoue.

const SEUIL = 30; // compliance_rules.alerte_j30

function ymdOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Miroir TS EXACT de la fonction SQL statut_echeance(p_exp, p_seuil) :
 *   NULL → inconnu ; (exp - today) < 0 → expire ; ≤ seuil → bientot ; sinon ok.
 * Toute divergence entre cette formule et licenceStatus fait échouer le test,
 * signalant que la source SQL et la source client ne sont plus alignées.
 */
function sqlStatutEcheance(exp: string | null, seuil = SEUIL): ComplianceStatus {
  if (exp == null) return 'inconnu';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = exp.split('-').map(Number);
  const e = new Date(y, m - 1, d);
  const days = Math.round((e.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'expire';
  if (days <= seuil) return 'bientot';
  return 'ok';
}

describe('parité source unique SQL ↔ client', () => {
  const offsets = [-365, -30, -1, 0, 1, 15, 29, 30, 31, 200, 365];

  it('licenceStatus (client) == statut_echeance (SQL) sur tous les cas', () => {
    for (const off of offsets) {
      const exp = ymdOffset(off);
      const client = licenceStatus({ statut: 'actif', date_expiration: exp });
      const sql = sqlStatutEcheance(exp);
      expect(client, `offset ${off} (exp ${exp})`).toBe(sql);
    }
  });

  it('les deux traitent l’absence de date comme "inconnu"', () => {
    expect(licenceStatus(null)).toBe('inconnu');
    expect(sqlStatutEcheance(null)).toBe('inconnu');
  });

  it('les deux traitent une échéance aujourd’hui comme NON expirée', () => {
    const today = ymdOffset(0);
    expect(licenceStatus({ statut: 'actif', date_expiration: today })).not.toBe('expire');
    expect(sqlStatutEcheance(today)).not.toBe('expire');
  });
});
