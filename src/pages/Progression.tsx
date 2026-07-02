import { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, RadialLinearScale, Filler, ArcElement,
} from 'chart.js';
import { Line, Radar, Bar, Doughnut } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, Plus, Target, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Layout } from '../components/Layout';
import { Link, useNavigate } from 'react-router-dom';
import { ParachuteIcon } from '../components/ParachuteIcon';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, RadialLinearScale, Filler, ArcElement,
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface JumpProg {
  id: string;
  jump_id: string;
  note_globale: number | null;
  sortie_avion: string | null;
  retour_face_sol: string | null;
  vigilance_altitude: string | null;
  ouverture: string | null;
  separation: string | null;
  trajectoire: string | null;
  declenchement: string | null;
  pilotage_voile: string | null;
  circuit_atterro: string | null;
  precision_atterro: string | null;
  gestion_urgences: string | null;
  note_tete: number | null;
  note_bassin: number | null;
  note_jambes: number | null;
  note_bras: number | null;
  score_position: number | null;
  note_ouverture_voile: number | null;
  note_atterrissage: number | null;
  note_mental: number | null;
  precision_metres: number | null;
  exercices_chute: string | null;
  exercices_voile: string | null;
  observations_moniteur: string | null;
  created_at: string;
  sauts?: {
    date_saut: string;
    lieu: string;
    hauteur_m: number;
    statut: string;
    nature_saut: string;
    categorie: string;
  } | null;
}

