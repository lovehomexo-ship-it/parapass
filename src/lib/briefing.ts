import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoFlyZone { label: string; points: { x: number; y: number }[] }
export interface Hazard { label: string; x: number; y: number }

export interface DzSettings {
  dz_id: string;
  image_fond_url: string | null;
  lz_x: number | null; lz_y: number | null;
  sock_x: number | null; sock_y: number | null;
  no_fly_zones: NoFlyZone[];
}

export interface DzBriefing {
  id: string;
  dz_id: string;
  briefing_date: string;
  version: number;
  wind_direction_deg: number;
  wind_speed_kt: number | null;
  sens_atterrissage_deg: number;
  circuit_side: 'main_gauche' | 'main_droite';
  altitude_debut_circuit_m: number;
  consignes: string | null;
  hazards: Hazard[];
  published_at: string;
  published_by: string | null;
}

// ─── Géométrie ────────────────────────────────────────────────────────────────

/** Cap compas (°) → vecteur unitaire écran (x → droite, y → bas, Nord = haut). */
export function headingToVector(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

export interface CircuitGeometry {
  /** Début du vent arrière (entrée de circuit). */
  start: { x: number; y: number };
  /** Virage vent arrière → base. */
  turnBase: { x: number; y: number };
  /** Virage base → finale. */
  turnFinal: { x: number; y: number };
  /** Zone de posé (fin de finale). */
  lz: { x: number; y: number };
  /** Path SVG avec virages arrondis. */
  path: string;
  /** Milieux de branches pour les labels. */
  midDownwind: { x: number; y: number };
  midBase: { x: number; y: number };
  midFinal: { x: number; y: number };
}

/**
 * Circuit d'atterrissage : finale alignée sur sensDeg et aboutissant à la LZ,
 * base perpendiculaire, vent arrière parallèle opposé. Miroir selon le côté.
 * Coordonnées et longueurs dans l'unité de l'appelant (ex. viewBox SVG).
 */
export function computeCircuit(
  lz: { x: number; y: number },
  sensDeg: number,
  side: 'main_gauche' | 'main_droite',
  scale: number // longueur de référence (ex. min(largeur, hauteur))
): CircuitGeometry {
  const d = headingToVector(sensDeg); // direction de déplacement en finale
  // Normale : main_droite = circuit à droite de l'axe finale (vu dans le sens d'atterrissage)
  const sign = side === 'main_droite' ? 1 : -1;
  const n = { x: -d.y * sign, y: d.x * sign };

  const Lf = scale * 0.26; // finale
  const Lb = scale * 0.18; // base
  const Ld = scale * 0.34; // vent arrière

  const turnFinal = { x: lz.x - d.x * Lf, y: lz.y - d.y * Lf };
  const turnBase = { x: turnFinal.x - n.x * Lb, y: turnFinal.y - n.y * Lb };
  const start = { x: turnBase.x + d.x * Ld, y: turnBase.y + d.y * Ld };

  const r = scale * 0.045; // rayon des virages arrondis
  const bIn  = { x: turnBase.x + d.x * r, y: turnBase.y + d.y * r };
  const bOut = { x: turnBase.x + n.x * r, y: turnBase.y + n.y * r };
  const fIn  = { x: turnFinal.x - n.x * r, y: turnFinal.y - n.y * r };
  const fOut = { x: turnFinal.x + d.x * r, y: turnFinal.y + d.y * r };

  const path = [
    `M ${start.x} ${start.y}`,
    `L ${bIn.x} ${bIn.y}`,
    `Q ${turnBase.x} ${turnBase.y} ${bOut.x} ${bOut.y}`,
    `L ${fIn.x} ${fIn.y}`,
    `Q ${turnFinal.x} ${turnFinal.y} ${fOut.x} ${fOut.y}`,
    `L ${lz.x} ${lz.y}`,
  ].join(' ');

  return {
    start, turnBase, turnFinal, lz, path,
    midDownwind: { x: (start.x + turnBase.x) / 2, y: (start.y + turnBase.y) / 2 },
    midBase: { x: (turnBase.x + turnFinal.x) / 2, y: (turnBase.y + turnFinal.y) / 2 },
    midFinal: { x: (turnFinal.x + lz.x) / 2, y: (turnFinal.y + lz.y) / 2 },
  };
}

// ─── Hooks données ────────────────────────────────────────────────────────────

function parseSettings(row: Record<string, unknown>): DzSettings {
  return {
    dz_id: row.dz_id as string,
    image_fond_url: (row.image_fond_url as string | null) ?? null,
    lz_x: row.lz_x as number | null, lz_y: row.lz_y as number | null,
    sock_x: row.sock_x as number | null, sock_y: row.sock_y as number | null,
    no_fly_zones: (row.no_fly_zones as NoFlyZone[] | null) ?? [],
  };
}

function parseBriefing(row: Record<string, unknown>): DzBriefing {
  return { ...(row as unknown as DzBriefing), hazards: (row.hazards as Hazard[] | null) ?? [] };
}

/** Dernière version du briefing du jour pour une DZ (+ settings), avec rafraîchissement optionnel. */
export function useBriefingDuJour(dzId: string | undefined, pollMs?: number) {
  const [settings, setSettings] = useState<DzSettings | null>(null);
  const [briefing, setBriefing] = useState<DzBriefing | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!dzId) return;
    const today = new Date().toISOString().substring(0, 10);
    const [{ data: s, error: se }, { data: b, error: be }] = await Promise.all([
      supabase.from('dz_settings').select('*').eq('dz_id', dzId).maybeSingle(),
      supabase.from('dz_briefings').select('*').eq('dz_id', dzId).eq('briefing_date', today)
        .order('version', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (se) console.error('Chargement dz_settings échoué :', se);
    if (be) console.error('Chargement dz_briefings échoué :', be);
    setSettings(s ? parseSettings(s) : null);
    setBriefing(b ? parseBriefing(b) : null);
    setLoading(false);
  }, [dzId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!pollMs) return;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [pollMs, load]);

  return { settings, briefing, loading, refresh: load };
}

/** Acquittement de l'utilisateur pour un briefing donné. */
export function useBriefingAck(briefingId: string | undefined, userId: string | undefined) {
  const [ackAt, setAckAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAckAt(null);
    if (!briefingId || !userId) return;
    supabase
      .from('briefing_acknowledgements')
      .select('acknowledged_at')
      .eq('briefing_id', briefingId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('Chargement acquittement échoué :', error); return; }
        setAckAt(data?.acknowledged_at ?? null);
      });
  }, [briefingId, userId]);

  const acknowledge = async () => {
    if (!briefingId || !userId) return;
    setError(null);
    const { data: written, error } = await supabase
      .from('briefing_acknowledgements')
      .insert({ briefing_id: briefingId, user_id: userId })
      .select('acknowledged_at');
    if (error || !written || written.length === 0) {
      console.error('Acquittement échoué :', error);
      setError(error?.message ?? 'Acquittement refusé');
      return;
    }
    setAckAt(written[0].acknowledged_at);
  };

  return { ackAt, acknowledge, error };
}
