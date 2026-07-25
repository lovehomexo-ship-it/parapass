import { getCurrencyStatus, type CurrencyRules } from './currency';
import type { ComplianceStatus } from './compliance';

// ─── Décision du jour (Prompt O) ──────────────────────────────────────────────
// Synthétise « est-ce que je fais sauter, et qui peut monter ? ». L'appli
// INFORME et ALERTE — elle ne décide ni n'interdit rien.

export type MeteoLevel = 'vert' | 'orange' | 'rouge';

export interface MeteoSeuils {
  vent_max_kt: number;
  vent_orange_kt: number;
  rafales_max_kt: number;
  rafales_orange_kt: number;
  plafond_min_m: number;
}

// Repli si aucune ligne meteo_seuils pour le centre.
export const DEFAULT_METEO_SEUILS: MeteoSeuils = {
  vent_max_kt: 20, vent_orange_kt: 15,
  rafales_max_kt: 25, rafales_orange_kt: 18,
  plafond_min_m: 1200,
};

export interface MeteoCourante {
  ventKt: number;
  rafalesKt: number;
  plafondM: number | null; // null = inconnu (n'aggrave pas le verdict)
}

/** Verdict météo 🟢/🟠/🔴 + raison en une ligne, à partir de seuils PARAMÉTRABLES. */
export function verdictMeteo(meteo: MeteoCourante, seuils: MeteoSeuils = DEFAULT_METEO_SEUILS): { level: MeteoLevel; reason: string } {
  const { ventKt, rafalesKt, plafondM } = meteo;
  // Rouge : au-delà des maxima.
  if (rafalesKt > seuils.rafales_max_kt) return { level: 'rouge', reason: `Rafales ${Math.round(rafalesKt)} kt (max ${seuils.rafales_max_kt} kt)` };
  if (ventKt > seuils.vent_max_kt) return { level: 'rouge', reason: `Vent ${Math.round(ventKt)} kt (max ${seuils.vent_max_kt} kt)` };
  // Orange : vigilance.
  if (rafalesKt > seuils.rafales_orange_kt) return { level: 'orange', reason: `Rafales ${Math.round(rafalesKt)} kt (vigilance ${seuils.rafales_orange_kt} kt)` };
  if (ventKt > seuils.vent_orange_kt) return { level: 'orange', reason: `Vent ${Math.round(ventKt)} kt (vigilance ${seuils.vent_orange_kt} kt)` };
  if (plafondM != null && plafondM < seuils.plafond_min_m) return { level: 'orange', reason: `Plafond ~${plafondM} m (< ${seuils.plafond_min_m} m)` };
  return { level: 'vert', reason: 'Conditions dans les seuils' };
}

export interface PresentDecision {
  user_id: string;
  prenom: string;
  nom: string;
  licence_status: ComplianceStatus;
  medical_status: ComplianceStatus;
  dernier_saut: string | null;
  niveau: string | null;
}

export interface ReadinessResult {
  presents: number;
  prets: number;
  bloques: number;
  /** Détail des bloqués : nom + raison (licence / médical / reprise). */
  bloquesDetail: Array<{ nom: string; raison: string }>;
}

/**
 * Prêts vs bloqués parmi les présents. Bloquant = licence expirée OU médical
 * expiré OU reprise obligatoire dépassée (décision produit « licence + médical
 * + reprise »). Licence/médical viennent de la source unique ; la reprise est
 * calculée via currency.ts (source unique des règles de reprise).
 */
export function computeReadiness(presents: PresentDecision[], currencyRules: CurrencyRules): ReadinessResult {
  const bloquesDetail: Array<{ nom: string; raison: string }> = [];
  for (const p of presents) {
    const nom = `${p.prenom} ${p.nom}`.trim();
    const reprise = getCurrencyStatus(p.dernier_saut, p.niveau, currencyRules);
    let raison: string | null = null;
    if (p.licence_status === 'expire') raison = 'Licence expirée';
    else if (p.medical_status === 'expire') raison = 'Certificat médical expiré';
    else if (reprise === 'reprise_obligatoire') raison = 'Reprise obligatoire dépassée';
    if (raison) bloquesDetail.push({ nom, raison });
  }
  return {
    presents: presents.length,
    prets: presents.length - bloquesDetail.length,
    bloques: bloquesDetail.length,
    bloquesDetail,
  };
}
