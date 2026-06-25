import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ParaDemoProvider, useParaDemo, DemoBanner, useGlobalDemo } from '../../lib/DemoContext';
import { ParachuteIcon } from '../../components/ParachuteIcon';
import { ParaPassLogo } from '../../components/ParaPassLogo';
import type { Saut, NotationTernaire } from '../../lib/types';
import { NATURE_SAUT_LABELS, CATEGORIE_LABELS, FONCTION_LABELS } from '../../lib/types';
import { DEMO_PARACHUTISTE_PROGRESSION } from '../../data/demoData';
import {
  Plus, FileDown, QrCode, TrendingUp, ChevronRight, ShieldCheck,
  Hash, X, ChevronLeft, Zap, Wind, Sun, Cloud, CloudRain, Thermometer,
  Award,
} from 'lucide-react';

type DashTab = 'accueil' | 'carnet' | 'planning';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAR_COLORS = ['', '#EF4444', '#F59E0B', '#EAB308', '#84CC16', '#10B981'];

function MiniStars({ value }: { value: number | null }) {
  if (!value) return <span style={{ color: 'rgba(255,255,255,0.3)' }} className="text-xs">—</span>;
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="w-3 h-3 rounded-sm inline-block"
          style={{ background: n <= value ? STAR_COLORS[value] : 'rgba(255,255,255,0.1)' }} />
      ))}
    </span>
  );
}

function noteColor(n: number | null): string {
  if (n === null) return '#64748B';
  if (n < 2.5) return '#EF4444';
  if (n < 3.5) return '#F59E0B';
  return '#10B981';
}

interface KpiCardProps {
  accent: string;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  barPct?: number;
  barColor?: string;
}

