import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface JumpCounts {
  total: number; // tous sauts hors soufflerie (is_tunnel = false), tous statuts
  valid: number; // is_tunnel = false ET statut IN ('valide','historique')
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
export function useJumpCounts(userId: string | undefined): JumpCounts {
  const [counts, setCounts] = useState<JumpCounts>({ total: 0, valid: 0 });

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
    ]).then(([{ count: total }, { count: valid }]) => {
      setCounts({ total: total ?? 0, valid: valid ?? 0 });
    });
  }, [userId]);

  return counts;
}

/** Compat shim — composants qui n'ont besoin que du total */
export function useJumpCount(userId: string | undefined): number {
  return useJumpCounts(userId).total;
}
