import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Météo vent en altitude (Open-Meteo, niveaux de pression) ─────────────────
// PRÉVISION INDICATIVE issue d'un modèle météo — pas une source aéronautique
// certifiée. L'appli informe, le DT et le parachutiste décident.
// Cache par DZ (dz_meteo_cache) : un appel API par DZ et par heure, maximum.

/** Niveaux de pression exposés par Open-Meteo → altitude ISA approchée. */
export const NIVEAUX_PRESSION = [
  { hPa: 1000, altM: 110 },
  { hPa: 925, altM: 760 },
  { hPa: 850, altM: 1460 },
  { hPa: 700, altM: 3010 },
  { hPa: 600, altM: 4200 }, // ≈ altitude de largage
  { hPa: 500, altM: 5570 },
] as const;

export interface MeteoJour {
  date: string;
  code: number; // code météo WMO
  tempMax: number;
  ventMax: number; // km/h
  rafalesMax: number; // km/h
}

export interface MeteoAltitudePayload {
  source: 'Open-Meteo';
  times: string[]; // heures locales ISO (3 jours)
  sol: { speed: number[]; dir: number[]; gusts: number[] }; // km/h, ° (d'où vient le vent)
  nuages: { total: number[]; bas: number[]; moyens: number[]; hauts: number[] }; // %
  niveaux: { hPa: number; altM: number; speed: number[]; dir: number[] }[];
  jours: MeteoJour[]; // résumé 3 jours (même appel API)
}

/** Icône selon le code météo WMO. */
export function iconeMeteo(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}

const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 h — les modèles ne bougent que quelques fois/jour

async function fetchOpenMeteo(lat: number, lon: number): Promise<MeteoAltitudePayload> {
  const niveauxVars = NIVEAUX_PRESSION
    .map(n => `windspeed_${n.hPa}hPa,winddirection_${n.hPa}hPa`)
    .join(',');
  // UN SEUL appel : horaire (profil vertical) + quotidien (résumé 3 jours)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,${niveauxVars}`
    + `&daily=weather_code,temperature_2m_max,wind_speed_10m_max,wind_gusts_10m_max`
    + `&forecast_days=3&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json() as { hourly: Record<string, (number | string)[]>; daily: Record<string, (number | string)[]> };
  const h = data.hourly;
  const d = data.daily;
  return {
    source: 'Open-Meteo',
    times: h.time as string[],
    sol: {
      speed: h.wind_speed_10m as number[],
      dir: h.wind_direction_10m as number[],
      gusts: h.wind_gusts_10m as number[],
    },
    nuages: {
      total: h.cloud_cover as number[],
      bas: h.cloud_cover_low as number[],
      moyens: h.cloud_cover_mid as number[],
      hauts: h.cloud_cover_high as number[],
    },
    niveaux: NIVEAUX_PRESSION.map(n => ({
      hPa: n.hPa,
      altM: n.altM,
      speed: h[`windspeed_${n.hPa}hPa`] as number[],
      dir: h[`winddirection_${n.hPa}hPa`] as number[],
    })),
    jours: (d.time as string[]).map((date, i) => ({
      date,
      code: (d.weather_code as number[])[i] ?? 0,
      tempMax: (d.temperature_2m_max as number[])[i] ?? 0,
      ventMax: (d.wind_speed_10m_max as number[])[i] ?? 0,
      rafalesMax: (d.wind_gusts_10m_max as number[])[i] ?? 0,
    })),
  };
}

/** Index de l'heure courante dans le tableau horaire (heures locales de la DZ). */
export function indexHeureCourante(times: string[]): number {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:00`;
  const idx = times.indexOf(key);
  return idx >= 0 ? idx : Math.min(new Date().getHours(), times.length - 1);
}

export interface MeteoAltitudeState {
  payload: MeteoAltitudePayload | null;
  fetchedAt: string | null;
  /** true si on sert un cache périmé faute d'API joignable */
  perime: boolean;
  error: string | null;
  loading: boolean;
}

