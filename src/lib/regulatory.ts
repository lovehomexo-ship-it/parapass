import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { ComplianceStatus } from './compliance';

// ─── Source unique de vérité — données réglementaires (Prompt N) ──────────────
// Total de sauts, total validé, statut de conformité licence & médical d'un
// licencié proviennent TOUS de la RPC serveur get_regulatory_snapshot (autorité).
// Aucun écran ne recalcule ces valeurs : dashboard DT, fiche licencié, espace
// parachutiste et émission du QR consomment cette même source à l'identique.

export interface RegulatorySnapshot {
  total: number;
  valid: number;
  licenceExp: string | null;
  licenceStatus: ComplianceStatus;
  medicalExp: string | null;
  medicalStatus: ComplianceStatus;
}

export const EMPTY_SNAPSHOT: RegulatorySnapshot = {
  total: 0, valid: 0,
  licenceExp: null, licenceStatus: 'inconnu',
  medicalExp: null, medicalStatus: 'inconnu',
};

interface SnapshotRow {
  total: number; valid: number;
  licence_exp: string | null; licence_status: ComplianceStatus;
  medical_exp: string | null; medical_status: ComplianceStatus;
}

function mapRow(row: SnapshotRow | null): RegulatorySnapshot {
  if (!row) return EMPTY_SNAPSHOT;
  return {
    total: row.total ?? 0,
    valid: row.valid ?? 0,
    licenceExp: row.licence_exp,
    licenceStatus: row.licence_status ?? 'inconnu',
    medicalExp: row.medical_exp,
    medicalStatus: row.medical_status ?? 'inconnu',
  };
}

/** Récupère le snapshot réglementaire une fois (usage hors composant). */
export async function fetchRegulatorySnapshot(userId: string): Promise<RegulatorySnapshot> {
  const { data, error } = await supabase.rpc('get_regulatory_snapshot', { p_user_id: userId }).maybeSingle();
  if (error) {
    // Erreur explicite : on trace, on renvoie un snapshot vide (jamais de silence).
    console.error('get_regulatory_snapshot échoué :', error);
    return EMPTY_SNAPSHOT;
  }
  return mapRow(data as SnapshotRow | null);
}

/**
 * Hook temps réel sur le snapshot réglementaire. Se rafraîchit après toute
 * évolution des sauts, licences ou certificats du licencié — donc toutes les
 * vues restent cohérentes après une validation, sans rechargement.
 */
export function useRegulatorySnapshot(userId: string | undefined): { snapshot: RegulatorySnapshot; loading: boolean } {
  const [snapshot, setSnapshot] = useState<RegulatorySnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setSnapshot(EMPTY_SNAPSHOT); setLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      const snap = await fetchRegulatorySnapshot(userId);
      if (!cancelled) { setSnapshot(snap); setLoading(false); }
    };
    load();

    const channel = supabase
      .channel(`regulatory-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sauts', filter: `parachutiste_id=eq.${userId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licences', filter: `parachutiste_id=eq.${userId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'certificats_medicaux', filter: `parachutiste_id=eq.${userId}` }, () => load())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId]);

  return { snapshot, loading };
}
