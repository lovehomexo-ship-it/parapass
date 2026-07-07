import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  DRILL_CATEGORIES, DRILL_TIMER_SEC, DRILL_PROP_COLORS,
  type DrillScenario, type DrillResult,
} from '../lib/drill';
import { ArrowLeft, Clock, CheckCircle, XCircle, Flame, Zap } from 'lucide-react';

// ─── Sélection déterministe du scénario du jour ────────────────────────────────

function pickTodayScenario(scenarios: DrillScenario[], brevet: string | null): DrillScenario | null {
  const eligible = scenarios.filter(s => {
    if (!s.niveau_brevet_mini) return true;
    const order = ['A', 'B', 'C', 'D'];
    const userIdx = brevet ? order.indexOf(brevet) : 0;
    const minIdx  = order.indexOf(s.niveau_brevet_mini);
    return userIdx >= minIdx;
  });
  if (eligible.length === 0) return scenarios[0] ?? null;

  // Seed = date du jour → même scénario pour tout le monde ce jour-là
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seed    = parseInt(dateStr, 10) % eligible.length;
  return eligible[seed];
}

// ─── Timer anneau SVG ──────────────────────────────────────────────────────────

function TimerRing({ timer, max }: { timer: number; max: number }) {
  const r   = 28;
  const c   = 2 * Math.PI * r;
  const pct = timer / max;
  const col = timer > max * 0.5 ? '#10B981' : timer > max * 0.25 ? '#F59E0B' : '#EF4444';

  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="rotate-[-90deg]">
      <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
      <circle cx={36} cy={36} r={r} fill="none" stroke={col} strokeWidth={5}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
      <text x={36} y={36} textAnchor="middle" dominantBaseline="central"
        className="rotate-90" style={{ fill: col, fontSize: 18, fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: '36px 36px' }}>
        {timer}
      </text>
    </svg>
  );
}

// ─── Page Réflexe du Jour ─────────────────────────────────────────────────────

