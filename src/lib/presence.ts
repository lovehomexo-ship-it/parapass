import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Check-in présence DZ ─────────────────────────────────────────────────────
// Le parachutiste se déclare lui-même (jamais de saisie DT). La présence est
// datée : le lendemain la liste est vide, rien ne se reporte.
// Fonctionne SEUL : les modules matériel/briefing s'y branchent s'ils sont là.

export interface DzPresence {
  id: string;
  dz_id: string;
  user_id: string;
  date_presence: string;
  heure_debut: string; // 'HH:MM'
  heure_fin: string;
  materiel_type: 'perso' | 'location';
  voile_perso_ref: string | null;
  voile_perso_libre: string | null;
  voile_location_ref: string | null;
  statut: 'present' | 'parti';
  checked_in_at: string;
  updated_at: string;
}

export interface CheckInInput {
  dz_id: string;
  heure_debut: string;
  heure_fin: string;
  materiel_type: 'perso' | 'location';
  voile_perso_ref?: string | null;
  voile_perso_libre?: string | null;
  voile_location_ref?: string | null;
}

const today = () => new Date().toISOString().substring(0, 10);
export const hhmm = (t: string) => t.substring(0, 5);

/** Présence du jour du licencié sur une DZ + actions (check-in upsert, départ). */
export function useMaPresence(dzId: string | undefined, userId: string | undefined) {
  const [presence, setPresence] = useState<DzPresence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!dzId || !userId) return;
    const { data, error } = await supabase
      .from('dz_presences').select('*')
      .eq('dz_id', dzId).eq('user_id', userId).eq('date_presence', today())
      .maybeSingle();
    if (error) { console.error('Chargement présence échoué :', error); return; }
    setPresence((data as DzPresence | null) ?? null);
  }, [dzId, userId]);

  useEffect(() => { load(); }, [load]);

  /** Upsert : se re-déclarer met à jour la même ligne (unicité dz+user+date). */
  const checkIn = async (input: CheckInInput): Promise<boolean> => {
    if (!userId) return false;
    setSaving(true);
    setError(null);
    const { data: written, error } = await supabase
      .from('dz_presences')
      .upsert({
        dz_id: input.dz_id,
        user_id: userId,
        date_presence: today(),
        heure_debut: input.heure_debut,
        heure_fin: input.heure_fin,
        materiel_type: input.materiel_type,
        voile_perso_ref: input.voile_perso_ref ?? null,
        voile_perso_libre: input.voile_perso_libre ?? null,
        voile_location_ref: input.voile_location_ref ?? null,
        statut: 'present',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'dz_id,user_id,date_presence' })
      .select('*');
    setSaving(false);
    if (error || !written || written.length === 0) {
      console.error('Check-in échoué :', error);
      setError(error?.message ?? 'Le check-in n\'a pas pu être enregistré. Réessayez.');
      return false;
    }
    setPresence(written[0] as DzPresence);
    return true;
  };

  /** « Je quitte la DZ » — réversible en se re-déclarant. */
  const quitter = async (): Promise<void> => {
    if (!presence) return;
    setError(null);
    const { data: written, error } = await supabase
      .from('dz_presences')
      .update({ statut: 'parti', updated_at: new Date().toISOString() })
      .eq('id', presence.id)
      .select('*');
    if (error || !written || written.length === 0) {
      console.error('Départ échoué :', error);
      setError(error?.message ?? 'Le départ n\'a pas pu être enregistré.');
      return;
    }
    setPresence(written[0] as DzPresence);
  };

  return { presence, checkIn, quitter, saving, error, refresh: load };
}

// ─── Côté DT : liste des présents du jour, en temps réel ──────────────────────

export interface PresenceDZRow extends DzPresence {
  nom: string;
  prenom: string;
  brevet: string | null;
  /** Voile perso résolue depuis le module matériel, si référencée. */
  voile_perso_nom: string | null;
  briefingAcquitte: boolean;
}

