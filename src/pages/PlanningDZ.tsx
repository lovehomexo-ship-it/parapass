import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  ChevronLeft, ChevronRight, Calendar, Clock, Thermometer,
  Users, X, MessageSquare, RefreshCw, MapPin,
  Plane,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Creneau {
  id: string;
  centre_id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  statut: 'ouvert' | 'ferme' | 'sous_reserve' | 'annule';
  titre: string | null;
  message: string | null;
  offre_promo: string | null;
  nb_places_total: number;
  nb_places_restantes: number;
  avion: string | null;
  altitude_prevue: number | null;
  type_saut: string[] | null;
  latitude: number | null;
  longitude: number | null;
  meteo_data: MeteoData | null;
  meteo_fetched_at: string | null;
  centres?: { nom: string; ville: string; latitude?: number; longitude?: number };
}

interface Inscription {
  id: string;
  creneau_id: string;
  parachutiste_id: string;
  statut: 'present' | 'peut_etre' | 'absent';
  commentaire: string | null;
}

interface MeteoData {
  temperature: number;
  windspeed_10m: number;
  winddirection_10m: number;
  windspeed_1500: number;
  windspeed_3000: number;
  windspeed_5500: number;
  precipitation_probability: number;
  cloudcover: number;
  visibility: number;
  weathercode: number;
}

interface ConditionEval {
  statut: 'favorable' | 'limite' | 'interdit';
  couleur: string;
  emoji: string;
  message: string;
}

// ─── Météo helpers ────────────────────────────────────────────────────────────

const BREVET_LIMITES: Record<string, { vent: number; hauteurMin: number }> = {
  avant_A: { vent: 7, hauteurMin: 1200 },
  A: { vent: 11, hauteurMin: 1200 },
  B: { vent: 11, hauteurMin: 1000 },
  BPA: { vent: 11, hauteurMin: 850 },
  C: { vent: 11, hauteurMin: 850 },
  D: { vent: 11, hauteurMin: 850 },
};

function evaluerConditions(meteo: MeteoData, brevet: string): ConditionEval {
  const limite = BREVET_LIMITES[brevet] ?? BREVET_LIMITES.B;
  const { windspeed_10m, precipitation_probability, visibility } = meteo;
  if (windspeed_10m > limite.vent || precipitation_probability > 70 || visibility < 5000) {
    return { statut: 'interdit', couleur: '#EF4444', emoji: '🔴', message: `Conditions non conformes pour votre brevet ${brevet}` };
  }
  if (windspeed_10m > limite.vent * 0.8 || precipitation_probability > 30) {
    return { statut: 'limite', couleur: '#F59E0B', emoji: '🟡', message: 'Conditions limites — vérifiez avec votre DT' };
  }
  return { statut: 'favorable', couleur: '#10B981', emoji: '🟢', message: `Conditions favorables pour votre brevet ${brevet}` };
}

function ms2kmh(ms: number) { return (ms * 3.6).toFixed(0); }

async function fetchMeteoOpenMeteo(lat: number, lon: number): Promise<MeteoData | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('hourly', [
      'temperature_2m', 'windspeed_10m', 'windspeed_850hPa', 'windspeed_700hPa',
      'windspeed_500hPa', 'winddirection_10m', 'weathercode', 'visibility',
      'cloudcover', 'precipitation_probability',
    ].join(','));
    url.searchParams.set('windspeed_unit', 'ms');
    url.searchParams.set('forecast_days', '7');
    url.searchParams.set('timezone', 'Europe/Paris');
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    // Take noon values (index 12) for today
    const idx = 12;
    return {
      temperature: data.hourly.temperature_2m[idx] ?? 20,
      windspeed_10m: data.hourly.windspeed_10m[idx] ?? 0,
      winddirection_10m: data.hourly.winddirection_10m[idx] ?? 0,
      windspeed_1500: data.hourly.windspeed_850hPa[idx] ?? 0,
      windspeed_3000: data.hourly.windspeed_700hPa[idx] ?? 0,
      windspeed_5500: data.hourly.windspeed_500hPa[idx] ?? 0,
      precipitation_probability: data.hourly.precipitation_probability[idx] ?? 0,
      cloudcover: data.hourly.cloudcover[idx] ?? 0,
      visibility: data.hourly.visibility[idx] ?? 10000,
      weathercode: data.hourly.weathercode[idx] ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Wind bar ─────────────────────────────────────────────────────────────────

function WindBar({ ms, max = 15 }: { ms: number; max?: number }) {
  const pct = Math.min(100, (ms / max) * 100);
  const color = ms > 11 ? '#EF4444' : ms > 8 ? '#F59E0B' : '#10B981';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/20">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-20 flex-shrink-0" style={{ color }}>
        {ms.toFixed(1)} m/s ({ms2kmh(ms)} km/h)
      </span>
    </div>
  );
}

