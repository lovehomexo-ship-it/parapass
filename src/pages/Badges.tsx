import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { BadgeIcon } from '../design/BadgeIcon';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useBadges } from '../lib/useBadges';
import type { Badge, Saut, BadgeDefinition } from '../lib/types';
import { BADGES } from '../lib/types';
import { Award, X, CheckCheck, Check, Lock } from 'lucide-react';

// ─── Rarity config ─────────────────────────────────────────────────────────────

// Chaque rareté a un traitement de MÉDAILLON distinct : dégradé de disque
// (top→bottom), anneau (ring), halo (glow) et brillance (shimmer légendaire).
const RARETE_CONFIG = {
  commun: {
    label: 'Commun',
    border: '#CBD5E1',
    bg: 'rgba(100,116,139,0.12)',
    text: '#94A3B8',
    glow: 'none',
    shimmer: false,
    ring: '#64748B', top: '#334155', bottom: '#1E293B', accent: '#CBD5E1',
    halo: 'none',
  },
  rare: {
    label: 'Rare',
    border: '#86EFAC',
    bg: 'rgba(22,163,74,0.12)',
    text: '#4ADE80',
    glow: '0 0 8px rgba(22,163,74,0.25)',
    shimmer: false,
    ring: '#22C55E', top: '#16A34A', bottom: '#064E3B', accent: '#DCFCE7',
    halo: '0 0 14px 1px rgba(34,197,94,0.35)',
  },
  epique: {
    label: 'Épique',
    border: '#93C5FD',
    bg: 'rgba(37,99,235,0.15)',
    text: '#60A5FA',
    glow: '0 0 10px rgba(37,99,235,0.3)',
    shimmer: false,
    ring: '#3B82F6', top: '#2563EB', bottom: '#1E3A8A', accent: '#DBEAFE',
    halo: '0 0 18px 2px rgba(59,130,246,0.4)',
  },
  legendaire: {
    label: 'Légendaire',
    border: '#FCD34D',
    bg: 'rgba(217,119,6,0.15)',
    text: '#FCD34D',
    glow: '0 0 14px rgba(217,119,6,0.4)',
    shimmer: true,
    ring: '#F59E0B', top: '#D97706', bottom: '#78350F', accent: '#FEF3C7',
    halo: '0 0 22px 3px rgba(245,158,11,0.5)',
  },
};

// ─── Category config ────────────────────────────────────────────────────────────

type CatKey = BadgeDefinition['categorie'];

// Pastille de couleur (vectorielle CSS) — plus d'emoji « rond » système.
function CatDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className="inline-block rounded-full flex-shrink-0" style={{ width: size, height: size, background: color }} />;
}

const CAT_CONFIG: Record<CatKey, { label: string; color: string }> = {
  volume:              { label: 'Volume',               color: '#F97316' },
  discipline:          { label: 'Discipline',            color: '#3B82F6' },
  temporel:            { label: 'Temporel',              color: '#10B981' },
  figures_vr:          { label: 'Voile Relative',        color: '#2563EB' },
  figures_freefly:     { label: 'Freefly',               color: '#F97316' },
  figures_tracking:    { label: 'Tracking & Angle',      color: '#16A34A' },
  figures_belly:       { label: 'Belly & Solo',          color: '#EF4444' },
  disciplines_speciales: { label: 'Disciplines spéciales', color: '#8B5CF6' },
  equipement:          { label: 'Caméra & Équipement',   color: '#64748B' },
};

const CAT_ORDER: CatKey[] = [
  'volume', 'discipline', 'temporel',
  'figures_vr', 'figures_freefly', 'figures_tracking', 'figures_belly',
  'disciplines_speciales', 'equipement',
];

// ─── Badge card ─────────────────────────────────────────────────────────────────

