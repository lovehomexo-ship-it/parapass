import { useEffect, useRef } from 'react';
import {
  computeCircuit, headingToVector,
  type DzBriefing, type DzSettings,
} from '../lib/briefing';

// ─── Scène du briefing — composant pur (aucun accès Supabase) ─────────────────
// Vue de dessus : fond satellite, manche à air, flèche de vent, circuit
// d'atterrissage recalculé selon le vent, marqueur parachutiste animé,
// dangers et zones de survol interdit. Trois modes : edit / view / tv.

const VB_W = 1000; // viewBox — les positions % sont converties dans ce repère
const VB_H = 625;  // ratio 16:10, adapté aux photos satellites usuelles

export interface BriefingSceneProps {
  briefing: Pick<DzBriefing,
    'wind_direction_deg' | 'wind_speed_kt' | 'sens_atterrissage_deg' |
    'circuit_side' | 'altitude_debut_circuit_m' | 'hazards'
  > | null;
  settings: Pick<DzSettings, 'lz_x' | 'lz_y' | 'sock_x' | 'sock_y' | 'no_fly_zones'>;
  /** URL (signée) de l'image de fond — résolue par l'appelant. */
  backgroundUrl: string | null;
  mode: 'edit' | 'view' | 'tv';
  /** Mode edit : clic sur la scène, coordonnées en % de l'image. */
  onCanvasClick?: (xPct: number, yPct: number) => void;
}

const pct = (x: number, axis: 'x' | 'y') => (axis === 'x' ? (x / 100) * VB_W : (x / 100) * VB_H);