interface SautRow {
  id: string;
  date_saut: string;
  lieu: string;
  hauteur_m: number;
  statut: string;
  nature_saut: string;
  categorie: string;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(arr: (number | null)[]): number {
  const valid = arr.filter((v): v is number => v !== null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function scoreColor(v: number): string {
  if (v === 0) return 'rgba(255,255,255,0.2)';
  if (v < 2) return '#EF4444';
  if (v < 3) return '#F59E0B';
  if (v < 4) return '#3B82F6';
  return '#10B981';
}

const TECH_ELEMENTS = [
  { key: 'sortie_avion', label: 'Sortie avion' },
  { key: 'retour_face_sol', label: 'Retour face sol' },
  { key: 'vigilance_altitude', label: 'Vigilance altitude' },
  { key: 'ouverture', label: 'Ouverture' },
  { key: 'separation', label: 'Séparation' },
  { key: 'trajectoire', label: 'Trajectoire' },
  { key: 'declenchement', label: 'Déclenchement' },
  { key: 'pilotage_voile', label: 'Pilotage voile' },
  { key: 'circuit_atterro', label: 'Circuit atterro' },
  { key: 'precision_atterro', label: 'Précision atterro' },
  { key: 'gestion_urgences', label: 'Gestion urgences' },
];

function techStatus(key: string, jumps: JumpProg[]): { status: 'maitrise' | 'en_cours' | 'non' | 'unevaluated'; pct: number } {
  const vals = jumps.slice(0, 10).map((d) => (d as any)[key]).filter(Boolean);
  if (!vals.length) return { status: 'unevaluated', pct: 0 };
  const m = vals.filter((v: string) => v === 'maitrise').length;
  const e = vals.filter((v: string) => v === 'en_cours').length;
  const n = vals.filter((v: string) => v === 'non').length;
  const total = m + e + n;
  if (m >= e && m >= n) return { status: 'maitrise', pct: (m / total) * 100 };
  if (e >= n) return { status: 'en_cours', pct: (e / total) * 100 };
  return { status: 'non', pct: (n / total) * 100 };
}

const STATUS_COLORS = { maitrise: '#10B981', en_cours: '#F59E0B', non: '#EF4444', unevaluated: 'rgba(255,255,255,0.15)' };
const STATUS_LABELS = { maitrise: 'Maîtrisé', en_cours: 'En cours', non: 'Non maîtrisé', unevaluated: 'Non évalué' };

// ─── Mini sparkline (inline SVG) ─────────────────────────────────────────────

function Sparkline({ data, color }: { data: (number | null)[]; color: string }) {
  const valid = data.filter((v): v is number => v !== null);
  if (valid.length < 2) return <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;
  const w = 80; const h = 32;
  const min = Math.min(...valid); const max = Math.max(...valid);
  const range = max - min || 1;
  const pts = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Score pill ───────────────────────────────────────────────────────────────

function ScorePill({ value }: { value: number | null }) {
  if (!value) return <span className="text-xs text-white/20">—</span>;
  const color = scoreColor(value);
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
      style={{ background: color }}>
      {value}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgBar({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-white mb-4">{children}</h2>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProgressionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progData, setProgData] = useState<JumpProg[]>([]);
  const [allSauts, setAllSauts] = useState<SautRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [histFilter, setHistFilter] = useState<'all' | 'evaluated' | 'unevaluated' | 'year'>('all');
  const [expandedAdvice, setExpandedAdvice] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: jpData }, { data: sautsData }] = await Promise.all([
        supabase
          .from('jump_progression')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('sauts')
          .select('id, date_saut, lieu, hauteur_m, statut, nature_saut, categorie, created_at, source')
          .eq('parachutiste_id', user.id)
          .eq('is_tunnel', false)
          .order('date_saut', { ascending: false })
          .limit(200),
      ]);
      // Fuse saut data into jump_progression rows client-side
      const sautMap: Record<string, SautRow> = {};
      (sautsData ?? []).forEach((s: SautRow) => { sautMap[s.id] = s; });
      const merged = (jpData ?? []).map((jp: JumpProg) => ({
        ...jp,
        sauts: sautMap[jp.jump_id] ?? null,
      }));
      setProgData(merged as JumpProg[]);
      setAllSauts((sautsData as SautRow[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const progById = useMemo(() => {
    const map: Record<string, JumpProg> = {};
    progData.forEach((p) => { map[p.jump_id] = p; });
    return map;
  }, [progData]);

  const evaluatedJumps = useMemo(() => progData.filter((d) => d.note_globale !== null), [progData]);
  const totalSauts = allSauts.length;
  const totalEvalued = evaluatedJumps.length;
  const evalRate = totalSauts > 0 ? (totalEvalued / totalSauts) * 100 : 0;

  // Trend: compare last 5 vs previous 5
  const last5 = evaluatedJumps.slice(0, 5).map((d) => d.note_globale!);
  const prev5 = evaluatedJumps.slice(5, 10).map((d) => d.note_globale!);
  const trendValue = last5.length >= 2 && prev5.length >= 2
    ? avg(last5) - avg(prev5)
    : null;

  // Global averages
  const noteGlobaleAvg = avg(evaluatedJumps.map((d) => d.note_globale));
  const noteOuvertureAvg = avg(evaluatedJumps.map((d) => d.note_ouverture_voile));
  const noteAtterroAvg = avg(evaluatedJumps.map((d) => d.note_atterrissage));
  const noteMentalAvg = avg(evaluatedJumps.map((d) => d.note_mental));
  const notePosAvg = avg(evaluatedJumps.map((d) => {
    const vals = [d.note_tete, d.note_bassin, d.note_jambes, d.note_bras].filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }));

  // Radar data
  const last20 = evaluatedJumps.slice(0, 20);
  const techAvg = TECH_ELEMENTS.map(({ key }) => {
    const vals = last20.map((d) => {
      const v = (d as any)[key];
      if (v === 'maitrise') return 5;
      if (v === 'en_cours') return 3;
      if (v === 'non') return 1;
      return null;
    });
    return avg(vals);
  });
  const techOverallAvg = techAvg.reduce((a, b) => a + b, 0) / techAvg.length || 0;

  const freqPerWeek = totalSauts / 52;
  const regulariteScore = Math.min(freqPerWeek * 5, 5);

  const radarValues = last20.length >= 3
    ? [
        avg(last20.map((d) => d.note_globale)),
        avg(last20.map((d) => d.note_ouverture_voile)),
        noteAtterroAvg > 0 ? noteAtterroAvg : avg(last20.map((d) => d.note_atterrissage)),
        avg(last20.map((d) => d.note_mental)),
        notePosAvg > 0 ? notePosAvg : techOverallAvg,
        regulariteScore,
      ]
    : [2.5, 2.5, 2.5, 2.5, 2.5, 2.5];

  const isGhostRadar = last20.length < 3;

  // Monthly bar chart (last 12 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      const count = allSauts.filter((s) => {
        const sd = new Date(s.date_saut);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      }).length;
      months.push({ label, count });
    }
    return months;
  }, [allSauts]);

  // Frequency stats
  const sauts365 = allSauts.filter((s) => {
    const d = new Date(s.date_saut);
    return d >= new Date(Date.now() - 365 * 24 * 3600 * 1000);
  }).length;
  const avgPerMonth = sauts365 / 12;
  const frequencyLabel = avgPerMonth < 2 ? 'Occasionnel' : avgPerMonth < 4 ? 'Régulier' : 'Assidu';
  const frequencyColor = avgPerMonth < 2 ? '#F59E0B' : avgPerMonth < 4 ? '#3B82F6' : '#10B981';

  // Best month
  const bestMonth = monthlyData.reduce((best, m) => m.count > best.count ? m : best, monthlyData[0]);

  // Precision moyenne
  const precisionVals = evaluatedJumps.filter((d) => d.precision_metres !== null).map((d) => d.precision_metres!);
  const precisionAvg = precisionVals.length ? avg(precisionVals) : null;

  // Exercise frequencies
  const chuteExMap: Record<string, number> = {};
  const voileExMap: Record<string, number> = {};
  progData.forEach((d) => {
    if (d.exercices_chute) d.exercices_chute.split(',').forEach((e) => { const t = e.trim(); if (t) chuteExMap[t] = (chuteExMap[t] || 0) + 1; });
    if (d.exercices_voile) d.exercices_voile.split(',').forEach((e) => { const t = e.trim(); if (t) voileExMap[t] = (voileExMap[t] || 0) + 1; });
  });
  const topChuteEx = Object.entries(chuteExMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topVoileEx = Object.entries(voileExMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Atterrissage distribution
  const atrrTypes = ['Debout propre', 'Debout instable', 'Roulé', 'Fessé', 'Chute'];
  const atterrCounts = evaluatedJumps.map((d) => {
    const v = d.note_atterrissage;
    if (v === 5) return 0;
    if (v === 4) return 1;
    if (v === 3) return 2;
    if (v === 2) return 3;
    return 4;
  }).reduce((acc: number[], i) => { acc[i]++; return acc; }, [0, 0, 0, 0, 0]);

  // Smart advice
  const adviceItems: string[] = [];
  if (evaluatedJumps.length > 0) {
    if (noteAtterroAvg > 0 && noteAtterroAvg < 3) adviceItems.push("Travaille ta précision d'atterrissage — vise le cible à chaque saut et note tes distances.");
    if (noteMentalAvg > 0 && noteMentalAvg < 3) adviceItems.push("Prends le temps de visualiser ton saut avant de monter en avion. La préparation mentale fait la différence.");
    if (noteOuvertureAvg > 0 && noteOuvertureAvg < 3) adviceItems.push("Vérifie ta position au déclenchement avec ton moniteur — une bonne symétrie évite les girations.");
    if (trendValue !== null && trendValue < -0.5) adviceItems.push("Ta progression marque le pas sur les derniers sauts. Parle-en à ton moniteur — un regard extérieur aide beaucoup.");
    if (avgPerMonth < 1) adviceItems.push("La régularité est clé : même un saut par mois maintient le fil. Planifie ta prochaine journée DZ !");
  }
  const mainAdvice = adviceItems[0] ?? null;

  // Weakness axis for advice heading
  const scoreMap: Record<string, number> = {
    'Note globale': noteGlobaleAvg,
    'Ouverture voile': noteOuvertureAvg,
    'Atterrissage': noteAtterroAvg,
    'Mental': noteMentalAvg,
  };
  const weakestAxis = Object.entries(scoreMap).filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;

  // Filtered history
  const filteredSauts = useMemo(() => {
    const yearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    return allSauts.filter((s) => {
      if (histFilter === 'evaluated') return !!progById[s.id];
      if (histFilter === 'unevaluated') return !progById[s.id];
      if (histFilter === 'year') return new Date(s.date_saut) >= yearAgo;
      return true;
    });
  }, [allSauts, progById, histFilter]);

  // ─── Chart configs ────────────────────────────────────────────────────────

  const chartJumps = [...evaluatedJumps].reverse();
  const lineChartData = {
    labels: chartJumps.map((_, i) => `S${i + 1}`),
    datasets: [
      {
        label: 'Note globale',
        data: chartJumps.map((d) => d.note_globale),
        borderColor: '#F97316',
        backgroundColor: 'rgba(249,115,22,0.08)',
        pointBackgroundColor: '#F97316',
        pointRadius: 3,
        tension: 0.35,
        fill: false,
      },
      {
        label: 'Atterrissage',
        data: chartJumps.map((d) => d.note_atterrissage),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        pointBackgroundColor: '#10B981',
        pointRadius: 3,
        tension: 0.35,
        fill: false,
      },
      {
        label: 'Mental',
        data: chartJumps.map((d) => d.note_mental),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59,130,246,0.08)',
        pointBackgroundColor: '#3B82F6',
        pointRadius: 3,
        tension: 0.35,
        fill: false,
      },
    ],
  };

  const lineOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: 'rgba(255,255,255,0.6)', font: { size: 11 } } },
      tooltip: { backgroundColor: 'rgba(0,26,77,0.95)', titleColor: '#fff', bodyColor: 'rgba(255,255,255,0.7)' },
    },
    scales: {
      y: { min: 0, max: 5, ticks: { color: 'rgba(255,255,255,0.4)', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.06)' } },
      x: { ticks: { color: 'rgba(255,255,255,0.3)', maxTicksLimit: 10 }, grid: { display: false } },
    },
  };

