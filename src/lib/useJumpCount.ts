import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface JumpCounts {
  total: number; // tous sauts hors soufflerie (is_tunnel = false), tous statuts
  valid: number; // is_tunnel = false ET statut IN ('valide','historique')
  /** Date du saut le plus récent, toutes sources confondues (hors soufflerie). */
  lastJumpDate: string | null;
  /** Date du saut le plus récent validé par un moniteur (statut 'valide'). */
  lastValidatedJumpDate: string | null;
  /** true si le saut le plus récent n'est pas validé moniteur (import OCR, déclaré, en attente). */
  lastJumpIsUnvalidated: boolean;
}

/**
 * Source de vérité unique pour les compteurs de sauts d'un parachutiste.
 *
 * total = is_tunnel = false (tous statuts)
 * valid = is_tunnel = false ET statut IN ('valide', 'historique')
 *         → validés moniteur + importés OCR/IA + déclarés sur l'honneur
 *
 * Les sauts en_attente : dans total, pas dans valid.
 * Les sessions soufflerie (is_tunnel = true) : exclues partout.
 */
const EMPTY_COUNTS: JumpCounts = { total: 0, valid: 0, lastJumpDate: null, lastValidatedJumpDate: null, lastJumpIsUnvalidated: false };

export function useJumpCounts(userId: string | undefined): JumpCounts {
  const [counts, setCounts] = useState<JumpCounts>(EMPTY_COUNTS);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase
        .from('sauts')
        .select('*', { count: 'exact', head: true })
        .eq('parachutiste_id', userId)
        .eq('is_tunnel', false),
      supabase
        .from('sauts')
        .select('*', { count: 'exact', head: true })
        .eq('parachutiste_id', userId)
        .eq('is_tunnel', false)
        .in('statut', ['valide', 'historique']),
      // Saut le plus récent toutes sources confondues (statut inclus pour la mention « non validé »)
      supabase
        .from('sauts')
        .select('date_saut, statut')
        .eq('parachutiste_id', userId)
        .eq('is_tunnel', false)
        .order('date_saut', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Saut le plus récent validé par un moniteur
      supabase
        .from('sauts')
        .select('date_saut')
        .eq('parachutiste_id', userId)
        .eq('is_tunnel', false)
        .eq('statut', 'valide')
        .order('date_saut', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([{ count: total }, { count: valid }, { data: last }, { data: lastValide }]) => {
      setCounts({
        total: total ?? 0,
        valid: valid ?? 0,
        lastJumpDate: last?.date_saut ?? null,
        lastValidatedJumpDate: lastValide?.date_saut ?? null,
        lastJumpIsUnvalidated: !!last && last.statut !== 'valide',
      });
    });
  }, [userId]);

  return counts;
}

/** Compat shim — composants qui n'ont besoin que du total */
export function useJumpCount(userId: string | undefined): number {
  return useJumpCounts(userId).total;
}
