import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Materiel, Maintenance } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComplianceStatus = 'ok' | 'bientot' | 'expire' | 'inconnu';

export interface ComplianceRule {
  rule_key: string;
  value_int: number;
  label: string;
  description: string | null;
}

export type ComplianceRules = Record<string, number>;

// Valeurs de repli si la table est injoignable (mêmes valeurs que le seed —
// la source de vérité reste compliance_rules en base)
export const DEFAULT_RULES: ComplianceRules = {
  pliage_secours_mois: 12,
  aad_maintenance_mois: 12,
  validite_certificat_medical_mois: 12,
  alerte_j30: 30,
  alerte_j7: 7,
};

// ─── Statut ───────────────────────────────────────────────────────────────────

export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}

/** 'ok' (> seuil), 'bientot' (≤ seuil alerte_j30), 'expire' (dépassé), 'inconnu' (pas de date). */
export function getComplianceStatus(
  dateEcheance: string | Date | null | undefined,
  rules: ComplianceRules = DEFAULT_RULES
): ComplianceStatus {
  const days = daysUntil(dateEcheance);
  if (days === null) return 'inconnu';
  if (days < 0) return 'expire';
  if (days <= (rules.alerte_j30 ?? DEFAULT_RULES.alerte_j30)) return 'bientot';
  return 'ok';
}

/** Échéance effective d'un matériel : prochain_echeance de la dernière maintenance,
 *  sinon calculée depuis la dernière intervention + règle paramétrable (pliage secours, AAD). */
export function getMaterielEcheance(
  materiel: Pick<Materiel, 'type'>,
  maintenances: Maintenance[],
  rules: ComplianceRules
): string | null {
  const last = [...maintenances].sort((a, b) => b.date_maintenance.localeCompare(a.date_maintenance))[0];
  if (last?.prochain_echeance) return last.prochain_echeance;
  if (!last) return null;
  const moisRegle = materiel.type === 'parachute_secours'
    ? rules.pliage_secours_mois
    : materiel.type === 'aad'
    ? rules.aad_maintenance_mois
    : null;
  if (!moisRegle) return null;
  const d = new Date(last.date_maintenance);
  d.setMonth(d.getMonth() + moisRegle);
  return d.toISOString().substring(0, 10);
}

const SEVERITY: Record<ComplianceStatus, number> = { expire: 3, bientot: 2, inconnu: 1, ok: 0 };

/** Le pire statut d'une liste ('expire' > 'bientot' > 'inconnu' > 'ok'). */
export function worstStatus(statuses: ComplianceStatus[]): ComplianceStatus {
  return statuses.reduce<ComplianceStatus>(
    (worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst),
    'ok'
  );
}

export const STATUS_CONFIG: Record<ComplianceStatus, { label: string; color: string; bg: string; border: string }> = {
  ok:      { label: 'À jour',   color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  bientot: { label: 'Bientôt',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  expire:  { label: 'Expiré',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
  inconnu: { label: 'Inconnu',  color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
};

// ─── Hook règles ──────────────────────────────────────────────────────────────

let cachedRules: ComplianceRules | null = null;

export function useComplianceRules(): { rules: ComplianceRules; loaded: boolean } {
  const [rules, setRules] = useState<ComplianceRules>(cachedRules ?? DEFAULT_RULES);
  const [loaded, setLoaded] = useState(cachedRules !== null);

  useEffect(() => {
    if (cachedRules) return;
    supabase
      .from('compliance_rules')
      .select('rule_key, value_int')
      .then(({ data, error }) => {
        if (error) {
          console.error('Chargement compliance_rules échoué :', error);
          setLoaded(true);
          return;
        }
        const merged = { ...DEFAULT_RULES };
        for (const r of data ?? []) merged[r.rule_key] = r.value_int;
        cachedRules = merged;
        setRules(merged);
        setLoaded(true);
      });
  }, []);

  return { rules, loaded };
}
