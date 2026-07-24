import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DemoProvider, DemoBanner, useDemo } from '../lib/DemoContext';
import { BadgesGrid } from './Badges';
import { ParachuteDropIcon } from '../components/ParachuteIcon';
import { AlertsPanel, CritiqueBanner } from '../components/AlertsPanel';
import type { Saut, NotationTernaire, Materiel, Maintenance } from '../lib/types';
import { NATURE_SAUT_LABELS, CATEGORIE_LABELS, FONCTION_LABELS, TYPE_MATERIEL_LABELS, TYPE_MAINTENANCE_LABELS } from '../lib/types';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus, FileDown, QrCode, Share2, Calendar, TrendingUp,
  ChevronDown, ChevronUp, BookOpen, User, Award,
  BarChart2, Package, ShieldCheck, Hash, X,
  CheckCircle, AlertTriangle, Clock, ChevronRight,
} from 'lucide-react';

type DemoTab = 'accueil' | 'carnet' | 'materiel' | 'badges' | 'profil';

// ─── Notation helpers ─────────────────────────────────────────────────────────

const STAR_COLORS = ['', '#EF4444', '#F59E0B', '#EAB308', '#84CC16', '#10B981'];

function MiniStars({ value }: { value: number | null }) {
  if (!value) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="w-3 h-3 rounded-sm inline-block"
          style={{ background: n <= value ? STAR_COLORS[value] : '#E5E7EB' }} />
      ))}
    </span>
  );
}

function StatutBadge({ saut }: { saut: Saut }) {
  if (saut.statut === 'valide') {
    const nom = saut.valide_par ? saut.valide_par.split(' ').pop() : '';
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <ShieldCheck className="w-3 h-3" />{nom || 'Validé'}
      </span>
    );
  }
  if (saut.statut === 'en_attente') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">En attente</span>;
  }
  return null;
}

// ─── Conversion Modal ─────────────────────────────────────────────────────────

