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
  /** Immuable — published_at nettement postérieur = briefing republié dans la journée. */
  created_at: string;
}

/** Compresse une image côté client avant upload : largeur max 1600 px,
 *  WebP qualité 0.8 (repli JPEG). Objectif : < 400 Ko au lieu de plusieurs Mo,
 *  pour que le fond charge même en 3G au bord de la piste. */
export async function compressImageFond(file: File): Promise<{ blob: Blob; ext: string; width: number; height: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Image illisible'));
    i.src = URL.createObjectURL(file);
  });
  const MAX_W = 1600;
  const scale = Math.min(1, MAX_W / img.naturalWidth);
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(img.src);

  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, q));

  let blob = await toBlob('image/webp', 0.8);
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob('image/jpeg', 0.8);
    ext = 'jpg';
  }
  if (!blob) throw new Error('Compression impossible');
  return { blob, ext, width, height };
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
  const [loadError, setLoadError] = useState<string | null>(null); // échec réseau SANS copie locale
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
      setLoadError(null);

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
      } else {
        // Pas de copie locale : on le DIT au lieu de ne rien afficher
        setLoadError('Impossible de charger le briefing (connexion ?). Réessayez.');
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

  // Realtime sur dz_briefings : une (re)publication met à jour published_at ;
  // toutes les vues doivent le voir pour que le compteur d'acquittements reparte
  // de 0 (les acks < nouveau published_at ne comptent plus). Sans cet abonnement,
  // le composant garde un published_at périmé et recompte les anciens acks.
  useEffect(() => {
    if (!dzId) return;
    const channel = supabase
      .channel(`dz-briefings-${dzId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'dz_briefings', filter: `dz_id=eq.${dzId}` },
        () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dzId, load]);

  return { settings, briefing, circuit, backgroundUrl, offline, loadError, loading, refresh: load };
}

/** Acquittement de l'utilisateur — avec file locale si hors ligne.
 *  Un acquittement ANTÉRIEUR à published_at est périmé (briefing republié) :
 *  `stale` vaut true et `ackAt` valide redevient null tant que l'utilisateur
 *  n'a pas ré-acquitté (upsert : la ligne unique est mise à jour). */
// État d'acquittement PARTAGÉ entre toutes les instances (le bloc briefing est
// rendu en haut ET en bas du dashboard : l'acquittement doit basculer les deux
// dans le même mouvement, sans rechargement).
const ackShared = new Map<string, { at: string | null; pending: boolean; fetched: boolean }>();
const ackSubs = new Set<() => void>();
function setAckShared(key: string, at: string | null, pending: boolean) {
  ackShared.set(key, { at, pending, fetched: true });
  ackSubs.forEach(f => f());
}

export function useBriefingAck(briefingId: string | undefined, userId: string | undefined, publishedAt?: string | null) {
  const key = `${briefingId}:${userId}`;
  const [, forceRender] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Abonnement au store partagé
  useEffect(() => {
    const sub = () => forceRender(n => n + 1);
    ackSubs.add(sub);
    return () => { ackSubs.delete(sub); };
  }, []);

  useEffect(() => {
    if (!briefingId || !userId || ackShared.get(key)?.fetched) return;
    const queued = readAckQueue().find(a => a.briefing_id === briefingId && a.user_id === userId);
    if (queued) { setAckShared(key, queued.acknowledged_at, true); return; }
    supabase
      .from('briefing_acknowledgements')
      .select('acknowledged_at')
      .eq('briefing_id', briefingId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('Chargement acquittement échoué :', error); return; }
        setAckShared(key, data?.acknowledged_at ?? null, false);
      });
  }, [briefingId, userId, key]);

  const shared = ackShared.get(key);
  const rawAckAt = shared?.at ?? null;
  const pending = shared?.pending ?? false;
  const setRawAckAt = (at: string | null, p = false) => setAckShared(key, at, p);

  // Le test « a acquitté » devient : acknowledged_at >= published_at
  const isStale = !!(rawAckAt && publishedAt && new Date(rawAckAt) < new Date(publishedAt));
  const ackAt = isStale ? null : rawAckAt;

  const acknowledge = async () => {
    if (!briefingId || !userId || saving) return;
    setError(null);
    setSaving(true);
    const now = new Date().toISOString();
    // Mise à jour OPTIMISTE : le bandeau disparaît dès le clic ; on rétablit
    // l'état précédent avec un message clair si l'écriture échoue.
    const previous = rawAckAt;
    setRawAckAt(now);
    // Upsert : premier acquittement OU ré-acquittement après republication
    const { data: written, error } = await supabase
      .from('briefing_acknowledgements')
      .upsert({ briefing_id: briefingId, user_id: userId, acknowledged_at: now }, { onConflict: 'briefing_id,user_id' })
      .select('acknowledged_at');
    setSaving(false);
    if (error || !written || written.length === 0) {
      // Hors ligne : on met en file locale, l'affichage optimiste reste valable
      if (!navigator.onLine || (error && error.message.includes('Failed to fetch'))) {
        writeAckQueue([...readAckQueue().filter(a => !(a.briefing_id === briefingId && a.user_id === userId)), { briefing_id: briefingId, user_id: userId, acknowledged_at: now }]);
        setRawAckAt(now, true);
        return;
      }
      // Vrai échec : on annule l'optimisme et on le dit, en français
      console.error('Acquittement échoué :', error);
      setRawAckAt(previous);
      setError('L\'acquittement n\'a pas pu être enregistré. Vérifiez votre connexion et réessayez.');
      return;
    }
    setRawAckAt(written[0].acknowledged_at);
  };

  return { ackAt, stale: isStale, pending, saving, acknowledge, error };
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

  /** Suppression d'un circuit. Renvoie un message d'erreur, ou null si OK.
   *  Un circuit référencé par des briefings publiés ne peut pas être supprimé
   *  (l'archive est la preuve de diffusion) : on le désactive à la place. */
  const remove = async (circuitId: string): Promise<string | null> => {
    const { data: deleted, error } = await supabase
      .from('dz_circuits').delete().eq('id', circuitId).select('id');
    if (error || !deleted || deleted.length === 0) {
      console.error('Suppression dz_circuits échouée :', error);
      if (error?.code === '23503') {
        return 'Ce circuit est référencé par des briefings publiés (archive). Décochez « Actif » pour le retirer des choix, sans casser l\'historique.';
      }
      return error?.message ?? 'Suppression refusée.';
    }
    await load();
    return null;
  };

  return { circuits, save, remove, refresh: load };
}
