import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { getGrade, getProgressToNextGrade, THEMES, QUIZ_BADGES, RARETE_COLORS } from '../lib/quiz';
import { Flame, ChevronRight } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface XPData {
  xp_total: number;
  streak: number;
  daily_done: boolean;
}

interface Classement {
  profil_id: string;
  nom: string;
  prenom: string;
  xp_total: number;
  rang: number;
}

interface BadgeEarned {
  badge_id: string;
  earned_at: string;
}

interface ThemeProgress {
  theme: string;
  nb_questions: number;
  nb_correctes: number;
}

// ─── Hook données ───────────────────────────────────────────────────────────────

function useAcademieData(userId: string | undefined) {
  const [xp, setXp] = useState<XPData>({ xp_total: 0, streak: 0, daily_done: false });
  const [badges, setBadges] = useState<BadgeEarned[]>([]);
  const [classement, setClassement] = useState<Classement[]>([]);
  const [themeProgress, setThemeProgress] = useState<ThemeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [centreId, setCentreId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      // Centre du user
      const { data: profil } = await supabase
        .from('profiles')
        .select('centre_id')
        .eq('id', userId!)
        .maybeSingle();
      const cid = profil?.centre_id ?? null;
      setCentreId(cid);

      // XP total
      const { data: xpRows } = await supabase
        .from('quiz_xp')
        .select('xp')
        .eq('user_id', userId!);
      const total = (xpRows ?? []).reduce((s: number, r: { xp: number }) => s + r.xp, 0);

      // Streak
      const { data: streak } = await supabase
        .from('quiz_streaks')
        .select('streak_actuel')
        .eq('user_id', userId!)
        .maybeSingle();

      // Quiz du jour déjà fait ?
      const today = new Date().toISOString().slice(0, 10);
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('id')
        .eq('user_id', userId!)
        .eq('mode', 'daily')
        .gte('created_at', today)
        .limit(1);

      setXp({
        xp_total: total,
        streak: streak?.streak_actuel ?? 0,
        daily_done: (attempts?.length ?? 0) > 0,
      });

      // Badges
      const { data: earned } = await supabase
        .from('quiz_badges_earned')
        .select('badge_id, earned_at')
        .eq('user_id', userId!);
      setBadges(earned ?? []);

      // Classement DZ
      if (cid) {
        const { data: ranking } = await supabase
          .from('quiz_xp')
          .select('user_id, xp, profil:profiles!user_id(nom, prenom, centre_id)');

        if (ranking) {
          const byUser: Record<string, { nom: string; prenom: string; xp: number }> = {};
          for (const r of ranking as Array<{ user_id: string; xp: number; profil: { nom: string; prenom: string; centre_id: string | null } | null }>) {
            if (!r.profil || r.profil.centre_id !== cid) continue;
            if (!byUser[r.user_id]) byUser[r.user_id] = { nom: r.profil.nom, prenom: r.profil.prenom, xp: 0 };
            byUser[r.user_id].xp += r.xp;
          }
          const sorted = Object.entries(byUser)
            .map(([id, v]) => ({ profil_id: id, nom: v.nom, prenom: v.prenom, xp_total: v.xp, rang: 0 }))
            .sort((a, b) => b.xp_total - a.xp_total)
            .map((r, i) => ({ ...r, rang: i + 1 }));
          setClassement(sorted.slice(0, 10));
        }
      }

      // Progrès par thème : join quiz_questions pour récupérer le thème
      const { data: prog } = await supabase
        .from('quiz_progress')
        .select('nb_fois_vue, nb_fois_correcte, question:quiz_questions!question_id(theme)')
        .eq('user_id', userId!);

      if (prog) {
        const byTheme: Record<string, { vues: number; correctes: number }> = {};
        for (const row of prog as Array<{ nb_fois_vue: number; nb_fois_correcte: number; question: { theme: string } | null }>) {
          const theme = row.question?.theme;
          if (!theme) continue;
          if (!byTheme[theme]) byTheme[theme] = { vues: 0, correctes: 0 };
          byTheme[theme].vues += row.nb_fois_vue;
          byTheme[theme].correctes += row.nb_fois_correcte;
        }
        setThemeProgress(Object.entries(byTheme).map(([theme, v]) => ({
          theme,
          nb_questions: v.vues,
          nb_correctes: v.correctes,
        })));
      } else {
        setThemeProgress([]);
      }

      setLoading(false);
    }

    load();
  }, [userId]);

  return { xp, badges, classement, themeProgress, loading, centreId };
}

// ─── Page principale ────────────────────────────────────────────────────────────

