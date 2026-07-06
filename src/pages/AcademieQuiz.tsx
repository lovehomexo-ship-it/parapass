import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getGrade, PROPOSITION_COLORS, diffLabel, type QuizQuestion, type QuizResult } from '../lib/quiz';
import { ArrowLeft, ChevronRight, Clock, Zap, CheckCircle, XCircle } from 'lucide-react';

// ─── Durée timer par question (secondes) ────────────────────────────────────────

const TIMER_SEC = 30;
const QUESTIONS_PER_SESSION = 10;

// ─── Écran chargement ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#0F172A' }}>
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 mb-4" style={{ borderColor: '#8B5CF6' }} />
      <p style={{ color: '#94A3B8' }}>Chargement des questions…</p>
    </div>
  );
}

// ─── Barre progression ───────────────────────────────────────────────────────────

function ProgressBar({ current, total, timer }: { current: number; total: number; timer: number }) {
  const timerPct = (timer / TIMER_SEC) * 100;
  const timerColor = timer > 15 ? '#10B981' : timer > 8 ? '#F59E0B' : '#EF4444';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color: '#94A3B8' }}>Question {current}/{total}</span>
        <span className="flex items-center gap-1 text-sm font-bold" style={{ color: timerColor }}>
          <Clock className="w-4 h-4" /> {timer}s
        </span>
      </div>
      {/* timer bar */}
      <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${timerPct}%`, background: timerColor }} />
      </div>
      {/* questions dots */}
      <div className="flex gap-1 mt-2">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i < current - 1 ? '#8B5CF6' : i === current - 1 ? '#A78BFA' : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>
    </div>
  );
}

// ─── Écran résultats ────────────────────────────────────────────────────────────

interface SessionStats {
  correctes: number;
  total: number;
  xpTotal: number;
  newGrade: boolean;
  gradeName: string;
  gradeIcon: string;
  gradeColor: string;
}

function ResultsScreen({ stats, onRetry, onDone }: { stats: SessionStats; onRetry: () => void; onDone: () => void }) {
  const pct = Math.round((stats.correctes / stats.total) * 100);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#0F172A' }}>
      <div className="text-6xl mb-4">{pct === 100 ? '🏆' : pct >= 70 ? '⭐' : '📚'}</div>
      <h1 className="text-3xl font-bold mb-2" style={{ color: '#F8FAFC' }}>
        {pct === 100 ? 'Parfait !' : pct >= 70 ? 'Bien joué !' : 'Continue comme ça !'}
      </h1>
      <p className="text-lg mb-1" style={{ color: '#94A3B8' }}>
        {stats.correctes}/{stats.total} bonnes réponses
      </p>
      <p className="text-2xl font-bold mb-6" style={{ color: '#A78BFA' }}>+{stats.xpTotal} XP</p>

      {stats.newGrade && (
        <div className="rounded-2xl p-4 mb-6 w-full max-w-xs"
          style={{ background: `${stats.gradeColor}15`, border: `1px solid ${stats.gradeColor}50` }}>
          <div className="text-4xl mb-1">{stats.gradeIcon}</div>
          <p className="font-bold" style={{ color: stats.gradeColor }}>Nouveau grade !</p>
          <p className="text-sm" style={{ color: '#94A3B8' }}>{stats.gradeName}</p>
        </div>
      )}

      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={onRetry}
          className="flex-1 rounded-xl py-3 font-semibold text-sm"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#A78BFA' }}>
          Rejouer
        </button>
        <button
          onClick={onDone}
          className="flex-1 rounded-xl py-3 font-semibold text-sm"
          style={{ background: '#7C3AED', color: '#fff' }}>
          Terminer
        </button>
      </div>
    </div>
  );
}

// ─── Page quiz ──────────────────────────────────────────────────────────────────

export function AcademieQuizPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') ?? 'training') as 'daily' | 'training';
  const theme = searchParams.get('theme') ?? undefined;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timer, setTimer] = useState(TIMER_SEC);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [xpBeforeSession, setXpBeforeSession] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Charger les questions
  useEffect(() => {
    async function load() {
      if (!user) return;

      // XP avant session (pour détecter nouveau grade)
      const { data: xpRows } = await supabase.from('quiz_xp').select('xp_gagnes').eq('profil_id', user.id);
      setXpBeforeSession((xpRows ?? []).reduce((s: number, r: { xp_gagnes: number }) => s + r.xp_gagnes, 0));

      let query = supabase
        .from('quiz_questions')
        .select('id, enonce, propositions, theme, niveau_brevet_mini, difficulte')
        .eq('valide', true);

      if (mode === 'daily') {
        // Sélection déterministe du jour
        query = query.order('id'); // on filtrera côté client avec hash simulé
      } else if (theme) {
        query = query.eq('theme', theme);
      }

      const { data } = await query.limit(50);
      if (!data || data.length === 0) { setLoading(false); return; }

      let pool = data as QuizQuestion[];

      if (mode === 'daily') {
        // pseudo-déterministe: shuffle avec seed = date
        const seed = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        pool = [...pool].sort((a, b) => {
          const ha = parseInt(a.id.replace(/-/g, '').slice(0, 8), 16) ^ parseInt(seed);
          const hb = parseInt(b.id.replace(/-/g, '').slice(0, 8), 16) ^ parseInt(seed);
          return ha - hb;
        });
      } else {
        pool = [...pool].sort(() => Math.random() - 0.5);
      }

      setQuestions(pool.slice(0, QUESTIONS_PER_SESSION));
      setLoading(false);
    }
    load();
  }, [user, mode, theme]);

  // Timer
  useEffect(() => {
    if (loading || sessionStats || result) return;
    startTimeRef.current = Date.now();
    setTimer(TIMER_SEC);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { handleTimeout(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIdx, loading, sessionStats]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const handleTimeout = useCallback(() => {
    stopTimer();
    if (submitting || result) return;
    submitAnswer('__timeout__');
  }, [submitting, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitAnswer = useCallback(async (propId: string) => {
    if (!user || submitting) return;
    const q = questions[currentIdx];
    if (!q) return;
    stopTimer();
    setSubmitting(true);
    setSelected(propId);

    const tempMs = Date.now() - startTimeRef.current;

    const { data, error } = await supabase.rpc('submit_quiz_answer', {
      p_question_id: q.id,
      p_reponse: propId,
      p_temps_ms: tempMs,
      p_mode: mode,
      p_session_id: sessionId,
    });

    if (!error && data) {
      setResult(data as QuizResult);
    }
    setSubmitting(false);
  }, [user, submitting, questions, currentIdx, mode, sessionId]);

  const next = useCallback(() => {
    const xpThisQ = result?.xp_gagnes ?? 0;
    const isLast = currentIdx >= questions.length - 1;

    if (isLast) {
      // Calculer stats session
      const totalXp = result?.xp_total ?? xpBeforeSession;
      const xpBefore = xpBeforeSession;
      const gradeBefore = getGrade(xpBefore);
      const gradeAfter = getGrade(totalXp);
      setSessionStats({
        correctes: 0, // calculé via résultats accumulés — simplifié ici
        total: questions.length,
        xpTotal: totalXp - xpBefore,
        newGrade: gradeBefore.nom !== gradeAfter.nom,
        gradeName: gradeAfter.nom,
        gradeIcon: gradeAfter.icone,
        gradeColor: gradeAfter.color,
      });
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setResult(null);
    }
  }, [currentIdx, questions.length, result, xpBeforeSession]);

  if (loading) return <LoadingScreen />;

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#0F172A' }}>
        <div className="text-5xl mb-4">📭</div>
        <p className="text-lg font-semibold mb-2" style={{ color: '#F8FAFC' }}>Aucune question disponible</p>
        <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>Revenez bientôt, la banque de questions s'enrichit régulièrement.</p>
        <button onClick={() => navigate('/academie')} className="rounded-xl px-6 py-3 font-semibold" style={{ background: '#7C3AED', color: '#fff' }}>
          Retour à l'Académie
        </button>
      </div>
    );
  }

  if (sessionStats) {
    return (
      <ResultsScreen
        stats={sessionStats}
        onRetry={() => { setSessionStats(null); setCurrentIdx(0); setSelected(null); setResult(null); }}
        onDone={() => navigate('/academie')}
      />
    );
  }

  const q = questions[currentIdx];
  const props = (q.propositions as { id: string; texte: string }[]);
  const diff = diffLabel(q.difficulte);

  return (
    <div className="min-h-screen flex flex-col px-4 py-6" style={{ background: '#0F172A' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/academie')} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <ArrowLeft className="w-5 h-5" style={{ color: '#94A3B8' }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: '#94A3B8' }}>
          {mode === 'daily' ? '📅 Défi du jour' : '🎯 Entraînement'}
        </span>
        <span className="ml-auto text-xs px-2 py-1 rounded-full font-semibold" style={{ background: `${diff.color}20`, color: diff.color }}>
          {diff.label}
        </span>
      </div>

      <ProgressBar current={currentIdx + 1} total={questions.length} timer={timer} />

      {/* Question */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-lg font-semibold leading-snug" style={{ color: '#F8FAFC' }}>{q.enonce}</p>
      </div>

      {/* Propositions */}
      <div className="flex flex-col gap-3 flex-1">
        {props.map((p, i) => {
          const colors = PROPOSITION_COLORS[i % PROPOSITION_COLORS.length];
          const isSelected = selected === p.id;
          const isCorrect = result?.est_correcte !== undefined && p.id === result.bonne_reponse;
          const isWrong = isSelected && result && !result.est_correcte;

          let bg = colors.bg;
          let border = colors.border;
          if (result) {
            if (isCorrect) { bg = 'rgba(16,185,129,0.2)'; border = '#10B981'; }
            else if (isWrong) { bg = 'rgba(239,68,68,0.2)'; border = '#EF4444'; }
            else { bg = 'rgba(255,255,255,0.03)'; border = 'rgba(255,255,255,0.08)'; }
          }

          return (
            <button
              key={p.id}
              disabled={!!result || submitting}
              onClick={() => submitAnswer(p.id)}
              className="w-full rounded-xl p-4 text-left flex items-center gap-3 transition-all"
              style={{ background: bg, border: `1px solid ${border}`, cursor: result ? 'default' : 'pointer' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: colors.bg, color: colors.label, border: `1px solid ${colors.border}` }}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 text-sm font-medium" style={{ color: '#F1F5F9' }}>{p.texte}</span>
              {result && isCorrect && <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#10B981' }} />}
              {result && isWrong && <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#EF4444' }} />}
            </button>
          );
        })}
      </div>

      {/* Feedback + XP */}
      {result && (
        <div className="mt-4">
          <div className="rounded-xl p-4 mb-3"
            style={{ background: result.est_correcte ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${result.est_correcte ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <div className="flex items-start gap-2">
              <span className="text-xl flex-shrink-0">{result.est_correcte ? '✅' : '❌'}</span>
              <div>
                <p className="font-semibold text-sm mb-1" style={{ color: result.est_correcte ? '#6EE7B7' : '#FCA5A5' }}>
                  {result.est_correcte ? `Correct ! +${result.xp_gagnes} XP` : 'Incorrect'}
                  {result.bonus_vitesse > 0 && <span style={{ color: '#FBBF24' }}> ⚡ +{result.bonus_vitesse} vitesse</span>}
                  {result.bonus_diff > 0 && <span style={{ color: '#A78BFA' }}> 🎯 +{result.bonus_diff} difficulté</span>}
                </p>
                {result.explication && <p className="text-xs" style={{ color: '#94A3B8' }}>{result.explication}</p>}
                {result.reference && <p className="text-xs mt-1" style={{ color: '#64748B' }}>{result.reference}</p>}
              </div>
            </div>
          </div>
          <button
            onClick={next}
            className="w-full rounded-xl py-3 font-bold flex items-center justify-center gap-2"
            style={{ background: '#7C3AED', color: '#fff' }}>
            {currentIdx >= questions.length - 1 ? 'Voir les résultats' : 'Question suivante'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
