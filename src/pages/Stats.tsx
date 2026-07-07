import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { useAuth } from '../lib/auth';
import { Layout } from '../components/Layout';
import { ParachuteDropIcon, AltitudeIcon } from '../components/ParachuteIcon';
import type { Saut } from '../lib/types';
import { Calendar, Trophy, MapPin, Target, TrendingUp, Wind } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const JALONS = [10, 25, 50, 100, 200, 300, 500, 1000, 2000, 5000, 10000];

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const CAT_COLORS = ['#001A4D', '#2563eb', '#16a34a', '#d97706', '#dc2626'];

interface StatsPageProps { sauts: Saut[]; }

export function StatsPage({ sauts }: StatsPageProps) {
  const { profile } = useAuth();

  const stats = useMemo(() => {
    if (sauts.length === 0) return null;
    const now = new Date();
    const thisYear = now.getFullYear();

    const sorted = [...sauts].sort((a, b) => a.date_saut.localeCompare(b.date_saut));

    // Chiffres clés
    const total = sauts.length;
    const totalMinutes = 0;
    const thisYearCount = sauts.filter((s) => new Date(s.date_saut).getFullYear() === thisYear).length;
    const altitudes = sauts.map((s) => s.hauteur_m).filter(Boolean);
    const altMoyenne = altitudes.length > 0 ? Math.round(altitudes.reduce((a, b) => a + b, 0) / altitudes.length) : 0;
    const altMax = altitudes.length > 0 ? Math.max(...altitudes) : 0;

    // Ouverture altitudes
    const ouvertures = sauts.map((s) => s.hauteur_ouverture).filter((v): v is number => typeof v === 'number' && v > 0);
    const ouvertureMoyenne = ouvertures.length > 0 ? Math.round(ouvertures.reduce((a, b) => a + b, 0) / ouvertures.length) : 0;

    // Altitude de chute libre moyenne (m) = altitude largage - altitude ouverture
    const sautsAvecDual = sauts.filter((s) => s.hauteur_m > 0 && s.hauteur_ouverture && s.hauteur_ouverture > 0 && s.hauteur_m > s.hauteur_ouverture!);
    const chuteLibreMoyenne = sautsAvecDual.length > 0
      ? Math.round(sautsAvecDual.reduce((acc, s) => acc + (s.hauteur_m - s.hauteur_ouverture!), 0) / sautsAvecDual.length)
      : 0;

    // Dropzone préférée
    const byLieu = sauts.reduce<Record<string, number>>((acc, s) => { acc[s.lieu] = (acc[s.lieu] ?? 0) + 1; return acc; }, {});
    const sortedLieux = Object.entries(byLieu).sort((a, b) => b[1] - a[1]);
    const dropzoneFav = sortedLieux[0]?.[0] ?? '—';

    // Graphique 12 derniers mois
    const months12: number[] = [];
    const labels12: string[] = [];
    const avgLargage12: (number | null)[] = [];
    const avgOuverture12: (number | null)[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels12.push(MONTHS_FR[d.getMonth()]);
      const monthSauts = sauts.filter((s) => {
        const sd = new Date(s.date_saut);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      });
      months12.push(monthSauts.length);
      const largs = monthSauts.map((s) => s.hauteur_m).filter(Boolean);
      avgLargage12.push(largs.length > 0 ? Math.round(largs.reduce((a, b) => a + b, 0) / largs.length) : null);
      const ouv = monthSauts.map((s) => s.hauteur_ouverture).filter((v): v is number => typeof v === 'number' && v > 0);
      avgOuverture12.push(ouv.length > 0 ? Math.round(ouv.reduce((a, b) => a + b, 0) / ouv.length) : null);
    }

    // Camembert catégories
    const cats = ['OA', 'OC', 'OR30', 'OR60', 'OR60plus'];
    const catCounts = cats.map((c) => sauts.filter((s) => s.categorie === c).length);
    const catLabels = ['OA', 'OC', 'OR<30"', 'OR<60"', 'OR>60"'];

    // Records
    const altMaxSaut = sauts.find((s) => s.hauteur_m === altMax);
    const tempsMax = 0;
    const tempsMaxSaut = null;

    const byMonth = sauts.reduce<Record<string, number>>((acc, s) => {
      const key = s.date_saut.substring(0, 7);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const bestMonthKey = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];

    // Prochain jalons
    const nextJalon = JALONS.find((j) => j > total) ?? JALONS[JALONS.length - 1];
    const prevJalon = JALONS.filter((j) => j <= total).pop() ?? 0;

    return {
      total, totalMinutes, thisYearCount, altMoyenne, altMax, dropzoneFav,
      labels12, months12, avgLargage12, avgOuverture12, catLabels, catCounts,
      sortedLieux, altMaxSaut, tempsMax, tempsMaxSaut, bestMonthKey,
      nextJalon, prevJalon, sorted, ouvertureMoyenne, chuteLibreMoyenne, sautsAvecDual,
    };
  }, [sauts]);

  if (!profile) return null;

  if (!stats) {
    return (
      <Layout>
        <div className="min-h-screen max-w-4xl mx-auto px-4 py-16 text-center" style={{ background: '#001A4D', color: '#FFFFFF' }}>
          <ParachuteDropIcon className="w-48 h-48 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Aucun saut enregistré pour le moment.</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Commencez à enregistrer vos sauts pour voir vos statistiques.</p>
        </div>
      </Layout>
    );
  }

  const lineData = {
    labels: stats.labels12,
    datasets: [{
      label: 'Sauts / mois',
      data: stats.months12,
      borderColor: '#001A4D',
      backgroundColor: 'rgba(26,39,68,0.08)',
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#F97316',
      pointRadius: 4,
      pointHoverRadius: 6,
    }],
  };

  const altLineData = {
    labels: stats.labels12,
    datasets: [
      {
        label: 'Largage moy. (m)',
        data: stats.avgLargage12,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.08)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointBackgroundColor: '#2563eb',
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      },
      {
        label: 'Ouverture moy. (m)',
        data: stats.avgOuverture12,
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22,163,74,0.08)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointBackgroundColor: '#16a34a',
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      },
    ],
  };

  const altLineOptions = {
    responsive: true,
    plugins: {
      legend: { display: true, position: 'bottom' as const, labels: { color: 'rgba(255,255,255,0.5)', font: { size: 11 }, padding: 12 } },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: { color: 'rgba(255,255,255,0.5)', callback: (v: number | string) => `${v}m` },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
      x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } },
    },
  };

  const lineOptions = {
    responsive: true,
    plugins: { legend: { display: false, labels: { color: 'rgba(255,255,255,0.5)' } } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: 'rgba(255,255,255,0.5)' },
        grid: { color: 'rgba(255,255,255,0.06)' }
      },
      x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } },
    },
  };

  const doughnutData = {
    labels: stats.catLabels,
    datasets: [{
      data: stats.catCounts,
      backgroundColor: CAT_COLORS,
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' as const, labels: { padding: 12, font: { size: 11 }, color: 'rgba(255,255,255,0.5)' } },
    },
    cutout: '60%',
  };

  const jalonPct = stats.nextJalon > stats.prevJalon
    ? Math.round(((stats.total - stats.prevJalon) / (stats.nextJalon - stats.prevJalon)) * 100)
    : 100;

  return (
    <Layout>
      <div className="min-h-screen max-w-4xl mx-auto px-4 py-6 space-y-6" style={{ background: '#001A4D' }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>Mes Statistiques</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Vue d'ensemble de votre activité parachutisme</p>
        </div>

        {/* ─── Chiffres clés ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Total sauts', value: stats.total.toString(), icon: <ParachuteDropIcon className="w-10 h-10 text-orange-600" />, bg: 'bg-orange-50' },
            { label: 'Cette année', value: stats.thisYearCount.toString(), icon: <Calendar className="w-5 h-5 text-green-600" />, bg: 'bg-green-50' },
            { label: 'Altitude moyenne', value: `${stats.altMoyenne.toLocaleString('fr-FR')} m`, icon: <AltitudeIcon className="w-10 h-10 text-sky-600" />, bg: 'bg-sky-50' },
            { label: 'Altitude record', value: `${stats.altMax.toLocaleString('fr-FR')} m`, icon: <Trophy className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50' },
            { label: 'Dropzone préférée', value: stats.dropzoneFav, icon: <MapPin className="w-5 h-5 text-red-500" />, bg: 'bg-red-50' },
            ...(stats.chuteLibreMoyenne > 0 ? [{ label: 'Chute libre moy.', value: `${stats.chuteLibreMoyenne.toLocaleString('fr-FR')} m`, icon: <TrendingUp className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-50', subtitle: undefined as string | undefined }] : []),
            ...(() => {
              const souffs = sauts.filter((s) => s.source === 'soufflerie');
              const nbSess = souffs.length;
              const totalMin = souffs.reduce((acc, s) => acc + ((s as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes ?? 0), 0);
              const valStr = totalMin === 0 ? '—' : totalMin < 60 ? `${totalMin} min` : `${Math.floor(totalMin / 60)} h${totalMin % 60 > 0 ? ` ${totalMin % 60}` : ''}`;
              return nbSess > 0 ? [{ label: 'Soufflerie', value: valStr, icon: <Wind className="w-5 h-5 text-blue-400" />, bg: 'bg-blue-50', subtitle: `${nbSess} session${nbSess > 1 ? 's' : ''}` as string | undefined }] : [];
            })(),
          ].map((item) => (
            <div key={item.label} className="rounded-xl p-4 shadow-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.label}</p>
                <div className={`w-8 h-8 ${item.bg} rounded-lg flex items-center justify-center`}>{item.icon}</div>
              </div>
              <p className="text-xl font-bold leading-tight truncate" style={{ color: '#FFFFFF' }}>{item.value}</p>
              {'subtitle' in item && item.subtitle && (
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.subtitle}</p>
              )}
            </div>
          ))}
        </div>

        {/* ─── Prochain jalon ────────────────────────────────────────────────── */}
        <div className="bg-[#001A4D] rounded-xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
            <ParachuteDropIcon className="w-72 h-72 text-white" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-orange-400">Prochain palier</span>
          </div>
          <p className="text-2xl font-bold mb-3">
            {stats.total} <span className="text-white/50 text-base">/ {stats.nextJalon} sauts</span>
          </p>
          <div className="w-full bg-white/20 rounded-full h-2.5 mb-2">
            <div className="bg-orange-500 h-2.5 rounded-full transition-all" style={{ width: `${jalonPct}%` }} />
          </div>
          <p className="text-sm text-blue-200">
            Encore <strong className="text-white">{stats.nextJalon - stats.total}</strong> saut{stats.nextJalon - stats.total > 1 ? 's' : ''} pour atteindre {stats.nextJalon} !
          </p>
        </div>

        {/* ─── Graphiques ───────────────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-5 shadow-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
              <h2 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Sauts sur 12 mois</h2>
            </div>
            <Line data={lineData} options={lineOptions} />
          </div>
          <div className="rounded-xl p-5 shadow-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
              <h2 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Répartition par catégorie</h2>
            </div>
            {stats.catCounts.some((c) => c > 0) ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <p className="text-center text-sm py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune donnée de catégorie</p>
            )}
          </div>
        </div>

        {/* ─── Altitudes largage / ouverture ────────────────────────────────── */}
        {stats.sautsAvecDual.length > 0 && (
          <div className="rounded-xl p-5 shadow-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-2 mb-4">
              <AltitudeIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
              <h2 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Altitudes moyennes (largage vs ouverture)</h2>
            </div>
            <Line data={altLineData} options={altLineOptions} />
          </div>
        )}

        {/* ─── Carte des dropzones ───────────────────────────────────────────── */}
        <div className="rounded-xl p-5 shadow-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Dropzones fréquentées</h2>
          </div>
          <div className="space-y-3">
            {stats.sortedLieux.slice(0, 10).map(([lieu, count]) => (
              <div key={lieu}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium truncate" style={{ color: '#FFFFFF' }}>{lieu}</span>
                  <span className="font-mono ml-2 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>{count} saut{count > 1 ? 's' : ''}</span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${Math.round((count / stats.total) * 100)}%`, background: '#F59E0B' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Records personnels ────────────────────────────────────────────── */}
        <div className="rounded-xl p-5 shadow-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Records personnels</h2>
          </div>
          <div className="space-y-3">
            {stats.altMaxSaut && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Altitude record</span>
                <span className="font-semibold" style={{ color: '#FFFFFF' }}>
                  {stats.altMax.toLocaleString('fr-FR')} m — {new Date(stats.altMaxSaut.date_saut).toLocaleDateString('fr-FR')}, {stats.altMaxSaut.lieu}
                </span>
              </div>
            )}
            {stats.tempsMaxSaut && stats.tempsMax > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Chute la plus longue</span>
                <span className="font-semibold" style={{ color: '#FFFFFF' }}>
                  {stats.tempsMax} min — {new Date(stats.tempsMaxSaut.date_saut).toLocaleDateString('fr-FR')}, {stats.tempsMaxSaut.lieu}
                </span>
              </div>
            )}
            {stats.bestMonthKey && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Meilleur mois</span>
                <span className="font-semibold" style={{ color: '#FFFFFF' }}>
                  {stats.bestMonthKey[1]} saut{stats.bestMonthKey[1] > 1 ? 's' : ''} en {MONTHS_FR[parseInt(stats.bestMonthKey[0].split('-')[1]) - 1]} {stats.bestMonthKey[0].split('-')[0]}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