export function AcademiePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { xp, badges, classement, themeProgress, loading } = useAcademieData(user?.id);

  const grade = getGrade(xp.xp_total);
  const prog = getProgressToNextGrade(xp.xp_total);
  const earnedIds = new Set(badges.map(b => b.badge_id));

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#8B5CF6' }} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6">

        {/* Header grade */}
        <div className="rounded-2xl p-5 mb-4 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))', border: '1px solid rgba(139,92,246,0.3)' }}>
          <div className="text-5xl mb-2">{grade.icone}</div>
          <h1 className="text-2xl font-bold" style={{ color: grade.color }}>{grade.nom}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--c-muted)' }}>ParaPass Académie</p>
          <div className="mt-3 flex items-center gap-3 justify-center">
            <span className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>{xp.xp_total} XP</span>
            {xp.streak > 0 && (
              <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: '#F97316' }}>
                <Flame className="w-4 h-4" /> {xp.streak} jours
              </span>
            )}
          </div>
          {prog.needed > 0 && (
            <div className="mt-3">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(139,92,246,0.15)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${prog.pct}%`, background: grade.color }} />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>{prog.current}/{prog.needed} XP vers grade suivant</p>
            </div>
          )}
        </div>

        {/* Quiz du jour */}
        <button
          onClick={() => navigate('/academie/quiz?mode=daily')}
          className="w-full rounded-2xl p-4 mb-4 flex items-center gap-4 text-left"
          style={{
            background: xp.daily_done ? 'rgba(16,185,129,0.08)' : 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.15))',
            border: xp.daily_done ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(139,92,246,0.4)',
            cursor: xp.daily_done ? 'default' : 'pointer',
          }}
          disabled={xp.daily_done}
        >
          <div className="text-3xl">{xp.daily_done ? '✅' : '📅'}</div>
          <div className="flex-1">
            <p className="font-bold" style={{ color: 'var(--c-text)' }}>
              {xp.daily_done ? 'Défi du jour terminé !' : 'Défi du jour'}
            </p>
            <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
              {xp.daily_done ? 'Revenez demain pour continuer votre série' : '10 questions · XP bonus disponible'}
            </p>
          </div>
          {!xp.daily_done && <ChevronRight className="w-5 h-5" style={{ color: '#8B5CF6' }} />}
        </button>

        {/* Entraînement par thème */}
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--c-muted)' }}>
          Entraînement par thème
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {Object.entries(THEMES).map(([key, th]) => {
            const tp = themeProgress.find(p => p.theme === key);
            const pct = tp && tp.nb_questions > 0 ? Math.round((tp.nb_correctes / tp.nb_questions) * 100) : 0;
            return (
              <button
                key={key}
                onClick={() => navigate(`/academie/quiz?mode=training&theme=${key}`)}
                className="rounded-xl p-4 text-left"
                style={{ background: th.bg, border: `1px solid ${th.color}40` }}
              >
                <div className="text-2xl mb-1">{th.icone}</div>
                <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{th.label}</p>
                {tp && tp.nb_questions > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: th.color }} />
                    </div>
                    <p className="text-xs mt-1" style={{ color: th.color }}>{pct}% correct</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Badges */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Badges</h2>
          <span className="text-xs" style={{ color: 'var(--c-muted)' }}>{earnedIds.size}/{QUIZ_BADGES.length}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {QUIZ_BADGES.map(b => {
            const earned = earnedIds.has(b.id);
            return (
              <div key={b.id}
                className="rounded-xl p-3 text-center"
                style={{ background: earned ? `${RARETE_COLORS[b.rarete]}15` : 'var(--c-surface)', border: `1px solid ${earned ? RARETE_COLORS[b.rarete] + '50' : 'var(--c-border)'}`, opacity: earned ? 1 : 0.4 }}>
                <div className="text-2xl mb-1">{earned ? b.icone : '🔒'}</div>
                <p className="text-xs font-semibold leading-tight" style={{ color: earned ? RARETE_COLORS[b.rarete] : 'var(--c-muted)' }}>{b.nom}</p>
              </div>
            );
          })}
        </div>

        {/* Classement DZ */}
        {classement.length > 0 && (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--c-muted)' }}>
              🏆 Classement DZ
            </h2>
            <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid var(--c-border)' }}>
              {classement.map((c, i) => {
                const isMe = c.profil_id === user?.id;
                const grade = getGrade(c.xp_total);
                return (
                  <div key={c.profil_id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ background: isMe ? 'rgba(139,92,246,0.1)' : i % 2 === 0 ? 'var(--c-card)' : 'var(--c-surface)', borderBottom: i < classement.length - 1 ? '1px solid var(--c-border)' : undefined }}>
                    <span className="w-6 text-center text-sm font-bold" style={{ color: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#D97706' : 'var(--c-muted)' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <span className="text-lg">{grade.icone}</span>
                    <span className="flex-1 text-sm font-semibold" style={{ color: isMe ? '#A78BFA' : 'var(--c-text)' }}>
                      {c.prenom} {c.nom}{isMe ? ' (moi)' : ''}
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--c-muted)' }}>{c.xp_total} XP</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </div>
    </Layout>
  );
}