function BadgeCard({
  def,
  badge,
  obtained,
  isNew,
  progress,
}: {
  def: BadgeDefinition;
  badge: Badge | undefined;
  obtained: boolean;
  isNew?: boolean;
  progress?: { current: number; required: number };
}) {
  const cfg = RARETE_CONFIG[def.rarete];
  const catCfg = CAT_CONFIG[def.categorie];
  const hasProgress = !!progress && progress.required > 0;
  const pct = hasProgress ? Math.min(100, Math.round((progress!.current / progress!.required) * 100)) : 0;
  const restants = progress ? Math.max(0, progress.required - progress.current) : 0;

  return (
    <div
      className="badge-medallion relative flex flex-col items-center p-3 rounded-2xl border cursor-default"
      style={{
        background: obtained ? cfg.bg : 'rgba(255,255,255,0.02)',
        borderColor: obtained ? `${cfg.border}55` : 'rgba(255,255,255,0.06)',
      }}
    >
      {/* NEW badge */}
      {isNew && obtained && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider z-20"
          style={{ background: '#F97316', color: '#fff', whiteSpace: 'nowrap' }}
        >
          NOUVEAU
        </div>
      )}

      {/* ── MÉDAILLON ── */}
      <div className="relative mb-2 badge-disc" style={{ width: 64, height: 64 }}>
        {obtained ? (
          <>
            {/* Halo (rareté) */}
            {cfg.halo !== 'none' && <div aria-hidden className="absolute inset-0 rounded-full" style={{ boxShadow: cfg.halo }} />}
            {/* Disque avec relief */}
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: `radial-gradient(circle at 38% 28%, ${cfg.top}, ${cfg.bottom})`,
                border: `2px solid ${cfg.ring}`,
                boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.25), inset 0 -5px 9px rgba(0,0,0,0.4)',
              }}
            >
              <div aria-hidden className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 42% 22%, rgba(255,255,255,0.38), transparent 55%)' }} />
              {cfg.shimmer && <div className="shimmer-bar" />}
              <BadgeIcon type={def.type} nom={def.nom} couleur={cfg.accent} className="w-8 h-8 relative z-10" />
            </div>
            {/* Pastille obtenu */}
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center z-10" style={{ background: cfg.ring, boxShadow: `0 0 6px ${cfg.ring}` }}>
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          </>
        ) : (
          <>
            {/* Anneau de progression (conic) + silhouette */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: hasProgress ? `conic-gradient(${catCfg.color} ${pct}%, rgba(255,255,255,0.08) ${pct}%)` : 'rgba(255,255,255,0.08)', padding: 3 }}
            >
              <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: '#0d1a30', border: '1px solid rgba(255,255,255,0.06)' }}>
                <BadgeIcon type={def.type} nom={def.nom} locked className="w-7 h-7" />
              </div>
            </div>
            {/* Cadenas */}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center z-10" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Lock className="w-2.5 h-2.5" style={{ color: '#64748B' }} aria-hidden />
            </div>
          </>
        )}
      </div>

      {/* Nom */}
      <div className="text-xs font-bold text-center leading-tight" style={{ color: obtained ? '#FFFFFF' : '#CBD5E1' }}>
        {def.nom}
      </div>

      {/* Sous-ligne : date obtenue / progression motivante / description */}
      {obtained && badge ? (
        <div className="text-[10px] mt-1 text-center" style={{ color: cfg.text }}>
          {new Date(badge.date_obtention).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      ) : hasProgress ? (
        <div className="mt-1 text-center">
          <p className="text-[11px] font-extrabold" style={{ color: catCfg.color }}>
            {restants} restant{restants > 1 ? 's' : ''}
          </p>
          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{progress!.current}/{progress!.required} · {pct}%</p>
        </div>
      ) : (
        <div className="text-[10px] mt-1 text-center leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {def.description}
        </div>
      )}

      {/* Puce de rareté — visible dans les DEUX états pour lire la rareté d'un coup d'œil */}
      <div className="mt-1.5">
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          style={{
            background: obtained ? cfg.bg : 'rgba(255,255,255,0.04)',
            color: obtained ? cfg.text : 'rgba(255,255,255,0.4)',
            border: `1px solid ${obtained ? `${cfg.border}55` : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ─── Exported grid (reused in Dashboard) ───────────────────────────────────────

export function BadgesGrid({ badges, totalSauts }: { badges: Badge[]; totalSauts: number }) {
  const obtainedSet = new Set(badges.map((b) => b.type_badge));

  const getProgress = (type: string): { current: number; required: number } | undefined => {
    const volumeMap: Record<string, number> = {
      premier_saut: 1, decollage: 10, en_route: 25, confirme: 50,
      centenaire: 100, veteran: 200, expert: 300, maitre: 500,
      legende: 1000, icone: 2000, mythe: 5000, immortel: 10000,
    };
    if (type in volumeMap) return { current: totalSauts, required: volumeMap[type] };
    return undefined;
  };

  return (
    <div className="space-y-8">
      {CAT_ORDER.map((cat) => {
        const catBadges = BADGES.filter((b) => b.categorie === cat);
        const { label } = CAT_CONFIG[cat];
        return (
          <div key={cat}>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {label}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {catBadges.map((def) => (
                <BadgeCard
                  key={def.type}
                  def={def}
                  badge={badges.find((b) => b.type_badge === def.type)}
                  obtained={obtainedSet.has(def.type)}
                  progress={getProgress(def.type)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Full Badges Page ──────────────────────────────────────────────────────────

const VOLUME_MAP: Record<string, number> = {
  premier_saut: 1, decollage: 10, en_route: 25, confirme: 50,
  centenaire: 100, veteran: 200, expert: 300, maitre: 500,
  legende: 1000, icone: 2000, mythe: 5000, immortel: 10000,
};

export function BadgesPage() {
  const { user } = useAuth();
  const [sauts, setSauts] = useState<Saut[]>([]);
  const [activeFilter, setActiveFilter] = useState<CatKey | 'all'>('all');
  const { badges, newBadge, dismissBadgeNotif, dismissAllBadgeNotifs } = useBadges(user?.id, sauts);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('sauts')
      .select('*')
      .eq('parachutiste_id', user.id)
      .then(({ data }) => { if (data) setSauts(data as Saut[]); });
  }, [user]);

  const obtainedSet = new Set(badges.map((b) => b.type_badge));
  const newBadgeTypes = new Set(badges.filter((b) => !b.notifie).map((b) => b.type_badge));
  const obtained = badges.length;
  const total = BADGES.length;
  const totalSauts = sauts.filter(s => s.statut === 'valide' || s.statut === 'historique').length;

  const rareteCount = (rarete: string) =>
    BADGES.filter((b) => b.rarete === rarete && obtainedSet.has(b.type)).length;

  const getProgress = (def: BadgeDefinition): { current: number; required: number } | undefined => {
    if (def.type in VOLUME_MAP) return { current: totalSauts, required: VOLUME_MAP[def.type] };
    return undefined;
  };

  // Sort unobtained badges by % progress descending, obtained at end
  const filteredBadges = BADGES.filter((b) => activeFilter === 'all' || b.categorie === activeFilter);
  const sortedBadges = [...filteredBadges].sort((a, b) => {
    const aObtained = obtainedSet.has(a.type);
    const bObtained = obtainedSet.has(b.type);
    if (aObtained && !bObtained) return 1;
    if (!aObtained && bObtained) return -1;
    // Both unobtained — sort by progress %
    const aP = getProgress(a);
    const bP = getProgress(b);
    const aPct = aP ? aP.current / aP.required : 0;
    const bPct = bP ? bP.current / bP.required : 0;
    return bPct - aPct;
  });

  const xp = Math.round((obtained / total) * 100);

  return (
    <Layout>
      <style>{`
        @keyframes shimmerMove {
          0% { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(300%) skewX(-15deg); }
        }
        .shimmer-bar {
          position: absolute; top: 0; left: 0;
          width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
          animation: shimmerMove 2.2s ease-in-out infinite;
        }
        /* Survol médaillon : léger relief, transform seule (GPU) pour rester fluide mobile */
        .badge-medallion { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .badge-medallion:hover .badge-disc { transform: scale(1.06); }
        .badge-disc { transition: transform 0.18s ease; }
        /* Célébration de déblocage — jouée UNE fois (iteration-count 1), non bloquante */
        @keyframes badgePop {
          0% { transform: scale(0.6); opacity: 0; }
          55% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes celebRing {
          0% { transform: scale(0.5); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes celebSpark {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
        .celeb-pop { animation: badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1) 1 both; }
        .celeb-ring { animation: celebRing 0.7s ease-out 1 both; }
        .celeb-spark { animation: celebSpark 0.7s ease-out 1 both; }
        @media (prefers-reduced-motion: reduce) {
          .shimmer-bar,
          .badge-medallion, .badge-medallion:hover .badge-disc, .badge-disc,
          .celeb-pop, .celeb-ring, .celeb-spark { animation: none !important; transition: none !important; transform: none !important; }
        }
      `}</style>

      <div style={{ background: '#001A4D', minHeight: '100vh' }}>

        {/* New badge toast */}
        {newBadge && (
          <div
            className="fixed bottom-6 right-6 z-50 rounded-2xl shadow-2xl px-5 py-4"
            style={{ background: '#001A4D', border: '1px solid rgba(249,163,22,0.35)', maxWidth: 280 }}
          >
            <button
              onClick={dismissBadgeNotif}
              className="absolute top-2 right-2 text-white/40 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {(() => {
              const nb = BADGES.find((b) => b.nom === newBadge);
              const rc = nb ? RARETE_CONFIG[nb.rarete] : RARETE_CONFIG.legendaire;
              return (
                <div className="mb-2 relative inline-flex items-center justify-center" style={{ width: 48, height: 48 }}>
                  {/* Éclat de célébration — pur CSS, une fois, pointer-events none */}
                  <div aria-hidden className="celeb-ring absolute rounded-full" style={{ inset: 0, border: `2px solid ${rc.ring}`, pointerEvents: 'none' }} />
                  {[0, 60, 120, 180, 240, 300].map((a) => (
                    <span key={a} aria-hidden className="celeb-spark absolute rounded-full" style={{
                      width: 4, height: 4, background: rc.accent, pointerEvents: 'none',
                      ['--dx' as string]: `${Math.round(Math.cos(a * Math.PI / 180) * 26)}px`,
                      ['--dy' as string]: `${Math.round(Math.sin(a * Math.PI / 180) * 26)}px`,
                    }} />
                  ))}
                  <div className="celeb-pop rounded-full flex items-center justify-center" style={{
                    width: 44, height: 44,
                    background: `radial-gradient(circle at 38% 28%, ${rc.top}, ${rc.bottom})`,
                    border: `2px solid ${rc.ring}`, boxShadow: rc.halo === 'none' ? undefined : rc.halo,
                  }}>
                    <BadgeIcon type={nb?.type ?? ''} nom={newBadge} couleur={rc.accent} className="w-6 h-6" />
                  </div>
                </div>
              );
            })()}
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#FCD34D' }}>
              Nouveau badge débloqué !
            </p>
            <p className="text-sm font-bold text-white">{newBadge}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={dismissBadgeNotif}
                className="text-xs px-3 py-1.5 rounded-lg transition"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                Fermer
              </button>
              <button
                onClick={dismissAllBadgeNotifs}
                className="text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                style={{ background: 'rgba(249,163,22,0.15)', color: '#FCD34D' }}
              >
                <CheckCheck className="w-3 h-3" /> Tout marquer vu
              </button>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto py-8 space-y-6 px-4">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Award className="w-6 h-6 text-orange-400" />
                <h1 className="text-2xl font-bold text-white">Mes Badges</h1>
                {newBadgeTypes.size > 0 && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                    style={{ background: '#F97316', color: '#fff' }}
                  >
                    {newBadgeTypes.size} NOUVEAU{newBadgeTypes.size > 1 ? 'X' : ''}
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Débloquez des badges en progressant dans votre pratique du parachutisme.
              </p>
            </div>
            {newBadgeTypes.size > 0 && (
              <button
                onClick={dismissAllBadgeNotifs}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
              >
                <CheckCheck className="w-3.5 h-3.5" /> Tout marquer comme vu
              </button>
            )}
          </div>

          {/* XP bar */}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Progression globale
              </span>
              <span className="text-xs font-bold" style={{ color: '#F97316' }}>
                {obtained} / {total} badges · {xp}%
              </span>
            </div>
            <div className="w-full rounded-full" style={{ height: 8, background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="rounded-full transition-all duration-700"
                style={{ width: `${xp}%`, height: '100%', background: 'linear-gradient(90deg, #F97316, #FCD34D)' }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Obtenus', value: obtained, color: '#FFFFFF' },
              { label: 'À débloquer', value: total - obtained, color: '#64748B' },
              { label: 'Total', value: total, color: '#FFFFFF' },
              { label: 'Légendaires', value: rareteCount('legendaire'), color: '#FCD34D' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-2xl p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="text-2xl font-bold" style={{ color }}>{value}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Rarity legend */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Rareté :</span>
            {(Object.entries(RARETE_CONFIG) as [keyof typeof RARETE_CONFIG, (typeof RARETE_CONFIG)[keyof typeof RARETE_CONFIG]][]).map(([key, cfg]) => (
              <span
                key={key}
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
              >
                {cfg.label}
              </span>
            ))}
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: activeFilter === 'all' ? '#F97316' : 'rgba(255,255,255,0.06)',
                color: activeFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${activeFilter === 'all' ? '#F97316' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              Tous ({total})
            </button>
            {CAT_ORDER.map((cat) => {
              const catBadges = BADGES.filter((b) => b.categorie === cat);
              const catObtained = catBadges.filter((b) => obtainedSet.has(b.type)).length;
              const { label, color } = CAT_CONFIG[cat];
              const active = activeFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: active ? `${color}25` : 'rgba(255,255,255,0.04)',
                    color: active ? color : 'rgba(255,255,255,0.45)',
                    border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <span className="inline-flex items-center gap-1.5"><CatDot color={color} size={8} /> {label} <span style={{ opacity: 0.6 }}>({catObtained}/{catBadges.length})</span></span>
                </button>
              );
            })}
          </div>

          {/* Badge grid */}
          {activeFilter === 'all' ? (
            // Grouped by category
            <div className="space-y-10">
              {CAT_ORDER.map((cat) => {
                const catBadges = BADGES.filter((b) => b.categorie === cat);
                const catObtained = catBadges.filter((b) => obtainedSet.has(b.type)).length;
                const { label, color } = CAT_CONFIG[cat];
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        <CatDot color={color} />
                        <span>{label}</span>
                      </h2>
                      <div className="flex items-center gap-2">
                        <div className="w-20 rounded-full" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
                          <div
                            className="rounded-full"
                            style={{ width: `${(catObtained / catBadges.length) * 100}%`, height: '100%', background: color, transition: 'width 0.5s ease' }}
                          />
                        </div>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {catObtained}/{catBadges.length}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {catBadges.map((def) => (
                        <BadgeCard
                          key={def.type}
                          def={def}
                          badge={badges.find((b) => b.type_badge === def.type)}
                          obtained={obtainedSet.has(def.type)}
                          isNew={newBadgeTypes.has(def.type)}
                          progress={getProgress(def)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Filtered flat grid — sorted by progress
            <div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {sortedBadges.map((def) => (
                  <BadgeCard
                    key={def.type}
                    def={def}
                    badge={badges.find((b) => b.type_badge === def.type)}
                    obtained={obtainedSet.has(def.type)}
                    isNew={newBadgeTypes.has(def.type)}
                    progress={getProgress(def)}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