function ConversionModal({ action, onClose }: { action: string; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <div className="text-4xl mb-3 text-center">🪂</div>
        <h2 className="text-lg font-bold text-[#001A4D] text-center mb-2">{action}</h2>
        <p className="text-sm text-gray-600 text-center mb-5">
          Cette fonctionnalité est disponible avec un compte ParaPass.
          Inscrivez-vous gratuitement pour accéder à toutes les fonctionnalités.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/register')}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition"
          >
            Créer mon compte gratuit
          </button>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 text-center">
            Continuer la démo
          </button>
        </div>
      </div>
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Détail du saut</p>
            <h2 className="text-lg font-bold text-[#001A4D] mt-0.5">
              {new Date(saut.date_saut).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Lieu / DZ', value: saut.lieu }, { label: 'Aéronef', value: saut.aeronef_immat },
              { label: 'Nature', value: NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut },
              { label: 'Catégorie', value: CATEGORIE_LABELS[saut.categorie] || saut.categorie },
              { label: 'Hauteur', value: `${saut.hauteur_m} m` }, { label: 'Fonction', value: FONCTION_LABELS[saut.fonction] || saut.fonction },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-[#001A4D]">{value || '—'}</p>
              </div>
            ))}
          </div>
          {(saut.programme || saut.exercice_chute || saut.exercice_voile) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Programme moniteur</p>
              {saut.programme && <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-blue-500 mb-0.5">Programme</p><p className="text-sm text-[#001A4D]">{saut.programme}</p></div>}
              {saut.exercice_voile && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-0.5">Exercice sous voile</p><p className="text-sm text-[#001A4D]">{saut.exercice_voile}</p></div>}
            </div>
          )}
          {posFields.some((f) => saut[f.key] !== null && saut[f.key] !== undefined) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notation position</p>
              <div className="grid grid-cols-2 gap-2">
                {posFields.map(({ label, key }) => (
                  <div key={key} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-600">{label}</span>
                    <MiniStars value={saut[key] as number | null} />
                  </div>
                ))}
                {saut.position_globale !== null && (
                  <div className="col-span-2 bg-[#001A4D]/5 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#001A4D]">Position globale</span>
                    <MiniStars value={saut.position_globale} />
                  </div>
                )}
              </div>
            </div>
          )}
          {ternaireFields.some((f) => saut[f.key] !== null) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observations techniques</p>
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
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-500 mb-0.5">Observations moniteur</p>
              <p className="text-sm text-[#001A4D]">{saut.observations_moniteur}</p>
            </div>
          )}
          {hashShort && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Hash className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-green-700">Saut signé cryptographiquement</p>
                <p className="text-xs text-green-600 font-mono mt-0.5">{hashShort}…</p>
              </div>
            </div>
          )}
          <div className="pt-1">
            <StatutBadge saut={saut} />
            {saut.valide_par && <p className="text-xs text-gray-400 mt-1">Signé par : {saut.valide_par}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Matériel tab ─────────────────────────────────────────────────────────────

function ProgressStatus({ materiel, maintenances }: { materiel: Materiel; maintenances: Maintenance[] }) {
  const now = new Date();
  const last = [...maintenances].sort((a, b) => b.date_maintenance.localeCompare(a.date_maintenance))[0];
  const nextEch = last?.prochain_echeance ? new Date(last.prochain_echeance) : null;

  let color = 'green';
  let label = 'OK';

  if (nextEch) {
    const days = Math.floor((nextEch.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) { color = 'red'; label = 'En retard'; }
    else if (days < 30) { color = 'amber'; label = `Dans ${days}j`; }
    else { color = 'green'; label = `OK — ${nextEch.toLocaleDateString('fr-FR')}`; }
  } else if (materiel.type === 'parachute_secours' && !last) {
    color = 'red'; label = 'Non renseigné';
  }

  const icon = color === 'green'
    ? <CheckCircle className="w-4 h-4 text-green-500" />
    : color === 'amber' ? <Clock className="w-4 h-4 text-amber-500" />
    : <AlertTriangle className="w-4 h-4 text-red-500" />;

  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-red-600'}`}>
      {icon} {label}
    </div>
  );
}

function MaterielTab({ materiels, maintenancesMap, onConversionAction }: {
  materiels: Materiel[];
  maintenancesMap: Record<string, Maintenance[]>;
  onConversionAction: (label: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#001A4D]">Mon Matériel</h1>
          <p className="text-sm text-gray-500">{materiels.length} équipement{materiels.length !== 1 ? 's' : ''} enregistré{materiels.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => onConversionAction('Ajouter un équipement')}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {materiels.map((mat) => {
        const maints = maintenancesMap[mat.id] ?? [];
        const isExp = expanded === mat.id;
        return (
          <div key={mat.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition"
              onClick={() => setExpanded(isExp ? null : mat.id)}
            >
              <div className="w-10 h-10 rounded-xl bg-[#001A4D]/10 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-[#001A4D]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#001A4D] text-sm">{mat.marque} {mat.modele}</p>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{TYPE_MATERIEL_LABELS[mat.type] || mat.type}</span>
                </div>
                <ProgressStatus materiel={mat} maintenances={maints} />
              </div>
              {isExp ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </button>

            {isExp && (
              <div className="border-t border-gray-100 p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'N° de série', value: mat.numero_serie },
                    { label: 'Fabrication', value: mat.date_fabrication ? new Date(mat.date_fabrication).getFullYear().toString() : '—' },
                    { label: 'Acquisition', value: mat.date_acquisition ? new Date(mat.date_acquisition).toLocaleDateString('fr-FR') : '—' },
                    { label: 'Statut', value: mat.statut },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-[#001A4D]">{value || '—'}</p>
                    </div>
                  ))}
                </div>

                {maints.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historique maintenance</p>
                    <div className="space-y-2">
                      {maints.map((m) => (
                        <div key={m.id} className="bg-gray-50 rounded-xl p-3 flex items-start justify-between">
                          <div>
                            <p className="text-xs font-semibold text-[#001A4D]">{TYPE_MAINTENANCE_LABELS[m.type_maintenance] || m.type_maintenance}</p>
                            <p className="text-xs text-gray-500">{new Date(m.date_maintenance).toLocaleDateString('fr-FR')} — {m.technicien}</p>
                            {m.notes && <p className="text-xs text-gray-400 mt-0.5">{m.notes}</p>}
                          </div>
                          {m.prochain_echeance && (
                            <div className="text-right flex-shrink-0 ml-3">
                              <p className="text-[10px] text-gray-400">Prochaine</p>
                              <p className="text-xs font-semibold text-[#001A4D]">{new Date(m.prochain_echeance).toLocaleDateString('fr-FR')}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => onConversionAction('Ajouter une maintenance')}
                  className="flex items-center gap-2 text-sm text-[#001A4D] font-semibold hover:text-orange-500 transition"
                >
                  <Plus className="w-4 h-4" /> Ajouter une maintenance
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── QR Code tab ─────────────────────────────────────────────────────────────

function QRTab() {
  const navigate = useNavigate();
  return (
    <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      <h2 className="text-xl font-bold text-[#001A4D] mb-2">Mon QR Code</h2>
      <p className="text-sm text-gray-500 mb-6">Partagez ce QR code avec un moniteur pour qu'il valide vos sauts</p>
      <div className="flex justify-center mb-6">
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
          <QRCodeSVG value="https://parapass.fr/verify/demo" size={180} />
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4 bg-amber-50 text-amber-700 rounded-lg p-3">
        En mode démo — le QR code ne permet pas de valider de vrais sauts
      </p>
      <button onClick={() => navigate('/register')} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition">
        Créer un vrai compte
      </button>
    </div>
  );
}

// ─── Demo Dashboard (main) ────────────────────────────────────────────────────

function DemoDashboardInner() {
  const demo = useDemo()!;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DemoTab>('accueil');
  const [selectedSaut, setSelectedSaut] = useState<Saut | null>(null);
  const [sortField, setSortField] = useState<'date_saut' | 'lieu' | 'hauteur_m'>('date_saut');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [conversionAction, setConversionAction] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const { profile, sauts, alertes, badges, materiel, maintenances } = demo;

  const totalSauts = 247; // Full career total (demo sauts are recent subset)
  const sautsCetteAnnee = sauts.filter((s) => new Date(s.date_saut).getFullYear() === 2026).length;
  const sortedByDate = [...sauts].sort((a, b) => b.date_saut.localeCompare(a.date_saut));
  const dernierSaut = sortedByDate[0] ? new Date(sortedByDate[0].date_saut).toLocaleDateString('fr-FR') : '—';

  const maintenancesMap = materiel.reduce<Record<string, Maintenance[]>>((acc, mat) => {
    acc[mat.id] = maintenances.filter((m) => m.materiel_id === mat.id);
    return acc;
  }, {});

  const sortedSauts = [...sauts].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'hauteur_m') return (a.hauteur_m - b.hauteur_m) * dir;
    return (a[sortField] ?? '').localeCompare(b[sortField] ?? '') * dir;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  };

  const tabs: { key: DemoTab; label: string; icon: React.ReactNode }[] = [
    { key: 'accueil', label: 'Tableau de bord', icon: <ParachuteDropIcon className="w-8 h-8" /> },
    { key: 'carnet', label: 'Mon Carnet', icon: <BookOpen className="w-4 h-4" /> },
    { key: 'materiel', label: 'Mon Matériel', icon: <Package className="w-4 h-4" /> },
    { key: 'badges', label: 'Badges', icon: <Award className="w-4 h-4" /> },
    { key: 'profil', label: 'Mon Profil', icon: <User className="w-4 h-4" /> },
  ];

  const unreadCount = alertes.filter((a) => !a.lue).length;

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingTop: '40px' }}>
      <DemoBanner />

      {/* Header */}
      <div className="bg-[#001A4D] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-28">
            <div className="flex items-center gap-2">
              <img src="/Logo_ParaPass.png" alt="ParaPass" className="h-14 w-auto object-contain" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-300 hidden sm:block">{profile.prenom} {profile.nom}</span>
              <AlertsPanel
                alertes={alertes}
                unreadCount={unreadCount}
                onMarkRead={() => {}}
                onMarkAllRead={() => {}}
              />
              <button onClick={() => setShowQr(!showQr)} className="p-2 rounded-lg hover:bg-white/10 text-white">
                <QrCode className="w-5 h-5" />
              </button>
              <button onClick={() => navigate('/login')} className="text-xs text-gray-400 hover:text-white hidden sm:block">
                Connexion
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0.5 overflow-x-auto pb-0 -mb-px">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setShowQr(false); }}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === t.key ? 'border-orange-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-white/20'
                }`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(' ').pop()}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <CritiqueBanner alertes={alertes} />

      {/* QR panel */}
      {showQr && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <QRTab />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* ─── ACCUEIL ─────────────────────────────────────────────────────── */}
        {activeTab === 'accueil' && !showQr && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total sauts</p>
                    <p className="text-3xl font-bold text-[#001A4D]">{totalSauts}</p>
                  </div>
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <ParachuteDropIcon className="w-10 h-10 text-orange-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Sauts cette année</p>
                    <p className="text-3xl font-bold text-[#001A4D]">{sautsCetteAnnee}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Dernier saut</p>
                    <p className="text-xl font-bold text-[#001A4D]">{dernierSaut}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={() => setConversionAction('Ajouter un saut')}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-orange-500/25"
              >
                <Plus className="w-5 h-5" /> Ajouter un saut
              </button>
              <button onClick={() => setShowQr(true)}
                className="flex items-center gap-2 bg-[#001A4D] hover:bg-[#1E3A5F] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                <QrCode className="w-4 h-4" /> Mon QR Code
              </button>
              <button onClick={() => setConversionAction('Exporter en PDF')}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-[#001A4D] border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                <FileDown className="w-4 h-4" /> Exporter PDF
              </button>
              <button onClick={() => setConversionAction('Partager avec un moniteur')}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-[#001A4D] border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                <Share2 className="w-4 h-4" /> Partager avec un moniteur
              </button>
            </div>

            {/* Progression */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#001A4D]" />
                  <span className="text-sm font-semibold text-[#001A4D]">Progression vers le prochain palier</span>
                </div>
                <span className="text-xs text-gray-500">{totalSauts} / 300 sauts</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="bg-orange-500 h-3 rounded-full transition-all" style={{ width: `${Math.round((totalSauts / 300) * 100)}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">Encore <span className="font-semibold text-[#001A4D]">{300 - totalSauts} sauts</span> pour le badge Expert (300 sauts)</p>
            </div>

            {/* Derniers sauts */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#001A4D]">Derniers sauts</h2>
                <button onClick={() => setActiveTab('carnet')} className="text-sm text-orange-500 hover:text-orange-600 font-medium">
                  Voir tout →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Lieu / DZ</th>
                      <th className="px-4 py-3 text-left font-medium">Nature</th>
                      <th className="px-4 py-3 text-left font-medium">Hauteur</th>
                      <th className="px-4 py-3 text-left font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedByDate.slice(0, 5).map((saut) => (
                      <tr key={saut.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setSelectedSaut(saut)}>
                        <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{new Date(saut.date_saut).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-3 text-gray-700">{saut.lieu}</td>
                        <td className="px-4 py-3 text-gray-700">{NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut}</td>
                        <td className="px-4 py-3 text-gray-700">{saut.hauteur_m}m</td>
                        <td className="px-4 py-3"><StatutBadge saut={saut} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ─── CARNET ──────────────────────────────────────────────────────── */}
        {activeTab === 'carnet' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#001A4D]">Mon Carnet de sauts (247 au total)</h2>
              <button
                onClick={() => setConversionAction('Ajouter un saut')}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort('date_saut')}>
                      Date <SortIcon field="date_saut" />
                    </th>
                    <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort('lieu')}>
                      Lieu / DZ <SortIcon field="lieu" />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Nature</th>
                    <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort('hauteur_m')}>
                      Hauteur <SortIcon field="hauteur_m" />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Fonction</th>
                    <th className="px-4 py-3 text-left font-medium">Position</th>
                    <th className="px-4 py-3 text-left font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedSauts.map((saut) => (
                    <tr
                      key={saut.id}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedSaut(saut)}
                    >
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{new Date(saut.date_saut).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 text-gray-700">{saut.lieu}</td>
                      <td className="px-4 py-3 text-gray-700">{NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut}</td>
                      <td className="px-4 py-3 text-gray-700">{saut.hauteur_m}m</td>
                      <td className="px-4 py-3 text-gray-700">{FONCTION_LABELS[saut.fonction] || saut.fonction}</td>
                      <td className="px-4 py-3"><MiniStars value={saut.position_globale} /></td>
                      <td className="px-4 py-3"><StatutBadge saut={saut} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">Affichage des 20 sauts les plus récents sur 247 au total</p>
            </div>
          </div>
        )}

        {/* ─── MATERIEL ────────────────────────────────────────────────────── */}
        {activeTab === 'materiel' && (
          <MaterielTab
            materiels={materiel}
            maintenancesMap={maintenancesMap}
            onConversionAction={setConversionAction}
          />
        )}

        {/* ─── BADGES ──────────────────────────────────────────────────────── */}
        {activeTab === 'badges' && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#001A4D]">Mes Badges</h1>
              <p className="text-sm text-gray-500">{badges.length} badges débloqués</p>
            </div>
            <BadgesGrid badges={badges} totalSauts={totalSauts} />
          </>
        )}

        {/* ─── PROFIL ──────────────────────────────────────────────────────── */}
        {activeTab === 'profil' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-[#001A4D]">Mon Profil</h1>
              <p className="text-sm text-gray-500">Vos informations personnelles (données de démonstration)</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-sm font-semibold text-[#001A4D] uppercase tracking-wider">Identité</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Prénom', value: profile.prenom },
                  { label: 'Nom', value: profile.nom },
                  { label: 'Date de naissance', value: profile.date_naissance ? new Date(profile.date_naissance).toLocaleDateString('fr-FR') : '—' },
                  { label: 'Lieu de naissance', value: profile.lieu_naissance ?? '—' },
                  { label: 'Nationalité', value: profile.nationalite },
                ].map(({ label, value }) => (
                  <div key={label} className={label === 'Nationalité' ? 'col-span-2' : ''}>
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-[#001A4D]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-3">
              <h2 className="text-sm font-semibold text-[#001A4D] uppercase tracking-wider">Licence & Pratique</h2>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">N° Licence FFP</span>
                <span className="font-semibold text-[#001A4D]">{profile.numero_licence}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Type de pratique</span>
                <span className="font-semibold text-[#001A4D]">Amateur / Loisir</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Rôle</span>
                <span className="font-semibold text-[#001A4D] capitalize">{profile.role}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <p className="text-sm text-amber-800 font-semibold mb-2">Mode démo — profil fictif</p>
              <p className="text-sm text-amber-700 mb-4">
                Créez un compte pour enregistrer vos vraies informations, vos sauts, et accéder à toutes les fonctionnalités ParaPass.
              </p>
              <button
                onClick={() => navigate('/register')}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-5 rounded-xl transition text-sm"
              >
                Créer mon compte gratuit
              </button>
            </div>
          </div>
        )}

      </div>

      {selectedSaut && (
        <SautDetailModal saut={selectedSaut} onClose={() => setSelectedSaut(null)} />
      )}

      {conversionAction && (
        <ConversionModal action={conversionAction} onClose={() => setConversionAction(null)} />
      )}
    </div>
  );
}

export function DemoPage() {
  return (
    <DemoProvider>
      <DemoDashboardInner />
    </DemoProvider>
  );
}
