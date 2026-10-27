import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { QrScanner } from '../components/QrScanner';
import { ParachuteIcon } from '../components/ParachuteIcon';
import { PlanningDZ } from './PlanningDZ';
import { Layout } from '../components/Layout';
import { MonComptePara } from '../components/MonComptePara';
import { AddSautModal } from '../components/AddSautModal';
import { ImportOCR } from '../components/ImportOCR';
import { DeclarationHonneur } from '../components/DeclarationHonneur';
import { BandeauAlertes } from '../components/AlertsPanel';
import { useAlertesContext } from '../lib/AlertesContext';
import { generatePDF } from '../lib/pdf';
import type { Saut, NotationTernaire, Materiel, Maintenance } from '../lib/types';
import { NATURE_SAUT_LABELS, CATEGORIE_LABELS, FONCTION_LABELS, STATUT_LABELS, BADGES, TYPE_MATERIEL_LABELS } from '../lib/types';
import { useAlertes, type MaterielEcheance } from '../lib/useAlertes';
import { useComplianceRules, getMaterielEcheance } from '../lib/compliance';
import { MaRepriseCard } from '../components/MaRepriseCard';
import { BriefingDuJourBlock } from '../components/BriefingDuJourCard';
import { AvionnageDuJour } from '../components/AvionnageDuJour';
import { MeteoAltitudeCard } from '../components/MeteoAltitudeCard';
import { CheckInPresence } from '../components/CheckInPresence';
import { ShareCardModal } from '../components/ShareCardModal';
import { useDzMembre } from '../lib/briefing';
import { useBadges } from '../lib/useBadges';
import { usePassport } from '../lib/usePassport';
import { sautsAEvaluer } from '../lib/progression';
import { lireTout } from '../lib/lireTout';
import { formatDateTimeParis } from '../lib/datetime';
import { useDemo } from '../lib/useDemo';
import { EnTeteAccueil, TitreBloc, CarteWallet, CarteCarnet, CarteProgression } from './accueil/AccueilBlocs';
import { CarnetListe } from './accueil/CarnetListe';
import { CelebrationBurst } from '../components/CelebrationBurst';
import {
  Plus, FileDown,
  ChevronDown, ChevronLeft, X, ShieldCheck, Hash,
  Award, ChevronRight, Camera, Wallet, Flame, Share2,
  Target, GraduationCap, ScanLine, CheckCircle2, Backpack,
  ClipboardList, AlertTriangle,
} from 'lucide-react';

// ─── Weather helpers (reused from PlanningDZ) ────────────────────────────────

type DashTab = 'accueil' | 'carnet' | 'planning' | 'compte';

// ─── Notation helpers ─────────────────────────────────────────────────────────

const STAR_COLORS = ['', '#EF4444', '#F59E0B', '#EAB308', '#84CC16', '#10B981'];

// ─── Raccourcis secondaires (grille 3 tuiles) ────────────────────────────────

