import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { QrScannerButton, QrScanner } from '../components/QrScanner';
import { ParachuteIcon, ParachuteDropIcon } from '../components/ParachuteIcon';
import { PlanningDZ } from './PlanningDZ';
import { Layout } from '../components/Layout';
import { MonComptePara } from '../components/MonComptePara';
import { AddSautModal } from '../components/AddSautModal';
import { ImportOCR } from '../components/ImportOCR';
import { DeclarationHonneur } from '../components/DeclarationHonneur';
import { BandeauAlertes } from '../components/AlertsPanel';
import { useAlertesContext } from '../lib/AlertesContext';
import { generatePDF } from '../lib/pdf';
import type { Saut, NotationTernaire, BadgeDefinition, Materiel, Maintenance } from '../lib/types';
import { NATURE_SAUT_LABELS, CATEGORIE_LABELS, FONCTION_LABELS, STATUT_LABELS, BADGES, TYPE_MATERIEL_LABELS } from '../lib/types';
import { useAlertes, type MaterielEcheance } from '../lib/useAlertes';
import { useComplianceRules, getMaterielEcheance } from '../lib/compliance';
import { MaRepriseCard } from '../components/MaRepriseCard';
import { BriefingDuJourBlock } from '../components/BriefingDuJourCard';
import { MeteoAltitudeCard } from '../components/MeteoAltitudeCard';
import { useDzMembre } from '../lib/briefing';
import { useBadges } from '../lib/useBadges';
import { usePassport } from '../lib/usePassport';
import { useDemo } from '../lib/useDemo';
import { PasseportCardView } from '../components/PasseportCardView';
import {
  Plus, FileDown, QrCode, Calendar, TrendingUp,
  ChevronDown, ChevronUp, Trash2, X, ShieldCheck, Hash,
  Pencil, Lock, Award, ChevronRight, Wind, Thermometer, Cloud, Sun, CloudRain, Camera, Wallet, Flame,
} from 'lucide-react';

// ─── Weather helpers (reused from PlanningDZ) ────────────────────────────────

// ─── KPI Card helpers ──────────────────────────────────────────────────────────

function monthsUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const exp = new Date(dateStr);
  const now = new Date();
  return Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

function expiryBarColor(months: number | null): string {
  if (months === null) return '#64748B';
  if (months < 0) return '#EF4444';
  if (months < 3) return '#F59E0B';
  return '#10B981';
}

interface KpiCardProps {
  accent: string;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  expiry?: { date: string | null; months: number | null };
}

function KpiCard({ accent, label, value, sub, expiry }: KpiCardProps) {
  const barColor = expiry ? expiryBarColor(expiry.months) : null;
  const barPct = expiry?.months !== null && expiry?.months !== undefined
    ? Math.max(0, Math.min(100, ((expiry.months ?? 0) / 12) * 100))
    : 0;

  return (
    <div
      style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        borderRadius: 12,
        borderLeft: `3px solid ${accent}`,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        padding: 20,
      }}
    >
      <p style={{ color: 'var(--c-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 500 }}>{label}</p>
      <p style={{ color: 'var(--c-text)', fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {expiry !== undefined && (
        <div style={{ height: 6, borderRadius: 3, background: 'var(--c-hover)', margin: '10px 0 6px', overflow: 'hidden' }}>
          <div className="progress-fill" style={{ height: '100%', width: `${barPct}%`, background: barColor ?? '#64748B', borderRadius: 3 }} />
        </div>
      )}
      <p style={{ color: 'var(--c-muted)', fontSize: 12, marginTop: expiry !== undefined ? 0 : 6 }}>{sub}</p>
    </div>
  );
}

type DashTab = 'accueil' | 'carnet' | 'planning' | 'compte';

// ─── Notation helpers ─────────────────────────────────────────────────────────

const STAR_COLORS = ['', '#EF4444', '#F59E0B', '#EAB308', '#84CC16', '#10B981'];

// ─── Raccourcis secondaires (grille 3 tuiles) ────────────────────────────────

function ShortcutTiles({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [reflexeDone, setReflexeDone] = useState(false);
  const [streak, setStreak]           = useState(0);
  const [reflexeLoading, setReflexeLoading] = useState(true);
  const [scanOpen, setScanOpen]       = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      supabase.from('drill_attempts').select('id').eq('profil_id', userId).eq('drill_date', today).maybeSingle(),
      supabase.from('drill_streaks').select('streak_courant').eq('profil_id', userId).maybeSingle(),
    ]).then(([{ data: attempt }, { data: streakRow }]) => {
      setReflexeDone(!!attempt);
      setStreak(streakRow?.streak_courant ?? 0);
      setReflexeLoading(false);
    });
  }, [userId]);

  const tiles = [
    {
      key: 'reflexe',
      icon: reflexeDone ? '✅' : '🎯',
      label: 'Réflexe du jour',
      badge: reflexeLoading ? null : reflexeDone
        ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399' }}>✓ fait</span>
        : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}>à faire</span>,
      streak: streak > 0 ? streak : null,
      bg: reflexeDone ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.07)',
      border: reflexeDone ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.25)',
      onClick: () => navigate('/reflexe'),
    },
    {
      key: 'academie',
      icon: '🎓',
      label: 'Académie',
      badge: <span className="text-[10px]" style={{ color: '#A78BFA' }}>Quiz · XP</span>,
      streak: null,
      bg: 'rgba(139,92,246,0.07)',
      border: '1px solid rgba(139,92,246,0.2)',
      onClick: () => navigate('/academie'),
    },
    {
      key: 'scanner',
      icon: '🎒',
      label: 'Scanner un sac',
      badge: <span className="text-[10px]" style={{ color: 'var(--c-dim)' }}>QR code</span>,
      streak: null,
      bg: 'var(--c-surface)',
      border: '1px solid var(--c-border-f)',
      onClick: () => setScanOpen(true),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {tiles.map(t => (
          <button
            key={t.key}
            onClick={t.onClick}
            className="flex flex-col items-center gap-1 rounded-xl py-3 px-2 text-center transition-opacity active:opacity-70"
            style={{ background: t.bg, border: t.border, cursor: 'pointer' }}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--c-text)' }}>
              {t.label}
            </span>
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {t.badge}
              {t.streak !== null && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#F97316' }}>
                  <Flame className="w-2.5 h-2.5" />{t.streak}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      {scanOpen && <QrScanner onClose={() => setScanOpen(false)} />}
    </>
  );
}

// ─── Mon sac du jour ──────────────────────────────────────────────────────────

function MonSacDuJour({ userId }: { userId: string }) {
  const [assignment, setAssignment] = useState<{ id: string; sac_id: string; start_at: string; sac: { nom_court: string | null; marque: string | null; modele: string | null; etat_journee: string } | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [rendu, setRendu] = useState(false);

  const load = () => {
    supabase
      .from('sac_assignments')
      .select('id, sac_id, start_at, sac:sacs_parachute(nom_court, marque, modele, etat_journee)')
      .eq('licencie_id', userId)
      .is('end_at', null)
      .maybeSingle()
      .then(({ data }) => { setAssignment(data as typeof assignment); setLoading(false); });
  };

  useEffect(() => { load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !assignment || rendu) return null;

  const { id: assignId, sac, sac_id, start_at } = assignment;
  const nom = sac?.nom_court || [sac?.marque, sac?.modele].filter(Boolean).join(' ') || 'Mon sac';
  const etat = sac?.etat_journee ?? 'pris';
  const age = Math.floor((Date.now() - new Date(start_at).getTime()) / 60000);
  const etatCfg = etat === 'a_plier'
    ? { label: 'Au tapis — à plier', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' }
    : { label: 'En votre possession', color: '#60A5FA', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)' };

  const rendre = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRendering(true);
    await supabase.from('sac_assignments').update({ end_at: new Date().toISOString(), ended_by: 'user' }).eq('id', assignId).is('end_at', null);
    await supabase.from('sacs_parachute').update({ etat_journee: 'libre' }).eq('id', sac_id);
    setRendering(false);
    setRendu(true);
  };

  return (
    <div className="rounded-xl mb-4 overflow-hidden"
      style={{ background: etatCfg.bg, border: `1px solid ${etatCfg.border}` }}>
      <a href={`/sac/${sac_id}`}
        className="flex items-center gap-3 px-4 py-3 no-underline"
        style={{ textDecoration: 'none' }}>
        <span className="text-2xl flex-shrink-0">🎒</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>{nom}</p>
          <p className="text-xs" style={{ color: etatCfg.color }}>{etatCfg.label}</p>
          <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Depuis {age < 60 ? `${age} min` : `${Math.floor(age / 60)} h ${age % 60} min`} · Toucher pour gérer</p>
        </div>
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-muted)' }} />
      </a>
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={rendre}
          disabled={rendering}
          className="w-full py-2 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}
        >
          {rendering ? 'Rendu en cours...' : '↩ Rendre le sac'}
        </button>
      </div>
    </div>
  );
}

function MiniStars({ value }: { value: number | null }) {
  if (!value) return <span style={{ color: 'var(--c-dim)' }} className="text-xs">—</span>;
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="w-3 h-3 rounded-sm inline-block"
          style={{ background: n <= value ? STAR_COLORS[value] : 'var(--c-hover)' }}
        />
      ))}
    </span>
  );
}

