import { useEffect, useRef, useState } from 'react';
import type { DzCircuit, DzSettings, Point } from '../lib/briefing';

// ─── Scène du briefing — composant pur (aucun accès Supabase) ─────────────────
// Le circuit est un TRACÉ CONFIGURÉ par le DT (jamais calculé depuis le vent).
// Le vent n'oriente que la manche à air et la flèche.

export interface BriefingSceneProps {
  settings: Pick<DzSettings, 'sock_x' | 'sock_y' | 'no_fly_zones' | 'obstacles' | 'image_fond_largeur' | 'image_fond_hauteur'>;
  circuit: Pick<DzCircuit, 'trace' | 'lz_x' | 'lz_y' | 'zone_evolution' | 'altitude_debut_m'> | null;
  vent: { direction_deg: number; vitesse_kt: number | null } | null;
  backgroundUrl: string | null;
  mode: 'edit' | 'view';
  /** Mode edit : tap sur le fond (coordonnées en %). */
  onCanvasTap?: (x: number, y: number) => void;
  /** Mode edit : déplacement d'un point du tracé / de la zone d'évolution. */
  onMovePoint?: (kind: 'trace' | 'zone', index: number, x: number, y: number) => void;
  /** Mode edit : appui long sur un point pour le retirer. */
  onRemovePoint?: (kind: 'trace' | 'zone', index: number) => void;
  /** Polygone en cours de tracé (aperçu). */
  pendingPolygon?: Point[];
  /** Mode edit : objet sélectionné (surbrillance) — la suppression se fait via le bouton hors carte. */
  selectedObject?: { kind: 'nofly' | 'obstacle' | 'evolution' | 'sock'; index: number } | null;
}

// viewBox par défaut si les dimensions natives de l'image sont inconnues
const DEFAULT_W = 1000;
const DEFAULT_H = 625;
const LONG_PRESS_MS = 550;

/** Étiquette avec fond semi-opaque sombre (lisible sur photo satellite). */
function Etiquette({ x, y, children, fill = '#FDE68A', fontSize = 14, anchor = 'middle' }: {
  x: number; y: number; children: string; fill?: string; fontSize?: number; anchor?: 'start' | 'middle' | 'end';
}) {
  const w = children.length * fontSize * 0.58 + 14;
  const bx = anchor === 'start' ? x - 7 : anchor === 'end' ? x - w + 7 : x - w / 2;
  return (
    <g>
      <rect x={bx} y={y - fontSize - 3} width={w} height={fontSize + 10} rx={5} fill="rgba(2,6,23,0.72)" />
      <text x={x} y={y} textAnchor={anchor} fill={fill} fontSize={fontSize} fontWeight="700">{children}</text>
    </g>
  );
}