export function BriefingScene({ briefing, settings, backgroundUrl, mode, onCanvasClick }: BriefingSceneProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const rafRef = useRef<number>(0);

  const hasLz = settings.lz_x != null && settings.lz_y != null;
  const lz = hasLz ? { x: pct(settings.lz_x!, 'x'), y: pct(settings.lz_y!, 'y') } : null;
  const sock = settings.sock_x != null && settings.sock_y != null
    ? { x: pct(settings.sock_x, 'x'), y: pct(settings.sock_y, 'y') } : null;

  const circuit = briefing && lz
    ? computeCircuit(lz, briefing.sens_atterrissage_deg, briefing.circuit_side, Math.min(VB_W, VB_H))
    : null;

  // Direction où le vent SOUFFLE (opposé à la provenance)
  const blowDeg = briefing ? (briefing.wind_direction_deg + 180) % 360 : 0;
  const blowVec = headingToVector(blowDeg);

  // ── Animation du marqueur parachutiste le long du circuit (~8 s en boucle) ──
  useEffect(() => {
    const path = pathRef.current;
    const marker = markerRef.current;
    if (!path || !marker || !circuit) return;
    const total = path.getTotalLength();
    const DURATION = 8000;
    let startTs: number | null = null;

    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = ((ts - startTs) % DURATION) / DURATION;
      const p = path.getPointAtLength(t * total);
      const p2 = path.getPointAtLength(Math.min(total, t * total + 2));
      const angle = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
      marker.setAttribute('transform', `translate(${p.x}, ${p.y}) rotate(${angle + 90})`);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // Le path SVG (chaîne) suffit à détecter tout changement de géométrie
  }, [circuit?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (mode !== 'edit' || !onCanvasClick) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    onCanvasClick(
      Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
      Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10
    );
  };

  const fontScale = mode === 'tv' ? 1.4 : 1;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-auto rounded-xl"
      style={{ display: 'block', background: '#1a2f1a', cursor: mode === 'edit' ? 'crosshair' : 'default' }}
      onClick={handleClick}
      role="img"
      aria-label="Scène du briefing du jour : circuit d'atterrissage vu de dessus"
    >
      <defs>
        <pattern id="noflyHatch" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
          <rect width="12" height="12" fill="rgba(239,68,68,0.12)" />
          <line x1="0" y1="0" x2="0" y2="12" stroke="rgba(239,68,68,0.55)" strokeWidth="4" />
        </pattern>
        <marker id="windArrowHead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#38BDF8" />
        </marker>
      </defs>

      {/* Fond satellite */}
      {backgroundUrl ? (
        <image href={backgroundUrl} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <text x={VB_W / 2} y={VB_H / 2} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={18 * fontScale}>
          Aucune photo satellite — à configurer par le DT
        </text>
      )}
      {/* Voile légère pour la lisibilité des overlays */}
      <rect x="0" y="0" width={VB_W} height={VB_H} fill="rgba(0,10,30,0.18)" />

      {/* Zones de survol interdit — toujours affichées, dans les trois modes */}
      {settings.no_fly_zones.map((z, i) => {
        if (z.points.length < 3) return null;
        const pts = z.points.map(p => `${pct(p.x, 'x')},${pct(p.y, 'y')}`).join(' ');
        const cx = z.points.reduce((s, p) => s + pct(p.x, 'x'), 0) / z.points.length;
        const cy = z.points.reduce((s, p) => s + pct(p.y, 'y'), 0) / z.points.length;
        return (
          <g key={i}>
            <polygon points={pts} fill="url(#noflyHatch)" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="8 4" />
            <text x={cx} y={cy} textAnchor="middle" fill="#FCA5A5" fontSize={13 * fontScale} fontWeight="700"
              style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.7)" strokeWidth="3">
              ⛔ {z.label}
            </text>
          </g>
        );
      })}

      {/* Circuit d'atterrissage */}
      {circuit && briefing && (
        <g>
          <path ref={pathRef} d={circuit.path} fill="none" stroke="#FBBF24" strokeWidth="4"
            strokeDasharray="14 8" strokeLinecap="round" opacity="0.95" />
          {/* Labels de branches */}
          {[
            { p: circuit.midDownwind, label: 'vent arrière' },
            { p: circuit.midBase, label: 'base' },
            { p: circuit.midFinal, label: 'finale' },
          ].map(({ p, label }) => (
            <text key={label} x={p.x} y={p.y - 10} textAnchor="middle" fill="#FDE68A"
              fontSize={14 * fontScale} fontWeight="700" style={{ paintOrder: 'stroke' }}
              stroke="rgba(0,0,0,0.75)" strokeWidth="3.5">
              {label}
            </text>
          ))}
          {/* Étiquette début de circuit */}
          <g transform={`translate(${circuit.start.x}, ${circuit.start.y})`}>
            <circle r="7" fill="#FBBF24" stroke="#0F172A" strokeWidth="2" />
            <text x="12" y="-8" fill="#FDE68A" fontSize={13 * fontScale} fontWeight="700"
              style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.75)" strokeWidth="3.5">
              début de circuit — {briefing.altitude_debut_circuit_m} m
            </text>
          </g>
          {/* Marqueur parachutiste animé (petite voile stylisée) */}
          <g ref={markerRef}>
            <path d="M -11 -4 Q 0 -14 11 -4 L 7 -2 Q 0 -9 -7 -2 Z" fill="#F97316" stroke="#0F172A" strokeWidth="1.2" />
            <line x1="-7" y1="-3" x2="-2" y2="6" stroke="#0F172A" strokeWidth="1.2" />
            <line x1="7" y1="-3" x2="2" y2="6" stroke="#0F172A" strokeWidth="1.2" />
            <circle cx="0" cy="7" r="3" fill="#0F172A" />
          </g>
        </g>
      )}

      {/* Zone de posé */}
      {lz && (
        <g transform={`translate(${lz.x}, ${lz.y})`}>
          <circle r="22" fill="rgba(16,185,129,0.18)" stroke="#10B981" strokeWidth="3" />
          <circle r="9" fill="rgba(16,185,129,0.35)" stroke="#10B981" strokeWidth="2" />
          <circle r="2.5" fill="#10B981" />
          <text y="40" textAnchor="middle" fill="#6EE7B7" fontSize={13 * fontScale} fontWeight="700"
            style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.75)" strokeWidth="3.5">
            zone de posé
          </text>
        </g>
      )}

      {/* Manche à air : cône orienté dans le sens où le vent souffle */}
      {sock && briefing && (
        <g transform={`translate(${sock.x}, ${sock.y})`}>
          <line x1="0" y1="0" x2="0" y2="-26" stroke="#E2E8F0" strokeWidth="3" />
          <g transform={`translate(0,-26) rotate(${blowDeg})`}>
            {/* Cône : pointe vers le haut du repère local = cap blowDeg */}
            <path d="M -8 0 L 8 0 L 2.5 -30 L -2.5 -30 Z" fill="#F97316" stroke="#0F172A" strokeWidth="1" />
            <path d="M -8 0 L 8 0 L 6 -11 L -6 -11 Z" fill="#fff" opacity="0.85" />
          </g>
          <circle r="3" fill="#E2E8F0" />
        </g>
      )}

      {/* Dangers */}
      {(briefing?.hazards ?? []).map((h, i) => (
        <g key={i} transform={`translate(${pct(h.x, 'x')}, ${pct(h.y, 'y')})`}>
          <path d="M 0 -14 L 12 8 L -12 8 Z" fill="#EF4444" stroke="#fff" strokeWidth="1.5" />
          <text y="5" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="900">!</text>
          <text y="24" textAnchor="middle" fill="#FCA5A5" fontSize={12 * fontScale} fontWeight="700"
            style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.75)" strokeWidth="3">
            {h.label}
          </text>
        </g>
      ))}

      {/* Flèche de vent + label (coin haut gauche) */}
      {briefing && (
        <g transform="translate(80, 78)">
          <circle r="44" fill="rgba(2,6,23,0.65)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <line
            x1={-blowVec.x * 28} y1={-blowVec.y * 28}
            x2={blowVec.x * 28} y2={blowVec.y * 28}
            stroke="#38BDF8" strokeWidth="4" markerEnd="url(#windArrowHead)"
          />
          <text y="62" textAnchor="middle" fill="#7DD3FC" fontSize={14 * fontScale} fontWeight="700"
            style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.75)" strokeWidth="3.5">
            Vent {briefing.wind_direction_deg}°{briefing.wind_speed_kt != null ? ` · ${briefing.wind_speed_kt} kt` : ''}
          </text>
        </g>
      )}

      {/* Flèche Nord fixe (coin haut droit) */}
      <g transform={`translate(${VB_W - 50}, 60)`}>
        <circle r="26" fill="rgba(2,6,23,0.65)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <path d="M 0 -16 L 6 8 L 0 3 L -6 8 Z" fill="#fff" />
        <text y="22" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">N</text>
      </g>
    </svg>
  );
}
