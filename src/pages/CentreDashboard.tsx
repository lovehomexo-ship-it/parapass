import { useState, useEffect, useCallback, useRef } from 'react';
import { MODULES, computeActiveModules } from '../data/modules';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';
import { generatePDF } from '../lib/pdf';
import { sendMessage, useConversationMessages, getOrCreateConversation, useConversations } from '../lib/useMessages';
import type { Message } from '../lib/useMessages';
import { PasseportCardView } from '../components/PasseportCardView';
import { AddSautModal } from '../components/AddSautModal';
import { useComplianceRules, getComplianceStatus, worstStatus, type ComplianceStatus } from '../lib/compliance';
import { ComplianceBadge, ComplianceDot } from '../components/ComplianceBadge';
import { useCurrencyRules, getCurrencyStatus, CURRENCY_STATUS_CONFIG } from '../lib/currency';
import { useEncadrement, verifierSeance } from '../lib/encadrement';
import { MeteoAltitudeDZ } from '../components/MeteoAltitudeCard';
import { BriefingRecapDZ } from './centre/BriefingRecap';

// ─── Abonnement du centre — helpers PARTAGÉS par toutes les sections du fichier
// (déclarés au niveau module : plus jamais de ReferenceError depuis une section).
// Plans réels en base : 'essai' (trial), 'centre' (agréé), 'centre_premium'.
// Repli sûr : sans info d'abonnement, on considère le plan inactif — pas de plantage.
function isPlanActif(centre: { plan?: string | null; statut?: string | null } | null | undefined): boolean {
  if (!centre?.plan) return false;
  if (centre.statut && centre.statut !== 'actif') return false;
  return ['centre', 'centre_premium'].includes(centre.plan);
}

function planLabel(plan: string | null | undefined): string {
  if (plan === 'centre_premium') return 'Premium';
  if (plan === 'centre') return 'Centre Agréé';
  if (plan === 'essai') return 'Essai';
  return '—';
}
import { PresencesDZ } from './centre/PresencesDZ';
import { VigilanceVoileDZ } from '../components/VigilanceVoileDZ';
import { BriefingSection } from './centre/BriefingSection';
import { BrevetsSection } from './centre/BrevetsSection';
import { EncadrementSection } from './centre/EncadrementSection';
import { EquipeUnifiee } from './centre/EquipeUnifiee';
import {
  Home, Users, ClipboardList, Activity, BarChart2, Calendar, Megaphone,
  Settings, Shield, MessageSquare, Bell, LogOut, Menu, X,
  AlertTriangle, CheckCircle, Clock, ChevronRight, Plus,
  Search, Filter, Eye, Trash2, UserCheck, UserX,
  Download, Upload, Hash, TrendingUp, MapPin, Send, Zap, Sun, Moon,
  GraduationCap, MoreVertical, UserMinus, Euro, BookCheck, Puzzle,
} from 'lucide-react';
import { PlanningCentre } from './PlanningCentre';
import { GestionPliage } from './centre/GestionPliage';
import { FinancesSection } from './centre/FinancesSection';
import { ValidationsCarnet } from './centre/ValidationsCarnet';
import { RelancesSection } from './centre/RelancesSection';
import { AcademyScoresDZ, DocumentsFFPDZ } from './centre/AcademySection';
import { PacStaff } from '../components/pac/PacStaff';
import { ModulesSection } from './centre/ModulesSection';
import { TandemSection } from './centre/TandemSection';

void Calendar; void Upload; void Hash; void TrendingUp; void MapPin;
void Download; void Filter; void Plus; void Trash2; void Zap;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Centre {
  id: string;
  nom: string;
  logo_url: string | null;
  statut: string;
  plan: string;
  ville: string;
  email: string | null;
  telephone: string | null;
  numero_agrement_ffp: string | null;
  signature_dt_url: string | null;
  tampon_nom_officiel: string | null;
  nom_dt: string | null;
}

interface LicencieSummary {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  numero_licence: string;
  photo_profil_url: string | null;
  role: string;
  statut_adhesion: 'en_attente' | 'actif' | 'inactif';
  date_adhesion: string | null;
}

interface SautSummary {
  id: string;
  parachutiste_id: string;
  date_saut: string;
  lieu: string;
  hauteur_m: number;
  categorie: string;
  statut: 'en_attente' | 'valide' | 'refuse';
  is_tunnel: boolean;
  parachutiste_nom?: string;
  parachutiste_prenom?: string;
}