export function BriefingScene({
  settings, circuit, vent, backgroundUrl, mode,
  onCanvasTap, onMovePoint, onRemovePoint, pendingPolygon, selectedObject,
}: BriefingSceneProps) {
  const VB_W = DEFAULT_W;
  const VB_H = settings.image_fond_largeur && settings.image_fond_hauteur
    ? Math.round((DEFAULT_W * settings.image_fond_hauteur) / settings.image_fond_largeur)
    : DEFAULT_H;

  // Préchargement du fond : le SVG (viewBox) réserve la hauteur quoi qu'il
  // arrive — la scène et le bouton d'acquittement ne dépendent JAMAIS de
  // l'image. États : chargement (squelette) / chargée / échec (fond neutre).
  const [bgState, setBgState] = useState<'loading' | 'loaded' | 'error'>('loading');
  useEffect(() => {
    if (!backgroundUrl) { setBgState('error'); return; }
    setBgState('loading');
    const img = new Image();
    img.onload = () => setBgState('loaded');
    img.onerror = () => setBgState('error');
    img.src = backgroundUrl;
    return () => { img.onload = null; img.onerror = null; };
  }, [backgroundUrl]);

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const rafRef = useRef(0);
  const dragRef = useRef<{ kind: 'trace' | 'zone'; index: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);

  const px = (p: Point): { x: number; y: number } => ({ x: (p[0] / 100) * VB_W, y: (p[1] / 100) * VB_H });

  const trace = circuit?.trace ?? [];
  const tracePath = trace.length >= 2
    ? trace.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p).x} ${px(p).y}`).join(' ')
    : null;

  // ── Animation du marqueur le long du tracé configuré ──
  useEffect(() => {
    const path = pathRef.current;
    const marker = markerRef.current;
    if (!path || !marker || !tracePath) return;
    const total = path.getTotalLength();
    if (total === 0) return;
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
  }, [tracePath]);

  // ── Pointer events (tablette / téléphone) ──
  const toPct = (e: React.PointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
      Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
    ];
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'edit') return;
    movedRef.current = false;
    const [x, y] = toPct(e);
    // Préhension d'un point existant : rayon ≥ 20 px écran
    const rect = svgRef.current!.getBoundingClientRect();
    const grabPct = (20 / rect.width) * 100;
    const candidates: { kind: 'trace' | 'zone'; index: number; d: number }[] = [];
    trace.forEach((p, i) => candidates.push({ kind: 'trace', index: i, d: Math.hypot(p[0] - x, (p[1] - y) * (rect.height / rect.width)) }));
    (circuit?.zone_evolution ?? []).forEach((p, i) => candidates.push({ kind: 'zone', index: i, d: Math.hypot(p[0] - x, (p[1] - y) * (rect.height / rect.width)) }));
    const hit = candidates.filter(c => c.d <= grabPct).sort((a, b) => a.d - b.d)[0];
    if (hit) {
      dragRef.current = { kind: hit.kind, index: hit.index };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      // Appui long = suppression du point
      longPressRef.current = setTimeout(() => {
        if (!movedRef.current && dragRef.current) {
          onRemovePoint?.(dragRef.current.kind, dragRef.current.index);
          dragRef.current = null;
        }
      }, LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (mode !== 'edit' || !dragRef.current) return;
    movedRef.current = true;
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
    const [x, y] = toPct(e);
    onMovePoint?.(dragRef.current.kind, dragRef.current.index, x, y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (mode !== 'edit') return;
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
    if (dragRef.current) { dragRef.current = null; return; }
    const [x, y] = toPct(e);
    onCanvasTap?.(x, y);
  };

  const renderPolygones = (zones: DzSettings['no_fly_zones'], variant: 'nofly' | 'obstacle' | 'evolution', extraLabel?: string) => (
    zones.map((z, i) => {
      if (z.points.length < 3) return null;
      const pts = z.points.map(p => { const q = px(p); return `${q.x},${q.y}`; }).join(' ');
      const cx = z.points.reduce((s, p) => s + px(p).x, 0) / z.points.length;
      const cy = z.points.reduce((s, p) => s + px(p).y, 0) / z.points.length;
      const styles = {
        nofly:     { fill: 'url(#noflyHatch)', stroke: '#EF4444', text: '#FCA5A5', prefix: '⛔ ' },
        obstacle:  { fill: 'rgba(56,189,248,0.22)', stroke: '#38BDF8', text: '#7DD3FC', prefix: '' },
        evolution: { fill: 'rgba(167,139,250,0.20)', stroke: '#A78BFA', text: '#C4B5FD', prefix: '' },
      }[variant];
      const isSelected = selectedObject?.kind === variant && selectedObject.index === i;
      return (
        <g key={`${variant}-${i}`}>
          <polygon points={pts} fill={styles.fill} stroke={isSelected ? '#FFFFFF' : styles.stroke}
            strokeWidth={isSelected ? 5 : 2.5}
            strokeDasharray={variant === 'nofly' && !isSelected ? '8 4' : undefined} />
          <Etiquette x={cx} y={cy} fill={styles.text} fontSize={13}>
            {`${styles.prefix}${z.nom}${extraLabel ?? ''}`}
          </Etiquette>
        </g>
      );
    })
  );

  // Étiquette « début de circuit » décalée perpendiculairement au premier segment
  const debutLabelPos = (() => {
    if (trace.length === 0) return null;
    const p0 = px(trace[0]);
    if (trace.length === 1) return { x: p0.x + 14, y: p0.y - 14 };
    const p1 = px(trace[1]);
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    // Normale unitaire, décalage de 26 px viewBox
    return { x: p0.x - (dy / len) * 26, y: p0.y + (dx / len) * 26 };
  })();

  const ventBlowDeg = vent ? (vent.direction_deg + 180) % 360 : 0;
  const blowRad = (ventBlowDeg * Math.PI) / 180;
  const blowVec = { x: Math.sin(blowRad), y: -Math.cos(blowRad) };
  const sock = settings.sock_x != null && settings.sock_y != null ? px([settings.sock_x, settings.sock_y]) : null;
  const lz = circuit && circuit.lz_x != null && circuit.lz_y != null ? px([circuit.lz_x, circuit.lz_y]) : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-auto rounded-xl select-none"
      style={{
        display: 'block',
        background: '#16241a',
        cursor: mode === 'edit' ? 'crosshair' : 'default',
        touchAction: mode === 'edit' ? 'none' : 'auto', // pas de scroll parasite pendant l'édition
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="img"
      aria-label="Scène du briefing du jour"
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

      {/* Fond : image si chargée, squelette pendant le chargement, fond neutre en échec.
          Le circuit, les zones et les consignes restent affichés dans tous les cas. */}
      {backgroundUrl && bgState === 'loaded' && (
        <image href={backgroundUrl} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" />
      )}
      {backgroundUrl && bgState === 'loading' && (
        <g pointerEvents="none">
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="#1B2B42">
            <animate attributeName="opacity" values="1;0.6;1" dur="1.6s" repeatCount="indefinite" />
          </rect>
          <text x={VB_W / 2} y={VB_H / 2} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="16">
            Chargement du fond…
          </text>
        </g>
      )}
      {(!backgroundUrl || bgState === 'error') && (
        <g pointerEvents="none">
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="#22324a" />
          <text x={VB_W / 2} y={VB_H - 18} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="14">
            {backgroundUrl ? 'fond indisponible — le briefing reste valable' : 'Aucune photo satellite configurée'}
          </text>
        </g>
      )}
      <rect x="0" y="0" width={VB_W} height={VB_H} fill="rgba(0,10,30,0.15)" pointerEvents="none" />

      {/* Zones interdites (rouge hachuré) et obstacles (bleu) */}
      {renderPolygones(settings.no_fly_zones, 'nofly')}
      {renderPolygones(settings.obstacles, 'obstacle')}

      {/* Zone d'évolution — une ZONE, pas une trajectoire */}
      {circuit?.zone_evolution && circuit.zone_evolution.length >= 3 && (
        renderPolygones([{ nom: 'zone d\'évolution — avant le circuit', points: circuit.zone_evolution }], 'evolution')
      )}

      {/* Polygone en cours de tracé (mode edit) */}
      {pendingPolygon && pendingPolygon.length > 0 && (
        <g pointerEvents="none">
          <polyline points={pendingPolygon.map(p => { const q = px(p); return `${q.x},${q.y}`; }).join(' ')}
            fill="none" stroke="#A78BFA" strokeWidth="2" strokeDasharray="4 4" />
          {pendingPolygon.map((p, i) => { const q = px(p); return <circle key={i} cx={q.x} cy={q.y} r="5" fill="#A78BFA" />; })}
        </g>
      )}

      {/* Tracé du circuit configuré */}
      {tracePath && (
        <g>
          <path ref={pathRef} d={tracePath} fill="none" stroke="#FBBF24" strokeWidth="4"
            strokeDasharray="14 8" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" pointerEvents="none" />
          <g ref={markerRef} pointerEvents="none">
            <path d="M -11 -4 Q 0 -14 11 -4 L 7 -2 Q 0 -9 -7 -2 Z" fill="#F97316" stroke="#0F172A" strokeWidth="1.2" />
            <line x1="-7" y1="-3" x2="-2" y2="6" stroke="#0F172A" strokeWidth="1.2" />
            <line x1="7" y1="-3" x2="2" y2="6" stroke="#0F172A" strokeWidth="1.2" />
            <circle cx="0" cy="7" r="3" fill="#0F172A" />
          </g>
        </g>
      )}

      {/* Points éditables du tracé (mode edit) — cible tactile généreuse */}
      {mode === 'edit' && trace.map((p, i) => {
        const q = px(p);
        return (
          <g key={`t${i}`}>
            <circle cx={q.x} cy={q.y} r="16" fill="transparent" />
            <circle cx={q.x} cy={q.y} r="7" fill={i === 0 ? '#10B981' : '#FBBF24'} stroke="#0F172A" strokeWidth="2" />
          </g>
        );
      })}
      {mode === 'edit' && (circuit?.zone_evolution ?? []).map((p, i) => {
        const q = px(p);
        return (
          <g key={`z${i}`}>
            <circle cx={q.x} cy={q.y} r="16" fill="transparent" />
            <circle cx={q.x} cy={q.y} r="6" fill="#A78BFA" stroke="#0F172A" strokeWidth="2" />
          </g>
        );
      })}

      {/* Étiquette début de circuit */}
      {debutLabelPos && circuit && (
        <g pointerEvents="none">
          <circle cx={px(trace[0]).x} cy={px(trace[0]).y} r="7" fill="#FBBF24" stroke="#0F172A" strokeWidth="2" />
          <Etiquette x={debutLabelPos.x} y={debutLabelPos.y} fontSize={13}>
            {`début de circuit — ${circuit.altitude_debut_m} m`}
          </Etiquette>
        </g>
      )}

      {/* Zone de posé du circuit */}
      {lz && (
        <g pointerEvents="none">
          <circle cx={lz.x} cy={lz.y} r="22" fill="rgba(16,185,129,0.18)" stroke="#10B981" strokeWidth="3" />
          <circle cx={lz.x} cy={lz.y} r="9" fill="rgba(16,185,129,0.35)" stroke="#10B981" strokeWidth="2" />
          <circle cx={lz.x} cy={lz.y} r="2.5" fill="#10B981" />
          <Etiquette x={lz.x} y={lz.y + 44} fill="#6EE7B7" fontSize={13}>zone de posé</Etiquette>
        </g>
      )}

      {/* Manche à air orientée selon le vent */}
      {sock && vent && (
        <g transform={`translate(${sock.x}, ${sock.y})`} pointerEvents="none">
          {selectedObject?.kind === 'sock' && (
            <circle r="34" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeDasharray="6 4" />
          )}
          <line x1="0" y1="0" x2="0" y2="-26" stroke="#E2E8F0" strokeWidth="3" />
          <g transform={`translate(0,-26) rotate(${ventBlowDeg})`}>
            <path d="M -8 0 L 8 0 L 2.5 -30 L -2.5 -30 Z" fill="#F97316" stroke="#0F172A" strokeWidth="1" />
            <path d="M -8 0 L 8 0 L 6 -11 L -6 -11 Z" fill="#fff" opacity="0.85" />
          </g>
          <circle r="3" fill="#E2E8F0" />
        </g>
      )}

      {/* Flèche de vent */}
      {vent && (
        <g transform="translate(80, 78)" pointerEvents="none">
          <circle r="44" fill="rgba(2,6,23,0.65)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <line x1={-blowVec.x * 28} y1={-blowVec.y * 28} x2={blowVec.x * 28} y2={blowVec.y * 28}
            stroke="#38BDF8" strokeWidth="4" markerEnd="url(#windArrowHead)" />
          <Etiquette x={0} y={66} fill="#7DD3FC" fontSize={14}>
            {`Vent ${vent.direction_deg}°${vent.vitesse_kt != null ? ` · ${vent.vitesse_kt} kt` : ''}`}
          </Etiquette>
        </g>
      )}

      {/* Flèche Nord fixe */}
      <g transform={`translate(${VB_W - 50}, 60)`} pointerEvents="none">
        <circle r="26" fill="rgba(2,6,23,0.65)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <path d="M 0 -16 L 6 8 L 0 3 L -6 8 Z" fill="#fff" />
        <text y="22" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">N</text>
      </g>
    </svg>
  );
}
