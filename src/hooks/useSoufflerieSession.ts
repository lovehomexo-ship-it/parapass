import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface SoufflerieSession {
  id: string;
  user_id: string;
  date: string;
  duree_min: number;
  tunnel: string;
  type_vol: 'solo' | 'coaching' | 'formation' | 'competition';
  disciplines: string[];
  instructeur: string | null;
  notes: string | null;
  note_globale: number | null;
  created_at: string;
}

export function useSoufflerieList(userId: string | undefined) {
  const [sessions, setSessions] = useState<SoufflerieSession[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('soufflerie_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    setSessions((data ?? []) as SoufflerieSession[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { sessions, loading, reload: load };
}

export function useSoufflerieStats(userId: string | undefined) {
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('soufflerie_sessions')
      .select('duree_min')
      .eq('user_id', userId)
      .then(({ data }) => {
        const rows = data ?? [];
        setTotalSessions(rows.length);
        setTotalMinutes(rows.reduce((s, r) => s + (r.duree_min ?? 0), 0));
      });
  }, [userId]);

  return { totalMinutes, totalSessions };
}

export function useAddSoufflerieSession() {
  const [loading, setLoading] = useState(false);

  const add = async (payload: Omit<SoufflerieSession, 'id' | 'created_at'>) => {
    setLoading(true);
    const { error } = await supabase.from('soufflerie_sessions').insert(payload);
    setLoading(false);
    return !error;
  };

  return { add, loading };
}

export function useDeleteSoufflerieSession() {
  const remove = async (id: string) => {
    await supabase.from('soufflerie_sessions').delete().eq('id', id);
  };
  return { remove };
}
