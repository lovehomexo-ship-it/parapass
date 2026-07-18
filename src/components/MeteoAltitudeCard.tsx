import { useState } from 'react';
import { Wind, ChevronDown, ChevronUp, CloudOff } from 'lucide-react';
import {
  useMeteoAltitude, indexHeureCourante, estimePlafond, kmhEnKt,
  type MeteoAltitudePayload,
} from '../lib/meteoAltitude';
import { useComplianceRules } from '../lib/compliance';

// Flèche de vent : même convention que la manche à air du briefing — elle est
// orientée dans le sens où le vent SOUFFLE ; le chiffre indique d'où il vient.
function FlecheVent({ dirProvenance, size = 18 }: { dirProvenance: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ transform: `rotate(${(dirProvenance + 180) % 360}deg)` }} aria-hidden>
      <path d="M10 2 L13 11 L10 9 L7 11 Z" fill="currentColor" />
      <line x1="10" y1="9" x2="10" y2="17" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function LigneEtage({ altM, speed, dir, seuil }: { altM: number; speed: number; dir: number; seuil: number }) {
  const fort = speed >= seuil;
  return (
    <div className="flex items-center gap-3 py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="w-16 text-xs font-mono text-right flex-shrink-0" style={{ color: 'rgba(255,255,255,0.55)' }}>
        {altM >= 1000 ? `${(altM / 1000).toFixed(1).replace('.0', '')} km` : `${altM} m`}
      </span>
      <span style={{ color: fort ? '#F87171' : '#7DD3FC' }}><FlecheVent dirProvenance={dir} /></span>
      <span className="text-sm font-bold" style={{ color: fort ? '#F87171' : '#fff' }}>
        {Math.round(speed)} km/h
      </span>
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>({kmhEnKt(speed)} kt · {Math.round(dir)}°)</span>
      {fort && <span className="text-[10px] font-bold ml-auto" style={{ color: '#F87171' }}>vent fort</span>}
    </div>
  );
}

