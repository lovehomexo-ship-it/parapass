import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CentreDemoProvider, useCentreDemo, DemoBanner, useGlobalDemo } from '../../lib/DemoContext';
import {
  Home, Users, ClipboardList, Activity, BarChart2, Calendar,
  Settings, MessageSquare, Bell, ChevronRight, X, Zap,
  AlertTriangle, CheckCircle, Clock, ShieldCheck, ChevronLeft,
  Menu,
} from 'lucide-react';

// ─── Demo action toast ────────────────────────────────────────────────────────

function DemoToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[10000] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white"
      style={{ transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#F97316,#EA580C)', animation: 'fadeInUp 0.25s ease' }}
    >
      <Zap className="w-4 h-4 flex-shrink-0" />
      Action désactivée en mode démo — inscrivez votre centre pour sauvegarder
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}

// ─── Conversion modal ─────────────────────────────────────────────────────────

function ConversionModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.15)' }} className="rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white/60"><X className="w-5 h-5" /></button>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
          <Users className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-white text-center mb-2">{title}</h2>
        <p className="text-sm text-center mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Cette fonctionnalité est disponible avec un compte ParaPass Centre. Inscrivez votre centre gratuitement.
        </p>
        <div className="flex flex-col gap-3">
          <Link to="/inscription-centre" className="w-full text-center text-white font-bold py-3 rounded-xl transition block" style={{ background: '#2563EB' }}>
            Inscrire mon centre
          </Link>
          <button onClick={onClose} className="text-sm text-center transition" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Continuer la démo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function CentreKpiCard({
  label, value, sub, accent, onClick,
}: {
  label: string; value: React.ReactNode; sub: string; accent: string; onClick?: () => void;
}) {
  return (
    <div
      className={onClick ? 'cursor-pointer' : ''}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        borderLeft: `3px solid ${accent}`,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        padding: 20,
        transition: 'background 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
    >
      <p style={{ color: '#7A9CC0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 500 }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>{value}</p>
      <p style={{ color: '#7A9CC0', fontSize: 12 }}>{sub}</p>
    </div>
  );
}

// ─── Alert banner ─────────────────────────────────────────────────────────────

function AlertBanner({ level, message, onView }: { level: 'red' | 'orange'; message: string; onView?: () => void }) {
  const s = level === 'red'
    ? { bg: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.25)', icon: '#EF4444' }
    : { bg: 'rgba(249,115,22,0.1)', border: '0.5px solid rgba(249,115,22,0.25)', icon: '#F97316' };
  return (
    <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ background: s.bg, border: s.border }}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: s.icon }} />
      <span className="flex-1 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{message}</span>
      {onView && (
        <button onClick={onView} className="text-xs font-semibold flex-shrink-0 transition-opacity hover:opacity-70" style={{ color: '#F97316' }}>
          Voir →
        </button>
      )}
    </div>
  );
}

// ─── Sidebar nav items ────────────────────────────────────────────────────────

type NavSection = 'dashboard' | 'licencies' | 'demandes' | 'activite' | 'planning' | 'stats' | 'equipe' | 'centre' | 'messages';

const NAV_ITEMS: { id: NavSection; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: Home },
  { id: 'licencies', label: 'Mes licenciés', icon: Users },
  { id: 'demandes', label: "Demandes d'adhésion", icon: ClipboardList },
  { id: 'activite', label: 'Activité des sauts', icon: Activity },
  { id: 'planning', label: 'Planning DZ', icon: Calendar },
  { id: 'stats', label: 'Statistiques', icon: BarChart2 },
  { id: 'equipe', label: 'Mon équipe', icon: Users },
  { id: 'centre', label: 'Mon centre', icon: Settings },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
];

// ─── Inner component ──────────────────────────────────────────────────────────