interface DashStats {
  totalLicencies: number;
  demandesAttente: number;
  sautsAujourdhui: number;
  alertes: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fr(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

function initials(nom: string, prenom: string): string {
  return `${(prenom[0] ?? '').toUpperCase()}${(nom[0] ?? '').toUpperCase()}`;
}

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

// ─── StatCard ──────────────────────────────────────────────────────────────────

function CentreKpiCard({
  label, value, sub, accent, onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={onClick ? 'cursor-pointer' : ''}
      style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        borderRadius: 12,
        borderLeft: `3px solid ${accent}`,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        padding: 20,
        transition: 'background 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'var(--c-card)'; }}
    >
      <p style={{ color: 'var(--c-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 500 }}>{label}</p>
      <p style={{ color: 'var(--c-text)', fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>{value}</p>
      <p style={{ color: 'var(--c-muted)', fontSize: 12 }}>{sub}</p>
    </div>
  );
}

// ─── AlertBanner ───────────────────────────────────────────────────────────────

function AlertBannerClickable({
  level, message, onView,
}: {
  level: 'red' | 'orange';
  message: string;
  onView?: () => void;
}) {
  const styles = level === 'red'
    ? { background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.25)', iconColor: '#EF4444' }
    : { background: 'rgba(249,115,22,0.1)', border: '0.5px solid rgba(249,115,22,0.25)', iconColor: '#F97316' };
  return (
    <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ background: styles.background, border: styles.border }}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: styles.iconColor }} />
      <span className="flex-1 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{message}</span>
      {onView && (
        <button onClick={onView} className="text-xs font-semibold flex-shrink-0 transition-opacity hover:opacity-70" style={{ color: '#F97316' }}>
          Voir →
        </button>
      )}
    </div>
  );
}

// ─── AvatarCircle ──────────────────────────────────────────────────────────────

const AVATAR_PALETTE = ['#003082', '#10B981', '#F97316', '#EF4444', '#8B5CF6', '#06B6D4', '#F59E0B', '#EC4899'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function AvatarCircle({
  url, nom, prenom, size = 'md',
}: {
  url: string | null;
  nom: string;
  prenom: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm';
  if (url) {
    return <img src={url} alt={`${prenom} ${nom}`} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  const bg = avatarColor(`${nom}${prenom}`);
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0`} style={{ background: bg, color: 'var(--c-text)' }}>
      {initials(nom, prenom)}
    </div>
  );
}

// ─── SousOnglets : barre horizontale scrollable sous un menu parent ────────────

function SousOnglets<T extends string>({ tabs, active, onChange }: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex gap-1 mb-5 overflow-x-auto pb-1" style={{ borderBottom: '1px solid var(--c-border)' }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="px-4 text-sm font-semibold whitespace-nowrap transition rounded-t-lg"
          style={{
            minHeight: 44,
            background: active === t.key ? 'var(--c-surface)' : 'transparent',
            color: active === t.key ? 'white' : 'var(--c-muted)',
            borderBottom: active === t.key ? '2px solid #2563EB' : '2px solid transparent',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Placeholder « à venir » pour une sous-partie pas encore construite ────────

// (exporté : prêt à accueillir les sous-parties des modules à venir)
export function SousPartieAVenir({ icone, titre, detail }: { icone: React.ReactNode; titre: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl"
      style={{ background: 'var(--c-surface)', border: '1px dashed var(--c-border-f)' }}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(37,99,235,0.12)' }}>
        {icone}
      </div>
      <p className="font-bold text-white">{titre}</p>
      <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--c-dim)' }}>{detail}</p>
      <span className="mt-4 text-[11px] px-3 py-1 rounded-full font-semibold"
        style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' }}>
        À venir
      </span>
    </div>
  );
}

// ─── Récap « En cours » du dashboard : lecture seule, renvoie aux sous-onglets ─

const tuileRecap = 'rounded-xl p-4 text-left w-full transition hover:opacity-90';
const tuileRecapStyle = { background: 'var(--c-surface)', border: '1px solid var(--c-border)' } as const;

// Tuile Encadrement du jour (zone « Aujourd'hui »)
function TuileEncadrementDZ({ centreId, onGo }: { centreId: string; onGo: (section: string, tab?: string) => void }) {
  const enc = useEncadrement(centreId);
  let manque = 0;
  for (const s of enc.seances) {
    manque += verifierSeance(s, enc.regles, enc.presents).filter(e => !e.satisfaite && !e.regle.a_verifier).length;
  }
  return (
    <button className={tuileRecap} style={tuileRecapStyle} onClick={() => onGo('equipe', 'encadrement')}>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>Encadrement des séances</p>
      <p className="text-2xl font-extrabold mt-1" style={{ color: enc.seances.length === 0 ? 'white' : manque === 0 ? '#34D399' : '#FBBF24' }}>
        {enc.seances.length === 0 ? '—' : manque === 0 ? '✓' : manque}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
        {enc.seances.length === 0
          ? 'Aucune séance ouverte.'
          : manque === 0
            ? `${enc.seances.length} séance${enc.seances.length > 1 ? 's' : ''} — encadrement réglementaire`
            : `${manque} exigence${manque > 1 ? 's' : ''} non couverte${manque > 1 ? 's' : ''}`}
      </p>
    </button>
  );
}

// Tuile Échéances à relancer (zone « À traiter ») — masquée si module absent
function TuileRelancesDZ({ centreId, onGo }: { centreId: string; onGo: (section: string, tab?: string) => void }) {
  const [relancesDues, setRelancesDues] = useState<number | null>(null);
  useEffect(() => {
    supabase.rpc('relances_apercu', { p_centre_id: centreId }).then(({ data, error }) => {
      if (error) { console.error('Aperçu relances échoué :', error); setRelancesDues(null); return; }
      const rows = (data as { deja_envoye: boolean }[] | null) ?? [];
      setRelancesDues(rows.filter(r => !r.deja_envoye).length);
    });
  }, [centreId]);
  if (relancesDues === null) return null;
  return (
    <button className={tuileRecap} style={tuileRecapStyle} onClick={() => onGo('messages', 'relances')}>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>Échéances à relancer</p>
      <p className="text-2xl font-extrabold mt-1" style={{ color: relancesDues === 0 ? '#34D399' : '#FBBF24' }}>{relancesDues}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--c-dim)' }}>
        {relancesDues === 0 ? 'Documents à jour selon les paliers.' : 'Licences / certificats arrivant à échéance.'}
      </p>
    </button>
  );
}

// Titre de zone du dashboard (Aujourd'hui / À traiter / Pilotage)
function ZoneTitre({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest pt-1" style={{ color: 'var(--c-dim)', letterSpacing: '1.5px' }}>{children}</p>;
}

// ─── DashboardHome ─────────────────────────────────────────────────────────────

function DashboardHome({
  centre, stats, onNavigate, carnetsEnAttente, briefingSlot, presencesSlot, encadrementSlot, relancesSlot, vigilanceSlot,
}: {
  centre: Centre | null;
  stats: DashStats;
  onNavigate: (s: string) => void;
  carnetsEnAttente: number;
  briefingSlot?: React.ReactNode;      // Briefing du jour (zone Aujourd'hui)
  presencesSlot?: React.ReactNode;     // Présents (compteur + liste fusionnés)
  encadrementSlot?: React.ReactNode;   // Encadrement des séances (zone Aujourd'hui)
  relancesSlot?: React.ReactNode;      // Échéances à relancer (zone À traiter)
  vigilanceSlot?: React.ReactNode;     // Vigilance charge alaire (zone À traiter)
}) {
  const [alerteExpires, setAlerteExpires] = useState(0);
  const [alerteMedical, setAlerteMedical] = useState(0);
  const [recentSauts, setRecentSauts] = useState<SautSummary[]>([]);
  const [sautsThisMonth, setSautsThisMonth] = useState(0);

  // Validities for conformity card
  const [licencesValides, setLicencesValides] = useState(0);
  const [licencesExpirees, setLicencesExpirees] = useState(0);
  const [certifOk, setCertifOk] = useState(0);
  const [certifExpirant, setCertifExpirant] = useState(0);

  useEffect(() => {
    if (!centre?.id) return;
    (async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const today = new Date().toISOString().split('T')[0];

      // Fetch member count via direct licencies_centres query (no in() needed)
      const { data: membresIds } = await supabase
        .from('licencies_centres')
        .select('parachutiste_id')
        .eq('centre_id', centre.id)
        .eq('statut', 'actif');

      const ids = (membresIds ?? []).map((m: { parachutiste_id: string }) => m.parachutiste_id);
      const total = ids.length;

      // Use RPCs to avoid long in() lists that cause 503 on HEAD requests
      const [
        { data: expLicData },
        { data: expMedData },
        { data: monthCountData },
      ] = await Promise.all([
        supabase.rpc('get_licences_expirees', { p_centre_id: centre.id, p_today: today }),
        supabase.rpc('get_certificats_expirants', { p_centre_id: centre.id, p_today: today, p_in_30: thirtyDaysFromNow.toISOString().split('T')[0] }),
        supabase.rpc('get_sauts_mois', { p_centre_id: centre.id, p_first_of_month: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] }),
      ]);

      const expLic = (expLicData as number) ?? 0;
      const expMed = (expMedData as number) ?? 0;
      setAlerteExpires(expLic);
      setLicencesExpirees(expLic);
      setLicencesValides(Math.max(0, total - expLic));
      setAlerteMedical(expMed);
      setCertifExpirant(expMed);
      setCertifOk(Math.max(0, total - expMed));
      setSautsThisMonth((monthCountData as number) ?? 0);

      // Recent sauts via join to avoid long in() on GET
      if (ids.length > 0) {
        const { data: sautsData } = await supabase
          .from('sauts')
          .select('id, parachutiste_id, date_saut, lieu, hauteur_m, categorie, statut, is_tunnel, profiles!parachutiste_id(nom, prenom)')
          .in('parachutiste_id', ids)
          .order('date_saut', { ascending: false })
          .limit(5);

        if (sautsData && sautsData.length > 0) {
          setRecentSauts((sautsData as unknown as Array<SautSummary & { profiles: { nom: string; prenom: string } | null }>).map((s) => ({
            ...s,
            parachutiste_nom: s.profiles?.nom,
            parachutiste_prenom: s.profiles?.prenom,
          })));
        }
      }
    })();
  }, [centre]);

  const totalMembers = stats.totalLicencies;
  const conformite = totalMembers > 0
    ? Math.round(((licencesValides + certifOk) / (totalMembers * 2)) * 100)
    : 100;
  const conformiteColor = conformite >= 80 ? '#10B981' : conformite >= 50 ? '#F97316' : '#EF4444';

  return (
    <div className="space-y-6">
      {/* ── 1 · EN-TÊTE — bandeau Centre DZ (identité + licenciés) ── */}
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, var(--c-dropdown), #1a3a6e)', border: '1px solid var(--c-border-f)' }}>
        {centre?.logo_url ? (
          <img src={centre.logo_url} alt={centre.nom} className="w-14 h-14 rounded-xl object-contain flex-shrink-0 p-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
        ) : (
          <div className="w-14 h-14 rounded-xl flex items-center justify-center font-black text-lg text-white/40 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>{(centre?.nom ?? 'DZ').slice(0, 2).toUpperCase()}</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--c-muted)', letterSpacing: '1px' }}>Centre DZ</p>
          <h1 className="truncate" style={{ color: 'var(--c-text)', fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>{centre?.nom ?? 'Mon Centre'}</h1>
          <p className="truncate" style={{ color: 'var(--c-muted)', fontSize: 12 }}>
            {[centre?.ville, centre?.numero_agrement_ffp ? `Code ${centre.numero_agrement_ffp}` : null, isPlanActif(centre) ? 'Agréé' : planLabel(centre?.plan)].filter(Boolean).join(' · ')}
            {centre?.nom_dt ? ` · DT ${centre.nom_dt}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-center flex-shrink-0">
          <p style={{ color: '#3B82F6', fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{stats.totalLicencies}</p>
          <p style={{ color: 'var(--c-muted)', fontSize: 11 }}>licenciés</p>
          {sautsThisMonth > 0 && <p className="text-[10px] mt-0.5 whitespace-nowrap" style={{ color: 'var(--c-dim)' }}>+{sautsThisMonth} sauts/mois</p>}
        </div>
      </div>

      {/* ── 2 · AUJOURD'HUI — l'opérationnel du jour ── */}
      <ZoneTitre>Aujourd'hui</ZoneTitre>
      {briefingSlot}
      {presencesSlot}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {encadrementSlot}
        <CentreKpiCard accent="#10B981" label="Sauts aujourd'hui" value={stats.sautsAujourdhui} sub="Sur le terrain" />
      </div>

      {/* ── 3 · À TRAITER — les actions en attente ── */}
      <ZoneTitre>À traiter</ZoneTitre>
      {(alerteExpires > 0 || alerteMedical > 0 || !centre?.logo_url) && (
        <div className="space-y-2">
          {alerteExpires > 0 && (
            <AlertBannerClickable level="red"
              message={`${alerteExpires} licencié${alerteExpires > 1 ? 's' : ''} avec une licence FFP expirée`}
              onView={() => onNavigate('licencies')} />
          )}
          {alerteMedical > 0 && (
            <AlertBannerClickable level="orange"
              message={`${alerteMedical} certificat${alerteMedical > 1 ? 's' : ''} médical${alerteMedical > 1 ? 'aux' : ''} expirant dans les 30 prochains jours`}
              onView={() => onNavigate('licencies')} />
          )}
          {!centre?.logo_url && (
            <button onClick={() => onNavigate('centre')} className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition"
              style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <span className="text-lg flex-shrink-0">🎨</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: '#F97316' }}>Ajoutez votre logo officiel</span>
                <span className="text-xs ml-2" style={{ color: 'rgba(249,115,22,0.7)' }}>Il apparaîtra sur les carnets de vos licenciés → Mon centre</span>
              </div>
              <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#F97316' }}>Configurer →</span>
            </button>
          )}
        </div>
      )}
      {vigilanceSlot}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CentreKpiCard accent={carnetsEnAttente > 0 ? '#8B5CF6' : 'var(--c-border-f)'} label="Carnets à valider"
          value={<span style={{ color: carnetsEnAttente > 0 ? '#8B5CF6' : 'var(--c-text)' }}>{carnetsEnAttente}</span>}
          sub="En attente" onClick={() => onNavigate('validations')} />
        <CentreKpiCard accent={stats.demandesAttente > 0 ? '#F97316' : 'var(--c-border-f)'} label="Demandes d'adhésion"
          value={<span style={{ color: stats.demandesAttente > 0 ? '#F97316' : 'var(--c-text)' }}>{stats.demandesAttente}</span>}
          sub="En attente" onClick={() => onNavigate('demandes')} />
      </div>
      {relancesSlot}

      {/* ── 4 · PILOTAGE — le fond, consultable ── */}
      <ZoneTitre>Pilotage</ZoneTitre>
      <div className="flex flex-col lg:flex-row gap-3">

        {/* 4 — Activité récente */}
        <div style={{ flex: 2, background: 'var(--c-dropdown)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--c-border-s)' }}>
            <h2 style={{ color: 'var(--c-text)', fontSize: 14, fontWeight: 600 }}>Activité récente</h2>
            <button onClick={() => onNavigate('sauts')} style={{ color: '#F97316', fontSize: 12 }} className="font-medium hover:opacity-70 transition-opacity">
              Voir tout →
            </button>
          </div>
          {recentSauts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--c-muted)' }}>Aucune activité récente</div>
          ) : (
            <div>
              {recentSauts.map((s, i) => {
                const nom = s.parachutiste_nom ?? '?';
                const prenom = s.parachutiste_prenom ?? '?';
                const isLast = i === recentSauts.length - 1;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <AvatarCircle url={null} nom={nom} prenom={prenom} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p style={{ color: 'var(--c-text)', fontSize: 13, fontWeight: 500 }}>{prenom} {nom}</p>
                      <p style={{ color: 'var(--c-muted)', fontSize: 11 }}>{fr(s.date_saut)} · {s.lieu} · {s.hauteur_m}m</p>
                    </div>
                    <span className="text-[11px] font-medium flex-shrink-0" style={
                      s.statut === 'valide'
                        ? { background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 20, padding: '3px 10px' }
                        : s.statut === 'refuse'
                        ? { background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '3px 10px' }
                        : { background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '3px 10px' }
                    }>
                      {s.statut === 'valide' ? 'Validé' : s.statut === 'refuse' ? 'Refusé' : 'En attente'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5 — Validités licenciés */}
        <div style={{ flex: 1, background: 'var(--c-dropdown)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 20, minWidth: 0 }}>
          <h2 style={{ color: 'var(--c-text)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Validités licenciés</h2>
          <div className="space-y-3">
            {[
              { label: 'Licences FFP valides', value: licencesValides, total: totalMembers, color: licencesValides === totalMembers ? '#10B981' : '#F97316' },
              { label: 'Licences expirées', value: licencesExpirees, total: null, color: licencesExpirees > 0 ? '#EF4444' : '#10B981' },
              { label: 'Certificats médicaux OK', value: certifOk, total: totalMembers, color: certifOk === totalMembers ? '#10B981' : '#F97316' },
              { label: 'Expirant dans 30j', value: certifExpirant, total: null, color: certifExpirant > 0 ? '#F97316' : '#10B981' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span style={{ color: 'var(--c-text2)', fontSize: 12 }}>{item.label}</span>
                <span style={{ color: item.color, fontSize: 13, fontWeight: 600 }}>
                  {item.value}{item.total !== null ? ` / ${item.total}` : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Conformity score */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: 'var(--c-border-s)' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--c-text2)', fontSize: 12 }}>Conformité globale</span>
              <span style={{ color: conformiteColor, fontSize: 14, fontWeight: 700 }}>{conformite}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--c-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${conformite}%`, background: conformiteColor, borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LicenciesSection ──────────────────────────────────────────────────────────

// ─── ModalPromotion ────────────────────────────────────────────────────────────

const DIPLOMES = [
  { value: 'BPA', label: 'BPA — Brevet de Parachutisme' },
  { value: 'BPJEPS', label: 'BPJEPS — Brevet Professionnel' },
  { value: 'BEES', label: 'BEES — Brevet d\'État' },
  { value: 'delegation_interne', label: 'Délégation interne centre' },
];

function ModalPromotion({ licencie, onConfirm, onClose }: {
  licencie: LicencieSummary;
  onConfirm: (opts: { diplome: string; numeroDiplome: string; dateFin: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [diplome, setDiplome] = useState('delegation_interne');
  const [numeroDiplome, setNumeroDiplome] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }}>
        {/* Header */}
        <div className="px-6 py-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg,#0F2549,#1a3a6e)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)' }}>
            <GraduationCap className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Promouvoir en moniteur délégué</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{licencie.prenom} {licencie.nom}</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Diplôme */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Type de qualification</label>
            <div className="space-y-2">
              {DIPLOMES.map(d => (
                <label key={d.value} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition" style={{ border: `1px solid ${diplome === d.value ? 'rgba(16,185,129,0.5)' : '#e5e7eb'}`, background: diplome === d.value ? 'rgba(16,185,129,0.06)' : '#f9fafb' }}>
                  <input type="radio" name="diplome" value={d.value} checked={diplome === d.value} onChange={() => setDiplome(d.value)} className="w-4 h-4 accent-green-500" />
                  <span className="text-sm text-gray-700">{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Numéro */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Numéro de diplôme <span className="font-normal normal-case">(optionnel)</span></label>
            <input
              value={numeroDiplome}
              onChange={e => setNumeroDiplome(e.target.value)}
              placeholder="Ex : BPJEPS-2023-4521"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-300"
              style={{ border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }}
            />
          </div>

          {/* Date fin */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Délégation valable jusqu'au <span className="font-normal normal-case">(optionnel)</span></label>
            <input
              type="date"
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-300"
              style={{ border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }}
            />
          </div>

          {/* Info */}
          <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-green-700 leading-relaxed">
              <strong>{licencie.prenom}</strong> verra l'onglet <strong>Validations</strong> apparaître immédiatement dans son application et pourra valider les sauts de vos licenciés.
            </p>
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition" style={{ border: '1px solid #d1d5db', background: '#f9fafb', color: '#6b7280' }}>
              Annuler
            </button>
            <button
              onClick={async () => { setLoading(true); await onConfirm({ diplome, numeroDiplome, dateFin: dateFin || null }); setLoading(false); }}
              disabled={loading}
              className="flex-[2] py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#10B981' }}
            >
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <GraduationCap className="w-4 h-4" />}
              Confirmer la promotion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MenuActionsLicencie ────────────────────────────────────────────────────────

function MenuActionsLicencie({ licencie, onOpenDrawer, onMessage, onPromouvoir, onRevoquer }: {
  licencie: LicencieSummary;
  onOpenDrawer: () => void;
  onMessage: () => void;
  onPromouvoir: () => void;
  onRevoquer: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMoniteur = licencie.role === 'moniteur_delegue' || licencie.role === 'moniteur';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 rounded-lg transition"
        style={{ color: open ? 'white' : 'rgba(255,255,255,0.4)', background: open ? 'rgba(255,255,255,0.12)' : 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
        onMouseLeave={e => { if (!open) e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
        title="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-2xl py-1 min-w-[190px]"
          style={{ background: '#1E3A5F', border: '1px solid rgba(255,255,255,0.12)' }}>
          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition"
            style={{ color: 'rgba(255,255,255,0.8)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { setOpen(false); onOpenDrawer(); }}>
            <Eye className="w-4 h-4 opacity-60" /> Voir le passeport
          </button>
          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition"
            style={{ color: 'rgba(255,255,255,0.8)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { setOpen(false); onMessage(); }}>
            <MessageSquare className="w-4 h-4 opacity-60" /> Envoyer un message
          </button>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

          {!isMoniteur ? (
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition"
              style={{ color: '#34D399' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setOpen(false); onPromouvoir(); }}>
              <GraduationCap className="w-4 h-4" /> Promouvoir moniteur
            </button>
          ) : (
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition"
              style={{ color: '#F87171' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setOpen(false); onRevoquer(); }}>
              <UserMinus className="w-4 h-4" /> Retirer statut moniteur
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LicenciesSection ─────────────────────────────────────────────────────────

function LicenciesSection({ centreId, onOpenDrawer, onOpenMessages }: { centreId: string | undefined; onOpenDrawer: (l: LicencieSummary) => void; onOpenMessages: (l: LicencieSummary) => void }) {
  const { profile: adminProfile } = useAuth();
  const [licencies, setLicencies] = useState<LicencieSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sautCounts, setSautCounts] = useState<Record<string, number>>({});
  const [brevets, setBrevets] = useState<Record<string, string>>({});
  const [promoLicencie, setPromoLicencie] = useState<LicencieSummary | null>(null);
  const { rules: complianceRules } = useComplianceRules();
  const { rules: currencyRules } = useCurrencyRules();
  const [conformiteMap, setConformiteMap] = useState<Record<string, ComplianceStatus>>({});
  const [dernierSautMap, setDernierSautMap] = useState<Record<string, string | null>>({});
  const [filtreConformite, setFiltreConformite] = useState<'tous' | ComplianceStatus>('tous');
  // Briefing du jour + acquittements
  const [briefingDuJourId, setBriefingDuJourId] = useState<string | null>(null);
  const [acksSet, setAcksSet] = useState<Set<string>>(new Set()); // user_ids ayant acquitté

  useEffect(() => {
    if (!centreId) return;
    (async () => {
      const today = new Date().toISOString().substring(0, 10);
      const { data: brief, error: bErr } = await supabase
        .from('dz_briefings').select('id, published_at').eq('dz_id', centreId).eq('date_briefing', today).maybeSingle();
      if (bErr) { console.error('Chargement briefing du jour échoué :', bErr); return; }
      if (!brief) { setBriefingDuJourId(null); return; }
      setBriefingDuJourId(brief.id);
      const { data: acks, error: aErr } = await supabase
        .from('briefing_acknowledgements').select('user_id, acknowledged_at').eq('briefing_id', brief.id);
      if (aErr) { console.error('Chargement acquittements échoué :', aErr); return; }
      // Un acquittement antérieur à la (re)publication est périmé
      setAcksSet(new Set((acks ?? [])
        .filter(a => new Date(a.acknowledged_at) >= new Date(brief.published_at))
        .map(a => a.user_id)));
    })();
  }, [centreId]);

  // Conformité (licence + médical + matériel) + récence via RPC sécurisée
  useEffect(() => {
    if (!centreId) return;
    supabase.rpc('get_conformite_licencies', { p_centre_id: centreId }).then(({ data, error }) => {
      if (error) { console.error('Chargement conformité licenciés échoué :', error); return; }
      const map: Record<string, ComplianceStatus> = {};
      const sautMap: Record<string, string | null> = {};
      for (const row of (data ?? []) as Array<{ parachutiste_id: string; licence_expiration: string | null; certificat_expiration: string | null; materiel_echeance: string | null; dernier_saut: string | null }>) {
        map[row.parachutiste_id] = worstStatus([
          getComplianceStatus(row.licence_expiration, complianceRules),
          getComplianceStatus(row.certificat_expiration, complianceRules),
          // Pas de matériel renseigné = pas bloquant côté vue centre : on ignore l'inconnu matériel
          row.materiel_echeance ? getComplianceStatus(row.materiel_echeance, complianceRules) : 'ok',
        ]);
        sautMap[row.parachutiste_id] = row.dernier_saut;
      }
      setConformiteMap(map);
      setDernierSautMap(sautMap);
    });
  }, [centreId, complianceRules]);

  const fetchLicencies = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const { data } = await supabase
      .from('licencies_centres')
      .select(`statut, date_adhesion, profiles!parachutiste_id(id, nom, prenom, email, numero_licence, photo_profil_url, created_at, role)`)
      .eq('centre_id', centreId)
      .eq('statut', 'actif');

    if (data) {
      const list: LicencieSummary[] = data.map((d: {
        statut: string; date_adhesion: string | null;
        profiles: { id: string; nom: string; prenom: string; email: string; numero_licence: string; photo_profil_url: string | null; role: string };
      }) => ({
        id: d.profiles.id,
        nom: d.profiles.nom,
        prenom: d.profiles.prenom,
        email: d.profiles.email,
        numero_licence: d.profiles.numero_licence,
        photo_profil_url: d.profiles.photo_profil_url,
        role: d.profiles.role,
        statut_adhesion: d.statut as LicencieSummary['statut_adhesion'],
        date_adhesion: d.date_adhesion,
      }));
      // Deduplicate by id (a licencié might have multiple active rows)
      const seen = new Set<string>();
      const deduped = list.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
      setLicencies(deduped);

      const ids = deduped.map(l => l.id);
      if (ids.length > 0) {
        const { data: sautsData } = await supabase
          .from('sauts')
          .select('parachutiste_id')
          .in('parachutiste_id', ids)
          .eq('statut', 'valide');
        const counts: Record<string, number> = {};
        (sautsData ?? []).forEach((s: { parachutiste_id: string }) => {
          counts[s.parachutiste_id] = (counts[s.parachutiste_id] ?? 0) + 1;
        });
        setSautCounts(counts);

        const { data: brevetsData } = await supabase
          .from('brevets')
          .select('parachutiste_id, type_brevet, date_obtention')
          .in('parachutiste_id', ids)
          .order('date_obtention', { ascending: false });
        const bMap: Record<string, string> = {};
        (brevetsData ?? []).forEach((b: { parachutiste_id: string; type_brevet: string }) => {
          if (!bMap[b.parachutiste_id]) bMap[b.parachutiste_id] = b.type_brevet;
        });
        setBrevets(bMap);
      }
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { fetchLicencies(); }, [fetchLicencies]);

  const handlePromouvoir = async (opts: { diplome: string; numeroDiplome: string; dateFin: string | null }) => {
    if (!promoLicencie || !centreId || !adminProfile) return;
    const now = new Date().toISOString();
    // 1. Create or reactivate delegation
    await supabase.from('delegations_validation').upsert({
      moniteur_id: promoLicencie.id,
      centre_id: centreId,
      dt_id: adminProfile.id,
      actif: true,
      date_delegation: now,
      date_expiration: opts.dateFin ? new Date(opts.dateFin).toISOString() : null,
      note: opts.numeroDiplome || null,
    }, { onConflict: 'centre_id,moniteur_id' });

    // 2. Update role
    await supabase.from('profiles').update({ role: 'moniteur_delegue' }).eq('id', promoLicencie.id);

    // 3. Send notification
    await supabase.from('notifications').insert({
      profile_id: promoLicencie.id,
      titre: 'Délégation de validation accordée',
      message: `${adminProfile.prenom} ${adminProfile.nom} vous a accordé une délégation de validation à ${(await supabase.from('centres').select('nom').eq('id', centreId).maybeSingle()).data?.nom ?? 'votre centre'}.`,
      type: 'success',
      lue: false,
    });

    setPromoLicencie(null);
    // Refresh list to show updated badge
    setLicencies(prev => prev.map(l => l.id === promoLicencie.id ? { ...l, role: 'moniteur_delegue' } : l));
  };

  const handleRevoquer = async (licencie: LicencieSummary) => {
    if (!centreId) return;
    const ok = confirm(`Retirer le statut moniteur à ${licencie.prenom} ${licencie.nom} ?\n\nIl ne pourra plus valider de sauts. Son carnet reste intact.`);
    if (!ok) return;

    // 1. Deactivate delegation for this centre
    await supabase.from('delegations_validation')
      .update({ actif: false, date_expiration: new Date().toISOString() })
      .eq('moniteur_id', licencie.id)
      .eq('centre_id', centreId);

    // 2. Check remaining active delegations across all centres
    const { data: autres } = await supabase.from('delegations_validation')
      .select('id').eq('moniteur_id', licencie.id).eq('actif', true);

    // 3. Downgrade role only if no other active delegations
    if (!autres?.length) {
      await supabase.from('profiles').update({ role: 'parachutiste' }).eq('id', licencie.id);
      setLicencies(prev => prev.map(l => l.id === licencie.id ? { ...l, role: 'parachutiste' } : l));
    } else {
      setLicencies(prev => prev.map(l => l.id === licencie.id ? { ...l, role: 'moniteur_delegue' } : l));
    }
  };

  const filtered = licencies.filter(l =>
    `${l.prenom} ${l.nom} ${l.numero_licence}`.toLowerCase().includes(search.toLowerCase())
    && (filtreConformite === 'tous' || (conformiteMap[l.id] ?? 'inconnu') === filtreConformite)
  );

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {promoLicencie && (
        <ModalPromotion
          licencie={promoLicencie}
          onConfirm={handlePromouvoir}
          onClose={() => setPromoLicencie(null)}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Mes licenciés <span className="font-normal text-lg" style={{ color: 'var(--c-dim)' }}>({licencies.length})</span></h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--c-dim)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none w-52 text-white placeholder:text-white/30"
              style={{ background: 'var(--c-border)', border: '1px solid var(--c-border-f)' }}
            />
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border-f)' }}>
            <button onClick={() => setViewMode('grid')} className="px-3 py-2 text-sm transition" style={{ background: viewMode === 'grid' ? '#2563EB' : 'transparent', color: viewMode === 'grid' ? 'white' : 'rgba(255,255,255,0.5)' }}>Grille</button>
            <button onClick={() => setViewMode('list')} className="px-3 py-2 text-sm transition" style={{ background: viewMode === 'list' ? '#2563EB' : 'transparent', color: viewMode === 'list' ? 'white' : 'rgba(255,255,255,0.5)' }}>Liste</button>
          </div>
        </div>
      </div>

      {/* Filtre conformité */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--c-dim)' }}>Conformité :</span>
        {([
          { key: 'tous' as const, label: 'Tous' },
          { key: 'expire' as const, label: 'Expiré' },
          { key: 'bientot' as const, label: 'Bientôt' },
          { key: 'ok' as const, label: 'À jour' },
        ]).map(f => {
          const count = f.key === 'tous' ? licencies.length : licencies.filter(l => (conformiteMap[l.id] ?? 'inconnu') === f.key).length;
          const active = filtreConformite === f.key;
          const color = f.key === 'expire' ? '#EF4444' : f.key === 'bientot' ? '#F59E0B' : f.key === 'ok' ? '#10B981' : '#60A5FA';
          return (
            <button
              key={f.key}
              onClick={() => setFiltreConformite(f.key)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition"
              style={{
                background: active ? `${color}26` : 'var(--c-border)',
                color: active ? color : 'rgba(255,255,255,0.6)',
                border: `1px solid ${active ? `${color}66` : 'var(--c-border-f)'}`,
              }}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--c-dim)' }}>Aucun licencié trouvé</div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(l => {
            const isMoniteur = l.role === 'moniteur_delegue' || l.role === 'moniteur';
            return (
              <div
                key={l.id}
                className="rounded-2xl p-4 cursor-pointer transition flex flex-col items-center text-center gap-2 relative"
                style={{ background: 'var(--c-surface)', border: `1px solid ${isMoniteur ? 'rgba(52,211,153,0.3)' : 'var(--c-border)'}` }}
                onClick={() => onOpenDrawer(l)}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-surface)'}
              >
                {/* 3-dot menu */}
                <div className="absolute top-3 right-3">
                  <MenuActionsLicencie
                    licencie={l}
                    onOpenDrawer={() => onOpenDrawer(l)}
                    onMessage={() => onOpenMessages(l)}
                    onPromouvoir={() => setPromoLicencie(l)}
                    onRevoquer={() => handleRevoquer(l)}
                  />
                </div>

                <AvatarCircle url={l.photo_profil_url} nom={l.nom} prenom={l.prenom} size="lg" />
                <div>
                  <p className="font-semibold text-white flex items-center justify-center gap-2">
                    <ComplianceDot status={conformiteMap[l.id] ?? 'inconnu'} />
                    {l.prenom} {l.nom}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--c-dim)' }}>{brevets[l.id] ?? '—'}</p>
                  <p className="text-xs" style={{ color: 'var(--c-dim)' }}>{sautCounts[l.id] ?? 0} sauts</p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'rgba(16,185,129,0.2)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)' }}>Actif</span>
                  {isMoniteur && (
                    <span className="text-xs rounded-full px-2 py-0.5 flex items-center gap-1" style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.4)' }}>
                      <GraduationCap className="w-3 h-3" /> Moniteur
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--c-card)', borderBottom: '1px solid var(--c-border)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--c-dim)' }}>Membre</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--c-dim)' }}>Brevet</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--c-dim)' }}>Sauts</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--c-dim)' }}>Statut</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--c-dim)' }}>Reprise</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--c-dim)' }}>Briefing</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--c-dim)' }}>Adhésion</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const isMoniteur = l.role === 'moniteur_delegue' || l.role === 'moniteur';
                return (
                  <tr key={l.id} className="transition cursor-pointer" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onClick={() => onOpenDrawer(l)}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AvatarCircle url={l.photo_profil_url} nom={l.nom} prenom={l.prenom} size="sm" />
                        <div>
                          <p className="font-medium text-white flex items-center gap-2">
                            <ComplianceDot status={conformiteMap[l.id] ?? 'inconnu'} />
                            {l.prenom} {l.nom}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--c-dim)' }}>{l.numero_licence}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--c-dim)' }}>{brevets[l.id] ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--c-dim)' }}>{sautCounts[l.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'rgba(16,185,129,0.2)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)' }}>Actif</span>
                        {isMoniteur && (
                          <span className="text-xs rounded-full px-2 py-0.5 flex items-center gap-1" style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.4)' }}>
                            <GraduationCap className="w-3 h-3" /> Moniteur
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const st = getCurrencyStatus(dernierSautMap[l.id], brevets[l.id], currencyRules);
                        const cfg = CURRENCY_STATUS_CONFIG[st];
                        const label = st === 'reprise_obligatoire' ? 'Reprise' : st === 'reprise_conseillee' ? 'Conseillée' : st === 'a_jour' ? 'À jour' : '—';
                        return (
                          <span className="text-xs rounded-full px-2 py-0.5 inline-flex items-center gap-1.5" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                            title={dernierSautMap[l.id] ? `Dernier saut : ${new Date(dernierSautMap[l.id]!).toLocaleDateString('fr-FR')} — selon les règles paramétrées` : 'Aucun saut connu'}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        if (!briefingDuJourId) return <span className="text-xs" style={{ color: 'var(--c-dim)' }}>—</span>;
                        const st = acksSet.has(l.id)
                          ? { label: 'Acquitté', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
                          : { label: 'Non lu', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' };
                        return (
                          <span className="text-xs rounded-full px-2 py-0.5 inline-flex items-center gap-1.5" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                            {st.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--c-dim)' }}>{fr(l.date_adhesion)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <MenuActionsLicencie
                        licencie={l}
                        onOpenDrawer={() => onOpenDrawer(l)}
                        onMessage={() => onOpenMessages(l)}
                        onPromouvoir={() => setPromoLicencie(l)}
                        onRevoquer={() => handleRevoquer(l)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── DemandesSection ───────────────────────────────────────────────────────────

function DemandesSection({ centreId, onAccepted }: { centreId: string | undefined; onAccepted: () => void }) {
  const [demandes, setDemandes] = useState<LicencieSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [centre, setCentre] = useState<{ nom: string } | null>(null);

  const fetchDemandes = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const { data: centreData } = await supabase.from('centres').select('nom').eq('id', centreId).maybeSingle();
    setCentre(centreData);

    const { data } = await supabase
      .from('licencies_centres')
      .select(`statut, date_adhesion, profiles!parachutiste_id(id, nom, prenom, email, numero_licence, photo_profil_url, role)`)
      .eq('centre_id', centreId)
      .eq('statut', 'en_attente')
      .order('date_adhesion', { ascending: false });

    if (data) {
      setDemandes(data.map((d: {
        statut: string; date_adhesion: string | null;
        profiles: { id: string; nom: string; prenom: string; email: string; numero_licence: string; photo_profil_url: string | null; role: string };
      }) => ({
        id: d.profiles.id,
        nom: d.profiles.nom,
        prenom: d.profiles.prenom,
        email: d.profiles.email,
        numero_licence: d.profiles.numero_licence,
        photo_profil_url: d.profiles.photo_profil_url,
        role: d.profiles.role,
        statut_adhesion: 'en_attente' as const,
        date_adhesion: d.date_adhesion,
      })));
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { fetchDemandes(); }, [fetchDemandes]);

  const handleAccept = async (profileId: string) => {
    if (!centreId) return;
    await supabase
      .from('licencies_centres')
      .update({ statut: 'actif', date_adhesion: new Date().toISOString().split('T')[0] })
      .eq('centre_id', centreId)
      .eq('parachutiste_id', profileId);
    await supabase.from('notifications').insert({
      profile_id: profileId,
      titre: 'Demande acceptée',
      message: `${centre?.nom ?? 'Le centre'} a accepté votre demande d'adhésion.`,
      lue: false,
    });
    setDemandes(prev => prev.filter(d => d.id !== profileId));
    onAccepted();
  };

  const handleRefuse = async (profileId: string) => {
    if (!centreId) return;
    await supabase
      .from('licencies_centres')
      .update({ statut: 'inactif' })
      .eq('centre_id', centreId)
      .eq('parachutiste_id', profileId);
    await supabase.from('notifications').insert({
      profile_id: profileId,
      titre: 'Demande refusée',
      message: `${centre?.nom ?? 'Le centre'} a refusé votre demande d'adhésion.`,
      lue: false,
    });
    setDemandes(prev => prev.filter(d => d.id !== profileId));
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Demandes d'adhésion <span className="font-normal text-lg" style={{ color: 'var(--c-dim)' }}>({demandes.length})</span></h1>
      {demandes.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#34D399' }} />
          <p style={{ color: 'var(--c-dim)' }}>Aucune demande en attente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {demandes.map(d => (
            <div key={d.id} className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
              <AvatarCircle url={d.photo_profil_url} nom={d.nom} prenom={d.prenom} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{d.prenom} {d.nom}</p>
                <p className="text-xs" style={{ color: 'var(--c-dim)' }}>{d.numero_licence}</p>
                {d.date_adhesion && (
                  <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--c-dim)' }}>
                    <Clock className="w-3 h-3" /> Demande il y a {daysSince(d.date_adhesion)} jour(s)
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(d.id)}
                  className="px-3 py-2 rounded-xl text-sm flex items-center gap-1 transition"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.25)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.15)'}
                >
                  <UserCheck className="w-4 h-4" /> Accepter
                </button>
                <button
                  onClick={() => handleRefuse(d.id)}
                  className="px-3 py-2 rounded-xl text-sm flex items-center gap-1 transition"
                  style={{ background: 'transparent', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <UserX className="w-4 h-4" /> Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SautsSection ──────────────────────────────────────────────────────────────

function SautsSection({ centreId }: { centreId: string | undefined }) {
  const { profile: adminProfile } = useAuth();
  const [tab, setTab] = useState<'attente' | 'today' | 'historique'>('attente');
  const [sauts, setSauts] = useState<SautSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchSauts = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);

    const { data: membresData } = await supabase
      .from('licencies_centres')
      .select('parachutiste_id')
      .eq('centre_id', centreId)
      .eq('statut', 'actif');

    const ids = (membresData ?? []).map((m: { parachutiste_id: string }) => m.parachutiste_id);
    if (ids.length === 0) { setSauts([]); setLoading(false); return; }

    const today = new Date().toISOString().split('T')[0];
    let query = supabase
      .from('sauts')
      .select('id, parachutiste_id, date_saut, lieu, hauteur_m, categorie, statut, is_tunnel')
      .in('parachutiste_id', ids);

    if (tab === 'attente') query = query.eq('statut', 'en_attente');
    else if (tab === 'today') query = query.eq('date_saut', today);
    else query = query.eq('statut', 'valide').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    query = query.order('date_saut', { ascending: false });

    const { data: sautsData } = await query;

    if (sautsData && sautsData.length > 0) {
      const pIds = [...new Set(sautsData.map((s: SautSummary) => s.parachutiste_id))];
      const { data: profilesData } = await supabase.from('profiles').select('id, nom, prenom').in('id', pIds);
      const pMap: Record<string, { nom: string; prenom: string }> = {};
      (profilesData ?? []).forEach((p: { id: string; nom: string; prenom: string }) => { pMap[p.id] = p; });
      setSauts(sautsData.map((s: SautSummary) => ({
        ...s,
        parachutiste_nom: pMap[s.parachutiste_id]?.nom,
        parachutiste_prenom: pMap[s.parachutiste_id]?.prenom,
      })));
    } else {
      setSauts([]);
    }
    setLoading(false);
  }, [centreId, tab, page]);

  useEffect(() => { fetchSauts(); }, [fetchSauts]);

  const handleValider = async (sautId: string) => {
    const validateur = adminProfile ? `${adminProfile.prenom} ${adminProfile.nom}` : 'Admin Centre';
    const { error } = await supabase.from('sauts').update({
      statut: 'valide',
      valide_le: new Date().toISOString(),
      valide_par: validateur,
    }).eq('id', sautId);
    if (!error) setSauts(prev => prev.filter(s => s.id !== sautId));
  };

  const exportCSV = () => {
    const header = 'id,parachutiste_id,date_saut,lieu,hauteur_m,categorie,statut,nom,prenom\n';
    const rows = sauts.map(s =>
      `${s.id},${s.parachutiste_id},${s.date_saut},${s.lieu},${s.hauteur_m},${s.categorie},${s.statut},${s.parachutiste_nom ?? ''},${s.parachutiste_prenom ?? ''}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sauts_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { key: 'attente', label: 'En attente' },
    { key: 'today', label: "Aujourd'hui" },
    { key: 'historique', label: 'Historique' },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Activité des sauts</h1>
        {tab === 'historique' && (
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
            <Download className="w-4 h-4" /> Exporter CSV
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white text-[#001A4D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#001A4D] border-t-transparent rounded-full animate-spin" /></div>
      ) : sauts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center text-gray-400">Aucun saut</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Parachutiste</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Lieu</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hauteur</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Catégorie</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
                {tab === 'attente' && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sauts.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.parachutiste_prenom} {s.parachutiste_nom}</td>
                  <td className="px-4 py-3 text-gray-600">{fr(s.date_saut)}</td>
                  <td className="px-4 py-3 text-gray-600">{s.lieu}</td>
                  <td className="px-4 py-3 text-gray-600">{s.is_tunnel ? '—' : `${s.hauteur_m}m`}</td>
                  <td className="px-4 py-3 text-gray-600">{s.is_tunnel ? 'Soufflerie' : s.categorie}</td>
                  <td className="px-4 py-3">
                    {s.statut === 'valide' && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">Validé</span>}
                    {s.statut === 'en_attente' && <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">En attente</span>}
                    {s.statut === 'refuse' && <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">Refusé</span>}
                  </td>
                  {tab === 'attente' && (
                    <td className="px-4 py-3">
                      <button onClick={() => handleValider(s.id)} className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-xs flex items-center gap-1 transition">
                        <CheckCircle className="w-3 h-3" /> Valider
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {tab === 'historique' && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40">Précédent</button>
              <span className="text-sm text-gray-500">Page {page + 1}</span>
              <button disabled={sauts.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40">Suivant</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MonCentreSection ──────────────────────────────────────────────────────────

function MonCentreSection({ centre, onSaved }: { centre: Centre | null; onSaved: () => void }) {
  const [form, setForm] = useState({
    nom: centre?.nom ?? '',
    ville: centre?.ville ?? '',
    email: centre?.email ?? '',
    telephone: centre?.telephone ?? '',
    numero_agrement_ffp: centre?.numero_agrement_ffp ?? '',
    tampon_nom_officiel: centre?.tampon_nom_officiel ?? '',
    nom_dt: centre?.nom_dt ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Signature DT upload
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadedSignature, setUploadedSignature] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Logo DZ upload
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadedLogo, setUploadedLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [dragOverLogo, setDragOverLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (centre) {
      setForm({
        nom: centre.nom,
        ville: centre.ville,
        email: centre.email ?? '',
        telephone: centre.telephone ?? '',
        numero_agrement_ffp: centre.numero_agrement_ffp ?? '',
        tampon_nom_officiel: centre.tampon_nom_officiel ?? '',
        nom_dt: centre.nom_dt ?? '',
      });
      if (centre.signature_dt_url) {
        setSignatureUrl(
          `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/parapass-docs/${centre.signature_dt_url}`
        );
      }
      if ((centre as unknown as Record<string,unknown>).logo_url) {
        const raw = (centre as unknown as Record<string,unknown>).logo_url as string;
        setLogoUrl(raw.startsWith('/') || raw.startsWith('http') ? raw : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/centre-logos/${raw}`);
      }
    }
  }, [centre]);

  const handleSave = async () => {
    if (!centre?.id) return;
    setSaving(true);
    await supabase.from('centres').update(form).eq('id', centre.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved();
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignatureFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setSignaturePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadSignature = async () => {
    if (!signatureFile || !centre?.id) return;
    setUploadingSignature(true);
    try {
      const path = `signatures/${centre.id}/dt.png`;
      const { error: uploadError } = await supabase.storage
        .from('parapass-docs')
        .upload(path, signatureFile, { upsert: true, contentType: signatureFile.type });
      if (uploadError) throw uploadError;

      await supabase.from('centres').update({ signature_dt_url: path }).eq('id', centre.id);
      setSignatureUrl(
        `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/parapass-docs/${path}`
      );
      setSignatureFile(null);
      setSignaturePreview(null);
      setUploadedSignature(true);
      setTimeout(() => setUploadedSignature(false), 3000);
      onSaved();
    } catch (err) {
      console.error('Signature upload error:', err);
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleRemoveSignature = async () => {
    if (!centre?.id) return;
    await supabase.from('centres').update({ signature_dt_url: null }).eq('id', centre.id);
    setSignatureUrl(null);
    setSignatureFile(null);
    setSignaturePreview(null);
    onSaved();
  };

  const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
  const LOGO_MAX_SIZE = 2 * 1024 * 1024;

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return;
    setLogoError(null);
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError('Format non supporté. Utilisez PNG, JPG, SVG ou WebP.');
      return;
    }
    if (file.size > LOGO_MAX_SIZE) {
      setLogoError('Fichier trop lourd. Maximum 2 Mo.');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => handleLogoFile(e.target.files?.[0]);

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverLogo(false);
    handleLogoFile(e.dataTransfer.files[0]);
  };

  const handleUploadLogo = async () => {
    if (!logoFile || !centre?.id) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const ext = logoFile.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `logo-${centre.id}.${ext}`;
      const { error } = await supabase.storage.from('centre-logos').upload(fileName, logoFile, { upsert: true, contentType: logoFile.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('centre-logos').getPublicUrl(fileName);
      const bust = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('centres').update({ logo_url: bust, logo_updated_at: new Date().toISOString() }).eq('id', centre.id);
      setLogoUrl(bust);
      setLogoFile(null);
      setLogoPreview(null);
      setUploadedLogo(true);
      setTimeout(() => setUploadedLogo(false), 4000);
      onSaved();
    } catch (err) {
      setLogoError(`Erreur lors de l'upload : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!centre?.id) return;
    await supabase.from('centres').update({ logo_url: null }).eq('id', centre.id);
    setLogoUrl(null);
    setLogoFile(null);
    setLogoPreview(null);
    onSaved();
  };

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20"
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Mon centre</h1>

      {/* ── Identité visuelle ── */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #0f1a30 100%)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Identité visuelle du centre</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Votre logo apparaît comme cachet officiel sur le verso des carnets de vos parachutistes
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Left — preview */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Aperçu cachet DZ</p>
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid rgba(249,115,22,0.4)' }}
            >
              {(logoPreview || logoUrl) ? (
                <img
                  src={logoPreview ?? logoUrl ?? ''}
                  alt="Logo DZ"
                  className="w-full h-full object-contain p-2"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <span className="text-2xl font-black text-white/30">{centre?.nom?.substring(0, 2).toUpperCase() || 'DZ'}</span>
              )}
            </div>
            <p className="text-[11px] text-white/50 text-center max-w-[120px] leading-snug">{centre?.nom}</p>
            {logoUrl && !logoPreview && (
              <button
                onClick={handleDeleteLogo}
                className="text-[11px] text-red-400 hover:text-red-300 transition flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Supprimer le logo
              </button>
            )}
          </div>

          {/* Right — drop zone + instructions */}
          <div className="flex flex-col gap-3">
            <div
              className="rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all select-none"
              style={{
                border: `2px dashed ${dragOverLogo ? '#F97316' : 'rgba(255,255,255,0.15)'}`,
                background: dragOverLogo ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.02)',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOverLogo(true); }}
              onDragLeave={() => setDragOverLogo(false)}
              onDrop={handleLogoDrop}
              onClick={() => logoInputRef.current?.click()}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)' }}>
                <Upload className="w-4 h-4" style={{ color: '#F97316' }} />
              </div>
              <p className="text-xs text-center font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {uploadingLogo ? 'Upload en cours…' : 'Glisser-déposer ou cliquer'}
              </p>
              <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                PNG, JPG, SVG, WebP · Max 2 Mo
              </p>
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />

            {logoError && (
              <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {logoError}
              </div>
            )}

            {logoFile && !logoError && (
              <button
                onClick={handleUploadLogo}
                disabled={uploadingLogo}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
                style={{ background: '#F97316' }}
              >
                {uploadingLogo ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi en cours…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Enregistrer le logo</>
                )}
              </button>
            )}

            {uploadedLogo && (
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                <CheckCircle className="w-3.5 h-3.5" />
                Logo mis à jour — appliqué sur tous les carnets
              </div>
            )}

            <div className="rounded-lg px-3 py-2.5 text-[10px] leading-relaxed" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}>
              <p className="font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Conseils</p>
              <p>· Fond transparent (PNG) pour un rendu optimal</p>
              <p>· Logo carré ou circulaire idéalement</p>
              <p>· Appliqué immédiatement sur toutes les cartes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Informations générales</h2>
        {field('Nom du centre', 'nom')}
        {field('Ville', 'ville')}
        {field('Email de contact', 'email', 'email')}
        {field('Téléphone', 'telephone', 'tel')}
        {field("N° agrément FFP", 'numero_agrement_ffp')}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {saved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Enregistré</span>}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#001A4D] text-white rounded-xl text-sm font-medium hover:bg-[#001A4D]/90 disabled:opacity-60 transition"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Cachet officiel */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-gray-900">Cachet officiel</h2>
          <p className="text-xs text-gray-500 mt-1">
            Le cachet apparaît au verso de la carte du licencié. Renseignez le nom officiel du centre et du Directeur Technique.
          </p>
        </div>

        {field("Nom officiel (pour le cachet)", 'tampon_nom_officiel')}
        {field("Nom du Directeur Technique", 'nom_dt')}

        <div className="flex items-center justify-between pt-1">
          <div />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#001A4D] text-white rounded-xl text-sm font-medium hover:bg-[#001A4D]/90 disabled:opacity-60 transition"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer le cachet'}
          </button>
        </div>

        {/* Signature DT upload */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Signature numérique DT</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Importez une image PNG/JPG de votre signature (fond transparent recommandé).
                Elle remplacera le cachet SVG sur le verso.
              </p>
            </div>
            {signatureUrl && !signaturePreview && (
              <button
                onClick={handleRemoveSignature}
                className="text-xs text-red-500 hover:text-red-700 transition flex items-center gap-1 flex-shrink-0 ml-4"
              >
                <X className="w-3.5 h-3.5" /> Supprimer
              </button>
            )}
          </div>

          {/* Preview zone */}
          {(signaturePreview || signatureUrl) && (
            <div className="mb-4 p-3 bg-gray-900 rounded-xl flex items-center justify-center" style={{ minHeight: 88 }}>
              <img
                src={signaturePreview ?? signatureUrl ?? ''}
                alt="Aperçu signature"
                className="max-h-16 max-w-xs object-contain"
                style={{ filter: signaturePreview ? 'none' : 'invert(1) sepia(1) saturate(2) hue-rotate(190deg)', opacity: 0.9 }}
              />
            </div>
          )}

          <input
            ref={signatureInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleSignatureChange}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => signatureInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <Upload className="w-4 h-4" />
              {signatureUrl && !signaturePreview ? 'Changer la signature' : 'Choisir un fichier'}
            </button>

            {signatureFile && (
              <button
                onClick={handleUploadSignature}
                disabled={uploadingSignature}
                className="flex items-center gap-2 px-4 py-2 bg-[#001A4D] text-white rounded-xl text-sm font-medium hover:bg-[#001A4D]/90 disabled:opacity-60 transition"
              >
                {uploadingSignature ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {uploadingSignature ? 'Envoi...' : 'Enregistrer'}
              </button>
            )}

            {uploadedSignature && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Signature enregistrée
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Plan</h2>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${isPlanActif(centre) ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
            {planLabel(centre?.plan)}
          </span>
          {!isPlanActif(centre) && (
            <span className="text-sm text-gray-500">Passez en Centre Agréé pour accéder à toutes les fonctionnalités</span>
          )}
        </div>
        {!isPlanActif(centre) && (
          <button className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
            Passer en Centre Agréé
          </button>
        )}
      </div>
    </div>
  );
}

// ─── StatsSection ──────────────────────────────────────────────────────────────

function StatsSection({ centreId }: { centreId: string | undefined }) {
  const [monthlyData, setMonthlyData] = useState<Array<{ label: string; count: number }>>([]);
  const [brevetData, setBrevetData] = useState<Array<{ type: string; count: number }>>([]);
  const [topParas, setTopParas] = useState<Array<{ nom: string; prenom: string; count: number; photo_profil_url: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centreId) return;
    (async () => {
      setLoading(true);
      const { data: membresData } = await supabase
        .from('licencies_centres')
        .select('parachutiste_id')
        .eq('centre_id', centreId)
        .eq('statut', 'actif');

      const ids = (membresData ?? []).map((m: { parachutiste_id: string }) => m.parachutiste_id);
      if (ids.length === 0) { setLoading(false); return; }

      // Monthly sauts (last 6 months)
      const months: Array<{ label: string; start: string; end: string }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const start = d.toISOString().split('T')[0];
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
        months.push({ label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), start, end });
      }

      const monthly = await Promise.all(months.map(async m => {
        const { count } = await supabase
          .from('sauts')
          .select('*', { count: 'exact', head: true })
          .in('parachutiste_id', ids)
          .gte('date_saut', m.start)
          .lte('date_saut', m.end)
          .eq('statut', 'valide');
        return { label: m.label, count: count ?? 0 };
      }));
      setMonthlyData(monthly);

      // Brevets repartition
      const { data: brevetsData } = await supabase
        .from('brevets')
        .select('parachutiste_id, type_brevet')
        .in('parachutiste_id', ids);
      // Dédup par parachutiste_id : un seul brevet (le premier trouvé) par personne
      const seenParaIds = new Set<string>();
      const bCounts: Record<string, number> = {};
      (brevetsData as Array<{ parachutiste_id: string; type_brevet: string }> ?? []).forEach((b) => {
        if (seenParaIds.has(b.parachutiste_id)) return;
        seenParaIds.add(b.parachutiste_id);
        bCounts[b.type_brevet] = (bCounts[b.type_brevet] ?? 0) + 1;
      });
      setBrevetData(Object.entries(bCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 8));

      // Top 5 parachutistes
      const { data: sautsAll } = await supabase
        .from('sauts')
        .select('parachutiste_id')
        .in('parachutiste_id', ids)
        .eq('statut', 'valide');
      const pCounts: Record<string, number> = {};
      (sautsAll ?? []).forEach((s: { parachutiste_id: string }) => { pCounts[s.parachutiste_id] = (pCounts[s.parachutiste_id] ?? 0) + 1; });
      const top5Ids = Object.entries(pCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
      if (top5Ids.length > 0) {
        const { data: topProfiles } = await supabase.from('profiles').select('id, nom, prenom, photo_profil_url').in('id', top5Ids);
        setTopParas((topProfiles ?? []).map((p: { id: string; nom: string; prenom: string; photo_profil_url: string | null }) => ({
          nom: p.nom, prenom: p.prenom, photo_profil_url: p.photo_profil_url, count: pCounts[p.id] ?? 0,
        })).sort((a, b) => b.count - a.count));
      }

      setLoading(false);
    })();
  }, [centreId]);

  const maxMonthly = Math.max(...monthlyData.map(m => m.count), 1);
  const maxBrevet = Math.max(...brevetData.map(b => b.count), 1);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sauts par mois */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Sauts validés (6 derniers mois)</h2>
          <div className="space-y-2">
            {monthlyData.map(m => (
              <div key={m.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-12 shrink-0">{m.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-[#001A4D] rounded-full transition-all"
                    style={{ width: `${(m.count / maxMonthly) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-8 text-right">{m.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Répartition brevets */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Répartition par brevet</h2>
          <div className="space-y-2">
            {brevetData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucune donnée</p>
            ) : brevetData.map(b => (
              <div key={b.type} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-12 shrink-0">{b.type}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: `${(b.count / maxBrevet) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-8 text-right">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Top 5 parachutistes les plus actifs</h2>
        {topParas.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune donnée</p>
        ) : (
          <div className="space-y-3">
            {topParas.map((p, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="text-lg font-bold text-gray-300 w-6 text-center">{i + 1}</span>
                <AvatarCircle url={p.photo_profil_url} nom={p.nom} prenom={p.prenom} size="sm" />
                <p className="flex-1 text-sm font-medium text-gray-900">{p.prenom} {p.nom}</p>
                <span className="text-sm font-bold text-[#001A4D]">{p.count} sauts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LicencieDrawer ────────────────────────────────────────────────────────────

const MESSAGES_RAPIDES = [
  { label: '⚠️ Licence expire', text: 'Bonjour, votre licence FFP expire bientôt. Pensez à la renouveler avant votre prochain saut.' },
  { label: '🏥 Certificat médical', text: 'Bonjour, votre certificat médical est expiré ou arrive à échéance. Un certificat valide est obligatoire pour sauter.' },
  { label: '✓ Saut validé', text: 'Votre saut a été validé. Bon saut et à bientôt sur la DZ !' },
  { label: '📅 Stage PAC', text: 'Un stage PAC est disponible prochainement dans notre centre. Êtes-vous intéressé(e) ?' },
  { label: '👋 Bienvenue', text: "Bienvenue dans notre centre ! N'hésitez pas à nous contacter pour toute question." },
];

function ChatMessages({
  conversationId,
  currentUserId,
  otherName,
}: {
  conversationId: string | null;
  currentUserId: string;
  otherName: string;
}) {
  const { messages, loading } = useConversationMessages(conversationId, currentUserId);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [destinataireId, setDestinatataireId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;
    supabase.from('conversations').select('participant_1_id, participant_2_id').eq('id', conversationId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setDestinatataireId(data.participant_1_id === currentUserId ? data.participant_2_id : data.participant_1_id);
    });
  }, [conversationId, currentUserId]);

  const handleSend = async () => {
    if (!input.trim() || !destinataireId || !conversationId) return;
    setSending(true);
    try {
      await sendMessage(currentUserId, destinataireId, input.trim());
      setInput('');
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-4 border-[#001A4D] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            Commencez la conversation avec {otherName}
          </div>
        )}
        {messages.map((m: Message) => {
          const isMine = m.expediteur_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${isMine ? 'bg-[#001A4D] text-white rounded-tl-sm' : 'bg-gray-100 text-gray-900 rounded-tr-sm'}`}>
                <p className="text-sm whitespace-pre-wrap break-words">{m.contenu}</p>
                <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-start' : 'justify-end'}`}>
                  <span className={`text-[10px] ${isMine ? 'text-white/50' : 'text-gray-400'}`}>{fmt(m.created_at)}</span>
                  {!isMine && (
                    <span className={`text-[10px] ${m.lu ? 'text-blue-500' : 'text-gray-300'}`}>
                      {m.lu ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Quick messages */}
      <div className="px-4 py-2 border-t border-gray-100 flex gap-1.5 overflow-x-auto">
        {MESSAGES_RAPIDES.map(mr => (
          <button
            key={mr.label}
            onClick={() => setInput(mr.text)}
            className="flex-shrink-0 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full px-3 py-1 transition"
          >
            {mr.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire un message... (Entrée pour envoyer)"
          rows={2}
          maxLength={2000}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 resize-none"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="p-2.5 bg-[#001A4D] text-white rounded-xl hover:bg-[#001A4D]/90 disabled:opacity-50 transition flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function LicencieDrawer({
  licencie, centreId, onClose, initialTab,
}: {
  licencie: LicencieSummary | null;
  centreId: string;
  onClose: () => void;
  initialTab?: 'carte' | 'sauts' | 'messages' | 'actions';
}) {
  const { profile: currentProfile } = useAuth();
  const [tab, setTab] = useState<'carte' | 'sauts' | 'messages' | 'actions'>(initialTab ?? 'carte');
  const [sauts, setSauts] = useState<SautSummary[]>([]);
  const [loadingSauts, setLoadingSauts] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [confirmRetrait, setConfirmRetrait] = useState(false);
  const [showAddSaut, setShowAddSaut] = useState(false);

  // Contrôle documentaire
  const [controleOk, setControleOk] = useState({ licence: false, medical: false, assurance: false });
  const [controleNote, setControleNote] = useState('');
  const [controleSubmitting, setControleSubmitting] = useState(false);
  const [controleSuccess, setControleSuccess] = useState(false);
  const [controleError, setControleError] = useState<string | null>(null);
  const [dernierControle, setDernierControle] = useState<{
    controle_le: string; licence_ok: boolean; medical_ok: boolean; assurance_ok: boolean;
    controle_par_nom: string | null; note: string | null;
  } | null>(null);

  // Conformité globale du licencié (licence + médical + matériel)
  const { rules: drawerRules } = useComplianceRules();
  const [drawerConformite, setDrawerConformite] = useState<ComplianceStatus | null>(null);
  useEffect(() => {
    if (!licencie) { setDrawerConformite(null); return; }
    supabase.rpc('get_conformite_licencies', { p_centre_id: centreId }).then(({ data, error }) => {
      if (error) { console.error('Chargement conformité fiche échoué :', error); return; }
      const row = ((data ?? []) as Array<{ parachutiste_id: string; licence_expiration: string | null; certificat_expiration: string | null; materiel_echeance: string | null }>)
        .find(r => r.parachutiste_id === licencie.id);
      if (!row) { setDrawerConformite('inconnu'); return; }
      setDrawerConformite(worstStatus([
        getComplianceStatus(row.licence_expiration, drawerRules),
        getComplianceStatus(row.certificat_expiration, drawerRules),
        row.materiel_echeance ? getComplianceStatus(row.materiel_echeance, drawerRules) : 'ok',
      ]));
    });
  }, [licencie, centreId, drawerRules]);

  useEffect(() => {
    setTab(initialTab ?? 'carte');
  }, [initialTab, licencie?.id]);

  useEffect(() => {
    if (!licencie) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [licencie, onClose]);

  useEffect(() => {
    if (!licencie || tab !== 'sauts') return;
    setLoadingSauts(true);
    supabase
      .from('sauts')
      .select('id, parachutiste_id, date_saut, lieu, hauteur_m, categorie, statut')
      .eq('parachutiste_id', licencie.id)
      .order('date_saut', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setSauts(data ?? []);
        setLoadingSauts(false);
      });
  }, [licencie, tab]);

  // Load or create conversation when switching to messages tab
  useEffect(() => {
    if (!licencie || tab !== 'messages' || !currentProfile) return;
    getOrCreateConversation(currentProfile.id, licencie.id).then(conv => {
      setConversationId(conv.id);
    });
  }, [licencie, tab, currentProfile]);

  // Charger le dernier contrôle documentaire quand on ouvre l'onglet actions
  useEffect(() => {
    if (!licencie || tab !== 'actions') return;
    setControleSuccess(false);
    setControleError(null);
    setControleOk({ licence: false, medical: false, assurance: false });
    setControleNote('');
    supabase
      .from('controle_documents')
      .select('controle_le, licence_ok, medical_ok, assurance_ok, note, controle_par_nom')
      .eq('licencie_id', licencie.id)
      .eq('centre_id', centreId)
      .order('controle_le', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setDernierControle(null); return; }
        const d = data as Record<string, unknown>;
        setDernierControle({
          controle_le: d.controle_le as string,
          licence_ok: d.licence_ok as boolean,
          medical_ok: d.medical_ok as boolean,
          assurance_ok: d.assurance_ok as boolean,
          note: d.note as string | null,
          controle_par_nom: (d.controle_par_nom as string | null) ?? null,
        });
      });
  }, [licencie, tab, centreId]);

  const handleBatchValider = async () => {
    if (!licencie) return;
    const validateur = currentProfile ? `${currentProfile.prenom} ${currentProfile.nom}` : 'Admin Centre';
    const pendingIds = sauts.filter(s => s.statut === 'en_attente').map(s => s.id);
    for (const id of pendingIds) {
      await supabase.from('sauts').update({
        statut: 'valide',
        valide_le: new Date().toISOString(),
        valide_par: validateur,
      }).eq('id', id);
    }
    setSauts(prev => prev.map(s => s.statut === 'en_attente' ? { ...s, statut: 'valide' as const } : s));
  };

  const handleRetirerDuCentre = async () => {
    if (!licencie) return;
    await supabase
      .from('licencies_centres')
      .update({ statut: 'inactif' })
      .eq('centre_id', centreId)
      .eq('parachutiste_id', licencie.id);
    onClose();
  };

  const handleControlerDocuments = async () => {
    if (!licencie || !currentProfile || controleSubmitting) return;
    setControleSubmitting(true);
    setControleError(null);
    const nomControleur = `${currentProfile.prenom} ${currentProfile.nom}`;
    // Fetch centre name for denormalization
    const { data: centreRow } = await supabase.from('centres').select('nom').eq('id', centreId).maybeSingle();
    const { data: inserted, error } = await supabase
      .from('controle_documents')
      .insert({
        licencie_id: licencie.id,
        centre_id: centreId,
        controle_par: currentProfile.id,
        controle_par_nom: nomControleur,
        centre_nom: centreRow?.nom ?? null,
        licence_ok: controleOk.licence,
        medical_ok: controleOk.medical,
        assurance_ok: controleOk.assurance,
        note: controleNote.trim() || null,
      })
      .select('id')
      .single();
    if (!error && inserted) {
      const now = new Date().toISOString();
      setControleSuccess(true);
      setDernierControle({
        controle_le: now,
        licence_ok: controleOk.licence,
        medical_ok: controleOk.medical,
        assurance_ok: controleOk.assurance,
        note: controleNote.trim() || null,
        controle_par_nom: nomControleur,
      });
    } else {
      setControleError(error?.message ?? 'Erreur lors de l\'enregistrement');
    }
    setControleSubmitting(false);
  };

  const handleGeneratePDF = async () => {
    if (!licencie) return;
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', licencie.id).maybeSingle();
    if (!profileData) return;
    const { data: sautsAll } = await supabase.from('sauts').select('*').eq('parachutiste_id', licencie.id).eq('statut', 'valide');
    const { data: licences } = await supabase.from('licences').select('*').eq('parachutiste_id', licencie.id);
    const { data: brevetsAll } = await supabase.from('brevets').select('*').eq('parachutiste_id', licencie.id);
    const { data: certs } = await supabase.from('certificats_medicaux').select('*').eq('parachutiste_id', licencie.id);
    const { data: quals } = await supabase.from('qualifications').select('*').eq('parachutiste_id', licencie.id);
    generatePDF({
      profile: profileData,
      sauts: sautsAll ?? [],
      licences: licences ?? [],
      brevets: brevetsAll ?? [],
      certificats: certs ?? [],
      qualifications: quals ?? [],
    });
  };

  if (!licencie) return null;

  const tabs = [
    { key: 'carte', label: 'Carte' },
    { key: 'sauts', label: 'Sauts' },
    { key: 'messages', label: 'Messages' },
    { key: 'actions', label: 'Actions' },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <AvatarCircle url={licencie.photo_profil_url} nom={licencie.nom} prenom={licencie.prenom} size="md" />
            <div>
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                {licencie.prenom} {licencie.nom}
                {drawerConformite && drawerConformite !== 'ok' && (
                  <ComplianceBadge status={drawerConformite} />
                )}
              </p>
              <p className="text-xs text-gray-500">{licencie.numero_licence}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-gray-100 bg-gray-50">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-[#001A4D] text-white' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={`flex-1 min-h-0 ${tab === 'messages' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-6 space-y-4'}`} key={`${licencie?.id}-${tab}`}>
          {tab === 'carte' && licencie && currentProfile && (
            <PasseportCardView
              userId={licencie.id}
              centreId={centreId}
              adminId={currentProfile.id}
            />
          )}

          {tab === 'sauts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">10 derniers sauts</p>
                <div className="flex items-center gap-2">
                  {sauts.some(s => s.statut === 'en_attente') && (
                    <button
                      onClick={handleBatchValider}
                      className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-xs flex items-center gap-1 transition"
                    >
                      <CheckCircle className="w-3 h-3" /> Valider en attente
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddSaut(true)}
                    className="px-3 py-1.5 bg-[#001A4D] text-white hover:bg-[#001A4D]/90 rounded-lg text-xs flex items-center gap-1 transition"
                  >
                    <Plus className="w-3 h-3" /> Ajouter un saut
                  </button>
                </div>
              </div>
              {loadingSauts ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-[#001A4D] border-t-transparent rounded-full animate-spin" /></div>
              ) : sauts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucun saut enregistré</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {sauts.map(s => (
                    <div key={s.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{fr(s.date_saut)}</p>
                        <p className="text-xs text-gray-500">{s.lieu} — {s.hauteur_m}m — {s.categorie}</p>
                      </div>
                      {s.statut === 'valide' && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">Validé</span>}
                      {s.statut === 'en_attente' && <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">En attente</span>}
                      {s.statut === 'refuse' && <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">Refusé</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'messages' && currentProfile && (
            <ChatMessages
              conversationId={conversationId}
              currentUserId={currentProfile.id}
              otherName={`${licencie.prenom} ${licencie.nom}`}
            />
          )}

          {tab === 'actions' && (
            <div className="space-y-5">

              {/* ── Contrôle documentaire ── */}
              <div className="border border-indigo-100 rounded-xl p-4 space-y-3" style={{ background: '#F5F3FF' }}>
                <div>
                  <p className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Contrôle documentaire
                  </p>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    Attester avoir vérifié les documents présentés à l'accueil
                  </p>
                </div>

                {/* Dernier contrôle */}
                {dernierControle && (
                  <div className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
                    Dernier contrôle : <strong>{new Date(dernierControle.controle_le).toLocaleDateString('fr-FR')}</strong>
                    {dernierControle.controle_par_nom && <> par {dernierControle.controle_par_nom}</>}
                    <span className="ml-2">
                      {dernierControle.licence_ok ? '✓ Lic' : '✗ Lic'}
                      {' · '}
                      {dernierControle.medical_ok ? '✓ Méd' : '✗ Méd'}
                      {' · '}
                      {dernierControle.assurance_ok ? '✓ Ass' : '✗ Ass'}
                    </span>
                  </div>
                )}

                {controleSuccess ? (
                  <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-100 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Contrôle enregistré avec succès
                  </div>
                ) : (
                  <>
                    {/* Checkboxes */}
                    <div className="space-y-2">
                      {([
                        { key: 'licence', label: 'Licence FFP présentée et conforme' },
                        { key: 'medical', label: 'Certificat médical présenté et conforme' },
                        { key: 'assurance', label: 'Assurance présentée et conforme' },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={controleOk[key]}
                            onChange={e => setControleOk(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="w-4 h-4 rounded accent-indigo-600"
                          />
                          <span className="text-sm text-indigo-900">{label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Note optionnelle */}
                    <textarea
                      value={controleNote}
                      onChange={e => setControleNote(e.target.value)}
                      placeholder="Note optionnelle…"
                      rows={2}
                      className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      style={{ background: 'rgba(255,255,255,0.8)' }}
                    />

                    {controleError && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        ⚠️ {controleError}
                      </div>
                    )}
                    <button
                      onClick={handleControlerDocuments}
                      disabled={controleSubmitting}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: '#4F46E5' }}
                    >
                      {controleSubmitting ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                      Enregistrer le contrôle
                    </button>
                    <p className="text-[10px] text-indigo-400 text-center leading-tight">
                      Contrôle documentaire uniquement — sans valeur de certification fédérale
                    </p>
                  </>
                )}
              </div>

              {/* Messagerie rapide */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Messagerie</p>
                  <p className="text-xs text-blue-600 mt-0.5">Échangez des messages avec {licencie.prenom}</p>
                </div>
                <button
                  onClick={() => setTab('messages')}
                  className="px-3 py-1.5 bg-[#001A4D] text-white rounded-xl text-xs hover:bg-[#001A4D]/90 transition flex items-center gap-1"
                >
                  <Send className="w-3 h-3" /> Ouvrir
                </button>
              </div>

              {/* PDF */}
              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={handleGeneratePDF}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm text-gray-700 transition"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                  Générer le carnet PDF
                </button>
              </div>

              {/* Retirer du centre */}
              <div className="border-t border-gray-100 pt-4">
                {!confirmRetrait ? (
                  <button
                    onClick={() => setConfirmRetrait(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 hover:bg-red-100 rounded-xl text-sm text-red-600 transition"
                  >
                    <UserX className="w-4 h-4" />
                    Retirer du centre
                  </button>
                ) : (
                  <div className="bg-red-50 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-red-700 font-medium">Confirmer le retrait de {licencie.prenom} {licencie.nom} ?</p>
                    <div className="flex gap-2">
                      <button onClick={handleRetirerDuCentre} className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700 transition">Confirmer</button>
                      <button onClick={() => setConfirmRetrait(false)} className="flex-1 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {showAddSaut && licencie && (
        <AddSautModal
          open={showAddSaut}
          onClose={() => setShowAddSaut(false)}
          targetParachutisteId={licencie.id}
          onAdded={(saut) => {
            setShowAddSaut(false);
            setSauts(prev => [{ ...saut, parachutiste_nom: licencie.nom, parachutiste_prenom: licencie.prenom } as SautSummary, ...prev.slice(0, 9)]);
          }}
        />
      )}
    </>
  );
}

// ─── MessagesSection ───────────────────────────────────────────────────────────

function MessagesSection({ currentUserId }: { currentUserId: string }) {
  const { conversations, loading } = useConversations(currentUserId);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null;

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="h-[calc(100vh-120px)] flex gap-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Conversation list */}
      <div className={`w-full md:w-72 border-r border-gray-100 flex flex-col ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="text-center text-gray-400 text-sm p-8">Aucune conversation</div>
          ) : conversations.map(conv => {
            const isActive = conv.id === selectedConvId;
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedConvId(conv.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition text-left ${isActive ? 'bg-blue-50' : ''}`}
              >
                <div className="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: conv.avatarCouleur }}>
                  {conv.avatarInitiales}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">{conv.nomAffiche}</p>
                    {(conv.non_lus ?? 0) > 0 && (
                      <span className="text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 ml-1 flex-shrink-0">{conv.non_lus}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{conv.dernier_message || 'Nouvelle conversation'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${!selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        {!selectedConvId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Sélectionnez une conversation
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <button onClick={() => setSelectedConvId(null)} className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg">
                <ChevronRight className="w-4 h-4 rotate-180 text-gray-500" />
              </button>
              <div className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold"
                style={{ background: selectedConv?.avatarCouleur || '#001A4D' }}>
                {selectedConv?.avatarInitiales || '?'}
              </div>
              <p className="font-medium text-gray-900 text-sm">
                {selectedConv?.nomAffiche || '—'}
              </p>
            </div>
            <ChatMessages
              conversationId={selectedConvId}
              currentUserId={currentUserId}
              otherName={selectedConv?.nomAffiche || ''}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── CentreDashboardPage ───────────────────────────────────────────────────────

export function CentreDashboardPage() {
  const { profile, signOut, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [centre, setCentre] = useState<Centre | null>(null);
  const [centreId, setCentreId] = useState<string | undefined>(undefined);
  const [stats, setStats] = useState<DashStats>({ totalLicencies: 0, demandesAttente: 0, sautsAujourdhui: 0, alertes: 0 });
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  // Sous-onglets : Messages = la communication, Mon équipe = les gens et leur encadrement
  const [messagesTab, setMessagesTab] = useState<'conversations' | 'relances'>('conversations');
  const [equipeTab, setEquipeTab] = useState<'encadrement' | 'equipe'>('equipe');
  const [academyTab, setAcademyTab] = useState<'quiz' | 'pac' | 'brevets' | 'documents'>('quiz');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(0);
  const [carnetsEnAttente, setCarnetsEnAttente] = useState(0);
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());
  const [drawerLicencie, setDrawerLicencie] = useState<LicencieSummary | null>(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState<'carte' | 'sauts' | 'messages' | 'actions'>('carte');
  const { totalUnread: msgUnread } = useConversations(profile?.id);

  useEffect(() => {
    if (!authLoading && (!profile || (profile.role !== 'admin' && profile.role !== 'moniteur'))) {
      // Allow if role is admin_centre via profile role field; fall through to data check
    }
  }, [authLoading, profile, navigate]);

  const fetchCentreData = useCallback(async () => {
    if (!profile) return;

    // Try via admin_centres join first, fallback to admin_centre_id on profile
    let resolvedCentreId: string | null = null;
    let centreData: Centre | null = null;

    // Step 1: get centre_id from admin_centres (no join to avoid RLS issues)
    const { data: adminData } = await supabase
      .from('admin_centres')
      .select('centre_id, role')
      .eq('profile_id', profile.id)
      .maybeSingle();

    resolvedCentreId = adminData?.centre_id ?? profile.admin_centre_id ?? null;

    // Step 2: load centre directly
    if (resolvedCentreId) {
      const { data: directCentre } = await supabase
        .from('centres')
        .select('*')
        .eq('id', resolvedCentreId)
        .maybeSingle();
      if (directCentre) centreData = directCentre as Centre;
    }

    if (centreData && resolvedCentreId) {
      setCentre(centreData);
      setCentreId(resolvedCentreId);

      const { count: licCount } = await supabase
        .from('licencies_centres')
        .select('*', { count: 'exact', head: true })
        .eq('centre_id', resolvedCentreId)
        .eq('statut', 'actif');

      const { count: pendingCount } = await supabase
        .from('licencies_centres')
        .select('*', { count: 'exact', head: true })
        .eq('centre_id', resolvedCentreId)
        .eq('statut', 'en_attente');

      const today = new Date().toISOString().split('T')[0];
      // Use RPC to avoid long in() list that causes 503 on HEAD requests
      const { data: sautsTodayData } = await supabase.rpc('get_sauts_today', {
        p_centre_id: resolvedCentreId,
        p_today: today,
      });
      const sautsToday = (sautsTodayData as number) ?? 0;

      setStats({
        totalLicencies: licCount ?? 0,
        demandesAttente: pendingCount ?? 0,
        sautsAujourdhui: sautsToday,
        alertes: 0,
      });

      // Active modules — règle unique du catalogue (ligne explicite, sinon défaut)
      const { data: modulesData, error: modulesError } = await supabase
        .from('centre_modules')
        .select('module_id, active')
        .eq('centre_id', resolvedCentreId);
      if (modulesError) console.error('Chargement centre_modules échoué :', modulesError);
      setActiveModules(computeActiveModules(modulesData ?? []));

      // Carnets en attente de validation
      const { count: carnetCount } = await supabase
        .from('licencies_centres')
        .select('*', { count: 'exact', head: true })
        .eq('centre_id', resolvedCentreId)
        .eq('statut', 'actif')
        .eq('carnet_statut', 'en_attente');
      setCarnetsEnAttente(carnetCount ?? 0);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (!authLoading) fetchCentreData();
  }, [authLoading, fetchCentreData]);

  // Notifications count
  useEffect(() => {
    if (!profile) return;
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id)
      .eq('lue', false)
      .then(({ count }) => setNotifCount(count ?? 0));
  }, [profile]);

  const isActivePlan = isPlanActif(centre);

  const navItems = [
    { key: 'dashboard', label: 'Tableau de bord', icon: Home },
    { key: 'licencies', label: 'Mes licenciés', icon: Users },
    { key: 'demandes', label: "Demandes d'adhésion", icon: ClipboardList, badge: stats.demandesAttente },
    { key: 'sauts', label: 'Activité des sauts', icon: Activity },
    { key: 'briefing', label: 'Briefing du jour', icon: Megaphone },
    ...(activeModules.has('academy') ? [{ key: 'academy', label: 'Academy', icon: GraduationCap }] : []),
    { key: 'planning', label: 'Planning DZ', icon: Calendar },
    { key: 'stats', label: 'Statistiques', icon: BarChart2 },
    { key: 'equipe', label: 'Mon équipe', icon: Shield },
    { key: 'centre', label: 'Mon centre', icon: Settings },
    { key: 'messages', label: 'Messages', icon: MessageSquare, badge: msgUnread },
    { key: 'validations', label: 'Validations carnet', icon: BookCheck, badge: carnetsEnAttente > 0 ? carnetsEnAttente : undefined },
    ...(activeModules.has('pliage') ? [{ key: 'pliage', label: 'Gestion pliage', icon: Shield }] : []),
    ...(activeModules.has('finances') ? [{ key: 'finances', label: 'Finances', icon: Euro }] : []),
    ...(activeModules.has('tandem') ? [{ key: 'tandem', label: 'Module Tandem', icon: GraduationCap }] : []),
    { key: 'modules', label: 'Modules', icon: Puzzle },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#001A4D' }}>
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    navigate('/');
    return null;
  }

  // No centre found yet
  if (!centre) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#001A4D' }}>
        <div className="rounded-2xl p-10 max-w-md text-center space-y-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-f)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Clock className="w-8 h-8" style={{ color: '#F59E0B' }} />
          </div>
          <h2 className="text-xl font-bold text-white">Centre en cours de validation</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-dim)' }}>
            Votre centre est en cours de validation. Nous vérifions votre agrément FFP sous 24-48h.
            Vous recevrez une notification dès que votre centre sera approuvé.
          </p>
          <button
            onClick={signOut}
            className="px-5 py-2.5 rounded-xl text-sm transition"
            style={{ background: 'var(--c-border)', color: 'var(--c-dim)' }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Centre info */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-3">
          {centre.logo_url ? (
            <img src={centre.logo_url} alt={centre.nom} className="w-9 h-9 rounded-full object-contain flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0" style={{ background: 'var(--c-hover)' }}>
              {centre.nom.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white truncate" style={{ fontSize: 13 }}>{centre.nom}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{
              background: isActivePlan ? 'rgba(37,99,235,0.2)' : 'rgba(249,115,22,0.2)',
              color: isActivePlan ? '#60A5FA' : '#F97316',
              border: `1px solid ${isActivePlan ? 'rgba(37,99,235,0.3)' : 'rgba(249,115,22,0.3)'}`,
            }}>
              {planLabel(centre.plan)}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 px-2 py-3 space-y-0.5 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.key;
          const isMsgBadge = item.key === 'messages';
          return (
            <button
              key={item.key}
              onClick={() => { setActiveSection(item.key); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 text-left transition-all"
              style={{
                padding: '9px 12px',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(249,115,22,0.1)' : 'transparent',
                color: isActive ? '#F97316' : 'var(--c-muted)',
                borderLeft: isActive ? '2px solid #F97316' : '2px solid transparent',
                borderRadius: isActive ? '0 8px 8px 0' : 8,
              }}
              onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--c-card)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text2)'; } }}
              onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-muted)'; } }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-semibold" style={{
                  background: isMsgBadge ? 'rgba(59,130,246,0.25)' : 'rgba(239,68,68,0.2)',
                  color: isMsgBadge ? '#60A5FA' : '#F87171',
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom: notifs + logout — always visible, never scrolled away */}
      <div className="px-2 py-3 space-y-0.5 flex-shrink-0" style={{ borderTop: '1px solid var(--c-border)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <button className="w-full flex items-center gap-2.5 rounded-lg transition"
          style={{ padding: '9px 12px', fontSize: 12, color: 'var(--c-dim)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-card)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-dim)'; }}
        >
          <Bell className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">Notifications</span>
          {notifCount > 0 && (
            <span className="text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-semibold" style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171' }}>{notifCount}</span>
          )}
        </button>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: 'var(--c-border)' }}>
            {initials(profile.nom, profile.prenom)}
          </div>
          <p className="text-xs flex-1 truncate" style={{ color: 'var(--c-dim)', fontSize: 11 }}>{profile.prenom} {profile.nom}</p>
          <button onClick={toggleTheme} className="p-1 rounded-lg transition flex-shrink-0" title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            style={{ color: 'var(--c-dim)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--c-dim)'; }}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button onClick={signOut} className="p-1 rounded-lg transition flex-shrink-0" title="Se déconnecter"
            style={{ color: 'var(--c-dim)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#F87171'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--c-dim)'; }}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--c-bg)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-full z-30" style={{ width: 220, background: 'var(--c-nav)', borderRight: '1px solid var(--c-border)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed top-0 left-0 z-50 lg:hidden flex flex-col" style={{ width: 220, height: '100dvh', background: 'var(--c-nav)', borderRight: '1px solid var(--c-border)' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--c-border)' }}>
              <span className="text-sm font-bold text-white">ParaPass</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--c-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 min-h-screen lg:ml-[220px]">
        {/* Top bar (mobile) */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-20" style={{ background: 'var(--c-nav)', borderBottom: '1px solid var(--c-border)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl" style={{ color: 'var(--c-muted)' }}>
            <Menu className="w-5 h-5" />
          </button>
          {/* Nom du centre affiché dans le bandeau Centre DZ juste en dessous (dédup) */}
          <span className="flex-1" />
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-xl transition" style={{ color: 'var(--c-muted)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--c-muted)'; }}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="relative">
              <Bell className="w-5 h-5" style={{ color: 'var(--c-muted)' }} />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{notifCount}</span>
            )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {activeSection === 'dashboard' && (
            <>
              {/* Dashboard réagencé : En-tête → Aujourd'hui → À traiter → Pilotage → Météo.
                  Les blocs opérationnels sont passés en slots pour respecter l'ordre. */}
              {(() => {
                const goRecap = (section: string, tab?: string) => {
                  if (section === 'equipe' && tab) setEquipeTab(tab as 'encadrement' | 'moniteurs' | 'staff');
                  if (section === 'messages' && tab) setMessagesTab(tab as 'conversations' | 'relances');
                  setActiveSection(section);
                };
                return (
                  <DashboardHome
                    centre={centre}
                    stats={stats}
                    onNavigate={setActiveSection}
                    carnetsEnAttente={carnetsEnAttente}
                    briefingSlot={centreId ? <BriefingRecapDZ centreId={centreId} onOuvrir={() => setActiveSection('briefing')} /> : undefined}
                    presencesSlot={centreId ? <PresencesDZ dzId={centreId} /> : undefined}
                    encadrementSlot={centreId ? <TuileEncadrementDZ centreId={centreId} onGo={goRecap} /> : undefined}
                    relancesSlot={centreId ? <TuileRelancesDZ centreId={centreId} onGo={goRecap} /> : undefined}
                    vigilanceSlot={centreId ? <VigilanceVoileDZ centreId={centreId} /> : undefined}
                  />
                );
              })()}
              {/* Météo — toujours en dernier (prévision indicative) */}
              {centreId && (
                <div className="mt-6">
                  <MeteoAltitudeDZ dzId={centreId} />
                </div>
              )}
            </>
          )}
          {activeSection === 'licencies' && (
            <LicenciesSection
              centreId={centreId}
              onOpenDrawer={(l) => { setDrawerInitialTab('carte'); setDrawerLicencie(l); }}
              onOpenMessages={(l) => { setDrawerInitialTab('messages'); setDrawerLicencie(l); }}
            />
          )}
          {activeSection === 'demandes' && (
            <DemandesSection centreId={centreId} onAccepted={fetchCentreData} />
          )}
          {activeSection === 'sauts' && (
            <SautsSection centreId={centreId} />
          )}
          {activeSection === 'stats' && (
            <StatsSection centreId={centreId} />
          )}
          {/* Mon équipe = les gens et leur encadrement : sous-onglets */}
          {activeSection === 'equipe' && (
            <div>
              <SousOnglets
                tabs={[
                  { key: 'encadrement' as const, label: 'Encadrement du jour' },
                  { key: 'equipe' as const, label: 'Mon équipe' },
                ]}
                active={equipeTab}
                onChange={setEquipeTab}
              />
              {equipeTab === 'encadrement' && centreId && <EncadrementSection centreId={centreId} vue="jour" />}
              {equipeTab === 'equipe' && centreId && <EquipeUnifiee centreId={centreId} />}
            </div>
          )}
          {activeSection === 'centre' && (
            <MonCentreSection centre={centre} onSaved={fetchCentreData} />
          )}
          {activeSection === 'pliage' && centreId && activeModules.has('pliage') && (
            <GestionPliage centreId={centreId} />
          )}
          {activeSection === 'briefing' && centreId && (
            <BriefingSection centreId={centreId} />
          )}
          {/* Academy = la formation : quiz sécurité, progression brevets, documents FFP */}
          {activeSection === 'academy' && centreId && activeModules.has('academy') && (
            <div>
              <SousOnglets
                tabs={[
                  { key: 'quiz' as const, label: 'Académie (quiz sécurité)' },
                  { key: 'pac' as const, label: 'Carnet PAC' },
                  { key: 'brevets' as const, label: 'Progression des brevets' },
                  { key: 'documents' as const, label: 'Documents officiels FFP' },
                ]}
                active={academyTab}
                onChange={setAcademyTab}
              />
              {academyTab === 'quiz' && <AcademyScoresDZ centreId={centreId} />}
              {academyTab === 'pac' && <PacStaff centreId={centreId} />}
              {academyTab === 'brevets' && <BrevetsSection centreId={centreId} />}
              {academyTab === 'documents' && <DocumentsFFPDZ centreId={centreId} dtId={profile?.id} />}
            </div>
          )}
          {activeSection === 'planning' && centreId && (
            <PlanningCentre centreId={centreId} />
          )}
          {/* Messages = la communication : sous-onglets */}
          {activeSection === 'messages' && profile && (
            <div>
              <SousOnglets
                tabs={[
                  { key: 'conversations' as const, label: 'Conversations' },
                  { key: 'relances' as const, label: 'Relances documents' },
                ]}
                active={messagesTab}
                onChange={setMessagesTab}
              />
              {messagesTab === 'conversations' && <MessagesSection currentUserId={profile.id} />}
              {messagesTab === 'relances' && centreId && <RelancesSection centreId={centreId} />}
            </div>
          )}
          {activeSection === 'validations' && centreId && (
            <ValidationsCarnet dzId={centreId} />
          )}
          {activeSection === 'tandem' && centreId && activeModules.has('tandem') && (
            <TandemSection centreId={centreId} />
          )}
          {activeSection === 'modules' && centreId && (
            <ModulesSection centreId={centreId} onActiveChange={setActiveModules} />
          )}
          {activeSection === 'finances' && centreId && activeModules.has('finances') && (
            isActivePlan
              ? <FinancesSection dzId={centreId} />
              : (
                <div className="flex items-center justify-center py-16 px-6">
                  <div className="max-w-md w-full rounded-2xl p-8 text-center space-y-4" style={{ background: 'var(--c-surface)', border: '1px solid rgba(249,115,22,0.3)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'rgba(249,115,22,0.12)' }}>
                      <Euro className="w-7 h-7" style={{ color: '#F97316' }} />
                    </div>
                    <h3 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Module Finances</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--c-dim)' }}>
                      Gérez les tarifs, suivez les soldes de vos licenciés et encaissez en ligne via Stripe.
                    </p>
                    <div className="rounded-xl py-3 px-4" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                      <p className="text-lg font-bold" style={{ color: '#F97316' }}>{MODULES.find(m => m.id === 'finances')?.prix?.toFixed(2).replace('.', ',')} € / mois</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--c-dim)' }}>Sans engagement</p>
                    </div>
                    <a href="mailto:contact@parapass.fr?subject=Activation module Finances"
                      className="block w-full py-3 rounded-xl text-sm font-bold text-white transition"
                      style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
                      Contacter l'équipe ParaPass
                    </a>
                  </div>
                </div>
              )
          )}
        </div>
      </main>

      {/* Licencie Drawer */}
      {drawerLicencie && centreId && (
        <LicencieDrawer
          licencie={drawerLicencie}
          centreId={centreId}
          onClose={() => setDrawerLicencie(null)}
          initialTab={drawerInitialTab}
        />
      )}
    </div>
  );
}