export function ShortcutTiles({ userId }: { userId: string }) {
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
      icon: reflexeDone
        ? <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--sev-conforme)' }} />
        : <Target className="w-5 h-5" style={{ color: '#FCA5A5' }} />,
      label: 'Réflexe du jour',
      badge: reflexeLoading ? null : reflexeDone
        ? <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--sev-conforme)' }}>Fait</span>
        : <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--sev-critique)' }}>à faire</span>,
      streak: streak > 0 ? streak : null,
      bg: reflexeDone ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.07)',
      border: reflexeDone ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.25)',
      onClick: () => navigate('/reflexe'),
    },
    {
      key: 'academie',
      icon: <GraduationCap className="w-5 h-5" style={{ color: '#A78BFA' }} />,
      label: 'Académie',
      badge: <span className="text-xs" style={{ color: 'var(--c-pliage)' }}>Quiz · XP</span>,
      streak: null,
      bg: 'rgba(139,92,246,0.07)',
      border: '1px solid rgba(139,92,246,0.2)',
      onClick: () => navigate('/academie'),
    },
    {
      key: 'scanner',
      icon: <ScanLine className="w-5 h-5" style={{ color: 'var(--c-muted)' }} />,
      label: 'Scanner un sac',
      badge: <span className="text-xs" style={{ color: 'var(--c-dim)' }}>QR code</span>,
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
            <span className="leading-none">{t.icon}</span>
            <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--c-text)' }}>
              {t.label}
            </span>
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {t.badge}
              {t.streak !== null && (
                <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: 'var(--accent-texte)' }}>
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
    ? { label: 'Au tapis — à plier', color: 'var(--accent-texte)', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' }
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
        <span className="flex-shrink-0" style={{ color: 'var(--accent-texte)' }}><Backpack className="w-6 h-6" /></span>
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
          style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--sev-critique)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user, profile } = useAuth();
  const { isDemo, blockIfDemo } = useDemo();
  const [sauts, setSauts] = useState<Saut[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [sautAEditer, setSautAEditer] = useState<Saut | null>(null);
  const [centreNom, setCentreNom] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);   // écran de partage (V2)
  const [proposeShare, setProposeShare] = useState(false); // invite « à chaud » après un saut
  const [selectedSaut, setSelectedSaut] = useState<Saut | null>(null);
  const [centrePlan, setCentrePlan] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // L'ONGLET VIT DANS L'URL (?tab=carnet), plus dans un état interne : la barre
  // d'onglets du bas doit savoir ce qui est affiché. Ouvert depuis la carte
  // « Mon carnet », le carnet laissait sinon « Aujourd'hui » allumé.
  const tabUrl = searchParams.get('tab');
  const activeTab: DashTab = tabUrl === 'carnet' || tabUrl === 'planning' || tabUrl === 'compte' ? tabUrl : 'accueil';
  const setActiveTab = useCallback((t: DashTab) => {
    if (t === activeTab) return;
    navigate(t === 'accueil' ? '/dashboard' : `/dashboard?tab=${t}`);
    window.scrollTo(0, 0);
  }, [activeTab, navigate]);

  // « + » de la barre d'onglets : ouvre l'ajout d'un saut, puis retire le
  // paramètre en gardant l'onglet courant.
  useEffect(() => {
    if (searchParams.get('action') === 'add-jump') {
      if (!blockIfDemo()) setModalOpen(true);
      navigate(activeTab === 'accueil' ? '/dashboard' : `/dashboard?tab=${activeTab}`, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Ancre #checkin (bouton « Présence » de la barre mobile). Le hash ne change
  // pas les searchParams : on écoute donc hashchange (+ au montage) pour que le
  // check-in s'ouvre de façon fiable, même si on est DÉJÀ sur le dashboard.
  const [checkinSignal, setCheckinSignal] = useState(0);
  useEffect(() => {
    const ouvrirCheckin = () => {
      if (window.location.hash !== '#checkin') return;
      setActiveTab('accueil');
      setCheckinSignal((n) => n + 1); // déplie la carte de présence
      requestAnimationFrame(() =>
        document.getElementById('checkin')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      );
    };
    ouvrirCheckin(); // au montage (arrivée depuis un autre écran)
    window.addEventListener('hashchange', ouvrirCheckin);
    return () => window.removeEventListener('hashchange', ouvrirCheckin);
  }, []);

  const { licences, certificats, qualifications, brevets, centresLicencies } = usePassport(user?.id);
  const briefingDzs = useDzMembre(user?.id);
  const { rules: complianceRules } = useComplianceRules();

  // La DZ OÙ L'ON EST aujourd'hui (présence déclarée), parmi celles dont on est
  // membre : elle titre le bloc du jour et choisit la météo. Il y avait une
  // carte de vent par DZ, celle où l'on n'est pas comprise.
  const [presenceDzId, setPresenceDzId] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('dz_presences').select('dz_id')
      .eq('user_id', user.id).eq('date_presence', new Date().toISOString().slice(0, 10)).neq('statut', 'parti')
      .limit(1).maybeSingle()
      .then(({ data }) => setPresenceDzId((data as { dz_id: string } | null)?.dz_id ?? null));
  }, [user?.id, checkinSignal]);
  const dzDuJour = briefingDzs.find(d => d.id === presenceDzId) ?? null;

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
    // Par pages : une lecture simple est coupée à 1 000 lignes, et un moniteur
    // à 3 000 sauts voyait « 1 000 » au total (cf. lireTout).
    const { data, error } = await lireTout<Saut>((d, f) => supabase
      .from('sauts')
      .select('*')
      .eq('parachutiste_id', user.id)
      .order('date_saut', { ascending: false })
      .range(d, f));
    if (!error) setSauts(data);
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

  // Sauts déjà évalués (Prompt R) — pour inviter à évaluer les sauts validés qui
  // ne le sont pas encore. Temps réel : l'invite disparaît dès l'évaluation saisie.
  const [evaluatedIds, setEvaluatedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await lireTout<{ jump_id: string }>((d, f) => supabase
        .from('jump_progression').select('jump_id').eq('user_id', user.id).not('note_globale', 'is', null)
        .range(d, f));
      if (error) { console.error('Chargement évaluations échoué :', error); return; }
      setEvaluatedIds(new Set(data.map((d) => d.jump_id)));
    };
    load();
    const ch = supabase
      .channel(`eval-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jump_progression', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Load first centre name + weather
  useEffect(() => {
    if (!centresLicencies.length) return;
    const first = centresLicencies[0];
    const centre = (first as unknown as { centre?: { nom?: string; latitude?: number; longitude?: number; plan?: string } }).centre;
    if (centre?.plan) setCentrePlan(centre.plan);
    if (centre?.nom) setCentreNom(centre.nom);
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
  // Sauts à évaluer (Prompt R) — la règle partagée avec la page Progression, le plus récent d'abord.
  const aEvaluer = sautsAEvaluer(vraisSauts, evaluatedIds);
  // Sauts enregistrés aujourd'hui (variante de la carte de partage — V2).
  const todayYmd = new Date().toISOString().slice(0, 10);
  const sautsAujourdhui = vraisSauts.filter((s) => s.date_saut === todayYmd).length;
  const validSauts = vraisSauts.filter((s) => s.statut === 'valide' || s.statut === 'historique').length;

  const sautsCetteAnnee = vraisSauts.filter((s) => new Date(s.date_saut).getFullYear() === new Date().getFullYear()).length;
  const sortedByDate = [...sauts].sort((a, b) => b.date_saut.localeCompare(a.date_saut));


  // Numérotation séquentielle uniquement sur les vrais sauts (pas soufflerie)
  // Calculé sur tous les sauts triés par date asc → attribue un numéro croissant aux non-soufflerie
  const sautNumeroMap = (() => {
    const byDateAsc = [...sauts]
      .filter((s) => !s.is_tunnel && s.statut !== 'declaration_honneur')
      // même jour → départage par heure de saisie, sinon numérotation instable
      .sort((a, b) => a.date_saut.localeCompare(b.date_saut) || (a.created_at ?? '').localeCompare(b.created_at ?? ''));
    const map: Record<string, number> = {};
    byDateAsc.forEach((s, i) => { map[s.id] = i + 1; });
    return map;
  })();



  const statutBadge = (saut: Saut) => {
    if (saut.statut === 'valide') {
      const nom = saut.valide_par ? saut.valide_par.split(' ').pop() : '';
      return (
        <span style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--sev-conforme)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 500 }} className="inline-flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          {nom || 'Validé'}
        </span>
      );
    }
    if (saut.statut === 'en_attente') {
      return (
        <span style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--accent-texte)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 500 }} className="inline-flex items-center gap-1">
          En attente
        </span>
      );
    }
    if (saut.statut === 'refuse') {
      return (
        <span style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--sev-critique)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 500 }} className="inline-flex items-center gap-1">
          {STATUT_LABELS[saut.statut] || saut.statut}
        </span>
      );
    }
    if (saut.statut === 'historique') {
      return (
        <span style={{ background: 'rgba(100,116,139,0.12)', color: 'var(--sev-neutre)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 500 }} className="inline-flex items-center gap-1">
          Historique
        </span>
      );
    }
    if (saut.statut === 'declaration_honneur') {
      return (
        <span style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 500 }} className="inline-flex items-center gap-1">
          <ClipboardList className="w-3 h-3" aria-hidden="true" /> Déclaration
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

  // ─── Licence & certificat médical data ───────────────────────────────────
  const licenceFFP = licences.find((l) => l.organisme === 'FFP') ?? licences[0] ?? null;
  const certifMedical = certificats[0] ?? null;

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

  return (
    <Layout noPadding>
      {isDemo && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold tracking-widest" style={{ background: '#F59E0B', color: '#1C1917' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" /> DONNÉES DE DÉMONSTRATION — Les informations affichées sont fictives
        </div>
      )}
      <BandeauAlertes alertes={alertes} acquittees={acquittees} onAcquitter={acquitterAlertes} statutDocs={statutDocs} licenceExpiration={licenceFFP?.date_expiration ?? null} certifExpiration={certifMedical?.date_expiration ?? null} userId={user?.id} masquerSiValide />

      {/* La sous-navigation (Vue d'ensemble / Mon Carnet / Ma DZ) disparaît :
          la barre d'onglets du bas porte Aujourd'hui et Carnet ; Planning et
          Mon compte s'ouvrent depuis « Moi » et gardent un retour. */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8" style={{ background: 'var(--c-bg)', minHeight: 'calc(100vh - 112px)' }}>
        <div className="max-w-7xl mx-auto">

          {/* ─── ACCUEIL ─────────────────────────────────────────────────────── */}
          {activeTab === 'accueil' && (
            <>
              {/* Entrée « à chaud » (V2) : proposer de partager sa journée. */}
              {proposeShare && (
                <div className="rounded-2xl p-4 mb-3 flex items-center gap-3 flex-wrap"
                  style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(234,88,12,0.12))', border: '1.5px solid rgba(249,115,22,0.45)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold" style={{ color: '#FFEDD5' }}>Beau saut !</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Partage ta journée avec une carte ParaPass.</p>
                  </div>
                  <button onClick={() => { setProposeShare(false); setShareOpen(true); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'var(--accent-fond)' }}>Partager ma journée →</button>
                  <button onClick={() => setProposeShare(false)} className="text-xs px-2 py-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Plus tard</button>
                </div>
              )}

              {/* ═══ L'ACCUEIL, EN CINQ BLOCS (cf. pages/accueil/AccueilBlocs) ═══
                  Une colonne, comme une app iPhone, même sur ordinateur : on lit
                  de haut en bas, dans l'ordre où la journée se vit. */}
              <div className="max-w-2xl mx-auto">
              {/* 1 — Qui je suis, et si je suis en règle (UNE pastille). */}
              <EnTeteAccueil prenom={profile.prenom} statutDocs={statutDocs} />

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


              {/* 2 — À LA DZ AUJOURD'HUI. Le briefing d'abord (on lit les
                  consignes), puis l'avion, la présence, le sac, le vent de CETTE
                  DZ. Ce qui était éparpillé en quatre blocs — briefing tout en
                  bas, météo pour chaque DZ — se lit ici d'un seul tenant. */}
              {briefingDzs.length > 0 && (
                <section aria-label="À la DZ aujourd'hui" className="space-y-3">
                  <TitreBloc>{dzDuJour ? `Aujourd’hui à ${dzDuJour.nom}` : 'À la DZ'}</TitreBloc>
                  {briefingDzs.map(dz => (
                    <BriefingDuJourBlock key={dz.id} dzId={dz.id} dzNom={dz.nom} userId={user?.id} />
                  ))}
                  <AvionnageDuJour userId={user?.id} />
                  <div id="checkin" className="scroll-mt-20"><CheckInPresence dzs={briefingDzs} userId={user?.id} openSignal={checkinSignal} /></div>
                  <MonSacDuJour userId={user!.id} />
                  <MeteoAltitudeCard dzId={(dzDuJour ?? briefingDzs[0]).id} />
                  {briefingDzs.map(dz => (
                    <BriefingDuJourBlock key={`bas-${dz.id}`} dzId={dz.id} dzNom={dz.nom} userId={user?.id} position="bas" />
                  ))}
                </section>
              )}

              {/* La reprise ne parle que lorsqu'elle a quelque chose à dire. */}
              <div className="mt-3"><MaRepriseCard userId={user?.id} niveau={topBrevet} masquerSiAJour onPlanifierReprise={() => setActiveTab('planning')} /></div>

              {/* 3 — Ma licence, à montrer. */}
              <TitreBloc lien="/passeport" libelleLien="Passeport">Ma licence</TitreBloc>
              <CarteWallet prenom={profile.prenom ?? ''} nom={profile.nom ?? ''} photo={profile.avatar_url}
                brevet={topBrevet} totalSauts={totalSauts}
                licenceFin={licenceFFP?.date_expiration ?? null} medicalFin={certifMedical?.date_expiration ?? null}
                statutDocs={statutDocs} />

              {/* 4 — Mon carnet, en une ligne. */}
              <TitreBloc>Mon carnet</TitreBloc>
              {loading
                ? <div className="rounded-2xl p-6 text-center text-sm" style={{ background: 'var(--c-card)', color: 'var(--c-muted)' }}>Chargement…</div>
                : <CarteCarnet total={totalSauts} cetteAnnee={sautsCetteAnnee} derniers={sortedByDate}
                    numeros={sautNumeroMap} onOuvrir={() => setActiveTab('carnet')} onSaut={setSelectedSaut} />}

              {/* 5 — Où j'en suis. */}
              <TitreBloc lien="/progression" libelleLien="Progression">Ma progression</TitreBloc>
              <CarteProgression aEvaluer={aEvaluer.length}
                onEvaluer={() => { if (!blockIfDemo() && aEvaluer[0]) { setSautAEditer(aEvaluer[0]); setModalOpen(true); } }}
                palier={nextVolume ? nextVolume[0] : null} sautsValides={validSauts}
                dernierBadge={last4Badges[0] ?? null} nbBadges={badges.length} />
              </div>
            </>
          )}

          {/* ─── CARNET ──────────────────────────────────────────────────────── */}
          {activeTab === 'carnet' && (
            // Pas d'overflow-hidden ici : il empêchait les en-têtes de mois de
            // rester collés en haut pendant le défilement.
            <div style={{ background: 'var(--c-dropdown)', border: '1px solid var(--c-border)' }} className="rounded-xl max-w-3xl mx-auto">
              {/* En-tête sur deux lignes : à 375 px, titre + quatre boutons
                  débordaient et « Ajouter » était coupé au bord. */}
              <div style={{ borderBottom: '1px solid var(--c-border)' }} className="px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold" style={{ fontSize: 22, color: 'var(--c-text)' }}>Mon carnet</h2>
                  <button
                    onClick={() => { if (!blockIfDemo()) setModalOpen(true); }}
                    disabled={isDemo}
                    title={isDemo ? 'Non disponible en mode démo' : undefined}
                    className="flex items-center gap-2 text-white px-4 rounded-xl text-sm font-semibold"
                    style={{ minHeight: 40, background: isDemo ? 'var(--c-muted)' : 'var(--accent-fond)',
                             cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.6 : 1 }}>
                    <Plus className="w-4 h-4" aria-hidden /> Ajouter
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <p className="flex-1 text-[13px]" style={{ color: 'var(--c-muted)' }}>{totalSauts} sauts enregistrés</p>
                  {/* Importer, exporter, partager : trois gestes rares, en icônes. */}
                  {!isDemo && (
                    <button onClick={() => setShowOCR(true)} aria-label="Importer un carnet papier" title="Importer un carnet papier"
                      className="w-10 h-10 flex items-center justify-center rounded-xl"
                      style={{ border: '1px solid var(--c-border-f)', color: 'var(--c-text2)' }}>
                      <Camera className="w-4 h-4" aria-hidden />
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (blockIfDemo() || !user) return;
                      // Totaux depuis la source unique (Prompt T) ; repli tableau si indisponible.
                      const { data, error } = await supabase.rpc('get_regulatory_snapshot', { p_user_id: user.id }).maybeSingle();
                      if (error) console.error('Snapshot export échoué :', error);
                      const c = data as { total: number; valid: number } | null;
                      generatePDF(profile, sauts, c ? { total: c.total, valid: c.valid } : undefined);
                    }}
                    disabled={sauts.length === 0 || isDemo}
                    aria-label="Exporter le carnet en PDF" title="Exporter en PDF"
                    className="w-10 h-10 flex items-center justify-center rounded-xl disabled:opacity-40"
                    style={{ border: '1px solid var(--c-border-f)', color: 'var(--c-text2)' }}>
                    <FileDown className="w-4 h-4" aria-hidden />
                  </button>
                  <button
                    onClick={() => { if (!blockIfDemo()) setShareOpen(true); }}
                    disabled={isDemo}
                    aria-label="Partager ma progression" title="Partager ma progression"
                    className="w-10 h-10 flex items-center justify-center rounded-xl disabled:opacity-40"
                    style={{ border: '1px solid var(--c-border-f)', color: 'var(--c-text2)' }}>
                    <Share2 className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              </div>

              {/* L'import du carnet papier (payant) vit ici, à côté d'« Ajouter » :
                  c'est là qu'on en a besoin, pas sur l'accueil. */}
              {!aDejaImporte && !isDemo && (
                <div className="px-4 pt-4"><BanniereOCR onClic={() => setShowOCR(true)} /></div>
              )}

              {/* Bandeau invitation déclaration sur l'honneur */}
              {!profile?.declaration_honneur_faite && totalSauts < 10 && (
                <div
                  className="mx-4 mt-4 rounded-xl flex items-center justify-between gap-3 px-4 py-3"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold inline-flex items-center gap-1.5" style={{ color: '#A78BFA' }}>
                      <ClipboardList className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Vous avez déjà sauté avant ParaPass ?
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
                <CarnetListe sauts={sortedByDate} numeros={sautNumeroMap} statutBadge={statutBadge}
                  onDetail={setSelectedSaut} onEdit={openEdit} onDelete={handleDelete} />
              )}
            </div>
          )}

          {/* ─── PLANNING ────────────────────────────────────────────────────── */}
          {(activeTab === 'planning' || activeTab === 'compte') && (
            <button type="button" onClick={() => setActiveTab('accueil')}
              className="inline-flex items-center gap-1 text-sm font-semibold mb-4" style={{ color: 'var(--accent-texte)', minHeight: 36 }}>
              <ChevronLeft className="w-4 h-4" aria-hidden /> Aujourd’hui
            </button>
          )}
          {activeTab === 'planning' && <PlanningDZ />}

          {/* ─── MON COMPTE ──────────────────────────────────────────────────── */}
          {activeTab === 'compte' && user && hasFinances && (
            <div className="max-w-2xl mx-auto pt-2">
              <div className="flex items-center gap-2 mb-5">
                <Wallet className="w-5 h-5" style={{ color: 'var(--accent-texte)' }} />
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
            // Célébration légère uniquement sur un VRAI passage à « validé »
            // (le saut édité devient valide), non bloquante.
            if (saut.statut === 'valide' && sautAEditer.statut !== 'valide') setCelebrate(true);
          } else {
            setSauts((s) => [saut, ...s]);
            if (saut.statut === 'valide') setCelebrate(true);
            // Entrée « à chaud » (V2) : proposer de partager sa journée après un vrai saut.
            if (!saut.is_tunnel) setProposeShare(true);
          }
        }}
        sautAEditer={sautAEditer}
      />

      <CelebrationBurst show={celebrate} onDone={() => setCelebrate(false)} />

      {/* Écran de partage (V2) — même composant pour les deux entrées. */}
      {shareOpen && user && (
        <ShareCardModal
          userId={user.id}
          prenom={profile?.prenom ?? 'Moi'}
          centre={centreNom}
          sautsDuJour={sautsAujourdhui}
          nouveauBadge={newBadge}
          onClose={() => setShareOpen(false)}
        />
      )}

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

// ─── Compact badge card (4-col grid) ─────────────────────────────────────────

// ─── Saut row for Carnet tab ──────────────────────────────────────────────────

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
            <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs font-medium uppercase tracking-wide">{saut.source === 'soufflerie' ? 'Session soufflerie' : 'Détail du saut'}</p>
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
          <div className="pt-1 space-y-0.5">
            {statutBadge(saut)}
            {/* Moniteur DÉCLARÉ au log — distinct du validateur, jamais écrasé. */}
            {saut.moniteur_nom_libre && (
              <p style={{ color: 'rgba(255,255,255,0.5)' }} className="text-xs mt-1">
                Moniteur déclaré : {saut.moniteur_nom_libre}
              </p>
            )}
            {/* Trace de validation — identique côté DT et côté parachutiste. */}
            {saut.valide_par && (
              <p style={{ color: 'rgba(255,255,255,0.35)' }} className="text-xs">
                Validé par {saut.valide_par}{saut.valide_le ? ` le ${formatDateTimeParis(saut.valide_le)}` : ''}
              </p>
            )}
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
          <Camera className="w-7 h-7" style={{ color: 'var(--accent-texte)' }} />
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: 'rgba(249,115,22,0.2)', color: 'var(--accent-texte)', border: '1px solid rgba(249,115,22,0.35)' }}
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
              <span key={p} className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                ✓ {p}
              </span>
            ))}
          </div>
        </div>

        {/* Price + CTA */}
        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs leading-none mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>une seule fois</p>
            <p className="text-2xl font-black text-white leading-none">4,99€</p>
          </div>
          <div
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all whitespace-nowrap"
            style={{ background: 'var(--accent-fond)', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}
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

// ─── Badge notification popup ─────────────────────────────────────────────────

function BadgeNotif({ newBadge, onDismiss }: { newBadge: string | null; onDismiss: () => void }) {
  if (!newBadge) return null;
  return (
    <div style={{ background: '#002266', border: '1px solid rgba(249, 158, 11, 0.3)' }} className="fixed bottom-6 right-6 z-50 rounded-xl shadow-2xl p-5 max-w-xs animate-bounce">
      <button onClick={onDismiss} className="absolute top-2 right-2 text-white/40 hover:text-white/60">
        <ChevronDown className="w-4 h-4" />
      </button>
      <Award className="w-6 h-6 mb-2" style={{ color: 'var(--accent-texte)' }} />
      <div className="font-bold text-white text-sm">Nouveau badge débloqué !</div>
      <div className="font-semibold mt-0.5" style={{ color: 'var(--accent-texte)' }}>{newBadge}</div>
      <button onClick={onDismiss} className="mt-3 text-xs text-white/40 hover:text-white/60">Fermer</button>
    </div>
  );
}