/** Profil vertical du sol vers le haut — tableau lisible d'un coup d'œil. */
export function ProfilVertical({ payload, heure, seuilAltitude, seuilSol }: {
  payload: MeteoAltitudePayload; heure: number; seuilAltitude: number; seuilSol: number;
}) {
  return (
    <div>
      {/* Du haut vers le bas à l'écran = altitudes décroissantes, sol en bas */}
      {[...payload.niveaux].reverse().map(n => (
        <LigneEtage key={n.hPa} altM={n.altM} speed={n.speed[heure] ?? 0} dir={n.dir[heure] ?? 0} seuil={seuilAltitude} />
      ))}
      <div className="flex items-center gap-3 py-1.5 rounded-b-lg" style={{ borderTop: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
        <span className="w-16 text-xs font-mono text-right flex-shrink-0 font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>sol</span>
        <span style={{ color: (payload.sol.speed[heure] ?? 0) >= seuilSol ? '#F87171' : '#7DD3FC' }}>
          <FlecheVent dirProvenance={payload.sol.dir[heure] ?? 0} />
        </span>
        <span className="text-sm font-bold" style={{ color: (payload.sol.speed[heure] ?? 0) >= seuilSol ? '#F87171' : '#fff' }}>
          {Math.round(payload.sol.speed[heure] ?? 0)} km/h
        </span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          raf. {Math.round(payload.sol.gusts[heure] ?? 0)} · {Math.round(payload.sol.dir[heure] ?? 0)}°
        </span>
      </div>
      <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Flèches orientées dans le sens où le vent souffle (comme la manche à air) · degrés = d'où il vient
      </p>
    </div>
  );
}

export function MentionSource({ fetchedAt, perime }: { fetchedAt: string | null; perime: boolean }) {
  const heure = fetchedAt ? new Date(fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
  return (
    <p className="text-[10px] mt-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
      {perime && <CloudOff className="w-3 h-3" style={{ color: '#FBBF24' }} />}
      Prévision indicative — Open-Meteo, {perime ? `prévision de ${heure} (API injoignable)` : heure} ·
      aide à la décision, pas une source aéronautique certifiée. La décision reste au DT et au parachutiste.
    </p>
  );
}

/** Bloc licencié : résumé (sol, plafond, vent au largage) + profil au clic. */
export function MeteoAltitudeCard({ dzId, dzNom }: { dzId: string | undefined; dzNom?: string }) {
  const { payload, fetchedAt, perime, error, loading } = useMeteoAltitude(dzId);
  const { rules } = useComplianceRules();
  const [deplie, setDeplie] = useState(false);

  if (loading) return null;
  if (error && !payload) {
    return (
      <div className="rounded-2xl px-4 py-3 mb-3 text-xs" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)', color: '#CBD5E1' }}>
        🌬️ Vent en altitude{dzNom ? ` — ${dzNom}` : ''} : {error}
      </div>
    );
  }
  if (!payload) return null;

  const i = indexHeureCourante(payload.times);
  const largage = payload.niveaux.find(n => n.hPa === 600); // ≈ 4 200 m
  const seuilSol = rules.meteo_vent_fort_sol_kmh ?? 30;
  const seuilAlt = rules.meteo_vent_fort_altitude_kmh ?? 60;

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <button onClick={() => setDeplie(d => !d)} className="w-full px-4 py-3 flex items-center gap-2 flex-wrap text-left" style={{ minHeight: 48 }}>
        <Wind className="w-4 h-4 flex-shrink-0" style={{ color: '#7DD3FC' }} />
        <span className="text-sm font-bold text-white">Vent en altitude{dzNom ? ` — ${dzNom}` : ''}</span>
        <span className="ml-auto flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {deplie ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      <div className="px-4 pb-3">
        {/* Résumé : sol · plafond · largage */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Sol</p>
            <div className="flex items-center gap-1.5" style={{ color: (payload.sol.speed[i] ?? 0) >= seuilSol ? '#F87171' : '#fff' }}>
              <FlecheVent dirProvenance={payload.sol.dir[i] ?? 0} size={16} />
              <span className="text-sm font-bold">{Math.round(payload.sol.speed[i] ?? 0)} km/h</span>
            </div>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>raf. {Math.round(payload.sol.gusts[i] ?? 0)} · {Math.round(payload.sol.dir[i] ?? 0)}°</p>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Plafond</p>
            <p className="text-xs font-semibold text-white leading-snug">{estimePlafond(payload.nuages, i)}</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{Math.round(payload.nuages.total[i] ?? 0)} % couvert</p>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Largage ~4 200 m</p>
            {largage && (
              <>
                <div className="flex items-center gap-1.5" style={{ color: (largage.speed[i] ?? 0) >= seuilAlt ? '#F87171' : '#fff' }}>
                  <FlecheVent dirProvenance={largage.dir[i] ?? 0} size={16} />
                  <span className="text-sm font-bold">{Math.round(largage.speed[i] ?? 0)} km/h</span>
                </div>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{kmhEnKt(largage.speed[i] ?? 0)} kt · {Math.round(largage.dir[i] ?? 0)}°</p>
              </>
            )}
          </div>
        </div>

        {/* Profil vertical complet au clic */}
        {deplie && (
          <div className="mt-3">
            <ProfilVertical payload={payload} heure={i} seuilAltitude={seuilAlt} seuilSol={seuilSol} />
          </div>
        )}

        <MentionSource fetchedAt={fetchedAt} perime={perime} />
      </div>
    </div>
  );
}

/** Bloc DZ : profil complet en permanence + projection horaire sur la journée. */
export function MeteoAltitudeDZ({ dzId }: { dzId: string }) {
  const { payload, fetchedAt, perime, error, loading } = useMeteoAltitude(dzId);
  const { rules } = useComplianceRules();

  if (loading) return null;
  if (error && !payload) {
    return (
      <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)', color: '#CBD5E1' }}>
        🌬️ Vent en altitude : {error}
      </div>
    );
  }
  if (!payload) return null;

  const i = indexHeureCourante(payload.times);
  const seuilSol = rules.meteo_vent_fort_sol_kmh ?? 30;
  const seuilAlt = rules.meteo_vent_fort_altitude_kmh ?? 60;
  const largage = payload.niveaux.find(n => n.hPa === 600);
  // Projection : toutes les 2 h à partir de maintenant
  const heuresProj = payload.times.map((_, idx) => idx).filter(idx => idx >= i && (idx - i) % 2 === 0).slice(0, 8);

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Wind className="w-5 h-5" style={{ color: '#7DD3FC' }} />
        <h2 className="text-sm font-bold text-white">Vent en altitude — outil d'aide à la décision</h2>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Profil vertical permanent */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--c-dim)' }}>Profil vertical — maintenant</p>
          <ProfilVertical payload={payload} heure={i} seuilAltitude={seuilAlt} seuilSol={seuilSol} />
        </div>

        {/* Projection sur la journée */}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--c-dim)' }}>Évolution de la journée</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr style={{ color: 'var(--c-dim)' }}>
                  <th className="text-left py-1 pr-2 font-medium">Heure</th>
                  <th className="text-left py-1 pr-2 font-medium">Sol</th>
                  <th className="text-left py-1 pr-2 font-medium">Rafales</th>
                  <th className="text-left py-1 font-medium">~4 200 m</th>
                </tr>
              </thead>
              <tbody>
                {heuresProj.map(idx => (
                  <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td className="py-1.5 pr-2 font-mono" style={{ color: 'var(--c-text2)' }}>{payload.times[idx].substring(11, 16)}</td>
                    <td className="py-1.5 pr-2">
                      <span className="inline-flex items-center gap-1" style={{ color: (payload.sol.speed[idx] ?? 0) >= seuilSol ? '#F87171' : '#fff' }}>
                        <FlecheVent dirProvenance={payload.sol.dir[idx] ?? 0} size={13} />
                        {Math.round(payload.sol.speed[idx] ?? 0)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2" style={{ color: 'var(--c-text2)' }}>{Math.round(payload.sol.gusts[idx] ?? 0)}</td>
                    <td className="py-1.5">
                      {largage && (
                        <span className="inline-flex items-center gap-1" style={{ color: (largage.speed[idx] ?? 0) >= seuilAlt ? '#F87171' : '#fff' }}>
                          <FlecheVent dirProvenance={largage.dir[idx] ?? 0} size={13} />
                          {Math.round(largage.speed[idx] ?? 0)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--c-dim)' }}>Vitesses en km/h.</p>
        </div>
      </div>

      <MentionSource fetchedAt={fetchedAt} perime={perime} />
    </div>
  );
}
