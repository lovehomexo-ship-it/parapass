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
    if (!userId) { setCounts(EMPTY_COUNTS); return; }
    let cancelled = false;

    const load = async () => {
      const [countsRes, { data: last }, { data: lastValide }] = await Promise.all([
        // total & valid via la RPC unique (mêmes chiffres propriétaire ET DT).
        supabase.rpc('get_jump_counts', { p_user_id: userId }).maybeSingle(),
        // Saut le plus récent toutes sources confondues (statut inclus pour la mention « non validé »)
        supabase.from('sauts').select('date_saut, statut')
          .eq('parachutiste_id', userId).eq('is_tunnel', false)
          .order('date_saut', { ascending: false }).limit(1).maybeSingle(),
        // Saut le plus récent validé par un moniteur
        supabase.from('sauts').select('date_saut')
          .eq('parachutiste_id', userId).eq('is_tunnel', false).eq('statut', 'valide')
          .order('date_saut', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      if (countsRes.error) {
        // Erreur explicite : on trace, on garde les compteurs à 0 (pas de silence).
        console.error('get_jump_counts échoué :', countsRes.error);
      }
      const c = countsRes.data as { total: number; valid: number } | null;
      setCounts({
        total: c?.total ?? 0,
        valid: c?.valid ?? 0,
        lastJumpDate: last?.date_saut ?? null,
        lastValidatedJumpDate: lastValide?.date_saut ?? null,
        lastJumpIsUnvalidated: !!last && last.statut !== 'valide',
      });
    };

    load();

    // Rafraîchit toutes les vues après une validation/ajout/suppression, sans reload.
    const channel = supabase
      .channel(`jump-counts-${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sauts', filter: `parachutiste_id=eq.${userId}` },
        () => { load(); })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId]);

  return counts;
}

/** Compat shim — composants qui n'ont besoin que du total */
export function useJumpCount(userId: string | undefined): number {
  return useJumpCounts(userId).total;
}
