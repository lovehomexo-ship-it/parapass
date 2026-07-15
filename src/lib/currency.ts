import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { daysUntil } from './compliance';

// ─── Reprise après inactivité (extension du moteur de règles FFP) ─────────────
// Les seuils viennent de la table currency_rules (paramétrable, page admin) —
// aucune valeur métier en dur ici.

export type CurrencyStatus = 'a_jour' | 'reprise_conseillee' | 'reprise_obligatoire' | 'indetermine';

export interface CurrencyRule {
  niveau: string;
  seuil_conseille_jours: number;
  seuil_obligatoire_jours: number;
  message: string | null;
}

export type CurrencyRules = Record<string, CurrencyRule>;

// Repli si la table est injoignable (mêmes valeurs que le seed — la source de
// vérité reste currency_rules en base)
export const DEFAULT_CURRENCY_RULES: CurrencyRules = {
  PAC: { niveau: 'PAC', seuil_conseille_jours: 30, seuil_obligatoire_jours: 90, message: null },
  BPA: { niveau: 'BPA', seuil_conseille_jours: 60, seuil_obligatoire_jours: 180, message: null },
  A:   { niveau: 'A',   seuil_conseille_jours: 60, seuil_obligatoire_jours: 180, message: null },
  B:   { niveau: 'B',   seuil_conseille_jours: 90, seuil_obligatoire_jours: 365, message: null },
  C:   { niveau: 'C',   seuil_conseille_jours: 120, seuil_obligatoire_jours: 365, message: null },
  D:   { niveau: 'D',   seuil_conseille_jours: 180, seuil_obligatoire_jours: 365, message: null },
};

/** Règle applicable à un niveau ; comme getRegles(), repli prudent sur BPA. */
export function getCurrencyRule(niveau: string | null | undefined, rules: CurrencyRules): CurrencyRule {
  return rules[niveau ?? ''] ?? rules['BPA'] ?? DEFAULT_CURRENCY_RULES['BPA'];
}

export function daysSince(date: string | Date | null | undefined): number | null {
  const d = daysUntil(date);
  return d === null ? null : -d;
}

/** Statut de reprise : croise date du dernier saut + niveau + currency_rules.
 *  L'appli signale, elle ne bloque jamais — la décision reste au moniteur / à la DZ. */
export function getCurrencyStatus(
  lastJumpDate: string | Date | null | undefined,
  niveau: string | null | undefined,
  rules: CurrencyRules
): CurrencyStatus {
  const jours = daysSince(lastJumpDate);
  if (jours === null) return 'indetermine';
  const rule = getCurrencyRule(niveau, rules);
  if (jours >= rule.seuil_obligatoire_jours) return 'reprise_obligatoire';
  if (jours >= rule.seuil_conseille_jours) return 'reprise_conseillee';
  return 'a_jour';
}

export const CURRENCY_STATUS_CONFIG: Record<CurrencyStatus, { label: string; color: string; bg: string; border: string }> = {
  a_jour:              { label: 'À jour',              color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  reprise_conseillee:  { label: 'Reprise conseillée',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  reprise_obligatoire: { label: 'Reprise obligatoire — selon les règles paramétrées', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  indetermine:         { label: 'Indéterminé',         color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
};

/** « il y a 4 mois », « il y a 12 jours »… */
export function formatDuree(jours: number): string {
  if (jours < 1) return "aujourd'hui";
  if (jours < 60) return `il y a ${jours} jour${jours > 1 ? 's' : ''}`;
  const mois = Math.floor(jours / 30);
  if (mois < 24) return `il y a ${mois} mois`;
  return `il y a ${Math.floor(mois / 12)} ans`;
}

// ─── Hook règles ──────────────────────────────────────────────────────────────

let cachedCurrencyRules: CurrencyRules | null = null;

export function useCurrencyRules(): { rules: CurrencyRules; loaded: boolean } {
  const [rules, setRules] = useState<CurrencyRules>(cachedCurrencyRules ?? DEFAULT_CURRENCY_RULES);
  const [loaded, setLoaded] = useState(cachedCurrencyRules !== null);

  useEffect(() => {
    if (cachedCurrencyRules) return;
    supabase
      .from('currency_rules')
      .select('niveau, seuil_conseille_jours, seuil_obligatoire_jours, message')
      .then(({ data, error }) => {
        if (error) {
          console.error('Chargement currency_rules échoué :', error);
          setLoaded(true);
          return;
        }
        const merged: CurrencyRules = { ...DEFAULT_CURRENCY_RULES };
        for (const r of (data ?? []) as CurrencyRule[]) merged[r.niveau] = r;
        cachedCurrencyRules = merged;
        setRules(merged);
        setLoaded(true);
      });
  }, []);

  return { rules, loaded };
}