function DemoCentreInner() {
  const demo = useCentreDemo()!;
  const { exitDemo } = useGlobalDemo();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [toastVisible, setToastVisible] = useState(false);
  const [conversionTitle, setConversionTitle] = useState('');
  const [showConversion, setShowConversion] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { centreData } = demo;
  const { centre, stats, licencies, moniteurs, alertes, planning, validations_recentes } = centreData;

  const showToast = () => { setToastVisible(true); setTimeout(() => setToastVisible(false), 3000); };
  const openConversion = (title: string) => { setConversionTitle(title); setShowConversion(true); };

  const handleNav = (id: NavSection) => {
    if (id === 'dashboard') { setActiveNav(id); setSidebarOpen(false); return; }
    openConversion(NAV_ITEMS.find((n) => n.id === id)?.label ?? id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0B1D3A' }}>
      <DemoBanner />

      {/* Top bar */}
      <header style={{ background: '#071529', borderBottom: '1px solid rgba(255,255,255,0.06)', height: 56 }}
        className="flex items-center px-4 gap-4 sticky top-0 z-40 flex-shrink-0">
        <button
          onClick={() => { exitDemo(); navigate('/'); }}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#3B82F6')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Quitter la démo
        </button>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-white font-bold text-sm">{centre.nom}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.2)', color: '#F97316' }}>Pro</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => openConversion('Notifications')} className="p-2 transition" style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
            <Bell className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#2563EB' }}>
            DA
          </div>
        </div>
        <button className="lg:hidden p-2 text-white/50" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="w-5 h-5" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-30 flex-shrink-0 transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ width: 220, background: '#071529', borderRight: '1px solid rgba(255,255,255,0.06)', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto', position: 'sticky' }}
        >
          <nav className="p-3 space-y-0.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm font-medium"
                style={{
                  background: activeNav === id ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: activeNav === id ? '#fff' : '#7A9CC0',
                  borderLeft: activeNav === id ? '2px solid #3B82F6' : '2px solid transparent',
                }}
                onMouseEnter={(e) => { if (activeNav !== id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (activeNav !== id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} className="p-3 mt-auto">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#2563EB' }}>
                DA
              </div>
              <span style={{ color: '#7A9CC0', fontSize: 12 }} className="truncate">Demo Admin</span>
            </div>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6 space-y-5" style={{ minWidth: 0 }}>

          {activeNav === 'dashboard' && (
            <>
              {/* Hero block */}
              <div
                className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                style={{ background: 'linear-gradient(135deg, #0F2549, #1a3a6e)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#7A9CC0', letterSpacing: '1px' }}>
                    MODE DÉMO · CENTRE DZ
                  </p>
                  <h1 style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>
                    {centre.nom}
                  </h1>
                  <p style={{ color: '#7A9CC0', fontSize: 13 }}>
                    {centre.ville} · {centre.region} · Code club {centre.code_club}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#5A7A9A' }}>DT : {centre.nom_dt}</p>
                </div>
                <div className="flex gap-6 flex-shrink-0">
                  <div className="text-center">
                    <p style={{ color: '#EF4444', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{stats.alertesCritiques}</p>
                    <p style={{ color: '#7A9CC0', fontSize: 11 }}>alertes critiques</p>
                  </div>
                  <div className="text-center">
                    <p style={{ color: '#3B82F6', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{stats.totalLicencies}</p>
                    <p style={{ color: '#7A9CC0', fontSize: 11 }}>licenciés</p>
                  </div>
                </div>
              </div>

              {/* 4 KPI cards */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <CentreKpiCard
                  accent="#3B82F6"
                  label="Licenciés actifs"
                  value={stats.licenciesActifs}
                  sub="+3 ce mois"
                  onClick={() => handleNav('licencies')}
                />
                <CentreKpiCard
                  accent="#F97316"
                  label="Demandes"
                  value={3}
                  sub="En attente"
                  onClick={() => handleNav('demandes')}
                />
                <CentreKpiCard
                  accent="#10B981"
                  label="Sauts aujourd'hui"
                  value={stats.sautsAujourdhui}
                  sub="Sur le terrain"
                />
                <CentreKpiCard
                  accent="#EF4444"
                  label="Alertes"
                  value={<span style={{ color: '#EF4444' }}>{stats.alertesCritiques}</span>}
                  sub="À traiter"
                  onClick={() => openConversion('Gestion des alertes')}
                />
              </div>

              {/* Alert banners */}
              <div className="space-y-2">
                <AlertBanner
                  level="red"
                  message={`⚠ ${stats.alertesCritiques} licencié(s) avec licence FFP expirée`}
                  onView={() => openConversion('Licences expirées')}
                />
                <AlertBanner
                  level="orange"
                  message="⚠ 1 certificat médical expirant dans 30 jours"
                  onView={() => openConversion('Certificats médicaux')}
                />
              </div>

              {/* Two-column: activité + validités */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Activité récente */}
                <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="px-5 py-4 flex items-center justify-between">
                    <h2 style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>Activité récente</h2>
                    <button onClick={() => handleNav('activite')} style={{ color: '#3B82F6', fontSize: 12 }} className="font-medium hover:opacity-80 transition-opacity">
                      Voir tout →
                    </button>
                  </div>
                  {validations_recentes.map((v, i) => (
                    <div key={v.id} className="flex items-center gap-3 px-5 py-3.5"
                      style={{ borderBottom: i < validations_recentes.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                        style={{ background: v.statut === 'valide' ? 'rgba(16,185,129,0.1)' : 'rgba(249,115,22,0.1)' }}>
                        {v.statut === 'valide'
                          ? <ShieldCheck className="w-4 h-4 text-green-500" />
                          : <Clock className="w-4 h-4 text-orange-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{v.parachutiste}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#7A9CC0' }}>
                          {new Date(v.saut_date).toLocaleDateString('fr-FR')} · {v.nature}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={v.statut === 'valide'
                          ? { background: 'rgba(16,185,129,0.12)', color: '#10B981' }
                          : { background: 'rgba(249,115,22,0.12)', color: '#F97316' }}>
                        {v.statut === 'valide' ? 'Validé' : 'En attente'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Validités licenciés */}
                <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="px-5 py-4">
                    <h2 style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>Validités licenciés</h2>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    {[
                      { label: 'Licences FFP valides', value: '20 / 25', color: '#F97316', pct: 80 },
                      { label: 'Licences expirées', value: '5', color: '#EF4444', pct: 20 },
                      { label: 'Certificats médicaux OK', value: '23 / 25', color: '#F97316', pct: 92 },
                      { label: 'Expirant dans 30j', value: '2', color: '#F59E0B', pct: 8 },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span style={{ color: '#7A9CC0', fontSize: 13 }}>{row.label}</span>
                        <span className="font-bold text-sm" style={{ color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginTop: 4 }}>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ color: '#7A9CC0', fontSize: 13 }}>Conformité globale</span>
                        <span className="font-bold text-sm text-white">86%</span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '86%', background: '#10B981', borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Moniteurs */}
              <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="px-5 py-4 flex items-center justify-between">
                  <h2 style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>Équipe moniteurs</h2>
                  <button onClick={() => handleNav('equipe')} style={{ color: '#3B82F6', fontSize: 12 }} className="font-medium hover:opacity-80 transition-opacity">
                    Gérer →
                  </button>
                </div>
                {moniteurs.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-4"
                    style={{ borderBottom: i < moniteurs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: '#1E3A8A', color: '#93C5FD' }}>
                      {m.prenom[0]}{m.nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{m.prenom} {m.nom}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#7A9CC0' }}>{m.qualification}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white">{m.nb_validations}</p>
                      <p className="text-xs" style={{ color: '#7A9CC0' }}>validations</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0"
                      style={m.disponible
                        ? { background: 'rgba(16,185,129,0.12)', color: '#10B981' }
                        : { background: 'rgba(255,255,255,0.06)', color: '#64748B' }}>
                      {m.disponible ? 'Disponible' : 'Indisponible'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Planning preview */}
              <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="px-5 py-4 flex items-center justify-between">
                  <h2 style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>Planning à venir</h2>
                  <button onClick={() => handleNav('planning')} style={{ color: '#3B82F6', fontSize: 12 }} className="font-medium hover:opacity-80 transition-opacity">
                    Voir tout →
                  </button>
                </div>
                {planning.slice(0, 3).map((p, i) => {
                  const PLANNING_LABELS: Record<string, string> = {
                    saut_en_groupe: 'Saut en groupe',
                    formation_brevet_a: 'Formation Brevet A',
                    journee_portes_ouvertes: 'Journée portes ouvertes',
                  };
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-4"
                      style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(37,99,235,0.15)', color: '#3B82F6' }}>
                        <p className="text-[10px] font-semibold">{new Date(p.date).toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()}</p>
                        <p className="text-lg font-bold leading-none">{new Date(p.date).getDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm">{PLANNING_LABELS[p.type] || p.type}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#7A9CC0' }}>{p.heure_debut} – {p.heure_fin} · {p.moniteur}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">{p.nb_inscrits}/{p.places_max}</p>
                          <p className="text-xs" style={{ color: '#7A9CC0' }}>places</p>
                        </div>
                        <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${(p.nb_inscrits / p.places_max) * 100}%`, background: p.nb_inscrits >= p.places_max ? '#EF4444' : '#3B82F6' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Licenciés table */}
              <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="px-5 py-4 flex items-center justify-between">
                  <h2 style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>Licenciés récents</h2>
                  <button onClick={() => handleNav('licencies')} style={{ color: '#3B82F6', fontSize: 12 }} className="font-medium hover:opacity-80 transition-opacity">
                    Voir tous ({stats.totalLicencies}) →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', color: '#7A9CC0' }}>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">Nom</th>
                        <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wide">Brevet</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide hidden md:table-cell">Sauts</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide hidden lg:table-cell">Dernière activité</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {licencies.slice(0, 6).map((l, i) => (
                        <tr key={l.id} className="transition-colors"
                          style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: '#1E3A8A', color: '#93C5FD' }}>
                                {l.prenom[0]}{l.nom[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{l.prenom} {l.nom}</p>
                                {l.alertes > 0 && (
                                  <span className="text-xs font-medium" style={{ color: '#EF4444' }}>{l.alertes} alerte{l.alertes > 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD' }}>
                              Brevet {l.brevet}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-white hidden md:table-cell">{l.nb_sauts}</td>
                          <td className="px-5 py-3.5 text-right text-xs hidden lg:table-cell" style={{ color: '#7A9CC0' }}>
                            {new Date(l.derniere_activite).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button onClick={() => openConversion(`Profil de ${l.prenom} ${l.nom}`)}
                              className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: '#3B82F6' }}>
                              Voir →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Alertes list */}
              <div style={{ background: '#0F2549', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="px-5 py-4">
                  <h2 style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>Alertes actives</h2>
                </div>
                {alertes.map((a, i) => (
                  <div key={a.id} className="flex items-start gap-4 px-5 py-4"
                    style={{ borderBottom: i < alertes.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: a.urgence === 'critique' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: a.urgence === 'critique' ? '#EF4444' : '#F59E0B' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{a.parachutiste}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#7A9CC0' }}>{a.message}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={a.urgence === 'critique'
                          ? { background: 'rgba(239,68,68,0.12)', color: '#EF4444' }
                          : { background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                        {a.urgence === 'critique' ? 'Critique' : 'Attention'}
                      </span>
                      <button onClick={showToast} className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: '#3B82F6' }}>
                        Traiter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Placeholder for non-dashboard sections (should never render in demo) */}
          {activeNav !== 'dashboard' && (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.12)' }}>
                  <CheckCircle className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-white font-bold text-base mb-2">Fonctionnalité disponible</p>
                <p className="text-sm mb-4" style={{ color: '#7A9CC0' }}>Inscrivez votre centre pour accéder à cette section.</p>
                <Link to="/inscription-centre" className="text-white font-bold py-2.5 px-6 rounded-xl inline-block" style={{ background: '#2563EB' }}>
                  Inscrire mon centre
                </Link>
              </div>
            </div>
          )}

        </main>
      </div>

      {showConversion && <ConversionModal title={conversionTitle} onClose={() => setShowConversion(false)} />}
      <DemoToast visible={toastVisible} />
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────────

export function DemoCentrePage() {
  return (
    <CentreDemoProvider>
      <DemoCentreInner />
    </CentreDemoProvider>
  );
}