function TernaireBadge({ value }: { value: NotationTernaire }) {
  if (!value) return null;
  const map = {
    a_retravailler: { label: '✗', cls: 'bg-red-100 text-red-600' },
    correct: { label: '~', cls: 'bg-orange-100 text-orange-600' },
    bon: { label: '✓', cls: 'bg-green-100 text-green-600' },
  };
  const { label, cls } = map[value];
  return <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${cls}`}>{label}</span>;
}

void TernaireBadge;

// ─── Badge rarity styles ──────────────────────────────────────────────────────

const RARETE_STYLES: Record<string, { border: string; glow: string; label: string; labelColor: string }> = {
  commun:     { border: 'rgba(100,116,139,0.4)',  glow: 'rgba(100,116,139,0.1)',  label: 'Commun',     labelColor: '#94A3B8' },
  rare:       { border: 'rgba(249,115,22,0.5)',   glow: 'rgba(249,115,22,0.12)',  label: 'Rare',       labelColor: '#F97316' },
  epique:     { border: 'rgba(139,92,246,0.55)',  glow: 'rgba(139,92,246,0.14)', label: 'Épique',     labelColor: '#8B5CF6' },
  legendaire: { border: 'rgba(245,158,11,0.6)',   glow: 'rgba(245,158,11,0.16)', label: 'Légendaire', labelColor: '#F59E0B' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user, profile } = useAuth();
  const { isDemo, blockIfDemo } = useDemo();
  const [sauts, setSauts] = useState<Saut[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [sautAEditer, setSautAEditer] = useState<Saut | null>(null);
  const [sortField, setSortField] = useState<'date_saut' | 'lieu' | 'hauteur_m'>('date_saut');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<DashTab>('accueil');
  const [selectedSaut, setSelectedSaut] = useState<Saut | null>(null);
  const [centreNom, setCentreNom] = useState<string | null>(null);
  const [centrePlan, setCentrePlan] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle query params from external navigation (e.g., Ma Progression page)
  useEffect(() => {
    const action = searchParams.get('action');
    const tab = searchParams.get('tab') as DashTab | null;
    if (tab && ['accueil', 'carnet', 'planning', 'compte'].includes(tab)) {
      setActiveTab(tab);
    }
    if (action === 'add-jump' && !blockIfDemo()) {
      setModalOpen(true);
      // Clean up URL without triggering a re-render loop
      navigate('/dashboard', { replace: true });
    }
  }, []);

  const { licences, certificats, qualifications, brevets, centresLicencies } = usePassport(user?.id);
  const briefingDzs = useDzMembre(user?.id);
  const { rules: complianceRules } = useComplianceRules();

  // Échéances matériel (pliage secours, AAD…) pour le bandeau d'alertes
  const [materielEcheances, setMaterielEcheances] = useState<MaterielEcheance[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: mats, error: matError } = await supabase
        .from('materiels').select('*').eq('parachutiste_id', user.id).eq('statut', 'actif');
      if (matError) { console.error('Chargement matériels échoué :', matError); return; }
      if (!mats || mats.length === 0) { setMaterielEcheances([]); return; }
      const { data: maints, error: maintError } = await supabase
        .from('maintenances').select('*').in('materiel_id', mats.map((m) => m.id));
      if (maintError) { console.error('Chargement maintenances échoué :', maintError); return; }
      const echeances: MaterielEcheance[] = [];
      for (const mat of mats as Materiel[]) {
        const echeance = getMaterielEcheance(mat, (maints as Maintenance[] ?? []).filter((m) => m.materiel_id === mat.id), complianceRules);
        if (echeance) echeances.push({ label: `${TYPE_MATERIEL_LABELS[mat.type] ?? mat.type} — ${mat.marque} ${mat.modele}`, echeance });
      }
      setMaterielEcheances(echeances);
    })();
  }, [user?.id, complianceRules]);

  const { alertes } = useAlertes(user?.id, sauts, licences, certificats, qualifications, {
    typePratiquant: profile?.type_pratiquant,
    suiviDgac: !!(profile?.preferences as Record<string, unknown> | null | undefined)?.suivi_dgac,
    materiel: materielEcheances,
    rules: complianceRules,
  });
  const { badges, newBadge, dismissBadgeNotif } = useBadges(user?.id, sauts);

  const { acquittees, acquitterAlertes, setAlertes: setAlertesCtx, setStatutDocs: setStatutDocsCtx, setLicenceExpiration: setLicExpCtx, setCertifExpiration: setCertExpCtx } = useAlertesContext();

  useEffect(() => { setAlertesCtx(alertes); }, [alertes, setAlertesCtx]);

  const fetchSauts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('sauts')
      .select('*')
      .eq('parachutiste_id', user.id)
      .order('date_saut', { ascending: false });
    if (!error && data) setSauts(data as Saut[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSauts(); }, [fetchSauts]);

  // Realtime: reflect validation changes (statut, valide_par, valide_le) without a full reload
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`sauts-rt-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sauts', filter: `parachutiste_id=eq.${user.id}` },
        (payload) => {
          setSauts((prev) => prev.map((s) => s.id === (payload.new as Saut).id ? { ...s, ...(payload.new as Saut) } : s));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Load first centre name + weather
  useEffect(() => {
    if (!centresLicencies.length) return;
    const first = centresLicencies[0];
    const centre = (first as unknown as { centre?: { nom?: string; latitude?: number; longitude?: number; plan?: string } }).centre;
    if (centre?.nom) setCentreNom(centre.nom);
    if (centre?.plan) setCentrePlan(centre.plan);
    // Météo : gérée par l'unique MeteoAltitudeCard (cache partagé dz_meteo_cache)
  }, [centresLicencies]);

  const [centresCount, setCentresCount] = useState<number | null>(null);
  const [aDejaImporte, setADejaImporte] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('licencies_centres')
      .select('centre_id', { count: 'exact', head: true })
      .eq('parachutiste_id', user.id)
      .eq('statut', 'actif')
      .then(({ count }) => setCentresCount(count ?? 0));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: ocrSaut } = await supabase
        .from('sauts')
        .select('id')
        .eq('parachutiste_id', user.id)
        .eq('source', 'ocr_import')
        .limit(1)
        .maybeSingle();
      setADejaImporte(!!ocrSaut || !!(profile?.declaration_honneur_faite));
    })();
  }, [user?.id, profile?.declaration_honneur_faite]);

  const handleDelete = async (id: string) => {
    if (blockIfDemo()) return;
    if (!confirm('Supprimer ce saut ?')) return;
    await supabase.from('sauts').delete().eq('id', id);
    setSauts((s) => s.filter((sa) => sa.id !== id));
  };

  const openEdit = (saut: Saut) => {
    if (blockIfDemo()) return;
    setSautAEditer(saut);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSautAEditer(null);
  };

  const vraisSauts = sauts.filter((s) => !s.is_tunnel);
  const totalSauts = vraisSauts.length;
  const validSauts = vraisSauts.filter((s) => s.statut === 'valide' || s.statut === 'historique').length;

  const sautsCetteAnnee = vraisSauts.filter((s) => new Date(s.date_saut).getFullYear() === new Date().getFullYear()).length;
  const sortedByDate = [...sauts].sort((a, b) => b.date_saut.localeCompare(a.date_saut));
  const dernierSaut = sortedByDate.find((s) => !s.is_tunnel)
    ? new Date(sortedByDate.find((s) => !s.is_tunnel)!.date_saut).toLocaleDateString('fr-FR')
    : null;

  const sortedSauts = [...sauts].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'hauteur_m') return (a.hauteur_m - b.hauteur_m) * dir;
    return (a[sortField] ?? '').localeCompare(b[sortField] ?? '') * dir;
  });

  // Numérotation séquentielle uniquement sur les vrais sauts (pas soufflerie)
  // Calculé sur tous les sauts triés par date asc → attribue un numéro croissant aux non-soufflerie
  const sautNumeroMap = (() => {
    const byDateAsc = [...sauts]
      .filter((s) => !s.is_tunnel && s.statut !== 'declaration_honneur')
      .sort((a, b) => a.date_saut.localeCompare(b.date_saut));
    const map: Record<string, number> = {};
    byDateAsc.forEach((s, i) => { map[s.id] = i + 1; });
    return map;
  })();

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  };

  const statutBadge = (saut: Saut) => {
    if (saut.statut === 'valide') {
      const nom = saut.valide_par ? saut.valide_par.split(' ').pop() : '';
      return (
        <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }} className="inline-flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          {nom || 'Validé'}
        </span>
      );
    }
    if (saut.statut === 'en_attente') {
      return (
        <span style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }} className="inline-flex items-center gap-1">
          En attente
        </span>
      );
    }
    if (saut.statut === 'refuse') {
      return (
        <span style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }} className="inline-flex items-center gap-1">
          {STATUT_LABELS[saut.statut] || saut.statut}
        </span>
      );
    }
    if (saut.statut === 'historique') {
      return (
        <span style={{ background: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }} className="inline-flex items-center gap-1">
          Historique
        </span>
      );
    }
    if (saut.statut === 'declaration_honneur') {
      return (
        <span style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }} className="inline-flex items-center gap-1">
          📋 Déclaration
        </span>
      );
    }
    return null;
  };

  // ─── Badge section data ───────────────────────────────────────────────────

  const earnedTypes = new Set(badges.map((b) => b.type_badge));
  const earnedDefs = BADGES.filter((b) => earnedTypes.has(b.type));
  const last4Badges = earnedDefs.slice(-4).reverse();

  const volumeThresholds: [number, string][] = [
    [1, 'premier_saut'], [10, 'decollage'], [25, 'en_route'], [50, 'confirme'],
    [100, 'centenaire'], [200, 'veteran'], [300, 'expert'], [500, 'maitre'],
    [1000, 'legende'], [2000, 'icone'], [5000, 'mythe'], [10000, 'immortel'],
  ];
  const nextVolume = volumeThresholds.find(([, type]) => !earnedTypes.has(type));
  const nextBadgeDef = nextVolume ? BADGES.find((b) => b.type === nextVolume[1]) : null;
  const nextBadgeSautsRestants = nextVolume ? Math.max(0, nextVolume[0] - validSauts) : 0;

  // ─── Licence & certificat médical data ───────────────────────────────────
  const licenceFFP = licences.find((l) => l.organisme === 'FFP') ?? licences[0] ?? null;
  const certifMedical = certificats[0] ?? null;
  const licenceMonths = monthsUntil(licenceFFP?.date_expiration ?? null);
  const certifMonths = monthsUntil(certifMedical?.date_expiration ?? null);

  // ─── Statut autorisation calculé depuis les dates (pas depuis Supabase alertes) ─
  const _docNow = new Date();
  const _isExpired = (d: string) => new Date(d) < _docNow;
  const _expiresSoon = (d: string) => {
    const dt = new Date(d);
    const in30 = new Date(_docNow);
    in30.setDate(_docNow.getDate() + 30);
    return dt > _docNow && dt < in30;
  };
  const _licExpired = licenceFFP?.date_expiration ? _isExpired(licenceFFP.date_expiration) : false;
  const _certExpired = certifMedical?.date_expiration ? _isExpired(certifMedical.date_expiration) : false;
  const _assuranceOk = !!(licenceFFP?.assurance_individuelle && licenceFFP?.assurance_rc);
  const _licValide = !!licenceFFP?.date_expiration && !_licExpired;
  const _certValide = !!certifMedical?.date_expiration && !_certExpired;
  const statutDocs: 'valide' | 'expire_bientot' | 'expire' | null = (() => {
    if (!licenceFFP && !certifMedical) return null;
    if (_licExpired || _certExpired) return 'expire';
    if (
      (licenceFFP?.date_expiration && _expiresSoon(licenceFFP.date_expiration)) ||
      (certifMedical?.date_expiration && _expiresSoon(certifMedical.date_expiration))
    ) return 'expire_bientot';
    if (_licValide && _certValide && _assuranceOk) return 'valide';
    return null;
  })();

  useEffect(() => {
    setStatutDocsCtx(statutDocs);
    setLicExpCtx(licenceFFP?.date_expiration ?? null);
    setCertExpCtx(certifMedical?.date_expiration ?? null);
  }, [statutDocs, licenceFFP?.date_expiration, certifMedical?.date_expiration]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Brevet displayed in sub-title ───────────────────────────────────────
  const topBrevet = brevets[0]?.type_brevet ?? null;

  // ─── DZ day labels ────────────────────────────────────────────────────────

  if (!profile) return null;

  const hasFinances = centrePlan ? ['pro', 'enterprise'].includes(centrePlan) : false;

  const subTabs: { key: DashTab; label: string }[] = [
    { key: 'accueil', label: 'Vue d\'ensemble' },
    { key: 'carnet', label: 'Mon Carnet' },
    { key: 'planning', label: '📅 Ma DZ' },
    ...(hasFinances ? [{ key: 'compte' as DashTab, label: '💳 Mon compte' }] : []),
  ];

  return (
    <Layout noPadding>
      {isDemo && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold tracking-widest" style={{ background: '#F59E0B', color: '#1C1917' }}>
          ⚠ DONNÉES DE DÉMONSTRATION — Les informations affichées sont fictives
        </div>
      )}
      <BandeauAlertes alertes={alertes} acquittees={acquittees} onAcquitter={acquitterAlertes} statutDocs={statutDocs} licenceExpiration={licenceFFP?.date_expiration ?? null} certifExpiration={certifMedical?.date_expiration ?? null} userId={user?.id} />

      {/* Sub-nav */}
      <div style={{ background: 'var(--c-nav)', borderBottom: '1px solid var(--c-border-s)' }} className="sticky top-14 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex">
          {subTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap font-medium ${
                activeTab === t.key
                  ? 'border-[#F97316] font-semibold'
                  : 'border-transparent'
              }`}
              style={{ color: activeTab === t.key ? 'var(--c-text)' : 'var(--c-muted)' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8" style={{ background: 'var(--c-bg)', minHeight: 'calc(100vh - 112px)' }}>
        <div className="max-w-7xl mx-auto">

          {/* ─── ACCUEIL ─────────────────────────────────────────────────────── */}
          {activeTab === 'accueil' && (
            <>
              {/* 0 — Briefing du jour : PREMIER élément visible, sans scroll
                  (bandeau + carte pour chaque DZ active via licencies_centres) */}
              {briefingDzs.map(dz => (
                <BriefingDuJourBlock key={dz.id} dzId={dz.id} dzNom={dz.nom} userId={user?.id} />
              ))}

              {/* 1 — Bandeau compact brevet + autorisation */}
              {statutDocs && (() => {
                const cfg = statutDocs === 'expire'
                  ? { bg: 'rgba(239,68,68,0.12)', color: '#F87171', border: 'rgba(239,68,68,0.25)', label: '🔴 Documents à renouveler' }
                  : statutDocs === 'expire_bientot'
                  ? { bg: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: 'rgba(245,158,11,0.25)', label: '⚠️ Documents expirent bientôt' }
                  : { bg: 'rgba(16,185,129,0.12)', color: '#6EE7B7', border: 'rgba(16,185,129,0.25)', label: '✅ Documents à jour' };
                return (
                  <div
                    className="mb-3 flex items-center justify-between gap-3 rounded-xl px-4"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, minHeight: 44 }}
                  >
                    <span style={{ color: cfg.color, fontSize: 13, fontWeight: 600 }}>{cfg.label}</span>
                    {topBrevet && (
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(249,115,22,0.2)', color: '#F97316', border: '1px solid rgba(249,115,22,0.4)' }}
                      >
                        Brevet {topBrevet}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Carte « Ma reprise » — récence du dernier saut selon les règles paramétrées */}
              <div className="mb-3">
                <MaRepriseCard userId={user?.id} niveau={topBrevet} />
              </div>

              {/* Vent en altitude — météo localisée de chaque DZ affichée (prévision indicative) */}
              {briefingDzs.map(dz => (
                <MeteoAltitudeCard key={`meteo-${dz.id}`} dzId={dz.id} dzNom={briefingDzs.length > 1 ? dz.nom : undefined} />
              ))}

              {/* 2 — Layout 2 colonnes desktop : carte (gauche) + tuiles+boutons (droite) */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6 mb-6">

                {/* Colonne gauche : carte dématérialisée */}
                <div className="lg:flex-shrink-0 lg:w-[480px] mb-6 lg:mb-0">
                  <PasseportCardView userId={user!.id} compact={true} sautsCountOverride={totalSauts} validSautsCountOverride={validSauts} />
                </div>

                {/* Colonne droite : KPI tiles + bouton ajouter un saut */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">

                  {/* 4 KPI cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Card 1 — Total sauts */}
                    <KpiCard
                      accent="#F97316"
                      label="Total sauts"
                      value={
                        <span className="flex items-center gap-2">
                          <ParachuteDropIcon className="w-6 h-6 text-orange-500" />
                          {totalSauts}
                        </span>
                      }
                      sub={`+${sautsCetteAnnee} cette année`}
                    />
                    {/* Card 2 — Cette année */}
                    <KpiCard
                      accent="#003082"
                      label="Cette année"
                      value={<span className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-400" />{sautsCetteAnnee}</span>}
                      sub={dernierSaut ? `Dernier : ${dernierSaut}` : 'Aucun saut encore'}
                    />
                    {/* Card 3 — Licence FFP */}
                    <KpiCard
                      accent="#10B981"
                      label="Licence FFP"
                      value={
                        <span style={{ fontSize: 15, fontWeight: 700, color: licenceFFP ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                          {licenceFFP?.date_expiration
                            ? new Date(licenceFFP.date_expiration).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                      }
                      expiry={{ date: licenceFFP?.date_expiration ?? null, months: licenceMonths }}
                      sub={
                        licenceFFP?.date_expiration
                          ? licenceMonths !== null && licenceMonths < 0
                            ? <span style={{ color: '#EF4444', fontWeight: 600 }}>EXPIRÉE</span>
                            : `Valide · ${licenceMonths} mois restants`
                          : 'Non renseignée'
                      }
                    />
                    {/* Card 4 — Certificat médical */}
                    <KpiCard
                      accent="#8B5CF6"
                      label="Certificat médical"
                      value={
                        <span style={{ fontSize: 15, fontWeight: 700, color: certifMedical ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                          {certifMedical?.date_expiration
                            ? new Date(certifMedical.date_expiration).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                      }
                      expiry={{ date: certifMedical?.date_expiration ?? null, months: certifMonths }}
                      sub={
                        certifMedical?.date_expiration
                          ? certifMonths !== null && certifMonths < 0
                            ? <span style={{ color: '#EF4444', fontWeight: 600 }}>EXPIRÉ</span>
                            : `Valide · ${certifMonths} mois restants`
                          : 'Non renseigné'
                      }
                    />
                  </div>

                  {/* Bouton Ajouter un saut */}
                  <div>
                    <button
                      onClick={() => { if (!blockIfDemo()) setModalOpen(true); }}
                      disabled={isDemo}
                      title={isDemo ? 'Non disponible en mode démo' : undefined}
                      className="flex items-center justify-center gap-2 text-white px-5 rounded-lg text-sm font-bold transition-colors shadow-lg w-full"
                      style={{
                        height: 48,
                        background: isDemo ? 'var(--c-muted)' : '#F97316',
                        cursor: isDemo ? 'not-allowed' : 'pointer',
                        opacity: isDemo ? 0.6 : 1,
                      }}
                    >
                      <Plus className="w-5 h-5" /> Ajouter un saut
                    </button>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => navigate('/qr-code')}
                        className="flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors flex-1"
                        style={{ height: 44, background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--c-surface)')}
                      >
                        <QrCode className="w-4 h-4" /> Mon QR Code
                      </button>
                      <button
                        onClick={() => { if (!blockIfDemo()) generatePDF(profile, sauts); }}
                        disabled={sauts.length === 0 || isDemo}
                        title={isDemo ? 'Non disponible en mode démo' : undefined}
                        className="flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex-1"
                        style={{
                          height: 44, background: 'var(--c-surface)', border: '1px solid var(--c-border-f)', color: 'var(--c-text)',
                          cursor: isDemo ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => { if (!isDemo) e.currentTarget.style.background = 'var(--c-hover)'; }}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--c-surface)')}
                      >
                        <FileDown className="w-4 h-4" /> Exporter PDF
                      </button>
                    </div>
                  </div>

                </div>
              </div>{/* fin layout 2 colonnes */}

              <MonSacDuJour userId={user!.id} />

              {/* Raccourcis secondaires — grille 3 tuiles compactes */}
              {!isDemo && <ShortcutTiles userId={user!.id} />}

              {(profile.type_pratiquant === 'professionnel' || !!(profile.preferences as Record<string, unknown> | null | undefined)?.suivi_dgac) && (() => {
                const now = new Date();
                const twelveMonthsAgo = new Date(now);
                twelveMonthsAgo.setMonth(now.getMonth() - 12);
                const sauts12m = sauts.filter((s) => new Date(s.date_saut) >= twelveMonthsAgo).length;
                const pct = Math.min(100, Math.round((sauts12m / 20) * 100));
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-amber-800">Seuil DGAC : {sauts12m} / 20 sauts (12 mois)</span>
                      <span className="text-xs text-amber-600">{pct}%</span>
                    </div>
                    <div className="w-full bg-amber-200 rounded-full h-2.5">
                      <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    {sauts12m < 20 && (
                      <p className="text-xs text-amber-700 mt-2">Obligation réglementaire SNPP : 20 sauts minimum sur les 12 derniers mois.</p>
                    )}
                  </div>
                );
              })()}

              {/* Onboarding guide for new users */}
              {!loading && totalSauts === 0 && (
                <div className="mb-6 p-5 rounded-xl" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)' }}>
                  <h3 style={{ color: 'var(--c-text)' }} className="font-bold mb-1 flex items-center gap-2 text-base">Bienvenue sur ParaPass !</h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--c-muted)' }}>
                    Complétez votre profil en 3 étapes pour profiter de toutes les fonctionnalités.
                  </p>
                  <div className="space-y-3">
                    {[
                      { step: 1, label: 'Renseigner ma licence FFP', to: '/passeport', done: (licences ?? []).length > 0 },
                      { step: 2, label: 'Rejoindre mon centre de parachutisme', to: '/communaute?tab=centres', done: (centresCount ?? 0) > 0 },
                      { step: 3, label: 'Ajouter mon premier saut', to: null, done: totalSauts > 0 },
                    ].map((item) => (
                      <div key={item.step} className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: item.done ? '#10B981' : 'var(--c-surface)', color: item.done ? '#fff' : 'var(--c-dim)' }}
                        >
                          {item.done ? '✓' : item.step}
                        </div>
                        <span className="text-sm flex-1" style={{ color: item.done ? 'rgba(74,222,128,0.7)' : 'var(--c-text)', textDecoration: item.done ? 'line-through' : 'none' }}>
                          {item.label}
                        </span>
                        {!item.done && (
                          <button
                            onClick={() => { if (item.to) navigate(item.to); else if (!blockIfDemo()) setModalOpen(true); }}
                            className="text-xs font-medium transition-colors"
                            style={{ color: '#60A5FA' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#93C5FD')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#60A5FA')}
                          >
                            Commencer →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {/* Ma Progression card */}
              {!aDejaImporte && !isDemo && (
                <BanniereOCR onClic={() => setShowOCR(true)} />
              )}

              {/* Ma Progression card */}
              <ProgressionCard userId={user?.id ?? null} />

              {/* 3+5 — Bottom grid: sauts table (2/3) + right column (1/3) */}              <div className="flex flex-col md:flex-row gap-3">

                {/* Left — Derniers sauts (2/3) */}
                <div style={{ flex: 2, background: 'var(--c-dropdown)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
                  <div style={{ borderBottom: '1px solid var(--c-border)' }} className="px-5 py-4 flex items-center justify-between">
                    <h2 style={{ color: 'var(--c-text)', fontSize: 15, fontWeight: 600 }}>Derniers sauts</h2>
                    <button onClick={() => setActiveTab('carnet')} style={{ color: '#F97316', fontSize: 12 }} className="font-medium hover:opacity-80 transition-opacity">
                      Voir tout →
                    </button>
                  </div>
                  {loading ? (
                    <div className="p-8 text-center text-sm" style={{ color: 'var(--c-muted)' }}>Chargement...</div>
                  ) : sauts.length === 0 ? (
                    <div className="p-10 text-center">
                      <ParachuteIcon className="w-24 h-24 mx-auto mb-3" style={{ color: 'var(--c-border-f)' }} />
                      <p className="text-sm" style={{ color: 'var(--c-muted)' }}>Aucun saut enregistré</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>Cliquez sur "Ajouter un saut" pour commencer</p>
                    </div>
                  ) : (
                    <div>
                      {sortedByDate.slice(0, 5).map((saut, idx) => (
                        <div
                          key={saut.id}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                          style={{ borderBottom: idx < Math.min(sortedByDate.length, 5) - 1 ? '1px solid var(--c-border-s)' : 'none' }}
                          onClick={() => setSelectedSaut(saut)}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                            style={saut.source === 'soufflerie'
                              ? { background: 'rgba(96,165,250,0.15)', color: '#60A5FA', fontSize: 16 }
                              : { background: 'rgba(249,115,22,0.15)', color: '#F97316' }}
                          >
                            {saut.source === 'soufflerie' ? '🌬️' : (sautNumeroMap[saut.id] ?? '—')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{saut.lieu}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                              {new Date(saut.date_saut).toLocaleDateString('fr-FR')}
                              {saut.source === 'soufflerie'
                                ? ` · Soufflerie${(saut as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes ? ` · ${(saut as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes} min` : ''}`
                                : ` · ↑${saut.hauteur_m}m${saut.hauteur_ouverture ? ` · ✂${saut.hauteur_ouverture}m` : ''} · ${NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {statutBadge(saut)}
                            <ChevronRight className="w-4 h-4" style={{ color: 'var(--c-dim)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right column (1/3) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

                  {/* 5 — Badges compact grid */}
                  {(last4Badges.length > 0 || nextBadgeDef) && (
                    <div style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16 }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Award className="w-3.5 h-3.5 text-orange-400" />
                          <span className="text-xs font-bold" style={{ color: 'var(--c-text)' }}>Badges</span>
                          {badges.length > 0 && (
                            <span style={{ background: 'rgba(249,115,22,0.2)', color: '#FB923C', fontSize: 10 }} className="font-semibold px-1.5 py-0.5 rounded-full">
                              {badges.length}
                            </span>
                          )}
                        </div>
                        <button onClick={() => navigate('/badges')} style={{ color: '#F97316', fontSize: 11 }} className="font-medium hover:opacity-80 transition-opacity">
                          Voir tout →
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {last4Badges.map((b) => (
                          <CompactBadgeCard key={b.type} def={b} earned />
                        ))}
                        {nextBadgeDef && (
                          <CompactBadgeCard def={nextBadgeDef} earned={false} locked sauts={nextBadgeSautsRestants} />
                        )}
                      </div>
                      {last4Badges.length === 0 && (
                        <p style={{ color: '#5A7A9A', fontSize: 11 }} className="mt-1">
                          Commencez à sauter pour débloquer vos premiers badges !
                        </p>
                      )}
                    </div>
                  )}

                  {/* La météo vit désormais dans l'unique carte compacte
                      « Vent en altitude » en haut de page (détail au clic) */}
                </div>
              </div>

              {/* Briefing du jour acquitté : version compacte en bas de page,
                  consultable sans monopoliser le haut de l'écran */}
              <div className="mt-3">
                {briefingDzs.map(dz => (
                  <BriefingDuJourBlock key={`bas-${dz.id}`} dzId={dz.id} dzNom={dz.nom} userId={user?.id} position="bas" />
                ))}
              </div>
            </>
          )}

          {/* ─── CARNET ──────────────────────────────────────────────────────── */}
          {activeTab === 'carnet' && (
            <div style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)' }} className="rounded-xl overflow-hidden">
              <div style={{ borderBottom: '1px solid var(--c-border)' }} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="font-bold" style={{ fontSize: 20, color: 'var(--c-text)' }}>Mon Carnet de sauts</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>{totalSauts} sauts enregistrés</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isDemo && (
                    <button
                      onClick={() => setShowOCR(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ border: '1px solid var(--c-border-f)', color: 'var(--c-text2)', background: 'var(--c-surface)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--c-surface)')}
                      title="Importer depuis un carnet papier via Claude Vision"
                    >
                      <Camera className="w-4 h-4" /> Carnet papier
                    </button>
                  )}
                  <button
                    onClick={() => { if (!blockIfDemo()) setModalOpen(true); }}
                    disabled={isDemo}
                    title={isDemo ? 'Non disponible en mode démo' : undefined}
                    className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: isDemo ? 'var(--c-muted)' : '#F97316',
                      cursor: isDemo ? 'not-allowed' : 'pointer',
                      opacity: isDemo ? 0.6 : 1,
                    }}
                  >
                    <Plus className="w-4 h-4" /> Ajouter
                  </button>
                </div>
              </div>

              {/* Bandeau invitation déclaration sur l'honneur */}
              {!profile?.declaration_honneur_faite && totalSauts < 10 && (
                <div
                  className="mx-4 mt-4 rounded-xl flex items-center justify-between gap-3 px-4 py-3"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#A78BFA' }}>
                      📋 Vous avez déjà sauté avant ParaPass ?
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                      Déclarez votre solde antérieur sur l'honneur pour démarrer votre carnet numérique au bon numéro.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeclaration(true)}
                    className="flex-shrink-0 text-xs font-semibold rounded-lg px-3 py-2 transition"
                    style={{ background: '#A78BFA', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#9061f9')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#A78BFA')}
                  >
                    Déclarer mon solde →
                  </button>
                </div>
              )}

              {loading ? (
                <div className="p-8 text-center" style={{ color: 'var(--c-dim)' }}>Chargement...</div>
              ) : sauts.length === 0 ? (
                <div className="p-12 text-center">
                  <ParachuteIcon className="w-36 h-36 mx-auto mb-3" style={{ color: 'var(--c-border-f)' }} />
                  <p className="font-medium" style={{ color: 'var(--c-muted)' }}>Aucun saut enregistré</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--c-dim)' }}>Cliquez sur "Ajouter" pour commencer</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto w-full">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '21%' }} />
                        <col style={{ width: '4%' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ background: 'var(--c-card)', color: 'var(--c-muted)' }}>
                          <th className="px-4 py-3 text-left font-medium">N°</th>
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
                          <th className="px-4 py-3 text-left font-medium w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'var(--c-border-s)' }}>
                        {sortedSauts.map((saut) => (
                          <SautRowCarnet
                            key={saut.id}
                            saut={saut}
                            numero={sautNumeroMap[saut.id] ?? null}
                            statutBadge={statutBadge}
                            onEdit={openEdit}
                            onDetail={setSelectedSaut}
                            onDelete={handleDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card list */}
                  <div className="md:hidden p-3 space-y-2">
                    {sortedSauts.map((saut) => (
                      <SautCardMobile
                        key={saut.id}
                        saut={saut}
                        numero={sautNumeroMap[saut.id] ?? null}
                        statutBadge={statutBadge}
                        onEdit={openEdit}
                        onDetail={setSelectedSaut}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── PLANNING ────────────────────────────────────────────────────── */}
          {activeTab === 'planning' && <PlanningDZ />}

          {/* ─── MON COMPTE ──────────────────────────────────────────────────── */}
          {activeTab === 'compte' && user && (
            <div className="max-w-2xl mx-auto pt-2">
              <div className="flex items-center gap-2 mb-5">
                <Wallet className="w-5 h-5" style={{ color: '#F97316' }} />
                <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>Mon compte</h2>
              </div>
              <MonComptePara userId={user.id} />
            </div>
          )}

        </div>
      </div>

      <AddSautModal
        open={modalOpen}
        onClose={closeModal}
        onAdded={(saut) => {
          if (sautAEditer) {
            setSauts((s) => s.map((sa) => sa.id === saut.id ? saut : sa));
          } else {
            setSauts((s) => [saut, ...s]);
          }
        }}
        sautAEditer={sautAEditer}
      />

      {showOCR && user && (
        <ImportOCR
          userId={user.id}
          onClose={() => setShowOCR(false)}
          onImported={(count) => {
            setShowOCR(false);
            setADejaImporte(true);
            // Reload sauts list
            supabase
              .from('sauts')
              .select('*')
              .eq('parachutiste_id', user.id)
              .order('date_saut', { ascending: false })
              .then(({ data }) => { if (data) setSauts(data as Saut[]); });
            void count;
          }}
        />
      )}

      {selectedSaut && (
        <SautDetailModal saut={selectedSaut} onClose={() => setSelectedSaut(null)} />
      )}

      {showDeclaration && user && profile && (
        <DeclarationHonneur
          profile={profile}
          userId={user.id}
          onClose={() => setShowDeclaration(false)}
          onConfirmed={(nb) => {
            setShowDeclaration(false);
            alert(`${nb} sauts déclarés sur l'honneur — votre prochain saut sera le n°${nb + 1}`);
            fetchSauts();
          }}
        />
      )}

      <BadgeNotif newBadge={newBadge} onDismiss={dismissBadgeNotif} />
    </Layout>
  );
}

// ─── Saut card for mobile Carnet ─────────────────────────────────────────────

function SautCardMobile({
  saut, numero, statutBadge, onEdit, onDetail, onDelete,
}: {
  saut: Saut;
  numero: number | null;
  statutBadge: (s: Saut) => React.ReactNode;
  onEdit: (s: Saut) => void;
  onDetail: (s: Saut) => void;
  onDelete: (id: string) => void;
}) {
  const canEdit = saut.statut !== 'valide' && saut.statut !== 'refuse';
  const isSoufflerie = saut.source === 'soufflerie' || saut.is_tunnel === true;

  if (saut.statut === 'declaration_honneur') {
    return (
      <div
        style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 10, padding: '12px 14px' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 18 }}>📋</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#A78BFA' }}>
              Solde antérieur — {saut.nb_sauts_declares ?? '?'} sauts déclarés sur l'honneur
            </p>
            <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
              Déclaré le {new Date(saut.created_at).toLocaleDateString('fr-FR')} · Déclaré sur l'honneur
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}
      onClick={() => onDetail(saut)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {isSoufflerie
            ? <span style={{ fontSize: 14 }}>🌬️</span>
            : <span style={{ color: '#F97316', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>{numero !== null ? `#${numero}` : '—'}</span>}
          <span style={{ color: 'var(--c-text)', fontSize: 13, fontWeight: 500 }}>{new Date(saut.date_saut).toLocaleDateString('fr-FR')}</span>
        </div>
        {!isSoufflerie && statutBadge(saut)}
      </div>
      <p style={{ color: 'var(--c-text)', fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{saut.lieu}</p>
      <div className="flex items-center gap-1" style={{ color: 'var(--c-muted)', fontSize: 12 }}>
        {isSoufflerie ? (
          <>
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}>Soufflerie</span>
            {(saut as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes && <><span>·</span><span style={{ color: '#93C5FD' }}>{(saut as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes} min</span></>}
            {(saut as { tunnel_discipline?: string | null }).tunnel_discipline && <><span>·</span><span>{(saut as { tunnel_discipline?: string | null }).tunnel_discipline}</span></>}
          </>
        ) : (
          <>
            <span>{NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut}</span>
            <span>·</span>
            <span title={saut.hauteur_ouverture ? `Largage : ${saut.hauteur_m}m · Ouverture : ${saut.hauteur_ouverture}m` : undefined}>
              ↑{saut.hauteur_m}m{saut.hauteur_ouverture ? ` · ✂${saut.hauteur_ouverture}m` : ''}
            </span>
            <span>·</span>
            <span>{FONCTION_LABELS[saut.fonction] || saut.fonction}</span>
          </>
        )}
        {(canEdit) && (
          <>
            <span className="ml-auto" />
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(saut); }}
              style={{ color: '#5A7A9A', padding: '4px 4px', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(saut.id); }}
              style={{ color: '#5A7A9A', padding: '4px 0', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Compact badge card (4-col grid) ─────────────────────────────────────────

function CompactBadgeCard({ def, earned, locked, sauts }: { def: BadgeDefinition; earned: boolean; locked?: boolean; sauts?: number }) {
  const rs = RARETE_STYLES[def.rarete] ?? RARETE_STYLES.commun;
  return (
    <div
      className="flex flex-col items-center gap-1 p-2 rounded-lg"
      style={{
        background: earned && !locked ? rs.glow : 'rgba(255,255,255,0.04)',
        border: `0.5px solid ${earned && !locked ? rs.border : 'rgba(255,255,255,0.06)'}`,
        opacity: locked ? 0.4 : 1,
      }}
    >
      <span className="text-xl" style={{ filter: locked ? 'grayscale(1)' : 'none' }}>{def.icone}</span>
      <span className="text-[9px] font-semibold text-white/70 text-center leading-tight line-clamp-1">{def.nom}</span>
      <span className="text-[9px] font-medium" style={{ color: locked ? '#64748B' : rs.labelColor }}>
        {locked && sauts !== undefined ? `${sauts} restants` : rs.label}
      </span>
    </div>
  );
}

// ─── Saut row for Carnet tab ──────────────────────────────────────────────────

function SautRowCarnet({
  saut,
  numero,
  statutBadge,
  onEdit,
  onDetail,
  onDelete,
}: {
  saut: Saut;
  numero: number | null;
  statutBadge: (s: Saut) => React.ReactNode;
  onEdit: (s: Saut) => void;
  onDetail: (s: Saut) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const canEdit = saut.statut !== 'valide' && saut.statut !== 'refuse';
  const isSoufflerie = saut.source === 'soufflerie' || saut.is_tunnel === true;

  if (saut.statut === 'declaration_honneur') {
    return (
      <tr style={{ background: 'rgba(167,139,250,0.06)' }}>
        <td colSpan={9} className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 18 }}>📋</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#A78BFA' }}>
                Solde antérieur — {saut.nb_sauts_declares ?? '?'} sauts déclarés sur l'honneur
              </p>
              <p className="text-xs" style={{ color: 'var(--c-dim)' }}>
                Déclaré le {new Date(saut.created_at).toLocaleDateString('fr-FR')} · Déclaré sur l'honneur
              </p>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="transition-colors cursor-pointer"
      style={{ background: hovered ? 'var(--c-hover)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onDetail(saut)}
    >
      <td className="px-4 py-3">
        {isSoufflerie
          ? <span style={{ fontSize: 16 }}>🌬️</span>
          : <span className="font-mono text-xs font-semibold" style={{ color: 'var(--c-dim)' }}>{numero !== null ? `#${numero}` : '—'}</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--c-text)' }}>{new Date(saut.date_saut).toLocaleDateString('fr-FR')}</td>
      <td style={{ color: 'var(--c-text2)' }} className="px-4 py-3 truncate">{saut.lieu}</td>
      <td style={{ color: 'var(--c-text2)' }} className="px-4 py-3 truncate">
        {isSoufflerie
          ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}>🌬️ Soufflerie</span>
          : (NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut)}
      </td>
      <td style={{ color: 'var(--c-text2)' }} className="px-4 py-3">
        {isSoufflerie
          ? <span style={{ color: '#93C5FD', fontSize: 12 }}>{(saut as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes ? `${(saut as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes} min` : '—'}{(saut as { tunnel_discipline?: string | null }).tunnel_discipline ? ` · ${(saut as { tunnel_discipline?: string | null }).tunnel_discipline}` : ''}</span>
          : <span title={saut.hauteur_ouverture ? `Largage : ${saut.hauteur_m}m · Ouverture : ${saut.hauteur_ouverture}m` : undefined}>↑{saut.hauteur_m}m{saut.hauteur_ouverture ? ` · ✂${saut.hauteur_ouverture}m` : ''}</span>}
      </td>
      <td style={{ color: 'var(--c-text2)' }} className="px-4 py-3 truncate">{FONCTION_LABELS[saut.fonction] || saut.fonction}</td>
      <td className="px-4 py-3"><MiniStars value={saut.position_globale} /></td>
      <td className="px-4 py-3">{statutBadge(saut)}</td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {hovered ? (
          canEdit ? (
            <div className="flex items-center gap-1.5">
              <button onClick={() => onEdit(saut)} className="text-white/40 hover:text-orange-400 transition-colors" title="Modifier">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(saut.id)} className="text-white/20 hover:text-red-500 transition-colors" title="Supprimer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Lock className="w-4 h-4 text-white/25" title="Saut validé — non modifiable" />
          )
        ) : null}
      </td>
    </tr>
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
    { label: 'Tête', key: 'position_tete' },
    { label: 'Bassin', key: 'position_bassin' },
    { label: 'Jambes', key: 'position_jambes' },
    { label: 'Bras', key: 'position_bras' },
  ];
  const ternaireFields: { label: string; key: keyof Saut }[] = [
    { label: 'Sortie avion', key: 'sortie_avion' },
    { label: 'Retour face sol', key: 'retour_face_sol' },
    { label: 'Vigilance altitude', key: 'vigilance_altitude' },
    { label: 'Ouverture', key: 'ouverture_notes' },
  ];
  const hashShort = saut.validation_hash ? saut.validation_hash.substring(0, 16) : null;

  const statutBadge = (s: Saut) => {
    if (s.statut === 'valide') {
      const nom = s.valide_par ? s.valide_par.split(' ').pop() : '';
      return (
        <span style={{ background: 'rgba(5, 150, 105, 0.4)', color: '#4ade80' }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium">
          <ShieldCheck className="w-3 h-3" />
          {nom || 'Validé'}
        </span>
      );
    }
    if (s.statut === 'en_attente') {
      return (
        <span style={{ background: 'rgba(180, 83, 9, 0.4)', color: '#facc15' }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium">
          En attente
        </span>
      );
    }
    if (s.statut === 'refuse') {
      return (
        <span style={{ background: 'rgba(127, 29, 29, 0.4)', color: '#f87171' }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium">
          {STATUT_LABELS[s.statut] || s.statut}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.15)' }} className="rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }} className="flex items-center justify-between p-5">
          <div>
            <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-medium uppercase tracking-wide">{saut.source === 'soufflerie' ? '🌬️ Session soufflerie' : 'Détail du saut'}</p>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {new Date(saut.date_saut).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {saut.source === 'soufflerie' ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Centre', value: saut.lieu },
                { label: 'Temps de vol', value: (saut as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes ? `${(saut as { tunnel_flight_minutes?: number | null }).tunnel_flight_minutes} min` : null },
                { label: 'Nb de vols', value: (saut as { tunnel_flight_count?: number | null }).tunnel_flight_count ? String((saut as { tunnel_flight_count?: number | null }).tunnel_flight_count) : null },
                { label: 'Discipline', value: (saut as { tunnel_discipline?: string | null }).tunnel_discipline },
                { label: 'Coach / encadrant', value: (saut as { tunnel_coach?: string | null }).tunnel_coach },
                { label: 'Nature', value: NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(96,165,250,0.08)', borderRadius: 12, border: '1px solid rgba(96,165,250,0.15)' }} className="p-3">
                  <p style={{ color: 'rgba(96,165,250,0.6)' }} className="text-xs mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-white">{value || '—'}</p>
                </div>
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Lieu / DZ', value: saut.lieu },
              { label: 'Aéronef', value: saut.aeronef_immat },
              { label: 'Nature', value: NATURE_SAUT_LABELS[saut.nature_saut] || saut.nature_saut },
              { label: 'Catégorie', value: CATEGORIE_LABELS[saut.categorie] || saut.categorie },
              { label: 'Hauteur largage', value: `${saut.hauteur_m} m` },
              { label: 'Hauteur ouverture', value: saut.hauteur_ouverture ? `${saut.hauteur_ouverture} m` : '—' },
              { label: 'Fonction', value: FONCTION_LABELS[saut.fonction] || saut.fonction },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} className="p-3">
                <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-white">{value || '—'}</p>
              </div>
            ))}
          </div>
          )}

          {saut.source !== 'soufflerie' && (saut.programme || saut.exercice_chute || saut.exercice_voile) && (
            <div className="space-y-2">
              <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-semibold uppercase tracking-wide">Programme moniteur</p>
              {saut.programme && (
                <div style={{ background: 'rgba(59,130,246,0.12)' }} className="rounded-xl p-3">
                  <p style={{ color: 'rgba(59,130,246,0.8)' }} className="text-xs mb-0.5">Programme</p>
                  <p className="text-sm text-white">{saut.programme}</p>
                </div>
              )}
              {saut.exercice_chute && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} className="p-3">
                  <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs mb-0.5">Exercice chute libre</p>
                  <p className="text-sm text-white">{saut.exercice_chute}</p>
                </div>
              )}
              {saut.exercice_voile && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} className="p-3">
                  <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs mb-0.5">Exercice sous voile</p>
                  <p className="text-sm text-white">{saut.exercice_voile}</p>
                </div>
              )}
            </div>
          )}

          {saut.source !== 'soufflerie' && posFields.some((f) => saut[f.key] !== null && saut[f.key] !== undefined) && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-semibold uppercase tracking-wide mb-2">Notation position</p>
              <div className="grid grid-cols-2 gap-2">
                {posFields.map(({ label, key }) => {
                  const val = saut[key] as number | null;
                  return (
                    <div key={key} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} className="p-3 flex items-center justify-between">
                      <span style={{ color: 'rgba(255,255,255,0.5)' }} className="text-xs">{label}</span>
                      <MiniStars value={val} />
                    </div>
                  );
                })}
                {saut.position_globale !== null && saut.position_globale !== undefined && (
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} className="col-span-2 p-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Position globale</span>
                    <MiniStars value={saut.position_globale} />
                  </div>
                )}
              </div>
            </div>
          )}

          {saut.source !== 'soufflerie' && ternaireFields.some((f) => saut[f.key] !== null) && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-semibold uppercase tracking-wide mb-2">Observations techniques</p>
              <div className="grid grid-cols-2 gap-2">
                {ternaireFields.map(({ label, key }) => {
                  const val = saut[key] as NotationTernaire;
                  if (!val) return null;
                  const cfg = TERNAIRE_CONFIG[val];
                  return (
                    <div key={key} style={{ background: cfg === TERNAIRE_CONFIG.bon ? 'rgba(5, 150, 105, 0.2)' : cfg === TERNAIRE_CONFIG.correct ? 'rgba(180, 83, 9, 0.2)' : 'rgba(127, 29, 29, 0.2)', border: cfg === TERNAIRE_CONFIG.bon ? '1px solid rgba(5, 150, 105, 0.4)' : cfg === TERNAIRE_CONFIG.correct ? '1px solid rgba(180, 83, 9, 0.4)' : '1px solid rgba(127, 29, 29, 0.4)' }} className="rounded-xl p-3">
                      <p style={{ color: cfg === TERNAIRE_CONFIG.bon ? '#4ade80' : cfg === TERNAIRE_CONFIG.correct ? '#facc15' : '#f87171', opacity: 0.7 }} className="text-xs mb-0.5">{label}</p>
                      <p style={{ color: cfg === TERNAIRE_CONFIG.bon ? '#4ade80' : cfg === TERNAIRE_CONFIG.correct ? '#facc15' : '#f87171' }} className="text-xs font-bold">{cfg.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(saut.observations || saut.observations_moniteur) && (
            <div className="space-y-2">
              {saut.observations && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} className="p-3">
                  <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs mb-0.5">Observations</p>
                  <p className="text-sm text-white">{saut.observations}</p>
                </div>
              )}
              {saut.observations_moniteur && (
                <div style={{ background: 'rgba(59,130,246,0.12)' }} className="rounded-xl p-3">
                  <p style={{ color: 'rgba(59,130,246,0.8)' }} className="text-xs mb-0.5">Observations moniteur</p>
                  <p className="text-sm text-white">{saut.observations_moniteur}</p>
                </div>
              )}
            </div>
          )}

          {saut.source !== 'soufflerie' && saut.signature_moniteur_url && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-semibold uppercase tracking-wide mb-2">Signature moniteur</p>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} className="p-3">
                <img src={saut.signature_moniteur_url} alt="Signature moniteur" className="max-h-16 object-contain" />
              </div>
            </div>
          )}

          {hashShort && (
            <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }} className="rounded-xl p-3 flex items-center gap-3">
              <div style={{ background: 'rgba(16,185,129,0.2)' }} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                <Hash className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-green-400">Saut signé cryptographiquement</p>
                <p className="text-xs text-green-400 font-mono mt-0.5">{hashShort}…</p>
              </div>
            </div>
          )}

          {saut.source !== 'soufflerie' && (
          <div className="pt-1">
            {statutBadge(saut)}
            {saut.valide_par && <p style={{ color: 'rgba(255,255,255,0.35)' }} className="text-xs mt-1">Signé par : {saut.valide_par}</p>}
            {saut.valide_le && <p style={{ color: 'rgba(255,255,255,0.35)' }} className="text-xs">Le : {new Date(saut.valide_le).toLocaleDateString('fr-FR')}</p>}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bannière OCR import ─────────────────────────────────────────────────────

function BanniereOCR({ onClic }: { onClic: () => void }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const points = ['Sauts illimités', 'Écriture manuscrite', 'Validation manuelle', 'Statut Historique · Déclaré sur l\'honneur'];

  return (
    <div
      className="mb-6 rounded-2xl overflow-hidden relative cursor-pointer select-none"
      style={{ background: 'linear-gradient(135deg, #0F2549 0%, #1a3a6e 50%, #0F2549 100%)', border: '1px solid rgba(249,115,22,0.3)' }}
      onClick={onClic}
    >
      {/* Decorative glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(249,115,22,0.12) 0%, transparent 60%)' }}
      />

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); setVisible(false); }}
        className="absolute top-3 right-3 z-10 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="relative p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}
        >
          <Camera className="w-7 h-7" style={{ color: '#F97316' }} />
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: 'rgba(249,115,22,0.2)', color: '#F97316', border: '1px solid rgba(249,115,22,0.35)' }}
            >
              Nouveau
            </span>
          </div>
          <h3 className="font-bold text-white text-base leading-snug mb-1">
            Importez votre carnet papier avec l'IA
          </h3>
          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Photographiez vos pages · Claude Vision extrait tous vos sauts · Archivé et horodaté
          </p>
          <div className="hidden sm:flex flex-wrap gap-x-3 gap-y-1">
            {points.map((p) => (
              <span key={p} className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                ✓ {p}
              </span>
            ))}
          </div>
        </div>

        {/* Price + CTA */}
        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] leading-none mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>une seule fois</p>
            <p className="text-2xl font-black text-white leading-none">4,99€</p>
          </div>
          <div
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all whitespace-nowrap"
            style={{ background: '#F97316', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}
          >
            <Camera className="w-4 h-4" />
            Commencer →
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Progression Card (dashboard) ────────────────────────────────────────────

interface JumpProgSummary {
  note_globale: number | null;
  note_tete: number | null;
  note_bassin: number | null;
  note_jambes: number | null;
  note_bras: number | null;
  note_ouverture_voile: number | null;
  note_atterrissage: number | null;
  note_mental: number | null;
  precision_metres: number | null;
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
  created_at: string;
}

function avg(arr: (number | null)[]): number | null {
  const vals = arr.filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function noteColor(n: number | null): string {
  if (n === null) return '#64748B';
  if (n < 2.5) return '#EF4444';
  if (n < 3.5) return '#F59E0B';
  return '#10B981';
}

function ProgressionCard({ userId }: { userId: string | null }) {
  const [data, setData] = useState<JumpProgSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      const { data: rows } = await supabase
        .from('jump_progression')
        .select('note_globale,note_tete,note_bassin,note_jambes,note_bras,note_ouverture_voile,note_atterrissage,note_mental,precision_metres,sortie_avion,retour_face_sol,vigilance_altitude,ouverture,separation,trajectoire,declenchement,pilotage_voile,circuit_atterro,precision_atterro,gestion_urgences,created_at')
        .eq('user_id', userId)
        .not('note_globale', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);
      setData((rows as JumpProgSummary[]) ?? []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return null;
  if (data.length < 1) return null;

  const noteGlobaleAvg = avg(data.map((d) => d.note_globale));
  const positionAvg = avg(data.map((d) => {
    const vals = [d.note_tete, d.note_bassin, d.note_jambes, d.note_bras].filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }));
  const atterrissageAvg = avg(data.map((d) => d.note_atterrissage));
  const mentalAvg = avg(data.map((d) => d.note_mental));

  const precisions = data.map((d) => d.precision_metres).filter((v): v is number => v !== null);
  const precisionAvg = precisions.length ? Math.round(precisions.reduce((a, b) => a + b, 0) / precisions.length) : null;

  const TECH_FIELDS = ['sortie_avion','retour_face_sol','vigilance_altitude','ouverture','separation','trajectoire','declenchement','pilotage_voile','circuit_atterro','precision_atterro','gestion_urgences'] as const;
  const maitrisesTotal = data.flatMap((d) => TECH_FIELDS.map((f) => d[f as keyof JumpProgSummary])).filter((v) => v === 'maitrise').length;
  const evalTotal = data.flatMap((d) => TECH_FIELDS.map((f) => d[f as keyof JumpProgSummary])).filter((v) => v !== null).length;
  const techMaîtrisePct = evalTotal > 0 ? maitrisesTotal / evalTotal : 0;
  const techScore = Math.round(techMaîtrisePct * 11);

  const atterrissageDebout = data.filter((d) => (d.note_atterrissage ?? 0) >= 4).length;

  // Trend
  const half = Math.ceil(data.length / 2);
  const recent = avg(data.slice(0, half).map((d) => d.note_globale));
  const older = avg(data.slice(half).map((d) => d.note_globale));
  const trend = recent !== null && older !== null ? (recent > older ? 'up' : recent < older - 0.2 ? 'down' : 'stable') : 'stable';

  // Alert banners
  const last3Notes = data.slice(0, 3).map((d) => d.note_globale).filter((v): v is number => v !== null);
  const showLowAlert = last3Notes.length === 3 && last3Notes.every((n) => n < 3);
  const last5Notes = data.slice(0, 5).map((d) => d.note_globale).filter((v): v is number => v !== null);
  const showHighAlert = last5Notes.length === 5 && last5Notes.every((n, i, arr) => i === 0 || n >= arr[i - 1]);

  const kpis = [
    {
      label: 'Note globale',
      value: noteGlobaleAvg !== null ? `${noteGlobaleAvg.toFixed(1)} ★` : '—',
      color: noteColor(noteGlobaleAvg),
      sub: trend === 'up' ? '↑ En hausse' : trend === 'down' ? '↓ En baisse' : '→ Stable',
      subColor: trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : 'var(--c-dim)',
    },
    {
      label: 'Position corps',
      value: positionAvg !== null ? `${positionAvg.toFixed(1)} / 5` : '—',
      color: noteColor(positionAvg),
      sub: 'Tête · Bassin · Jambes · Bras',
      subColor: 'var(--c-muted)',
    },
    {
      label: 'Posés debout',
      value: `${atterrissageDebout} / ${data.length}`,
      color: '#10B981',
      sub: null,
      bar: data.length > 0 ? (atterrissageDebout / data.length) * 100 : 0,
      barColor: '#10B981',
    },
    {
      label: 'Éléments maîtrisés',
      value: `${techScore} / 11`,
      color: '#003082',
      sub: null,
      bar: techScore / 11 * 100,
      barColor: '#003082',
    },
    {
      label: 'Précision atterro',
      value: precisionAvg !== null ? `${precisionAvg} m` : '—',
      color: precisionAvg !== null && precisionAvg < 10 ? '#10B981' : '#F59E0B',
      sub: precisionAvg !== null ? 'du cible' : 'Pas de données',
      subColor: 'var(--c-muted)',
    },
    {
      label: 'Mental',
      value: mentalAvg !== null ? `${mentalAvg.toFixed(1)} / 5` : '—',
      color: noteColor(mentalAvg),
      sub: '🧠',
      subColor: 'var(--c-dim)',
    },
  ];

  return (
    <div className="mb-6" style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--c-border-s)' }}>
        <div>
          <h2 style={{ color: 'var(--c-text)', fontSize: 15, fontWeight: 600 }}>Ma Progression</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
            Basé sur tes {data.length} dernier{data.length > 1 ? 's' : ''} saut{data.length > 1 ? 's' : ''} évalué{data.length > 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/progression" className="text-xs font-medium no-underline transition-opacity hover:opacity-70" style={{ color: '#F97316' }}>
          Voir le détail →
        </Link>
      </div>

      {/* Alert banners */}
      {showLowAlert && (
        <div className="px-5 py-2 text-xs font-medium" style={{ background: 'rgba(245,158,11,0.1)', color: '#FCD34D', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
          Tes derniers sauts sont en dessous de ta moyenne — parle-en à ton moniteur
        </div>
      )}
      {showHighAlert && !showLowAlert && (
        <div className="px-5 py-2 text-xs font-medium" style={{ background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>
          Tu progresses bien sur tes 5 derniers sauts ! Continue comme ça
        </div>
      )}

      {/* KPI grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-2 font-medium" style={{ color: 'var(--c-muted)', letterSpacing: '0.5px' }}>{kpi.label}</p>
            <p className="text-xl font-bold leading-tight" style={{ color: kpi.color }}>{kpi.value}</p>
            {'bar' in kpi && kpi.bar !== undefined && (
              <div style={{ height: 6, background: 'var(--c-hover)', borderRadius: 3, margin: '8px 0 4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${kpi.bar}%`, background: kpi.barColor, borderRadius: 3 }} />
              </div>
            )}
            {kpi.sub && (
              <p className="text-[10px] mt-1.5" style={{ color: kpi.subColor }}>{kpi.sub}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Badge notification popup ─────────────────────────────────────────────────

function BadgeNotif({ newBadge, onDismiss }: { newBadge: string | null; onDismiss: () => void }) {
  if (!newBadge) return null;
  return (
    <div style={{ background: '#002266', border: '1px solid rgba(249, 158, 11, 0.3)' }} className="fixed bottom-6 right-6 z-50 rounded-xl shadow-2xl p-5 max-w-xs animate-bounce">
      <button onClick={onDismiss} className="absolute top-2 right-2 text-white/40 hover:text-white/60">
        <ChevronDown className="w-4 h-4" />
      </button>
      <div className="text-2xl mb-2">🎖️</div>
      <div className="font-bold text-white text-sm">Nouveau badge débloqué !</div>
      <div className="text-orange-500 font-semibold mt-0.5">{newBadge}</div>
      <button onClick={onDismiss} className="mt-3 text-xs text-white/40 hover:text-white/60">Fermer</button>
    </div>
  );
}
