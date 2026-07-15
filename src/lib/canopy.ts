import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Charge alaire (outil strictement consultatif et pédagogique) ─────────────
// Repères issus de la table canopy_guidelines (paramétrable, page admin) —
// aucune valeur métier en dur. Jamais bloquant, jamais culpabilisant.

export type CanopyStatus = 'dans_les_recommandations' | 'proche_de_la_limite' | 'au_dela' | 'donnees_manquantes';

export interface CanopyGuideline {
  id: string;
  sauts_min: number;
  sauts_max: number | null; // null = illimité
  charge_max_recommandee: number;
  commentaire: string | null;
}

const KG_TO_LB = 2.20462;

/** Charge alaire en lb/ft², arrondie à 2 décimales. Formule : poids en livres ÷ surface en pieds carrés. */
export function computeWingLoading(poidsKg: number, tailleVoileFt2: number): number {
  return Math.round(((poidsKg * KG_TO_LB) / tailleVoileFt2) * 100) / 100;
}

/** Tranche de repère correspondant au nombre de sauts. */
export function findGuideline(sautsCount: number, guidelines: CanopyGuideline[]): CanopyGuideline | null {
  return guidelines.find(g => sautsCount >= g.sauts_min && (g.sauts_max === null || sautsCount <= g.sauts_max)) ?? null;
}

export interface CanopyAssessment {
  status: CanopyStatus;
  chargeAlaire: number | null;
  guideline: CanopyGuideline | null;
}

/** Statut consultatif : ≥ 90 % du repère = « proche de la limite », au-delà = « au_dela ». */
export function getCanopyStatus(
  poidsKg: number | null | undefined,
  tailleVoileFt2: number | null | undefined,
  sautsCount: number,
  guidelines: CanopyGuideline[]
): CanopyAssessment {
  if (!poidsKg || !tailleVoileFt2 || poidsKg <= 0 || tailleVoileFt2 <= 0) {
    return { status: 'donnees_manquantes', chargeAlaire: null, guideline: null };
  }
  const guideline = findGuideline(sautsCount, guidelines);
  const chargeAlaire = computeWingLoading(poidsKg, tailleVoileFt2);
  if (!guideline) return { status: 'donnees_manquantes', chargeAlaire, guideline: null };
  if (chargeAlaire > guideline.charge_max_recommandee) return { status: 'au_dela', chargeAlaire, guideline };
  if (chargeAlaire >= guideline.charge_max_recommandee * 0.9) return { status: 'proche_de_la_limite', chargeAlaire, guideline };
  return { status: 'dans_les_recommandations', chargeAlaire, guideline };
}

export const CANOPY_STATUS_CONFIG: Record<CanopyStatus, { label: string; color: string; bg: string; border: string }> = {
  dans_les_recommandations: { label: 'Dans les recommandations', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  proche_de_la_limite:      { label: 'Proche du repère',         color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  au_dela:                  { label: 'Au-delà du repère',        color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
  donnees_manquantes:       { label: 'À compléter',              color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

let cachedGuidelines: CanopyGuideline[] | null = null;

export function useCanopyGuidelines(): CanopyGuideline[] {
  const [guidelines, setGuidelines] = useState<CanopyGuideline[]>(cachedGuidelines ?? []);
  useEffect(() => {
    if (cachedGuidelines) return;
    supabase
      .from('canopy_guidelines')
      .select('id, sauts_min, sauts_max, charge_max_recommandee, commentaire')
      .order('sauts_min')
      .then(({ data, error }) => {
        if (error) { console.error('Chargement canopy_guidelines échoué :', error); return; }
        cachedGuidelines = (data ?? []) as CanopyGuideline[];
        setGuidelines(cachedGuidelines);
      });
  }, []);
  return guidelines;
}

/** Poids équipé (table privée owner-only — jamais exposé hors de ce module). */
export function usePoidsEquipe(userId: string | undefined): {
  poidsKg: number | null;
  save: (poids: number | null) => Promise<string | null>; // renvoie un message d'erreur ou null
} {
  const [poidsKg, setPoidsKg] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profils_prives')
      .select('poids_tout_equipe_kg')
      .eq('profile_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('Chargement poids équipé échoué :', error); return; }
        setPoidsKg(data?.poids_tout_equipe_kg ?? null);
      });
  }, [userId]);

  const save = async (poids: number | null): Promise<string | null> => {
    if (!userId) return 'Utilisateur inconnu';
    const { data: written, error } = await supabase
      .from('profils_prives')
      .upsert({ profile_id: userId, poids_tout_equipe_kg: poids, updated_at: new Date().toISOString() })
      .select('profile_id');
    if (error || !written || written.length === 0) {
      console.error('Écriture poids équipé échouée :', error);
      return error?.message ?? 'Écriture refusée';
    }
    setPoidsKg(poids);
    return null;
  };

  return { poidsKg, save };
}
