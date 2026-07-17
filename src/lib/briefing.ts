import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
// Toutes les coordonnées sont en POURCENTAGE de l'image (0–100), jamais en pixels.

export type Point = [number, number];

export interface ZonePolygone { nom: string; points: Point[] }

export interface DzSettings {
  dz_id: string;
  image_fond_path: string | null;
  image_fond_largeur: number | null;
  image_fond_hauteur: number | null;
  sock_x: number | null; sock_y: number | null;
  no_fly_zones: ZonePolygone[];
  obstacles: ZonePolygone[];
}

export interface DzCircuit {
  id: string;
  dz_id: string;
  nom: string;
  sens: 'main_gauche' | 'main_droite';
  /** Polyligne du début de circuit jusqu'à la zone de posé — tracée par le DT, jamais calculée. */
  trace: Point[];
  lz_x: number | null; lz_y: number | null;
  /** Zone (polygone) où les parachutistes évoluent avant le circuit — jamais une trajectoire. */
  zone_evolution: Point[] | null;
  altitude_debut_m: number;
  actif: boolean;
}

export interface DzBriefing {
  id: string;
  dz_id: string;
  date_briefing: string;
  circuit_id: string | null;
  vent_direction_deg: number;
  vent_vitesse_kt: number | null;
  consignes: string | null;
  published_at: string;
}

/** URL publique du fond (bucket dz-maps public, cache long). `v` invalide le cache après remplacement. */
export function dzMapPublicUrl(path: string, v?: string): string {
  const { data } = supabase.storage.from('dz-maps').getPublicUrl(path);
  return v ? `${data.publicUrl}?v=${v}` : data.publicUrl;
}

/** Cap compas (°) du dernier segment du tracé = sens d'atterrissage dérivé (indicatif). */
export function sensAtterrissageDerive(trace: Point[]): number | null {
  if (trace.length < 2) return null;
  const [x1, y1] = trace[trace.length - 2];
  const [x2, y2] = trace[trace.length - 1];
  const deg = (Math.atan2(x2 - x1, -(y2 - y1)) * 180) / Math.PI; // Nord = -y écran
  return Math.round((deg + 360) % 360);
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseSettings(row: Record<string, unknown>): DzSettings {
  return {
    dz_id: row.dz_id as string,
    image_fond_path: (row.image_fond_path as string | null) ?? null,
    image_fond_largeur: (row.image_fond_largeur as number | null) ?? null,
    image_fond_hauteur: (row.image_fond_hauteur as number | null) ?? null,
    sock_x: row.sock_x as number | null, sock_y: row.sock_y as number | null,
    no_fly_zones: (row.no_fly_zones as ZonePolygone[] | null) ?? [],
    obstacles: (row.obstacles as ZonePolygone[] | null) ?? [],
  };
}

function parseCircuit(row: Record<string, unknown>): DzCircuit {
  return {
    ...(row as unknown as DzCircuit),
    trace: (row.trace as Point[] | null) ?? [],
    zone_evolution: (row.zone_evolution as Point[] | null) ?? null,
  };
}

// ─── Hors-ligne ───────────────────────────────────────────────────────────────

interface BriefingSnapshot {
  settings: DzSettings;
  briefing: DzBriefing;
  circuit: DzCircuit | null;
  backgroundUrl: string | null;
}

const snapshotKey = (dzId: string, date: string) => `parapass:briefing:${dzId}:${date}`;
const ACK_QUEUE_KEY = 'parapass:briefing:ack-queue';

function readSnapshot(dzId: string, date: string): BriefingSnapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(dzId, date));
    return raw ? (JSON.parse(raw) as BriefingSnapshot) : null;
  } catch { return null; }
}

function writeSnapshot(dzId: string, date: string, snap: BriefingSnapshot) {
  try { localStorage.setItem(snapshotKey(dzId, date), JSON.stringify(snap)); } catch { /* stockage plein : tant pis */ }
}

interface QueuedAck { briefing_id: string; user_id: string; acknowledged_at: string }

function readAckQueue(): QueuedAck[] {
  try { return JSON.parse(localStorage.getItem(ACK_QUEUE_KEY) ?? '[]') as QueuedAck[]; } catch { return []; }
}
function writeAckQueue(q: QueuedAck[]) {
  try { localStorage.setItem(ACK_QUEUE_KEY, JSON.stringify(q)); } catch { /* ignore */ }
}