/** Météo de la DZ affichée : cache partagé en base, rafraîchi au plus 1×/heure
 *  (par le premier client qui constate un cache trop vieux — pour tous). */
export function useMeteoAltitude(dzId: string | undefined): MeteoAltitudeState {
  const [state, setState] = useState<MeteoAltitudeState>({ payload: null, fetchedAt: null, perime: false, error: null, loading: true });

  const load = useCallback(async () => {
    if (!dzId) return;
    // 1. Cache partagé
    const { data: cache, error: cacheErr } = await supabase
      .from('dz_meteo_cache')
      .select('payload, fetched_at')
      .eq('dz_id', dzId)
      .maybeSingle();
    if (cacheErr) console.error('Lecture cache météo échouée :', cacheErr);

    // Un cache sans structure attendue (ancien format inclus) est ignoré
    const cacheValide = cache
      && Array.isArray((cache.payload as MeteoAltitudePayload)?.times)
      && Array.isArray((cache.payload as MeteoAltitudePayload)?.jours);
    const cacheAge = cacheValide ? Date.now() - new Date(cache.fetched_at).getTime() : Infinity;
    if (cacheValide && cacheAge < CACHE_MAX_AGE_MS) {
      setState({ payload: cache.payload as MeteoAltitudePayload, fetchedAt: cache.fetched_at, perime: false, error: null, loading: false });
      return;
    }

    // 2. Cache absent ou > 1 h : coordonnées du centre puis appel API
    const { data: centre, error: centreErr } = await supabase
      .from('centres')
      .select('latitude, longitude')
      .eq('id', dzId)
      .maybeSingle();
    if (centreErr) console.error('Lecture coordonnées centre échouée :', centreErr);
    if (!centre?.latitude || !centre?.longitude) {
      setState({
        payload: cacheValide ? (cache!.payload as MeteoAltitudePayload) : null,
        fetchedAt: cache?.fetched_at ?? null,
        perime: !!cacheValide,
        error: cacheValide ? null : 'Coordonnées de la DZ non renseignées — météo localisée indisponible.',
        loading: false,
      });
      return;
    }

    try {
      const payload = await fetchOpenMeteo(centre.latitude, centre.longitude);
      const fetchedAt = new Date().toISOString();
      setState({ payload, fetchedAt, perime: false, error: null, loading: false });
      // Écrit le cache pour tous les utilisateurs de la DZ (erreur non bloquante mais tracée)
      const { error: upErr } = await supabase
        .from('dz_meteo_cache')
        .upsert({ dz_id: dzId, payload, fetched_at: fetchedAt })
        .select('dz_id');
      if (upErr) console.error('Écriture cache météo échouée :', upErr);
    } catch (e) {
      console.error('Appel Open-Meteo échoué :', e);
      // Repli : dernière prévision en cache, signalée comme périmée — jamais d'écran vide
      setState({
        payload: cacheValide ? (cache!.payload as MeteoAltitudePayload) : null,
        fetchedAt: cache?.fetched_at ?? null,
        perime: !!cacheValide,
        error: cacheValide ? null : 'Météo injoignable et aucune prévision en cache. Réessayez plus tard.',
        loading: false,
      });
    }
  }, [dzId]);

  useEffect(() => { load(); }, [load]);

  return state;
}

/** Estimation de plafond à partir des couches Open-Meteo (pas de base nuageuse
 *  directe dans l'API) : couche basse ≈ < 2 000 m, moyenne ≈ 2–6 km. */
export function estimePlafond(nuages: MeteoAltitudePayload['nuages'], i: number): string {
  if ((nuages.bas[i] ?? 0) > 60) return 'plafond bas probable (< 2 000 m)';
  if ((nuages.moyens[i] ?? 0) > 60) return 'couche moyenne (2–6 km)';
  if ((nuages.total[i] ?? 0) > 80) return 'ciel couvert (couche haute)';
  if ((nuages.total[i] ?? 0) > 40) return 'partiellement nuageux';
  return 'ciel dégagé';
}

export const kmhEnKt = (kmh: number) => Math.round(kmh * 0.539957);