  const radarOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      r: {
        min: 0, max: 5,
        ticks: { display: false },
        pointLabels: { color: 'rgba(255,255,255,0.75)', font: { size: 11 } },
        grid: { color: 'rgba(255,255,255,0.08)' },
        angleLines: { color: 'rgba(255,255,255,0.06)' },
      },
    },
  };

  const radarData = {
    labels: ['Note globale', 'Ouverture voile', 'Atterrissage', 'Mental', 'Technique corps', 'Régularité'],
    datasets: [{
      label: 'Progression',
      data: radarValues,
      borderColor: isGhostRadar ? 'rgba(255,255,255,0.15)' : '#F97316',
      backgroundColor: isGhostRadar ? 'rgba(255,255,255,0.04)' : 'rgba(249,115,22,0.15)',
      pointBackgroundColor: isGhostRadar ? 'rgba(255,255,255,0.2)' : '#F97316',
      pointRadius: 4,
    }],
  };

  const barData = {
    labels: monthlyData.map((m) => m.label),
    datasets: [{
      label: 'Sauts',
      data: monthlyData.map((m) => m.count),
      backgroundColor: monthlyData.map((m) => m.count > 0 ? 'rgba(59,130,246,0.7)' : 'rgba(255,255,255,0.06)'),
      borderRadius: 4,
    }],
  };
  const barOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,26,77,0.95)', titleColor: '#fff', bodyColor: 'rgba(255,255,255,0.7)' } },
    scales: {
      y: { ticks: { color: 'rgba(255,255,255,0.4)', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.06)' } },
      x: { ticks: { color: 'rgba(255,255,255,0.3)' }, grid: { display: false } },
    },
  };

  const doughnutData = {
    labels: atrrTypes,
    datasets: [{
      data: atterrCounts,
      backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#EF4444'],
      borderWidth: 0,
    }],
  };
  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { position: 'bottom' as const, labels: { color: 'rgba(255,255,255,0.6)', font: { size: 10 }, boxWidth: 10 } } },
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!user) return null;

  return (
    <Layout>
      <div style={{ background: '#001A4D', minHeight: '100vh' }} className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── HEADER ────────────────────────────────────────────────────── */}
          <div>
            <Link to="/dashboard" className="text-sm font-medium no-underline flex items-center gap-1 mb-4 w-fit" style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F97316')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
              ← Tableau de bord
            </Link>
            <h1 className="text-4xl font-bold text-white mb-4">Ma Progression</h1>

            {/* Counters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="px-3 py-1.5 rounded-full text-sm font-semibold" style={{ background: 'rgba(59,130,246,0.2)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.3)' }}>
                {totalSauts} saut{totalSauts !== 1 ? 's' : ''} enregistré{totalSauts !== 1 ? 's' : ''}
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm font-semibold"
                style={totalEvalued > 0
                  ? { background: 'rgba(16,185,129,0.2)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)' }
                  : { background: 'rgba(249,115,22,0.15)', color: '#FCD34D', border: '1px solid rgba(249,115,22,0.3)' }}>
                {totalEvalued > 0 ? `${totalEvalued} saut${totalEvalued !== 1 ? 's' : ''} évalué${totalEvalued !== 1 ? 's' : ''}` : '0 évalué'}
              </span>
              {trendValue !== null && (
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5"
                  style={trendValue >= 0
                    ? { background: 'rgba(16,185,129,0.2)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)' }
                    : { background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {trendValue >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {trendValue >= 0 ? `+${trendValue.toFixed(1)}` : trendValue.toFixed(1)} vs 10 derniers
                </span>
              )}
            </div>

            {/* Eval rate bar */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>Taux d'évaluation de tes sauts</span>
                <span className="text-xs font-bold text-white">{evalRate.toFixed(0)} %</span>
              </div>
              <ProgBar value={evalRate} max={100} color="#10B981" />
              {totalEvalued === 0 && (
                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Évalue tes sauts pour affiner ta progression — dans "Ajouter un saut", remplis la section Évaluation.
                </p>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
            </div>
          )}

          {!loading && (
            <>
              {/* ── EMPTY STATE when 0 sauts ───────────────────────────── */}
              {totalSauts === 0 && (
                <div className="rounded-2xl p-10 text-center" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex justify-center mb-4 opacity-40"><ParachuteIcon className="w-14 h-14 text-white" /></div>
                  <h2 className="text-xl font-bold text-white mb-2">Aucun saut enregistré</h2>
                  <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Ajoute ton premier saut pour commencer à suivre ta progression.</p>
                  <button onClick={() => navigate('/dashboard?action=add-jump')} className="px-6 py-3 rounded-xl text-sm font-bold text-white transition" style={{ background: '#F97316' }}>
                    + Ajouter un saut
                  </button>
                </div>
              )}

              {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
              {totalSauts > 0 && (
                <div className="space-y-8">

                  {/* ── SECTION 1 — NOTE GLOBALE & TENDANCE ─────────────── */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Note globale card */}
                    <div className="rounded-2xl p-6" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Note globale moyenne</p>
                      {noteGlobaleAvg > 0 ? (
                        <>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-5xl font-bold text-white">{noteGlobaleAvg.toFixed(1)}</span>
                            <span className="text-lg" style={{ color: 'rgba(255,255,255,0.35)' }}>/5</span>
                          </div>
                          <div className="flex gap-0.5 mb-3">
                            {[1,2,3,4,5].map((n) => (
                              <span key={n} style={{ fontSize: 20, color: n <= Math.round(noteGlobaleAvg) ? '#F97316' : 'rgba(255,255,255,0.12)' }}>★</span>
                            ))}
                          </div>
                          <div className="mt-2">
                            <Sparkline data={chartJumps.map((d) => d.note_globale)} color="#F97316" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-28 gap-3">
                          <span className="text-4xl font-bold" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
                          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>Évalue ton prochain saut pour commencer</p>
                        </div>
                      )}
                    </div>

                    {/* Score breakdown */}
                    <div className="rounded-2xl p-6" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Détail des scores</p>
                      <div className="space-y-3">
                        {[
                          { label: 'Ouverture voile', value: noteOuvertureAvg, color: '#3B82F6' },
                          { label: 'Atterrissage', value: noteAtterroAvg, color: '#10B981' },
                          { label: 'Mental', value: noteMentalAvg, color: '#8B5CF6' },
                          { label: 'Position corps', value: notePosAvg, color: '#F59E0B' },
                        ].map(({ label, value, color }) => (
                          <div key={label}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                              <span className="text-xs font-bold" style={{ color: value > 0 ? color : 'rgba(255,255,255,0.2)' }}>
                                {value > 0 ? `${value.toFixed(1)}/5` : '—'}
                              </span>
                            </div>
                            <ProgBar value={value} max={5} color={value > 0 ? color : 'rgba(255,255,255,0.06)'} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Radar */}
                    <div className="rounded-2xl p-6 relative" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Profil de compétences</p>
                      {isGhostRadar && (
                        <p className="text-xs mb-2 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Ton radar apparaîtra après 3 sauts évalués
                        </p>
                      )}
                      <Radar data={radarData} options={radarOpts} />
                    </div>
                  </div>

                  {/* ── SECTION 2 — COURBE DE PROGRESSION ──────────────── */}
                  {evaluatedJumps.length >= 2 && (
                    <div className="rounded-2xl p-6" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <SectionTitle>Courbe de progression</SectionTitle>
                      <Line data={lineChartData} options={lineOpts} />
                    </div>
                  )}

                  {/* ── SECTION 3 — 3 CATEGORY CARDS ───────────────────── */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Chute libre */}
                    <div className="rounded-2xl p-5 space-y-4" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🪂</span>
                        <h3 className="font-bold text-white text-sm">Chute libre</h3>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Éléments techniques maîtrisés</span>
                          <span className="text-xs font-bold text-white">
                            {TECH_ELEMENTS.filter(({ key }) => techStatus(key, evaluatedJumps).status === 'maitrise').length}/{TECH_ELEMENTS.length}
                          </span>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          {TECH_ELEMENTS.map(({ key, label }) => {
                            const { status } = techStatus(key, evaluatedJumps);
                            const color = STATUS_COLORS[status];
                            const icon = status === 'maitrise' ? '✓' : status === 'en_cours' ? '~' : status === 'non' ? '✗' : '·';
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-xs font-bold w-4 text-center" style={{ color }}>{icon}</span>
                                <span className="text-xs flex-1" style={{ color: status === 'unevaluated' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)' }}>{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {topChuteEx.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Exercices pratiqués</p>
                          <div className="flex flex-wrap gap-1.5">
                            {topChuteEx.map(([ex, count]) => (
                              <span key={ex} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ background: 'rgba(249,115,22,0.15)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.25)' }}>
                                {ex} ×{count}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {TECH_ELEMENTS.every(({ key }) => techStatus(key, evaluatedJumps).status === 'unevaluated') && (
                        <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Aucun élément technique évalué pour l'instant
                        </p>
                      )}
                    </div>

                    {/* Voile & Atterrissage */}
                    <div className="rounded-2xl p-5 space-y-4" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎯</span>
                        <h3 className="font-bold text-white text-sm">Voile & Atterrissage</h3>
                      </div>

                      <div className="space-y-3">
                        {[
                          { label: 'Ouverture voile', value: noteOuvertureAvg, color: '#3B82F6' },
                          { label: 'Atterrissage', value: noteAtterroAvg, color: '#10B981' },
                        ].map(({ label, value, color }) => (
                          <div key={label}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                              <span className="text-xs font-bold" style={{ color: value > 0 ? color : 'rgba(255,255,255,0.2)' }}>
                                {value > 0 ? `${value.toFixed(1)}/5` : '—'}
                              </span>
                            </div>
                            <ProgBar value={value} max={5} color={value > 0 ? color : 'rgba(255,255,255,0.06)'} />
                          </div>
                        ))}
                      </div>

                      {evaluatedJumps.filter((d) => d.note_atterrissage !== null).length >= 3 ? (
                        <div>
                          <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Types d'atterrissage</p>
                          <Doughnut data={doughnutData} options={doughnutOpts} />
                        </div>
                      ) : (
                        <p className="text-xs text-center py-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Évalue 3 sauts pour voir la répartition
                        </p>
                      )}

                      {precisionAvg !== null ? (
                        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Précision moyenne</p>
                          <p className="text-2xl font-bold text-green-400">{precisionAvg.toFixed(0)} m</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>du cible · objectif &lt; 5 m</p>
                        </div>
                      ) : (
                        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>Pas de données de précision</p>
                      )}

                      {topVoileEx.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Exercices sous voile</p>
                          <div className="flex flex-wrap gap-1.5">
                            {topVoileEx.map(([ex, count]) => (
                              <span key={ex} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ background: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.25)' }}>
                                {ex} ×{count}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mental & Régularité */}
                    <div className="rounded-2xl p-5 space-y-4" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🧠</span>
                        <h3 className="font-bold text-white text-sm">Mental & Régularité</h3>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Mental / Gestion stress</span>
                          <span className="text-xs font-bold" style={{ color: noteMentalAvg > 0 ? '#8B5CF6' : 'rgba(255,255,255,0.2)' }}>
                            {noteMentalAvg > 0 ? `${noteMentalAvg.toFixed(1)}/5` : '—'}
                          </span>
                        </div>
                        <ProgBar value={noteMentalAvg} max={5} color={noteMentalAvg > 0 ? '#8B5CF6' : 'rgba(255,255,255,0.06)'} />
                      </div>

                      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Fréquence de saut</p>
                        <p className="text-xl font-bold text-white">{avgPerMonth.toFixed(1)} <span className="text-sm font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>sauts/mois</span></p>
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${frequencyColor}25`, color: frequencyColor, border: `1px solid ${frequencyColor}40` }}>
                          {frequencyLabel}
                        </span>
                      </div>

                      {bestMonth?.count > 0 && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          <span>Meilleur mois :</span>
                          <span className="font-bold text-white">{bestMonth.label}</span>
                          <span>— {bestMonth.count} saut{bestMonth.count > 1 ? 's' : ''}</span>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Sauts par mois (12 derniers)</p>
                        <Bar data={barData} options={barOpts} />
                      </div>
                    </div>
                  </div>

                  {/* ── SECTION 4 — HISTORIQUE ──────────────────────────── */}
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <h2 className="font-bold text-white">Historique des sauts</h2>
                      <div className="flex gap-2 flex-wrap">
                        {(['all', 'evaluated', 'unevaluated', 'year'] as const).map((f) => (
                          <button key={f} onClick={() => setHistFilter(f)}
                            className="px-3 py-1 rounded-full text-xs font-semibold transition"
                            style={histFilter === f
                              ? { background: '#F97316', color: '#fff' }
                              : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}>
                            {{ all: 'Tous', evaluated: 'Évalués', unevaluated: 'Non évalués', year: 'Cette année' }[f]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mobile: cards */}
                    <div className="block md:hidden divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      {filteredSauts.slice(0, 30).map((s) => {
                        const prog = progById[s.id];
                        return (
                          <div key={s.id} className="px-4 py-3" style={{ opacity: prog ? 1 : 0.6 }}>
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{s.lieu}</p>
                                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(s.date_saut).toLocaleDateString('fr-FR')}</p>
                              </div>
                              {prog ? (
                                <div className="flex gap-1.5 flex-shrink-0">
                                  {prog.note_globale && <ScorePill value={prog.note_globale} />}
                                  {prog.note_atterrissage && <ScorePill value={prog.note_atterrissage} />}
                                </div>
                              ) : (
                                <button onClick={() => navigate('/dashboard?action=add-jump')}
                                  className="text-xs font-semibold px-2 py-1 rounded-lg"
                                  style={{ background: 'rgba(249,115,22,0.15)', color: '#FB923C' }}>
                                  Évaluer →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                            {['Date', 'Lieu', 'Note', 'Chute', 'Voile', 'Atterro', 'Mental', 'Exercices'].map((h) => (
                              <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>{h}</th>
                            ))}
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSauts.slice(0, 50).map((s, i) => {
                            const prog = progById[s.id];
                            const exChips = prog?.exercices_chute?.split(',').map((e) => e.trim()).filter(Boolean).slice(0, 2) ?? [];
                            return (
                              <tr key={s.id} className="transition-colors" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none', opacity: prog ? 1 : 0.55 }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                  {new Date(s.date_saut).toLocaleDateString('fr-FR')}
                                </td>
                                <td className="px-4 py-3 text-xs font-medium text-white max-w-[140px] truncate">{s.lieu}</td>
                                <td className="px-4 py-3"><ScorePill value={prog?.note_globale ?? null} /></td>
                                <td className="px-4 py-3">
                                  {prog?.score_position
                                    ? <ScorePill value={Math.round(prog.score_position)} />
                                    : <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                                </td>
                                <td className="px-4 py-3"><ScorePill value={prog?.note_ouverture_voile ?? null} /></td>
                                <td className="px-4 py-3"><ScorePill value={prog?.note_atterrissage ?? null} /></td>
                                <td className="px-4 py-3"><ScorePill value={prog?.note_mental ?? null} /></td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1 flex-wrap">
                                    {exChips.map((ex) => (
                                      <span key={ex} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                                        {ex}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {!prog && (
                                    <button onClick={() => navigate('/dashboard?action=add-jump')}
                                      className="text-[11px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
                                      style={{ background: 'rgba(249,115,22,0.15)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.2)' }}>
                                      Évaluer →
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── SECTION 5 — CONSEIL & OBJECTIFS ─────────────────── */}
                  {(mainAdvice || evaluatedJumps.length > 0) && (
                    <div className="rounded-2xl p-6" style={{ background: '#112240', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="w-5 h-5 text-amber-400" />
                        <h2 className="font-bold text-white">Conseil ParaPass</h2>
                        {adviceItems.length > 1 && (
                          <button onClick={() => setExpandedAdvice((v) => !v)} className="ml-auto p-1 rounded-lg transition" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {expandedAdvice ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {mainAdvice ? (
                        <>
                          <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <Target className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              {weakestAxis && (
                                <p className="text-xs font-semibold text-amber-400 mb-1">Concentre-toi sur : {weakestAxis}</p>
                              )}
                              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{mainAdvice}</p>
                            </div>
                          </div>
                          {expandedAdvice && adviceItems.slice(1).map((tip, i) => (
                            <div key={i} className="mt-3 flex items-start gap-3 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <Target className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
                              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{tip}</p>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            Tes scores sont homogènes. Continue d'évaluer tes sauts pour obtenir des conseils personnalisés.
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button onClick={() => navigate('/dashboard?action=add-jump')}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                          style={{ background: '#F97316' }}>
                          <Plus className="w-4 h-4" /> Ajouter un saut évalué
                        </button>
                        <Link to="/dashboard?tab=carnet"
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white no-underline transition"
                          style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)' }}>
                          Voir mon carnet
                        </Link>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