export function ReflexeDuJourPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [scenario, setScenario] = useState<DrillScenario | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<DrillResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [timer, setTimer] = useState(DRILL_TIMER_SEC);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef    = useRef<number>(Date.now());
  const timedOutRef = useRef(false);

  // ── Chargement ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    async function load() {
      // Déjà fait aujourd'hui ?
      const today = new Date().toISOString().slice(0, 10);
      const { data: done } = await supabase
        .from('drill_attempts')
        .select('id')
        .eq('profil_id', user!.id)
        .eq('drill_date', today)
        .maybeSingle();

      if (done) { setAlreadyDone(true); setLoading(false); return; }

      // Charger scénarios valides
      const { data } = await supabase
        .from('drill_scenarios')
        .select('id, situation, propositions, categorie, niveau_brevet_mini')
        .eq('valide', true);

      const brevet = (profile as { brevet?: string | null } | null)?.brevet ?? null;
      const picked = pickTodayScenario((data ?? []) as DrillScenario[], brevet);
      setScenario(picked);
      setLoading(false);
    }
    load();
  }, [user, profile]);

  // ── Timer ───────────────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (loading || alreadyDone || result || !scenario) return;
    startRef.current = Date.now();
    timedOutRef.current = false;
    setTimer(DRILL_TIMER_SEC);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          stopTimer();
          setTimedOut(true);
          // Ne pas appeler submitAnswer depuis un state updater (effet de bord interdit)
          // On déclenche le submit après le cycle de rendu via setTimeout
          if (!timedOutRef.current) {
            timedOutRef.current = true;
            setTimeout(() => submitAnswer('__timeout__'), 0);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => stopTimer();
  }, [loading, alreadyDone, scenario, stopTimer, submitAnswer]);

  // ── Soumission ──────────────────────────────────────────────────────────────

  const submitAnswer = useCallback(async (propId: string) => {
    if (!scenario || submitting || result) return;
    stopTimer();
    setSubmitting(true);
    setSelected(propId);

    const temps = Date.now() - startRef.current;

    const { data, error } = await supabase.rpc('submit_drill_answer', {
      p_scenario_id: scenario.id,
      p_reponse:     propId,
      p_temps_ms:    temps,
    });

    if (!error && data) {
      setResult(data as DrillResult);
    } else if (error) {
      if (error.message?.includes('déjà fait')) {
        setAlreadyDone(true);
      } else {
        setSubmitError(error.message ?? 'Erreur lors de la validation');
        setSelected(null);
      }
    }
    setSubmitting(false);
  }, [scenario, submitting, result, stopTimer]);

  // ── États d'affichage ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#EF4444' }} />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#0F172A' }}>
        <div className="text-5xl mb-4">📭</div>
        <p className="text-lg font-semibold mb-2" style={{ color: '#F8FAFC' }}>Aucun scénario disponible</p>
        <p className="text-sm mb-6" style={{ color: '#64748B' }}>Revenez bientôt.</p>
        <button onClick={() => navigate('/dashboard')} className="rounded-xl px-6 py-3 font-semibold" style={{ background: '#1E293B', color: '#94A3B8' }}>
          Retour
        </button>
      </div>
    );
  }

  const cat = DRILL_CATEGORIES[scenario.categorie];
  const props = scenario.propositions as { id: string; texte: string }[];

  // ── Écran "déjà fait" ───────────────────────────────────────────────────────

  if (alreadyDone && !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#0F172A' }}>
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#F8FAFC' }}>Réflexe du jour fait !</h1>
        <p className="text-sm mb-1" style={{ color: '#64748B' }}>Vous avez déjà complété le réflexe d'aujourd'hui.</p>
        <p className="text-sm mb-8" style={{ color: '#64748B' }}>Revenez demain pour le prochain scénario.</p>
        <button onClick={() => navigate('/dashboard')} className="rounded-xl px-8 py-3 font-semibold" style={{ background: '#1E293B', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}>
          Retour au tableau de bord
        </button>
      </div>
    );
  }

  // ── Écran résultats ─────────────────────────────────────────────────────────

  if (result) {
    return (
      <div className="min-h-screen flex flex-col px-4 py-8" style={{ background: '#0F172A' }}>
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg self-start mb-6" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <ArrowLeft className="w-5 h-5" style={{ color: '#94A3B8' }} />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto w-full">
          {/* Verdict */}
          <div className="text-6xl mb-3">{timedOut ? '⏱️' : result.est_correct ? '✅' : '❌'}</div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#F8FAFC' }}>
            {timedOut ? 'Temps écoulé' : result.est_correct ? 'Bon réflexe !' : 'Pas le bon réflexe'}
          </h1>
          <p className="text-sm mb-4" style={{ color: '#64748B' }}>
            {result.est_correct ? `+${result.xp_gagnes} XP Académie` : `+${result.xp_gagnes} XP (participation)`}
            {result.bonus_vitesse > 0 && <span style={{ color: '#FBBF24' }}> · ⚡ +{result.bonus_vitesse} rapidité</span>}
          </p>

          {/* Streak */}
          {result.streak > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}>
              <Flame className="w-4 h-4" style={{ color: '#F97316' }} />
              <span className="text-sm font-semibold" style={{ color: '#F97316' }}>
                {result.streak} jour{result.streak > 1 ? 's' : ''} de suite
              </span>
            </div>
          )}

          {/* Explication */}
          <div className="w-full rounded-2xl p-5 text-left mb-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>
              {cat?.icone} {cat?.label}
            </p>
            {!result.est_correct && (
              <p className="text-sm font-semibold mb-3" style={{ color: '#6EE7B7' }}>
                Bonne réponse : {result.bonne_reponse}
              </p>
            )}
            <p className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>{result.explication}</p>
            {result.reference && (
              <p className="text-xs mt-3 italic" style={{ color: '#475569' }}>{result.reference}</p>
            )}
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-xl py-3 font-bold"
            style={{ background: '#7C3AED', color: '#fff' }}>
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  // ── Écran quiz ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col px-4 py-6" style={{ background: '#0F172A' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <ArrowLeft className="w-5 h-5" style={{ color: '#94A3B8' }} />
        </button>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#EF4444' }}>🔴 Réflexe du jour</p>
          <p className="text-xs" style={{ color: '#475569' }}>{cat?.icone} {cat?.label}</p>
        </div>
        <TimerRing timer={timer} max={DRILL_TIMER_SEC} />
      </div>

      {/* Situation */}
      <div className="rounded-2xl p-5 mb-8 flex-shrink-0"
        style={{ background: cat ? cat.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${cat ? cat.color + '40' : 'rgba(255,255,255,0.08)'}` }}>
        <p className="text-lg font-bold leading-snug" style={{ color: '#F8FAFC' }}>
          {scenario.situation}
        </p>
      </div>

      {/* Erreur soumission */}
      {submitError && (
        <div className="rounded-xl px-4 py-3 mb-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          ⚠️ {submitError}
        </div>
      )}

      {/* Propositions */}
      <div className="flex flex-col gap-3 flex-1">
        {props.map((p, i) => {
          const colors = DRILL_PROP_COLORS[i % DRILL_PROP_COLORS.length];
          const isSelected = selected === p.id;
          return (
            <button
              key={p.id}
              disabled={!!result || submitting || timedOut}
              onClick={() => submitAnswer(p.id)}
              className="w-full rounded-xl p-4 text-left flex items-center gap-3 transition-all active:scale-98"
              style={{
                background: isSelected ? 'rgba(255,255,255,0.08)' : colors.bg,
                border: `1px solid ${isSelected ? 'rgba(255,255,255,0.2)' : colors.border}`,
                cursor: result ? 'default' : 'pointer',
                opacity: submitting && !isSelected ? 0.5 : 1,
              }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', color: colors.label, border: `1px solid ${colors.border}` }}>
                {p.id}
              </span>
              <span className="text-sm font-medium leading-snug" style={{ color: '#E2E8F0' }}>{p.texte}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs mt-6" style={{ color: '#1E293B' }}>
        Une seule tentative par jour · Gratuit pour toujours
      </p>
    </div>
  );
}
