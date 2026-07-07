import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useBadges } from '../lib/useBadges';
import type { Badge, Saut, BadgeDefinition } from '../lib/types';
import { BADGES } from '../lib/types';
import { Award, X, CheckCheck } from 'lucide-react';

// ─── Rarity config ─────────────────────────────────────────────────────────────

const RARETE_CONFIG = {
  commun: {
    label: 'Commun',
    border: '#CBD5E1',
    bg: 'rgba(100,116,139,0.12)',
    text: '#94A3B8',
    glow: 'none',
    shimmer: false,
  },
  rare: {
    label: 'Rare',
    border: '#86EFAC',
    bg: 'rgba(22,163,74,0.12)',
    text: '#4ADE80',
    glow: '0 0 8px rgba(22,163,74,0.25)',
    shimmer: false,
  },
  epique: {
    label: 'Épique',
    border: '#93C5FD',
    bg: 'rgba(37,99,235,0.15)',
    text: '#60A5FA',
    glow: '0 0 10px rgba(37,99,235,0.3)',
    shimmer: false,
  },
  legendaire: {
    label: 'Légendaire',
    border: '#FCD34D',
    bg: 'rgba(217,119,6,0.15)',
    text: '#FCD34D',
    glow: '0 0 14px rgba(217,119,6,0.4)',
    shimmer: true,
  },
};

// ─── Category config ────────────────────────────────────────────────────────────

type CatKey = BadgeDefinition['categorie'];

const CAT_CONFIG: Record<CatKey, { label: string; emoji: string; color: string }> = {
  volume:              { label: 'Volume',               emoji: '🪂', color: '#F97316' },
  discipline:          { label: 'Discipline',            emoji: '🎯', color: '#3B82F6' },
  temporel:            { label: 'Temporel',              emoji: '📅', color: '#10B981' },
  figures_vr:          { label: 'Voile Relative',        emoji: '🔵', color: '#2563EB' },
  figures_freefly:     { label: 'Freefly',               emoji: '🟠', color: '#F97316' },
  figures_tracking:    { label: 'Tracking & Angle',      emoji: '🟢', color: '#16A34A' },
  figures_belly:       { label: 'Belly & Solo',          emoji: '🔴', color: '#EF4444' },
  disciplines_speciales: { label: 'Disciplines spéciales', emoji: '🟣', color: '#8B5CF6' },
  equipement:          { label: 'Caméra & Équipement',   emoji: '⚙️', color: '#64748B' },
};

const CAT_ORDER: CatKey[] = [
  'volume', 'discipline', 'temporel',
  'figures_vr', 'figures_freefly', 'figures_tracking', 'figures_belly',
  'disciplines_speciales', 'equipement',
];

// ─── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ current, required, color }: { current: number; required: number; color: string }) {
  const pct = Math.min(100, (current / required) * 100);
  return (
    <div className="w-full mt-1" style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
    </div>
  );
}

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

  return (
    <div
      className="relative flex flex-col items-center p-4 rounded-2xl border transition-all duration-200 group cursor-default"
      style={{
        background: obtained ? cfg.bg : 'rgba(255,255,255,0.03)',
        borderColor: obtained ? cfg.border : 'rgba(255,255,255,0.08)',
        boxShadow: obtained ? cfg.glow : 'none',
        opacity: obtained ? 1 : 0.55,
      }}
      onMouseEnter={(e) => {
        if (obtained) {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scale(1.04)';
          el.style.boxShadow = cfg.glow === 'none'
            ? '0 4px 20px rgba(0,0,0,0.25)'
            : cfg.glow.replace(/[\d.]+\)$/, '0.6)');
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'scale(1)';
        el.style.boxShadow = obtained ? cfg.glow : 'none';
      }}
    >
      {/* Shimmer overlay for legendary */}
      {obtained && cfg.shimmer && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="shimmer-bar" />
        </div>
      )}

      {/* NEW badge */}
      {isNew && obtained && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider z-20 animate-pulse"
          style={{ background: '#F97316', color: '#fff', whiteSpace: 'nowrap' }}
        >
          NOUVEAU
        </div>
      )}

      {/* Obtained check */}
      {obtained && (
        <div
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center z-10"
          style={{ background: cfg.text, boxShadow: `0 0 6px ${cfg.border}` }}
        >
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div
        className="text-3xl mb-2 relative z-10 transition-transform duration-200"
        style={{ filter: obtained ? 'none' : 'grayscale(1)' }}
      >
        {def.icone}
      </div>
      <div
        className="text-xs font-bold text-center leading-tight relative z-10"
        style={{ color: obtained ? '#FFFFFF' : '#94A3B8' }}
      >
        {def.nom}
      </div>

      {obtained && badge ? (
        <div className="text-[10px] mt-1 relative z-10 text-center" style={{ color: cfg.text }}>
          {new Date(badge.date_obtention).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      ) : (
        <>
          <div className="text-[10px] mt-1 text-center leading-tight relative z-10" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {def.description}
          </div>
          {progress && progress.required > 0 && (
            <div className="w-full mt-2 relative z-10">
              <ProgressBar current={progress.current} required={progress.required} color={catCfg.color} />
              <p className="text-[9px] text-center mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {progress.current} / {progress.required}
              </p>
            </div>
          )}
        </>
      )}

      {obtained && (
        <div className="mt-1.5 relative z-10">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
          >
            {RARETE_CONFIG[def.rarete].label}
          </span>
        </div>
      )}
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
            <div className="text-2xl mb-2">🏅</div>
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
              const { label, emoji, color } = CAT_CONFIG[cat];
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
                  {emoji} {label} <span style={{ opacity: 0.6 }}>({catObtained}/{catBadges.length})</span>
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
                const { label, emoji, color } = CAT_CONFIG[cat];
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        <span>{emoji}</span>
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