/** Rejoue les acquittements mis en file hors ligne. Renvoie le nombre rejoué. */
export async function flushAckQueue(): Promise<number> {
  const queue = readAckQueue();
  if (queue.length === 0) return 0;
  const remaining: QueuedAck[] = [];
  let flushed = 0;
  for (const ack of queue) {
    // onConflict SANS ignoreDuplicates : un ré-acquittement hors ligne met à jour la ligne
    const { error } = await supabase
      .from('briefing_acknowledgements')
      .upsert({ briefing_id: ack.briefing_id, user_id: ack.user_id, acknowledged_at: ack.acknowledged_at }, { onConflict: 'briefing_id,user_id' });
    if (error) {
      console.error('Rejeu acquittement hors-ligne échoué :', error);
      remaining.push(ack);
    } else {
      flushed++;
    }
  }
  writeAckQueue(remaining);
  return flushed;
}

// ─── Hooks données ────────────────────────────────────────────────────────────

/** DZ actives du licencié (id + nom) — depuis licencies_centres, la table de
 *  référence du module briefing et de ses RLS. Un licencié peut appartenir à
 *  plusieurs DZ : le dashboard affiche le briefing de chacune. */
export function useDzMembre(userId: string | undefined): { id: string; nom: string }[] {
  const [dzs, setDzs] = useState<{ id: string; nom: string }[]>([]);
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('licencies_centres')
      .select('centre_id, centre:centres(nom)')
      .eq('parachutiste_id', userId)
      .eq('statut', 'actif')
      .then(({ data, error }) => {
        if (error) { console.error('Chargement DZ du membre échoué :', error); return; }
        const seen = new Set<string>();
        setDzs((data ?? [])
          .map((r: Record<string, unknown>) => ({ id: r.centre_id as string, nom: (r.centre as { nom?: string } | null)?.nom ?? 'DZ' }))
          .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; }));
      });
  }, [userId]);
  return dzs;
}