export function usePresencesDZ(dzId: string | undefined) {
  const [rows, setRows] = useState<PresenceDZRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!dzId) return;
    // Pas d'embed profiles!user_id : la FK pointe vers auth.users, PostgREST ne
    // peut pas joindre profiles — on récupère les identités séparément.
    // Le statut 'present' SUFFIT à afficher quelqu'un : la plage horaire est une
    // information, jamais un filtre d'inclusion.
    const { data: presences, error } = await supabase
      .from('dz_presences')
      .select('*')
      .eq('dz_id', dzId)
      .eq('date_presence', today())
      .eq('statut', 'present');
    if (error) { console.error('Chargement présences échoué :', error); setLoading(false); return; }

    const list = (presences ?? []) as DzPresence[];
    const userIds = list.map(p => p.user_id);
    let profilMap: Record<string, { nom: string; prenom: string }> = {};
    if (userIds.length) {
      const { data: profils, error: prErr } = await supabase
        .from('profiles').select('id, nom, prenom').in('id', userIds);
      if (prErr) console.error('Chargement profils présents échoué :', prErr);
      profilMap = Object.fromEntries((profils ?? []).map(p => [p.id, { nom: p.nom, prenom: p.prenom }]));
    }

    // Enrichissements en parallèle : brevets, voiles perso référencées,
    // acquittements du briefing du jour (lu depuis briefing_acknowledgements — jamais dupliqué)
    const materielIds = list.map(p => p.voile_perso_ref).filter((x): x is string => !!x);
    const [brevetsRes, materielsRes, briefingRes] = await Promise.all([
      userIds.length ? supabase.from('brevets').select('parachutiste_id, type_brevet, date_obtention')
        .in('parachutiste_id', userIds).order('date_obtention', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      materielIds.length ? supabase.from('materiels').select('id, marque, modele, taille_voile_ft2').in('id', materielIds) : Promise.resolve({ data: [], error: null }),
      supabase.from('dz_briefings').select('id, published_at').eq('dz_id', dzId).eq('date_briefing', today()).maybeSingle(),
    ]);
    if (brevetsRes.error) console.error('Chargement brevets échoué :', brevetsRes.error);
    if (materielsRes.error) console.error('Chargement matériels échoué :', materielsRes.error);
    if (briefingRes.error) console.error('Chargement briefing échoué :', briefingRes.error);

    const brevetMap: Record<string, string> = {};
    for (const b of (brevetsRes.data ?? []) as { parachutiste_id: string; type_brevet: string }[]) {
      brevetMap[b.parachutiste_id] ??= b.type_brevet;
    }
    const materielMap: Record<string, string> = {};
    for (const m of (materielsRes.data ?? []) as { id: string; marque: string; modele: string; taille_voile_ft2: number | null }[]) {
      materielMap[m.id] = `${m.marque} ${m.modele}${m.taille_voile_ft2 ? ` ${m.taille_voile_ft2}` : ''}`;
    }
    let ackSet = new Set<string>();
    const briefing = briefingRes.data as { id: string; published_at: string } | null;
    if (briefing && userIds.length) {
      const { data: acks, error: aErr } = await supabase
        .from('briefing_acknowledgements')
        .select('user_id')
        .eq('briefing_id', briefing.id)
        .gte('acknowledged_at', briefing.published_at)
        .in('user_id', userIds);
      if (aErr) console.error('Chargement acquittements échoué :', aErr);
      ackSet = new Set((acks ?? []).map(a => a.user_id));
    }

    setRows(list.map(p => ({
      ...p,
      nom: profilMap[p.user_id]?.nom ?? '?',
      prenom: profilMap[p.user_id]?.prenom ?? '',
      brevet: brevetMap[p.user_id] ?? null,
      voile_perso_nom: p.voile_perso_ref ? materielMap[p.voile_perso_ref] ?? null : null,
      briefingAcquitte: ackSet.has(p.user_id),
    })));
    setLoading(false);
  }, [dzId]);

  useEffect(() => { load(); }, [load]);
  // Temps réel sur les présences + filet 30 s
  useEffect(() => {
    if (!dzId) return;
    const channel = supabase
      .channel(`presences-${dzId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dz_presences', filter: `dz_id=eq.${dzId}` }, () => load())
      .subscribe();
    const poll = setInterval(load, 30_000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [dzId, load]);

  /** Retrait manuel par le DT (parti sans se déclarer) — réversible. */
  const retirer = async (presenceId: string, retour = false): Promise<string | null> => {
    const { data: written, error } = await supabase
      .from('dz_presences')
      .update({ statut: retour ? 'present' : 'parti', updated_at: new Date().toISOString() })
      .eq('id', presenceId)
      .select('id');
    if (error || !written || written.length === 0) {
      console.error('Retrait présence échoué :', error);
      return error?.message ?? 'Action refusée.';
    }
    await load();
    return null;
  };

  return { rows, loading, retirer, refresh: load };
}
