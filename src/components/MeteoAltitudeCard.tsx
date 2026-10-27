import { useState, type CSSProperties } from 'react';
import {
  Wind, ChevronDown, ChevronUp, CloudOff,
  Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudSnow, CloudDrizzle, CloudLightning,
} from 'lucide-react';
import {
  useMeteoAltitude, indexHeureCourante, estimePlafond, kmhEnKt,
  type MeteoAltitudePayload,
} from '../lib/meteoAltitude';
import { useComplianceRules } from '../lib/compliance';
import { formatHeureParis } from '../lib/datetime';

// Icône météo VECTORIELLE (famille unique Lucide) — remplace les emojis système
// (☀️ ⛅ 🌧️…) pour tenir la discipline visuelle partagée avec le dashboard.
function IconeMeteo({ code, className, style }: { code: number; className?: string; style?: CSSProperties }) {
  const C =
    code === 0 ? Sun :
    code <= 2 ? CloudSun :
    code === 3 ? Cloud :
    code <= 48 ? CloudFog :
    code <= 67 ? CloudRain :
    code <= 77 ? CloudSnow :
    code <= 82 ? CloudDrizzle :
    CloudLightning;
  return <C className={className ?? 'w-4 h-4'} style={style} aria-hidden />;
}

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

// Code couleur de seuil partagé (vert dans les seuils, orange à surveiller, rouge hors seuils).
function seuilColor(speed: number, seuil: number): string {
  if (speed >= seuil) return 'var(--sev-critique)';        // hors seuils
  if (speed >= seuil * 0.75) return 'var(--sev-vigilance)';  // à surveiller
  return 'var(--sev-conforme)';                             // dans les seuils
}

function altLabel(altM: number): string {
  return altM >= 1000 ? `${(altM / 1000).toFixed(1).replace('.0', '')} km` : `${altM} m`;
}

/** Une altitude = une barre horizontale (longueur ∝ vent), teintée par le seuil,
 *  flèche de direction, valeur exacte inscrite + tooltip complet (kt · degrés). */