/** Briefing du jour + circuit actif + settings. Copie locale pour le hors-ligne. */
export function useBriefingDuJour(dzId: string | undefined) {
  const [settings, setSettings] = useState<DzSettings | null>(null);
  const [briefing, setBriefing] = useState<DzBriefing | null>(null);
  const [circuit, setCircuit] = useState<DzCircuit | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!dzId) return;
    const today = new Date().toISOString().substring(0, 10);
    try {
      const [{ data: s, error: se }, { data: b, error: be }] = await Promise.all([
        supabase.from('dz_settings').select('*').eq('dz_id', dzId).maybeSingle(),
        supabase.from('dz_briefings').select('*').eq('dz_id', dzId).eq('date_briefing', today).maybeSingle(),
      ]);
      if (se || be) throw se ?? be;

      const parsedSettings = s ? parseSettings(s) : null;
      const parsedBriefing = (b as DzBriefing | null) ?? null;
      let parsedCircuit: DzCircuit | null = null;
      if (parsedBriefing?.circuit_id) {
        const { data: c, error: ce } = await supabase.from('dz_circuits').select('*').eq('id', parsedBriefing.circuit_id).maybeSingle();
        if (ce) throw ce;
        parsedCircuit = c ? parseCircuit(c) : null;
      }
      const bg = parsedSettings?.image_fond_path ? dzMapPublicUrl(parsedSettings.image_fond_path) : null;

      setSettings(parsedSettings);
      setBriefing(parsedBriefing);
      setCircuit(parsedCircuit);
      setBackgroundUrl(bg);
      setOffline(false);

      if (parsedSettings && parsedBriefing) {
        writeSnapshot(dzId, today, { settings: parsedSettings, briefing: parsedBriefing, circuit: parsedCircuit, backgroundUrl: bg });
      }
      // Reconnecté : on rejoue les acquittements en attente
      flushAckQueue();
    } catch (e) {
      console.error('Chargement briefing échoué — bascule hors ligne :', e);
      const snap = readSnapshot(dzId, today);
      if (snap) {
        setSettings(snap.settings);
        setBriefing(snap.briefing);
        setCircuit(snap.circuit);
        setBackgroundUrl(snap.backgroundUrl);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [dzId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onOnline = () => load();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [load]);

  return { settings, briefing, circuit, backgroundUrl, offline, loading, refresh: load };
}

/** Acquittement de l'utilisateur — avec file locale si hors ligne.
 *  Un acquittement ANTÉRIEUR à published_at est périmé (briefing republié) :
 *  `stale` vaut true et `ackAt` valide redevient null tant que l'utilisateur
 *  n'a pas ré-acquitté (upsert : la ligne unique est mise à jour). */
export function useBriefingAck(briefingId: string | undefined, userId: string | undefined, publishedAt?: string | null) {
  const [rawAckAt, setRawAckAt] = useState<string | null>(null);
  const [pending, setPending] = useState(false); // acquitté hors ligne, en attente de synchro
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRawAckAt(null); setPending(false);
    if (!briefingId || !userId) return;
    const queued = readAckQueue().find(a => a.briefing_id === briefingId && a.user_id === userId);
    if (queued) { setRawAckAt(queued.acknowledged_at); setPending(true); return; }
    supabase
      .from('briefing_acknowledgements')
      .select('acknowledged_at')
      .eq('briefing_id', briefingId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('Chargement acquittement échoué :', error); return; }
        setRawAckAt(data?.acknowledged_at ?? null);
      });
  }, [briefingId, userId]);

  // Le test « a acquitté » devient : acknowledged_at >= published_at
  const isStale = !!(rawAckAt && publishedAt && new Date(rawAckAt) < new Date(publishedAt));
  const ackAt = isStale ? null : rawAckAt;

  const acknowledge = async () => {
    if (!briefingId || !userId) return;
    setError(null);
    const now = new Date().toISOString();
    // Upsert : premier acquittement OU ré-acquittement après republication
    const { data: written, error } = await supabase
      .from('briefing_acknowledgements')
      .upsert({ briefing_id: briefingId, user_id: userId, acknowledged_at: now }, { onConflict: 'briefing_id,user_id' })
      .select('acknowledged_at');
    if (error || !written || written.length === 0) {
      // Hors ligne : on met en file locale et on l'affiche comme pris
      if (!navigator.onLine || (error && error.message.includes('Failed to fetch'))) {
        writeAckQueue([...readAckQueue().filter(a => !(a.briefing_id === briefingId && a.user_id === userId)), { briefing_id: briefingId, user_id: userId, acknowledged_at: now }]);
        setRawAckAt(now);
        setPending(true);
        return;
      }
      console.error('Acquittement échoué :', error);
      setError(error?.message ?? 'Acquittement refusé');
      return;
    }
    setRawAckAt(written[0].acknowledged_at);
  };

  return { ackAt, stale: isStale, pending, acknowledge, error };
}

// ─── CRUD circuits (écran DT) ─────────────────────────────────────────────────

export function useDzCircuits(dzId: string | undefined) {
  const [circuits, setCircuits] = useState<DzCircuit[]>([]);

  const load = useCallback(async () => {
    if (!dzId) return;
    const { data, error } = await supabase.from('dz_circuits').select('*').eq('dz_id', dzId).order('created_at');
    if (error) { console.error('Chargement dz_circuits échoué :', error); return; }
    setCircuits((data ?? []).map(parseCircuit));
  }, [dzId]);

  useEffect(() => { load(); }, [load]);

  /** Sauvegarde explicite d'un circuit. Renvoie un message d'erreur, ou null si OK. */
  const save = async (circuit: Partial<DzCircuit> & { dz_id: string }): Promise<string | null> => {
    const payload = {
      dz_id: circuit.dz_id,
      nom: circuit.nom,
      sens: circuit.sens,
      trace: circuit.trace ?? [],
      lz_x: circuit.lz_x ?? null, lz_y: circuit.lz_y ?? null,
      zone_evolution: circuit.zone_evolution ?? null,
      altitude_debut_m: circuit.altitude_debut_m,
      actif: circuit.actif ?? true,
      updated_at: new Date().toISOString(),
    };
    const { data: written, error } = circuit.id
      ? await supabase.from('dz_circuits').update(payload).eq('id', circuit.id).select('id')
      : await supabase.from('dz_circuits').insert(payload).select('id');
    if (error || !written || written.length === 0) {
      console.error('Écriture dz_circuits échouée :', error);
      return error?.message ?? 'Écriture refusée — le circuit n\'a pas été enregistré.';
    }
    await load();
    return null;
  };

  return { circuits, save, refresh: load };
}