function KpiCard({ accent, label, value, sub, barPct, barColor }: KpiCardProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      borderLeft: `3px solid ${accent}`,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      padding: 20,
    }}>
      <p style={{ color: '#7A9CC0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 500 }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {barPct !== undefined && (
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', margin: '10px 0 6px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${barPct}%`, background: barColor ?? '#10B981', borderRadius: 3 }} />
        </div>
      )}
      <p style={{ color: '#7A9CC0', fontSize: 12, marginTop: barPct !== undefined ? 0 : 6 }}>{sub}</p>
    </div>
  );
}

function statutBadge(saut: Saut): React.ReactNode {
  if (saut.statut === 'valide') {
    const nom = saut.valide_par ? saut.valide_par.split(' ').pop() : '';
    return (
      <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }} className="inline-flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" />{nom || 'Validé'}
      </span>
    );
  }
  if (saut.statut === 'en_attente') {
    return (
      <span style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
        En attente
      </span>
    );
  }
  return null;
}

// ─── Demo action toast ────────────────────────────────────────────────────────

function DemoToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[10000] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white"
      style={{ transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#F97316,#EA580C)', animation: 'fadeInUp 0.25s ease' }}
    >
      <Zap className="w-4 h-4 flex-shrink-0" />
      Action désactivée en mode démo — créez un compte pour sauvegarder
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}

// ─── Saut Detail Modal ────────────────────────────────────────────────────────

const TERNAIRE_CONFIG = {
  a_retravailler: { label: 'À retravailler', cls: 'bg-red-100 text-red-700 border-red-200' },
  correct: { label: 'Correct', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  bon: { label: 'Bon', cls: 'bg-green-100 text-green-700 border-green-200' },
};

function SautDetailModal({ saut, onClose }: { saut: Saut; onClose: () => void }) {
  const posFields: { label: string; key: keyof Saut }[] = [
    { label: 'Tête', key: 'position_tete' }, { label: 'Bassin', key: 'position_bassin' },
    { label: 'Jambes', key: 'position_jambes' }, { label: 'Bras', key: 'position_bras' },
  ];
  const ternaireFields: { label: string; key: keyof Saut }[] = [
    { label: 'Sortie avion', key: 'sortie_avion' }, { label: 'Retour face sol', key: 'retour_face_sol' },
    { label: 'Vigilance altitude', key: 'vigilance_altitude' }, { label: 'Ouverture', key: 'ouverture_notes' },
  ];
  const hashShort = saut.validation_hash ? saut.validation_hash.substring(0, 16) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.15)' }} className="rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }} className="flex items-center justify-between p-5">
          <div>
            <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-medium uppercase tracking-wide">Détail du saut</p>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {new Date(saut.date_saut).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/50"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Lieu / DZ', value: saut.lieu }, { label: 'Aéronef', value: saut.aeronef_immat },
              { label: 'Nature', value: NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut },
              { label: 'Catégorie', value: CATEGORIE_LABELS[saut.categorie] || saut.categorie },
              { label: 'Hauteur', value: `${saut.hauteur_m} m` }, { label: 'Fonction', value: FONCTION_LABELS[saut.fonction] || saut.fonction },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} className="p-3">
                <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-white">{value || '—'}</p>
              </div>
            ))}
          </div>
          {posFields.some((f) => saut[f.key] !== null) && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-semibold uppercase tracking-wide mb-2">Notation position</p>
              <div className="grid grid-cols-2 gap-2">
                {posFields.map(({ label, key }) => (
                  <div key={key} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} className="p-3 flex items-center justify-between">
                    <span style={{ color: 'rgba(255,255,255,0.5)' }} className="text-xs">{label}</span>
                    <MiniStars value={saut[key] as number | null} />
                  </div>
                ))}
                {saut.position_globale !== null && (
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} className="col-span-2 p-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Position globale</span>
                    <MiniStars value={saut.position_globale} />
                  </div>
                )}
              </div>
            </div>
          )}
          {ternaireFields.some((f) => saut[f.key] !== null) && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-semibold uppercase tracking-wide mb-2">Observations techniques</p>
              <div className="grid grid-cols-2 gap-2">
                {ternaireFields.map(({ label, key }) => {
                  const val = saut[key] as NotationTernaire;
                  if (!val) return null;
                  const cfg = TERNAIRE_CONFIG[val];
                  return (
                    <div key={key} className={`rounded-xl p-3 border ${cfg.cls}`}>
                      <p className="text-xs mb-0.5 opacity-70">{label}</p>
                      <p className="text-xs font-bold">{cfg.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {saut.observations_moniteur && (
            <div style={{ background: 'rgba(59,130,246,0.12)' }} className="rounded-xl p-3">
              <p style={{ color: 'rgba(59,130,246,0.8)' }} className="text-xs mb-0.5">Observations moniteur</p>
              <p className="text-sm text-white">{saut.observations_moniteur}</p>
            </div>
          )}
          {hashShort && (
            <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }} className="rounded-xl p-3 flex items-center gap-3">
              <div style={{ background: 'rgba(16,185,129,0.2)' }} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                <Hash className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-green-400">Saut certifié cryptographiquement</p>
                <p className="text-xs text-green-400 font-mono mt-0.5">{hashShort}…</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Conversion modal ─────────────────────────────────────────────────────────

function ConversionModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.15)' }} className="rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white/60"><X className="w-5 h-5" /></button>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.15)' }}>
          <ParachuteIcon className="w-8 h-8 text-orange-400" />
        </div>
        <h2 className="text-lg font-bold text-white text-center mb-2">{title}</h2>
        <p className="text-sm text-center mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Cette fonctionnalité est disponible avec un compte ParaPass. Inscrivez-vous gratuitement.
        </p>
        <div className="flex flex-col gap-3">
          <Link to="/register" className="w-full text-center text-white font-bold py-3 rounded-xl transition block" style={{ background: '#F97316' }}>
            Créer mon compte gratuit
          </Link>
          <button onClick={onClose} className="text-sm text-center transition" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Continuer la démo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Progression Card ─────────────────────────────────────────────────────────

function DemoProgressionCard({ onShowConversion }: { onShowConversion: (t: string) => void }) {
  const prog = DEMO_PARACHUTISTE_PROGRESSION;
  const kpis = [
    {
      label: 'Note globale',
      value: `${prog.note_globale.toFixed(1)} ★`,
      color: noteColor(prog.note_globale),
      sub: '↑ En hausse',
      subColor: '#10B981',
    },
    {
      label: 'Position corps',
      value: `${prog.position_corps.toFixed(1)} / 5`,
      color: noteColor(prog.position_corps),
      sub: 'Tête · Bassin · Jambes · Bras',
      subColor: 'rgba(255,255,255,0.35)',
    },
    {
      label: 'Posés debout',
      value: `${prog.poses_debout} / ${prog.poses_total}`,
      color: '#10B981',
      bar: (prog.poses_debout / prog.poses_total) * 100,
      barColor: '#10B981',
    },
    {
      label: 'Éléments maîtrisés',
      value: `${prog.elements_maitrises} / ${prog.elements_total}`,
      color: '#003082',
      bar: (prog.elements_maitrises / prog.elements_total) * 100,
      barColor: '#003082',
    },
    {
      label: 'Précision atterro',
      value: `${prog.precision_metres} m`,
      color: '#F59E0B',
      sub: 'du cible',
      subColor: 'rgba(255,255,255,0.35)',
    },
    {
      label: 'Mental',
      value: `${prog.note_mental.toFixed(1)} / 5`,
      color: noteColor(prog.note_mental),
      sub: '🧠',
      subColor: 'rgba(255,255,255,0.4)',
    },
  ];

  return (
    <div className="mb-6" style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <h2 style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>Ma Progression</h2>
          <p className="text-xs mt-0.5" style={{ color: '#7A9CC0' }}>Basé sur tes 10 derniers sauts évalués</p>
        </div>
        <button onClick={() => onShowConversion('Ma Progression détaillée')} className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: '#F97316' }}>
          Voir le détail →
        </button>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-2 font-medium" style={{ color: '#7A9CC0', letterSpacing: '0.5px' }}>{kpi.label}</p>
            <p className="text-xl font-bold leading-tight" style={{ color: kpi.color }}>{kpi.value}</p>
            {'bar' in kpi && kpi.bar !== undefined && (
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, margin: '8px 0 4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${kpi.bar}%`, background: kpi.barColor, borderRadius: 3 }} />
              </div>
            )}
            {'sub' in kpi && kpi.sub && (
              <p className="text-[10px] mt-1.5" style={{ color: kpi.subColor }}>{kpi.sub}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function DemoDashboardInner() {
  const demo = useParaDemo()!;
  const { exitDemo } = useGlobalDemo();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DashTab>('accueil');
  const [selectedSaut, setSelectedSaut] = useState<Saut | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [conversionTitle, setConversionTitle] = useState('');
  const [showConversion, setShowConversion] = useState(false);

  const showToast = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const showConversionModal = (title: string) => {
    setConversionTitle(title);
    setShowConversion(true);
  };

  const { profile, sauts, licences, brevets, badges } = demo;
  const licenceActive = licences.find((l) => l.statut === 'actif');
  const topBrevet = brevets[0]?.type_brevet ?? null;
  const totalSauts = 50;
  const sautsCetteAnnee = 9;
  const dernierSaut = sauts[0] ? new Date(sauts[0].date_saut).toLocaleDateString('fr-FR') : null;

  const licenceMonths = licenceActive?.date_expiration
    ? Math.floor((new Date(licenceActive.date_expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  const subTabs: { key: DashTab; label: string }[] = [
    { key: 'accueil', label: 'Tableau de bord' },
    { key: 'carnet', label: 'Mon Carnet' },
    { key: 'planning', label: 'Ma DZ' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#0B1D3A' }}>
      <DemoBanner />

      {/* Navbar — identical to real navbar structure */}
      <nav style={{ background: '#071529', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Left: logo + back */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => { exitDemo(); navigate('/'); }}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F97316')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Quitter la démo
            </button>
            <div className="hidden sm:block w-px h-4 bg-white/10" />
            <ParaPassLogo className="hidden sm:block h-6 w-auto" />
          </div>

          {/* Center: nav links */}
          <div className="hidden md:flex items-center gap-1">
            {(['Tableau de bord', 'Mon Passeport', 'Mes Stats', 'Ma Progression', 'Mon Matériel', 'Badges', 'Communauté'] as const).map((label) => {
              const isActive = label === 'Tableau de bord';
              return (
                <button
                  key={label}
                  onClick={() => !isActive && showConversionModal(label)}
                  className="px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap"
                  style={{
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                    borderBottom: isActive ? '2px solid #F97316' : '2px solid transparent',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Right: actions + avatar */}
          <div className="flex items-center gap-2">
            <button onClick={() => showConversionModal('QR Code FFP')} className="p-2 transition" style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
              <QrCode className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#F97316' }}>
              {profile.prenom[0]}{profile.nom[0]}
            </div>
          </div>
        </div>
      </nav>

      {/* Sub-nav */}
      <div style={{ background: '#071529', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="sticky top-14 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex">
          {subTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap font-medium"
              style={{
                borderColor: tab === t.key ? '#F97316' : 'transparent',
                color: tab === t.key ? '#FFFFFF' : '#7A9CC0',
                fontWeight: tab === t.key ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8" style={{ background: '#0B1D3A', minHeight: 'calc(100vh - 112px)' }}>
        <div className="max-w-7xl mx-auto">

          {/* ─── ACCUEIL ─────────────────────────────────────────────────────── */}
          {tab === 'accueil' && (
            <>
              {/* Hero card — exact same structure as Sophie */}
              <div
                className="mb-6 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                style={{ background: 'linear-gradient(135deg, #0F2549, #1a3a6e)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#7A9CC0', letterSpacing: '1px' }}>
                    MODE DÉMO · PARACHUTISTE
                  </p>
                  <h1 style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>
                    {profile.prenom} {profile.nom}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span style={{ color: '#7A9CC0', fontSize: 13 }}>
                      {[licenceActive?.numero_licence, 'BigAir Rochefort'].filter(Boolean).join(' · ')}
                    </span>
                    {topBrevet && (
                      <span className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: 'rgba(249,115,22,0.2)', color: '#F97316', border: '1px solid rgba(249,115,22,0.4)' }}>
                        Brevet {topBrevet}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 80 }}>
                  <ParachuteIcon className="w-8 h-8 mb-1" style={{ color: '#F97316' }} />
                  <p style={{ color: '#FFFFFF', fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{totalSauts}</p>
                  <p style={{ color: '#7A9CC0', fontSize: 11 }}>sauts au total</p>
                </div>
              </div>

              {/* 4 KPI cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <KpiCard
                  accent="#F97316"
                  label="Total sauts"
                  value={<span className="flex items-center gap-2"><ParachuteIcon className="w-6 h-6 text-orange-500" />{totalSauts}</span>}
                  sub={`+${sautsCetteAnnee} cette année`}
                />
                <KpiCard
                  accent="#003082"
                  label="Cette année"
                  value={<span className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-400" />{sautsCetteAnnee}</span>}
                  sub={dernierSaut ? `Dernier : ${dernierSaut}` : 'Aucun saut encore'}
                />
                <KpiCard
                  accent="#10B981"
                  label="Licence FFP"
                  value={<span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>déc. 2026</span>}
                  barPct={licenceMonths !== null ? Math.max(0, Math.min(100, (licenceMonths / 12) * 100)) : 50}
                  barColor="#10B981"
                  sub="Valide · 6 mois restants"
                />
                <KpiCard
                  accent="#8B5CF6"
                  label="Certificat médical"
                  value={<span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>juin 2027</span>}
                  barPct={75}
                  barColor="#8B5CF6"
                  sub="Valide · 12 mois restants"
                />
              </div>

              {/* Action buttons */}
              <div className="mb-6">
                <button
                  onClick={() => showConversionModal('Ajouter un saut')}
                  className="flex items-center justify-center gap-2 text-white px-5 rounded-lg text-sm font-bold transition-colors shadow-lg w-full md:w-auto"
                  style={{ background: '#F97316', height: 48 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EA580C')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#F97316')}
                >
                  <Plus className="w-5 h-5" /> Ajouter un saut
                </button>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => showConversionModal('Mon QR Code FFP')}
                    className="flex items-center justify-center gap-2 border rounded-lg text-sm font-semibold transition-colors flex-1 md:flex-none md:px-4 md:py-2.5"
                    style={{ height: 44, background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.15)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  >
                    <QrCode className="w-4 h-4" /> Mon QR Code
                  </button>
                  <button
                    onClick={() => showConversionModal('Exporter PDF')}
                    className="flex items-center justify-center gap-2 border rounded-lg text-sm font-semibold transition-colors flex-1 md:flex-none md:px-4 md:py-2.5"
                    style={{ height: 44, background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.15)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  >
                    <FileDown className="w-4 h-4" /> Exporter PDF
                  </button>
                </div>
              </div>

              {/* Progression card */}
              <DemoProgressionCard onShowConversion={showConversionModal} />

              {/* Bottom grid: derniers sauts + right column */}
              <div className="flex flex-col md:flex-row gap-3">

                {/* Derniers sauts */}
                <div style={{ flex: 2, background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="px-5 py-4 flex items-center justify-between">
                    <h2 style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>Derniers sauts</h2>
                    <button onClick={() => setTab('carnet')} style={{ color: '#F97316', fontSize: 12 }} className="font-medium hover:opacity-80 transition-opacity">
                      Voir tout →
                    </button>
                  </div>
                  {sauts.slice(0, 5).map((saut, idx) => (
                    <div
                      key={saut.id}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                      style={{ borderBottom: idx < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                      onClick={() => setSelectedSaut(saut)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                        style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}>
                        {totalSauts - idx}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>{saut.lieu}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#7A9CC0' }}>
                          {new Date(saut.date_saut).toLocaleDateString('fr-FR')} · {saut.hauteur_m}m · {NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {statutBadge(saut)}
                        <ChevronRight className="w-4 h-4" style={{ color: '#5A7A9A' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

                  {/* Badges */}
                  {badges.length > 0 && (
                    <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Award className="w-3.5 h-3.5 text-orange-400" />
                          <span className="text-xs font-bold text-white">Badges</span>
                          <span style={{ background: 'rgba(249,115,22,0.2)', color: '#FB923C', fontSize: 10 }} className="font-semibold px-1.5 py-0.5 rounded-full">
                            {badges.length}
                          </span>
                        </div>
                        <button onClick={() => showConversionModal('Tous mes badges')} style={{ color: '#F97316', fontSize: 11 }} className="font-medium hover:opacity-80 transition-opacity">
                          Voir tout →
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { icon: '🪂', label: '1er saut', color: '#F97316' },
                          { icon: '✈️', label: '10 sauts', color: '#0EA5E9' },
                          { icon: '🌟', label: '25 sauts', color: '#F59E0B' },
                          { icon: '🏅', label: '50 sauts', color: '#F97316' },
                        ].map((b) => (
                          <div key={b.label} className="flex flex-col items-center gap-1 p-2 rounded-lg"
                            style={{ background: `${b.color}14`, border: `0.5px solid ${b.color}40` }}>
                            <span className="text-xl">{b.icon}</span>
                            <span className="text-[9px] font-semibold text-white/70 text-center leading-tight">{b.label}</span>
                          </div>
                        ))}
                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg opacity-40"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                          <span className="text-xl" style={{ filter: 'grayscale(1)' }}>🏆</span>
                          <span className="text-[9px] font-semibold text-white/70 text-center leading-tight">100 sauts</span>
                          <span className="text-[9px] font-medium" style={{ color: '#64748B' }}>50 restants</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Météo DZ */}
                  <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Wind className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-bold text-white">SkyDive Atlantique — Météo</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Aujourd'hui", temp: 22, wind: 18, code: 0, precip: 10 },
                        { label: 'Demain', temp: 19, wind: 24, code: 2, precip: 25 },
                        { label: 'Après-demain', temp: 17, wind: 31, code: 61, precip: 70 },
                      ].map((day, i) => {
                        const isRain = day.precip > 60;
                        const cond = day.wind > 30 || isRain
                          ? { label: 'Fermé', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' }
                          : day.wind > 20
                          ? { label: 'Limites', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' }
                          : { label: 'Sautables', color: '#10B981', bg: 'rgba(16,185,129,0.15)' };
                        const WeatherIcon = day.code === 0 ? Sun : day.code <= 3 ? Cloud : CloudRain;
                        return (
                          <div key={i} className="flex items-center gap-2"
                            style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: i < 2 ? 6 : 0 }}>
                            <span style={{ color: '#7A9CC0', fontSize: 11, width: 90, flexShrink: 0 }}>{day.label}</span>
                            <WeatherIcon className="w-4 h-4 text-amber-400" />
                            <Thermometer className="w-3 h-3" style={{ color: '#5A7A9A' }} />
                            <span style={{ color: '#C8D6E8', fontSize: 11 }}>{day.temp}°</span>
                            <Wind className="w-3 h-3" style={{ color: '#5A7A9A' }} />
                            <span style={{ color: '#C8D6E8', fontSize: 11 }}>{day.wind}km/h</span>
                            <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: cond.bg, color: cond.color }}>
                              {cond.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── CARNET ──────────────────────────────────────────────────────── */}
          {tab === 'carnet' && (
            <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)' }} className="rounded-xl overflow-hidden">
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold" style={{ fontSize: 20 }}>Mon Carnet de sauts</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#7A9CC0' }}>{totalSauts} sauts enregistrés</p>
                </div>
                <button
                  onClick={() => showConversionModal('Ajouter un saut')}
                  className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: '#F97316' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EA580C')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#F97316')}
                >
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
              <div>
                {sauts.map((saut, idx) => (
                  <div
                    key={saut.id}
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors"
                    style={{ borderBottom: idx < sauts.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                    onClick={() => setSelectedSaut(saut)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                      style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}>
                      {totalSauts - idx}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>{saut.lieu}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#7A9CC0' }}>
                        {new Date(saut.date_saut).toLocaleDateString('fr-FR')} · {saut.hauteur_m}m · {NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {statutBadge(saut)}
                      <ChevronRight className="w-4 h-4" style={{ color: '#5A7A9A' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── PLANNING ────────────────────────────────────────────────────── */}
          {tab === 'planning' && (
            <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24 }}>
              <div className="flex items-center gap-2 mb-4">
                <Wind className="w-4 h-4 text-blue-400" />
                <h2 className="text-white font-bold text-base">Ma DZ — Planning & Météo</h2>
              </div>
              <p style={{ color: '#7A9CC0', fontSize: 13 }}>
                Rejoindre un centre pour voir le planning de votre DZ en temps réel.
              </p>
              <button
                onClick={() => showConversionModal('Rejoindre un centre')}
                className="mt-4 text-sm font-semibold px-4 py-2 rounded-lg transition-colors text-white"
                style={{ background: '#F97316' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#EA580C')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#F97316')}
              >
                Créer un compte pour rejoindre un centre →
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#071529', borderTop: '1px solid rgba(255,255,255,0.06)' }} className="py-6 mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ParaPassLogo className="h-5 w-auto" />
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>© 2026 ParaPass</span>
          </div>
          <div className="flex items-center gap-2">
            <img src="/logo-ffp-footer.png" alt="FFP" className="h-6 w-auto opacity-60" />
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>En partenariat avec la FFP</span>
          </div>
        </div>
      </footer>

      {selectedSaut && <SautDetailModal saut={selectedSaut} onClose={() => setSelectedSaut(null)} />}
      {showConversion && <ConversionModal title={conversionTitle} onClose={() => setShowConversion(false)} />}
      <DemoToast visible={toastVisible} />
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────────

export function DemoDashboardPage() {
  return (
    <ParaDemoProvider>
      <DemoDashboardInner />
    </ParaDemoProvider>
  );
}