function BarreEtage({ label, speed, dir, gust, seuil, maxSpeed, sol }: {
  label: string; speed: number; dir: number; gust?: number; seuil: number; maxSpeed: number; sol?: boolean;
}) {
  const color = seuilColor(speed, seuil);
  const pct = Math.max(5, Math.min(100, (speed / maxSpeed) * 100));
  const title = `${label} : ${Math.round(speed)} km/h (${kmhEnKt(speed)} kt) · vient de ${Math.round(dir)}°${sol && gust != null ? ` · rafales ${Math.round(gust)} km/h` : ''}`;
  return (
    <div className="flex items-center gap-2 py-0.5" title={title}>
      <span className="w-11 text-xs font-mono text-right flex-shrink-0"
        style={{ color: sol ? 'var(--c-text)' : 'var(--c-muted)', fontWeight: sol ? 700 : 400 }}>
        {label}
      </span>
      <span className="flex-shrink-0" style={{ color }}><FlecheVent dirProvenance={dir} size={14} /></span>
      <div className="flex-1 h-4 rounded relative overflow-hidden" style={{ background: 'var(--c-hover)' }}>
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
        {/* LA VALEUR ÉTAIT COLLÉE AU BORD DROIT DE LA PISTE, pas au bout de
            la barre : dès que le vent est faible, elle se retrouvait sur le
            fond vide. En blanc, c'était invisible en mode jour. Elle suit
            maintenant la barre — DEDANS quand il y a la place (le fond est
            alors une couleur saturée, le blanc y tient), DEHORS sinon, et dans
            la couleur du texte. */}
        {pct > 80 ? (
          // La barre occupe presque toute la piste : la valeur rentre DEDANS,
          // contre le bout de la barre — jamais contre le bord de la piste,
          // qui est l'erreur d'origine. Le fond est alors une couleur saturée,
          // le blanc y tient dans les deux thèmes.
          <span className="absolute inset-y-0 flex items-center text-xs font-bold whitespace-nowrap"
            style={{ right: `calc(${100 - pct}% + 6px)`, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            {Math.round(speed)}{sol && gust != null ? ` · raf ${Math.round(gust)}` : ''}
          </span>
        ) : (
          <span className="absolute inset-y-0 flex items-center text-xs font-bold whitespace-nowrap"
            style={{ left: `calc(${pct}% + 6px)`, color: 'var(--c-text)' }}>
            {Math.round(speed)}{sol && gust != null ? ` · raf ${Math.round(gust)}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

/** Profil vertical VISUEL : barres du vent par altitude, sol en bas, code couleur seuil. */
export function ProfilVertical({ payload, heure, seuilAltitude, seuilSol }: {
  payload: MeteoAltitudePayload; heure: number; seuilAltitude: number; seuilSol: number;
}) {
  const levels = [...payload.niveaux].reverse(); // haut → bas à l'écran
  const solSpeed = payload.sol.speed[heure] ?? 0;
  const maxSpeed = Math.max(seuilAltitude, solSpeed, ...levels.map(n => n.speed[heure] ?? 0), 40) * 1.1;
  return (
    <div>
      {levels.map(n => (
        <BarreEtage key={n.hPa} label={altLabel(n.altM)} speed={n.speed[heure] ?? 0} dir={n.dir[heure] ?? 0}
          seuil={seuilAltitude} maxSpeed={maxSpeed} />
      ))}
      <div className="mt-0.5 pt-0.5" style={{ borderTop: '1px solid var(--c-border-f)' }}>
        <BarreEtage label="sol" speed={solSpeed} dir={payload.sol.dir[heure] ?? 0}
          gust={payload.sol.gusts[heure] ?? 0} seuil={seuilSol} maxSpeed={maxSpeed} sol />
      </div>
      <p className="text-xs mt-1.5" style={{ color: 'var(--c-dim)' }}>
        Barre = force du vent · flèche = sens où il souffle · <span style={{ color: 'var(--sev-conforme)' }}>vert</span> dans les seuils, <span style={{ color: 'var(--sev-vigilance)' }}>orange</span> à surveiller, <span style={{ color: 'var(--sev-critique)' }}>rouge</span> hors seuils.
      </p>
    </div>
  );
}

/** Évolution de la journée : courbe SVG vent sol + rafales, bandes de seuil
 *  (vert/orange/rouge). Valeurs exactes accessibles au survol/tap (lecture ci-dessous). */
function EvolutionViz({ payload, indices, seuilSol, seuilAlt, largage }: {
  payload: MeteoAltitudePayload; indices: number[]; seuilSol: number; seuilAlt: number;
  largage: MeteoAltitudePayload['niveaux'][number] | undefined;
}) {
  const [sel, setSel] = useState<number>(0);
  const W = 300, H = 140, padL = 8, padR = 8, padT = 10, padB = 20;
  const cW = W - padL - padR, cH = H - padT - padB;
  const solVals = indices.map(i => payload.sol.speed[i] ?? 0);
  const gustVals = indices.map(i => payload.sol.gusts[i] ?? 0);
  const maxY = Math.max(seuilSol * 1.25, ...gustVals, ...solVals, 30);
  const x = (k: number) => padL + (indices.length <= 1 ? cW / 2 : (k / (indices.length - 1)) * cW);
  const y = (v: number) => padT + cH - (Math.min(v, maxY) / maxY) * cH;
  const y0 = padT + cH, yG = y(seuilSol * 0.75), yO = y(seuilSol);
  const solPts = indices.map((i, k) => `${x(k)},${y(payload.sol.speed[i] ?? 0)}`).join(' ');
  const gustPts = indices.map((i, k) => `${x(k)},${y(payload.sol.gusts[i] ?? 0)}`).join(' ');
  const selIdx = indices[sel];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxHeight: 160 }} role="img" aria-label="Évolution du vent sur la journée">
        {/* Bandes de seuil : vert (dans), orange (à surveiller), rouge (hors) */}
        <rect x={padL} y={yG} width={cW} height={y0 - yG} fill="rgba(52,211,153,0.10)" />
        <rect x={padL} y={yO} width={cW} height={yG - yO} fill="rgba(251,191,36,0.12)" />
        <rect x={padL} y={padT} width={cW} height={yO - padT} fill="rgba(248,113,113,0.12)" />
        <line x1={padL} x2={W - padR} y1={yO} y2={yO} stroke="var(--sev-vigilance)" strokeWidth="0.7" strokeDasharray="3 3" opacity="0.6" />
        {/* Rafales (pointillé) puis vent sol (plein) */}
        <polyline points={gustPts} fill="none" stroke="var(--action-texte)" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.7" />
        <polyline points={solPts} fill="none" stroke="var(--c-text)" strokeWidth="2" strokeLinejoin="round" />
        {/* Points cliquables/survolables — valeur exacte via readout + <title> */}
        {indices.map((i, k) => {
          const sp = payload.sol.speed[i] ?? 0;
          return (
            <g key={i} onClick={() => setSel(k)} onMouseEnter={() => setSel(k)} style={{ cursor: 'pointer' }}>
              <rect x={x(k) - cW / (indices.length * 2)} y={padT} width={cW / indices.length} height={cH} fill="transparent" />
              <circle cx={x(k)} cy={y(sp)} r={k === sel ? 4 : 3} fill={seuilColor(sp, seuilSol)} stroke={k === sel ? 'var(--c-text)' : 'none'} strokeWidth="1.5">
                <title>{`${payload.times[i].substring(11, 16)} — sol ${Math.round(sp)} km/h · rafales ${Math.round(payload.sol.gusts[i] ?? 0)}${largage ? ` · ~4200m ${Math.round(largage.speed[i] ?? 0)}` : ''}`}</title>
              </circle>
              <text x={x(k)} y={H - 6} textAnchor="middle" fontSize="8" fill={k === sel ? 'var(--c-text)' : 'var(--c-muted)'}>
                {payload.times[i].substring(11, 13)}h
              </text>
            </g>
          );
        })}
      </svg>
      {/* Lecture exacte du créneau sélectionné (survol/tap) — valeurs jamais supprimées */}
      <div className="mt-1 flex items-center gap-3 flex-wrap text-xs rounded-lg px-2.5 py-1.5" style={{ background: 'var(--c-hover)' }}>
        <span className="font-mono font-bold" style={{ color: 'var(--c-text)' }}>{payload.times[selIdx].substring(11, 16)}</span>
        <span className="inline-flex items-center gap-1" style={{ color: seuilColor(payload.sol.speed[selIdx] ?? 0, seuilSol) }}>
          <FlecheVent dirProvenance={payload.sol.dir[selIdx] ?? 0} size={12} /> sol {Math.round(payload.sol.speed[selIdx] ?? 0)} km/h
        </span>
        <span style={{ color: 'var(--c-text2)' }}>raf. {Math.round(payload.sol.gusts[selIdx] ?? 0)}</span>
        {largage && (
          <span className="inline-flex items-center gap-1" style={{ color: seuilColor(largage.speed[selIdx] ?? 0, seuilAlt) }}>
            <FlecheVent dirProvenance={largage.dir[selIdx] ?? 0} size={12} /> ~4200 m {Math.round(largage.speed[selIdx] ?? 0)}
          </span>
        )}
      </div>
    </div>
  );
}

export function MentionSource({ fetchedAt, perime }: { fetchedAt: string | null; perime: boolean }) {
  const heure = fetchedAt ? formatHeureParis(fetchedAt) : '—';
  return (
    <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: 'var(--c-dim)' }}>
      {perime && <CloudOff className="w-3 h-3" style={{ color: 'var(--sev-vigilance)' }} />}
      Prévision indicative — Open-Meteo, {perime ? `prévision de ${heure} (API injoignable)` : heure} ·
      aide à la décision, pas une source aéronautique certifiée. La décision reste au DT et au parachutiste.
    </p>
  );
}

/** Résumé 3 jours (données du même appel API caché). */
function Jours3({ payload }: { payload: MeteoAltitudePayload }) {
  const labels = ['Aujourd\'hui', 'Demain', 'Après-demain'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {payload.jours.slice(0, 3).map((j, i) => (
        <div key={j.date} className="rounded-xl p-2.5 text-center" style={{ background: 'var(--c-hover)' }}>
          <p className="text-xs mb-0.5" style={{ color: 'var(--c-muted)' }}>{labels[i] ?? j.date}</p>
          <div className="flex justify-center mb-1"><IconeMeteo code={j.code} className="w-5 h-5" style={{ color: 'var(--action-texte)' }} /></div>
          <p className="text-xs font-bold" style={{ color: 'var(--c-text)' }}>{Math.round(j.tempMax)}° · {Math.round(j.ventMax)} km/h</p>
          <p className="text-xs" style={{ color: 'var(--c-muted)' }}>raf. {Math.round(j.rafalesMax)}</p>
        </div>
      ))}
    </div>
  );
}

/** Bloc licencié — COMPACT : une seule ligne discrète (icône + vent sol) ;
 *  tout le détail (tuiles, profil vertical, 3 jours) ne s'affiche qu'au clic.
 *  La météo est proportionnelle à l'usage : le para la consulte, ne la subit pas. */
// ═══════════════════════════════════════════════════════════════════════════
// CETTE CARTE N'AFFICHAIT PLUS QUE SES ICÔNES EN MODE JOUR.
//
// Tout y était écrit pour le bleu nuit : blancs translucides pour le texte,
// teintes claires de Tailwind pour les états (#F87171, #FBBF24, #34D399,
// #7DD3FC). Posées telles quelles sur le blanc du thème clair, elles tombent
// entre 1,0 et 2,2:1 — le vent, la direction, les rafales, le plafond : plus
// rien. Il restait deux pictogrammes dans un rectangle vide.
//
// Tout passe désormais par les jetons, qui portent UNE VALEUR PAR THÈME. Deux
// exceptions assumées : le chiffre posé sur la jauge colorée reste blanc, avec
// son ombre portée — son fond est la barre, pas la carte.
// ═══════════════════════════════════════════════════════════════════════════

export function MeteoAltitudeCard({ dzId, dzNom }: { dzId: string | undefined; dzNom?: string }) {
  const { payload, fetchedAt, perime, error, loading } = useMeteoAltitude(dzId);
  const { rules } = useComplianceRules();
  const [deplie, setDeplie] = useState(false);

  if (loading) return null;
  if (error && !payload) {
    return (
      <div className="rounded-2xl px-4 py-3 mb-3 text-xs" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)', color: 'var(--c-text2)' }}>
        <Wind className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--action-texte)' }} /> Vent en altitude{dzNom ? ` — ${dzNom}` : ''} : {error}
      </div>
    );
  }
  if (!payload) return null;

  const i = indexHeureCourante(payload.times);
  const largage = payload.niveaux.find(n => n.hPa === 600); // ≈ 4 200 m
  const seuilSol = rules.meteo_vent_fort_sol_kmh ?? 30;
  const seuilAlt = rules.meteo_vent_fort_altitude_kmh ?? 60;

  const codeJour = payload.jours[0]?.code ?? 0;
  const solFort = (payload.sol.speed[i] ?? 0) >= seuilSol;

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      {/* Ligne compacte — seule visible par défaut : conditions + vent sol */}
      <button onClick={() => setDeplie(d => !d)} className="w-full px-4 py-2.5 flex items-center gap-2 text-left" style={{ minHeight: 44 }}>
        <IconeMeteo code={codeJour} className="w-4 h-4" style={{ color: solFort ? 'var(--sev-critique)' : 'var(--action-texte)' }} />
        <span style={{ color: solFort ? 'var(--sev-critique)' : 'var(--action-texte)' }}><FlecheVent dirProvenance={payload.sol.dir[i] ?? 0} size={15} /></span>
        <span className="text-sm font-bold" style={{ color: solFort ? 'var(--sev-critique)' : 'var(--c-text)' }}>
          {Math.round(payload.sol.speed[i] ?? 0)} km/h
        </span>
        <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
          {Math.round(payload.sol.dir[i] ?? 0)}°{dzNom ? ` · ${dzNom}` : ''}
        </span>
        <span className="text-xs ml-auto mr-1" style={{ color: 'var(--c-muted)' }}>Météo</span>
        <span className="flex-shrink-0" style={{ color: 'var(--c-muted)' }}>
          {deplie ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {/* Détail complet uniquement au clic : tuiles, profil vertical, 3 jours */}
      {deplie && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-2.5" style={{ background: 'var(--c-hover)' }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--c-muted)' }}>Sol</p>
              <div className="flex items-center gap-1.5" style={{ color: solFort ? 'var(--sev-critique)' : 'var(--c-text)' }}>
                <FlecheVent dirProvenance={payload.sol.dir[i] ?? 0} size={16} />
                <span className="text-sm font-bold">{Math.round(payload.sol.speed[i] ?? 0)} km/h</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>raf. {Math.round(payload.sol.gusts[i] ?? 0)} · {Math.round(payload.sol.dir[i] ?? 0)}°</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: 'var(--c-hover)' }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--c-muted)' }}>Plafond</p>
              <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--c-text)' }}>{estimePlafond(payload.nuages, i)}</p>
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{Math.round(payload.nuages.total[i] ?? 0)} % couvert</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: 'var(--c-hover)' }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--c-muted)' }}>Largage ~4 200 m</p>
              {largage && (
                <>
                  <div className="flex items-center gap-1.5" style={{ color: (largage.speed[i] ?? 0) >= seuilAlt ? 'var(--sev-critique)' : 'var(--c-text)' }}>
                    <FlecheVent dirProvenance={largage.dir[i] ?? 0} size={16} />
                    <span className="text-sm font-bold">{Math.round(largage.speed[i] ?? 0)} km/h</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{kmhEnKt(largage.speed[i] ?? 0)} kt · {Math.round(largage.dir[i] ?? 0)}°</p>
                </>
              )}
            </div>
          </div>

          <div className="mt-3">
            <ProfilVertical payload={payload} heure={i} seuilAltitude={seuilAlt} seuilSol={seuilSol} />
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide mt-3 mb-1.5" style={{ color: 'var(--c-muted)' }}>3 prochains jours</p>
          <Jours3 payload={payload} />

          <MentionSource fetchedAt={fetchedAt} perime={perime} />
        </div>
      )}
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
      <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)', color: 'var(--c-text2)' }}>
        <Wind className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--action-texte)' }} /> Vent en altitude : {error}
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
        <Wind className="w-5 h-5" style={{ color: 'var(--action-texte)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>Météo — outil d'aide à la décision</h2>
      </div>

      {/* Résumé 3 jours en haut (mêmes données, même cache) */}
      <div className="mb-4 max-w-md">
        <Jours3 payload={payload} />
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
          <EvolutionViz payload={payload} indices={heuresProj} seuilSol={seuilSol} seuilAlt={seuilAlt} largage={largage} />
          <p className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--c-dim)' }}>
            <span className="inline-flex items-center gap-1"><span style={{ width: 10, height: 2, background: 'var(--c-text)', display: 'inline-block' }} /> vent sol</span>
            <span className="inline-flex items-center gap-1"><span style={{ width: 10, height: 0, borderTop: '1.5px dashed var(--action-texte)', display: 'inline-block' }} /> rafales</span>
            <span>· survolez / touchez un point pour les valeurs exactes (km/h)</span>
          </p>
        </div>
      </div>

      <MentionSource fetchedAt={fetchedAt} perime={perime} />
    </div>
  );
}