// ─── Météo widget ─────────────────────────────────────────────────────────────

function MeteoWidget({ creneau, brevet }: { creneau: Creneau; brevet: string }) {
  const [meteo, setMeteo] = useState<MeteoData | null>(creneau.meteo_data ?? null);
  const [loading, setLoading] = useState(!creneau.meteo_data);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;

    const lat = creneau.latitude ?? creneau.centres?.latitude;
    const lon = creneau.longitude ?? creneau.centres?.longitude;
    if (!lat || !lon) { setLoading(false); return; }

    // Use cached data if fresh (< 30 min)
    if (creneau.meteo_data && creneau.meteo_fetched_at) {
      const age = Date.now() - new Date(creneau.meteo_fetched_at).getTime();
      if (age < 30 * 60 * 1000) { setLoading(false); return; }
    }

    fetchedRef.current = true;
    setLoading(true);

    fetchMeteoOpenMeteo(lat, lon).then(data => {
      if (data) {
        setMeteo(data);
        supabase.from('creneaux_dz').update({
          meteo_data: data,
          meteo_fetched_at: new Date().toISOString(),
        }).eq('id', creneau.id);
      }
      setLoading(false);
    });
  }, [creneau.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasCoords = creneau.latitude || creneau.centres?.latitude;

  // Skeleton — same structure/height as the loaded widget header
  if (loading) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '56px' }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white/70 rounded-full animate-spin flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 rounded-full animate-pulse w-1/3" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <div className="h-2 rounded-full animate-pulse w-1/2" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>
          <div className="h-5 w-16 rounded-full animate-pulse flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
      </div>
    );
  }

  if (!meteo) {
    return (
      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)', minHeight: '56px', display: 'flex', alignItems: 'center' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {hasCoords ? 'Météo non disponible' : 'Coordonnées GPS non renseignées pour ce centre'}
        </p>
      </div>
    );
  }

  const conditions = evaluerConditions(meteo, brevet);
  const updatedAgo = creneau.meteo_fetched_at
    ? Math.round((Date.now() - new Date(creneau.meteo_fetched_at).getTime()) / 60000)
    : null;

  const handleRefresh = () => {
    const lat = creneau.latitude ?? creneau.centres?.latitude;
    const lon = creneau.longitude ?? creneau.centres?.longitude;
    if (!lat || !lon) return;
    fetchedRef.current = false;
    setLoading(true);
    fetchMeteoOpenMeteo(lat, lon).then(data => {
      if (data) {
        setMeteo(data);
        supabase.from('creneaux_dz').update({
          meteo_data: data,
          meteo_fetched_at: new Date().toISOString(),
        }).eq('id', creneau.id);
      }
      setLoading(false);
    });
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🌤️</span>
          <span className="text-xs font-semibold text-white">Météo en temps réel</span>
        </div>
        <div className="flex items-center gap-2">
          {updatedAgo !== null && (
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>màj il y a {updatedAgo} min</span>
          )}
          <button onClick={handleRefresh} className="p-1 rounded hover:bg-white/10 transition-colors">
            <RefreshCw className="w-3 h-3 text-white/50" />
          </button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* Conditions globales */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-white">
            <Thermometer className="w-3.5 h-3.5 text-orange-300" />
            {meteo.temperature.toFixed(0)}°C
          </span>
          <span className="flex items-center gap-1.5 text-xs text-white">
            ☁️ {meteo.cloudcover}% nuages
          </span>
          <span className="flex items-center gap-1.5 text-xs text-white">
            🌧️ Pluie {meteo.precipitation_probability}%
          </span>
          <span className="flex items-center gap-1.5 text-xs text-white">
            👁️ {(meteo.visibility / 1000).toFixed(0)} km
          </span>
        </div>
        {/* Vent */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>
            VENT AU SOL
          </div>
          <WindBar ms={meteo.windspeed_10m} />
          <div className="text-[10px] mt-2 mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>EN ALTITUDE</div>
          <div className="space-y-1">
            {[
              { label: '1 500m', ms: meteo.windspeed_1500 },
              { label: '3 000m', ms: meteo.windspeed_3000 },
              { label: '5 500m', ms: meteo.windspeed_5500 },
            ].map(w => (
              <div key={w.label} className="flex items-center gap-2">
                <span className="text-[10px] w-12 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>{w.label}</span>
                <WindBar ms={w.ms} max={25} />
              </div>
            ))}
          </div>
        </div>
        {/* Eval brevet */}
        <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${conditions.couleur}40` }}>
          <div className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            TON AUTORISATION (brevet {brevet.toUpperCase()})
          </div>
          <div className="space-y-0.5 mb-2">
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: meteo.windspeed_10m <= (BREVET_LIMITES[brevet]?.vent ?? 11) ? '#10B981' : '#EF4444' }}>
              {meteo.windspeed_10m <= (BREVET_LIMITES[brevet]?.vent ?? 11) ? '✓' : '✗'} Vent sol {meteo.windspeed_10m.toFixed(1)} m/s
              {meteo.windspeed_10m <= (BREVET_LIMITES[brevet]?.vent ?? 11) ? ' — OK' : ` — Limite ${BREVET_LIMITES[brevet]?.vent ?? 11} m/s`}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: meteo.precipitation_probability <= 30 ? '#10B981' : '#F59E0B' }}>
              {meteo.precipitation_probability <= 30 ? '✓' : '⚠️'} Pluie {meteo.precipitation_probability}%
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base">{conditions.emoji}</span>
            <div>
              <div className="text-xs font-bold" style={{ color: conditions.couleur }}>
                CONDITIONS {conditions.statut === 'favorable' ? 'FAVORABLES' : conditions.statut === 'limite' ? 'LIMITES' : 'DÉCONSEILLÉES'}
              </div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{conditions.message}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Statut colors ────────────────────────────────────────────────────────────

const STATUT_CONFIG = {
  ouvert: { bg: '#10B981', bgLight: '#DCFCE7', text: '#065F46', label: 'OUVERT', emoji: '🟢' },
  ferme: { bg: '#EF4444', bgLight: '#FEE2E2', text: '#991B1B', label: 'FERMÉ', emoji: '🔴' },
  sous_reserve: { bg: '#F59E0B', bgLight: '#FEF3C7', text: '#92400E', label: 'SOUS RÉSERVE', emoji: '🟡' },
  annule: { bg: '#64748B', bgLight: '#F1F5F9', text: '#334155', label: 'ANNULÉ', emoji: '⛔' },
};

// ─── Fiche créneau ────────────────────────────────────────────────────────────

function FicheCreneauModal({
  creneau, inscription, brevet, onClose, onInscription,
}: {
  creneau: Creneau;
  inscription: Inscription | null;
  brevet: string;
  onClose: () => void;
  onInscription: (statut: Inscription['statut'], commentaire: string) => Promise<void>;
}) {
  const sc = STATUT_CONFIG[creneau.statut];
  const [selectedStatut, setSelectedStatut] = useState<Inscription['statut']>(inscription?.statut ?? 'present');
  const [commentaire, setCommentaire] = useState(inscription?.commentaire ?? '');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onInscription(selectedStatut, commentaire);
    setSaving(false);
    onClose();
  };

  const dateFormatted = new Date(creneau.date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Count inscrits via nb_places_restantes
  const nbInscrits = creneau.nb_places_total - creneau.nb_places_restantes;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(160deg, #001A4D 0%, #002266 100%)', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between flex-shrink-0">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-2"
              style={{ background: sc.bg + '25', color: sc.bg }}>
              {sc.emoji} {sc.label}
            </div>
            <h2 className="text-lg font-bold text-white leading-tight capitalize">{dateFormatted}</h2>
            {creneau.titre && <p className="text-sm mt-0.5" style={{ color: '#60A5FA' }}>{creneau.titre}</p>}
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {creneau.centres?.nom} · {creneau.centres?.ville}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-4 space-y-4">
          {/* Infos essentielles */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <Clock className="w-3.5 h-3.5" />, label: `${creneau.heure_debut.slice(0, 5)} → ${creneau.heure_fin.slice(0, 5)}` },
              { icon: <Users className="w-3.5 h-3.5" />, label: `${nbInscrits} / ${creneau.nb_places_total} places` },
              creneau.avion ? { icon: <Plane className="w-3.5 h-3.5" />, label: creneau.avion } : null,
              creneau.altitude_prevue ? { icon: <span className="text-xs">📏</span>, label: `${creneau.altitude_prevue}m` } : null,
            ].filter(Boolean).map((item, i) => item && (
              <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{item.icon}</span>
                <span className="text-xs text-white truncate">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Types de sauts */}
          {creneau.type_saut && creneau.type_saut.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {creneau.type_saut.map(t => (
                <span key={t} className="text-xs px-2 py-1 rounded-md font-medium" style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD' }}>
                  🪂 {t}
                </span>
              ))}
            </div>
          )}

          {/* Message centre */}
          {creneau.message && (
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-[10px] font-semibold tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <MessageSquare className="w-3 h-3 inline mr-1" />MESSAGE DU CENTRE
              </div>
              <p className="text-sm text-white leading-relaxed">"{creneau.message}"</p>
            </div>
          )}

          {/* Offre promo */}
          {creneau.offre_promo && (
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div className="text-[10px] font-semibold tracking-wider mb-1" style={{ color: '#F59E0B' }}>🎁 OFFRE</div>
              <p className="text-sm font-medium" style={{ color: '#FCD34D' }}>{creneau.offre_promo}</p>
            </div>
          )}

          {/* Météo */}
          {creneau.statut === 'ouvert' && (
            <MeteoWidget creneau={creneau} brevet={brevet} />
          )}

          {/* Inscription */}
          {creneau.statut === 'ouvert' && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-semibold text-white">MON STATUT</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { s: 'present' as const, label: 'Je viens', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
                    { s: 'peut_etre' as const, label: 'Peut-être', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
                    { s: 'absent' as const, label: 'Non', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
                  ]).map(opt => (
                    <button
                      key={opt.s}
                      onClick={() => setSelectedStatut(opt.s)}
                      className="py-3 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: selectedStatut === opt.s ? opt.bg : 'rgba(255,255,255,0.05)',
                        color: selectedStatut === opt.s ? opt.color : 'rgba(255,255,255,0.5)',
                        border: `1.5px solid ${selectedStatut === opt.s ? opt.color + '60' : 'transparent'}`,
                        minHeight: '48px',
                      }}
                    >
                      {opt.s === 'present' ? '✓' : opt.s === 'peut_etre' ? '?' : '✗'}<br />
                      {opt.label}
                    </button>
                  ))}
                </div>
                {selectedStatut === 'present' && (
                  <input
                    value={commentaire}
                    onChange={e => setCommentaire(e.target.value)}
                    placeholder="Ex: J'arrive vers 10h30 (optionnel)"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/10 focus:outline-none focus:border-blue-400 placeholder:text-white/30"
                  />
                )}
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all"
                  style={{
                    background: saving ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #003082, #0050CC)',
                    minHeight: '48px',
                  }}
                >
                  {saving ? 'Enregistrement…' : inscription ? '✓ Mettre à jour mon statut' : '✓ Confirmer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Calendrier mini-day cell ─────────────────────────────────────────────────

function DayCell({
  date, creneaux, onClick, isToday, isCurrentMonth,
}: {
  date: Date;
  creneaux: Creneau[];
  onClick: () => void;
  isToday: boolean;
  isCurrentMonth: boolean;
}) {
  const main = creneaux[0] ?? null;
  const sc = main ? STATUT_CONFIG[main.statut] : null;
  const day = date.getDate();

  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all relative overflow-hidden"
      style={{
        background: sc ? sc.bgLight : isToday ? '#EFF6FF' : 'transparent',
        border: isToday ? '2px solid #2563EB' : `1px solid ${sc ? sc.bg + '30' : '#E2E8F0'}`,
        opacity: isCurrentMonth ? 1 : 0.35,
        cursor: main ? 'pointer' : 'default',
      }}
    >
      <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : sc ? '' : 'text-gray-500'}`}
        style={sc ? { color: sc.text } : undefined}>
        {day}
      </span>
      {sc && (
        <span className="text-[8px] font-bold px-1 py-0.5 rounded leading-none"
          style={{ background: sc.bg + '20', color: sc.bg }}>
          {sc.emoji}
        </span>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CentreOption {
  id: string;
  nom: string;
  ville: string;
  latitude?: number;
  longitude?: number;
}

export function PlanningDZ() {
  const { user, profile } = useAuth();
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCreneau, setSelectedCreneau] = useState<Creneau | null>(null);
  const [centreId, setCentreId] = useState<string | null>(null);
  const [mesCentres, setMesCentres] = useState<CentreOption[]>([]);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Resolve all of the user's active centres
  useEffect(() => {
    if (!user) return;
    supabase
      .from('licencies_centres')
      .select('centre_id, centres(id, nom, ville, latitude, longitude)')
      .eq('parachutiste_id', user.id)
      .eq('statut', 'actif')
      .then(({ data }) => {
        if (!data?.length) return;
        const options: CentreOption[] = data.map((row: Record<string, unknown>) => {
          const c = row.centres as CentreOption;
          return { id: c.id, nom: c.nom, ville: c.ville, latitude: c.latitude, longitude: c.longitude };
        });
        setMesCentres(options);
        if (!centreId) setCentreId(options[0].id);
      });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const centreActif = mesCentres.find(c => c.id === centreId) ?? null;

  // Load creneaux
  const loadCreneaux = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const from = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0];
    const to = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0];
    const { data } = await supabase
      .from('creneaux_dz')
      .select('*, centres(nom, ville, latitude, longitude)')
      .eq('centre_id', centreId)
      .gte('date', from)
      .lte('date', to)
      .order('date');
    setCreneaux((data as Creneau[]) ?? []);
    setLoading(false);
  }, [centreId, currentMonth]);

  // Load inscriptions
  const loadInscriptions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('inscriptions_creneaux')
      .select('*')
      .eq('parachutiste_id', user.id);
    setInscriptions((data as Inscription[]) ?? []);
  }, [user]);

  useEffect(() => { loadCreneaux(); }, [loadCreneaux]);
  useEffect(() => { loadInscriptions(); }, [loadInscriptions]);

  // Realtime for inscription counts
  useEffect(() => {
    if (!centreId) return;
    const ch = supabase.channel('inscriptions-planning')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inscriptions_creneaux' }, () => {
        loadCreneaux();
        loadInscriptions();
      })
      .subscribe();
    realtimeRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [centreId, loadCreneaux, loadInscriptions]);

  const handleInscription = async (creneau: Creneau, statut: Inscription['statut'], commentaire: string) => {
    if (!user) return;
    const existing = inscriptions.find(i => i.creneau_id === creneau.id);
    if (existing) {
      await supabase.from('inscriptions_creneaux')
        .update({ statut, commentaire })
        .eq('id', existing.id);
    } else {
      await supabase.from('inscriptions_creneaux')
        .insert({ creneau_id: creneau.id, parachutiste_id: user.id, statut, commentaire });
      // Update places restantes
      if (statut === 'present') {
        await supabase.from('creneaux_dz')
          .update({ nb_places_restantes: Math.max(0, creneau.nb_places_restantes - 1) })
          .eq('id', creneau.id);
      }
    }
    await loadInscriptions();
    await loadCreneaux();
  };

  // Build calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  const days: Date[] = [];
  for (let i = 0; i < startOffset; i++) {
    days.push(new Date(year, month, -startOffset + i + 1));
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, days.length - lastDay.getDate() - startOffset + 1));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getCreneauxForDate = (d: Date) => {
    const key = d.toISOString().split('T')[0];
    return creneaux.filter(c => c.date === key);
  };

  // Prochains créneaux inscrits
  const prochains = creneaux
    .filter(c => c.statut === 'ouvert' && c.date >= today.toISOString().split('T')[0])
    .filter(c => inscriptions.some(i => i.creneau_id === c.id && i.statut === 'present'))
    .slice(0, 3);

  const userBrevet = profile?.role === 'moniteur' ? 'D' : 'B'; // fallback — would use actual brevet from passport

  if (loading && !creneaux.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#001A4D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ma DZ</h1>
        </div>
      </div>

      {/* DZ Selector — shown only if licencié dans 2+ centres */}
      {mesCentres.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {mesCentres.map(centre => (
            <button
              key={centre.id}
              onClick={() => { setCentreId(centre.id); setSelectedCreneau(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{
                background: centreId === centre.id ? '#2563EB' : '#fff',
                color: centreId === centre.id ? '#fff' : '#374151',
                border: centreId === centre.id ? '1.5px solid #2563EB' : '1.5px solid #E5E7EB',
                boxShadow: centreId === centre.id ? '0 2px 8px rgba(37,99,235,0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {centre.nom}
              <span className="text-xs opacity-70">· {centre.ville}</span>
            </button>
          ))}
        </div>
      )}

      {/* Single centre label */}
      {mesCentres.length === 1 && centreActif && (
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="w-3.5 h-3.5" />
          {centreActif.nom} · {centreActif.ville}
        </div>
      )}

      {!centreId ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun centre associé</p>
          <p className="text-sm text-gray-400 mt-1">Rejoignez un centre de parachutisme pour voir son planning.</p>
        </div>
      ) : (
        <>
          {/* Prochains créneaux inscrits */}
          {prochains.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Mes prochains créneaux</h2>
              {prochains.map(c => {
                const insc = inscriptions.find(i => i.creneau_id === c.id);
                const meteoEval = c.meteo_data ? evaluerConditions(c.meteo_data, userBrevet) : null;
                const dateLabel = new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCreneau(c)}
                    className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 hover:border-blue-200 hover:shadow-sm transition-all text-left"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ background: '#DCFCE7' }}>🟢</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 capitalize">{dateLabel} — {c.centres?.nom}</div>
                      <div className="text-sm text-gray-500">{c.heure_debut.slice(0, 5)}-{c.heure_fin.slice(0, 5)} · Tu y vas ✓</div>
                    </div>
                    {meteoEval && (
                      <span className="text-sm flex-shrink-0">{meteoEval.emoji}</span>
                    )}
                    {insc?.commentaire && (
                      <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[120px]">{insc.commentaire}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Calendar */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            {/* Nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>
              <h2 className="font-semibold text-gray-900 capitalize">
                {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 px-3 pt-3 pb-1">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 pb-1">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 px-3 pb-3">
              {days.map((d, i) => {
                const dc = getCreneauxForDate(d);
                const isCurrentMonth = d.getMonth() === month;
                const dToday = new Date(); dToday.setHours(0, 0, 0, 0);
                const isToday = d.getTime() === dToday.getTime();
                return (
                  <DayCell
                    key={i}
                    date={d}
                    creneaux={dc}
                    isToday={isToday}
                    isCurrentMonth={isCurrentMonth}
                    onClick={() => { if (dc.length > 0) setSelectedCreneau(dc[0]); }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 pb-4 flex-wrap">
              {Object.values(STATUT_CONFIG).map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: s.bgLight, border: `1px solid ${s.bg + '50'}` }} />
                  <span className="text-[10px] text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Liste complète du mois */}
          {creneaux.filter(c => c.statut === 'ouvert').length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Créneaux ouverts ce mois</h2>
              {creneaux.filter(c => c.statut === 'ouvert').map(c => {
                const insc = inscriptions.find(i => i.creneau_id === c.id);
                const nbInscrits = c.nb_places_total - c.nb_places_restantes;
                const dateLabel = new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCreneau(c)}
                    className="w-full bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 hover:border-blue-200 hover:shadow-sm transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base" style={{ background: '#DCFCE7' }}>🟢</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 capitalize">{dateLabel}</div>
                      <div className="text-xs text-gray-500">{c.heure_debut.slice(0, 5)}-{c.heure_fin.slice(0, 5)} · {nbInscrits}/{c.nb_places_total} inscrits</div>
                    </div>
                    {insc ? (
                      <span className="text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0"
                        style={{
                          background: insc.statut === 'present' ? '#DCFCE7' : insc.statut === 'peut_etre' ? '#FEF3C7' : '#FEE2E2',
                          color: insc.statut === 'present' ? '#065F46' : insc.statut === 'peut_etre' ? '#92400E' : '#991B1B',
                        }}>
                        {insc.statut === 'present' ? '✓ Je viens' : insc.statut === 'peut_etre' ? '? Peut-être' : '✗ Non'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 flex-shrink-0">S'inscrire →</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal fiche créneau */}
      {selectedCreneau && (
        <FicheCreneauModal
          creneau={selectedCreneau}
          inscription={inscriptions.find(i => i.creneau_id === selectedCreneau.id) ?? null}
          brevet={userBrevet}
          onClose={() => setSelectedCreneau(null)}
          onInscription={(s, c) => handleInscription(selectedCreneau, s, c)}
        />
      )}
    </div>
  );
}
