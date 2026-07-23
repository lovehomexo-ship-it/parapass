import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserCheck, UserPlus, UserX, Users, Clock, X, Building2, MapPin, CheckCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { TYPE_BREVET_LABELS } from '../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfilPublic {
  id: string;
  nom: string;
  prenom: string;
  username: string | null;
  photo_profil_url: string | null;
  bio: string | null;
  niveau_profil: string | null;
  profil_public: boolean;
  visibilite_sauts: boolean;
  visibilite_brevets: boolean;
  visibilite_badges: boolean;
  visibilite_centre: boolean;
  centre_id: string | null;
  brevet_principal: string | null;
  centre_principal: string | null;
  total_sauts: number;
  sauts_annee: number;
  dernier_saut: string | null;
  nb_badges: number;
  statut_suivi?: FollowStatus;
  raison?: string;
}

interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  statut: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  profil?: ProfilPublic;
}

interface Centre {
  id: string;
  nom: string;
  ville: string;
  code_postal: string | null;
  numero_agrement_ffp: string | null;
  logo_url: string | null;
  statut: string;
  plan: string | null;
  mon_statut: 'actif' | 'en_attente' | null;
}

type FollowStatus = 'none' | 'pending' | 'accepted';
type Tab = 'abonnements' | 'abonnes' | 'centres' | 'suggestions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(prenom: string, nom: string) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
}

function getCentreInitials(nom: string) {
  return nom.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();
}

function daysAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Jamais sauté';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (diff === 0) return "Sauté aujourd'hui";
  if (diff === 1) return 'Sauté hier';
  if (diff < 30) return `Il y a ${diff} jours`;
  if (diff < 365) return `Il y a ${Math.floor(diff / 30)} mois`;
  return `Il y a ${Math.floor(diff / 365)} an${Math.floor(diff / 365) > 1 ? 's' : ''}`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ url, prenom, nom, size = 'md' }: { url: string | null; prenom: string; nom: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-9 h-9 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-16 h-16 text-base' };
  if (url) return <img src={url} alt={`${prenom} ${nom}`} className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-[#2563EB] flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {getInitials(prenom, nom)}
    </div>
  );
}

// ─── Brevet Pill ──────────────────────────────────────────────────────────────

function BrevetPill({ brevet }: { brevet: string | null | undefined }) {
  if (!brevet) return null;
  return (
    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(253,186,116,0.3)', color: '#FB923C' }}>
      {TYPE_BREVET_LABELS[brevet] ?? brevet}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl shadow-sm border p-4 animate-pulse" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-4 rounded w-2/3" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="h-3 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 rounded w-3/4" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="h-3 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.1)' }} />
      </div>
      <div className="h-8 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }} />
    </div>
  );
}

// ─── Centre Skeleton ──────────────────────────────────────────────────────────

function CentreSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-4 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <div className="h-3 rounded w-1/3" style={{ background: 'rgba(255,255,255,0.1)' }} />
      </div>
      <div className="w-20 h-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }} />
    </div>
  );
}

// ─── Follow Button ────────────────────────────────────────────────────────────

function FollowButton({ status, loading, onClick }: { status: FollowStatus; loading: boolean; onClick: () => void }) {
  if (status === 'accepted') {
    return (
      <button onClick={onClick} disabled={loading}
        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50">
        <UserCheck className="w-3.5 h-3.5" />
        Suivi
      </button>
    );
  }
  if (status === 'pending') {
    return (
      <button disabled className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-not-allowed" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
        <Clock className="w-3.5 h-3.5" />
        En attente
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#001A4D] text-white hover:bg-[#1a3060] transition-colors disabled:opacity-50">
      <UserPlus className="w-3.5 h-3.5" />
      Suivre
    </button>
  );
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard({ profile, followStatus, followLoading, onFollow, onNavigate, raison }: {
  profile: ProfilPublic;
  followStatus: FollowStatus;
  followLoading: boolean;
  onFollow: (id: string, isPublic: boolean) => void;
  onNavigate: (profile: ProfilPublic) => void;
  raison?: string;
}) {
  return (
    <div className="rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      {raison && (
        <p className="text-[10px] mb-2 font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{raison}</p>
      )}
      <div className="flex items-start gap-3">
        <button onClick={() => onNavigate(profile)} className="flex-shrink-0">
          <Avatar url={profile.photo_profil_url} prenom={profile.prenom} nom={profile.nom} size="md" />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onNavigate(profile)} className="text-left w-full">
            <p className="text-sm font-bold text-white truncate">{profile.prenom} {profile.nom}</p>
            {profile.username && <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>@{profile.username}</p>}
          </button>
          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
            {profile.visibilite_brevets && profile.brevet_principal && (
              <BrevetPill brevet={profile.brevet_principal} />
            )}
            {profile.visibilite_centre && profile.centre_principal && (
              <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{profile.centre_principal}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3">
            {profile.visibilite_sauts && profile.total_sauts > 0 && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span className="font-semibold text-white">{profile.total_sauts}</span> sauts
              </span>
            )}
            {profile.visibilite_sauts && profile.dernier_saut && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{daysAgo(profile.dernier_saut)}</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          <FollowButton
            status={followStatus}
            loading={followLoading}
            onClick={() => onFollow(profile.id, profile.profil_public || profile.niveau_profil === 'public')}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Centre Card ──────────────────────────────────────────────────────────────

function CentreCard({ centre, onRejoindre, joinLoading }: {
  centre: Centre;
  onRejoindre: (id: string, nom: string) => void;
  joinLoading: boolean;
}) {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl transition-colors"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      {/* Logo / initiales */}
      <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-lg text-white" style={{ background: '#1E3A5F' }}>
        {centre.logo_url
          ? <img src={centre.logo_url} alt={centre.nom} className="w-full h-full object-contain" />
          : getCentreInitials(centre.nom)
        }
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-snug truncate">{centre.nom}</p>
        <p className="text-[13px] mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {centre.ville}{centre.code_postal ? ` (${centre.code_postal})` : ''}
        </p>
        {centre.numero_agrement_ffp && (
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {centre.numero_agrement_ffp}
            {centre.plan === 'centre_premium' && ' · Certifié ParaPass'}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="flex-shrink-0">
        {centre.mon_statut === 'actif' ? (
          <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Membre
          </span>
        ) : centre.mon_statut === 'en_attente' ? (
          <span className="flex items-center gap-1.5 text-amber-400 text-sm font-medium">
            <Clock className="w-4 h-4" />
            En attente
          </span>
        ) : (
          <button
            onClick={() => onRejoindre(centre.id, centre.nom)}
            disabled={joinLoading}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            style={{ background: '#2563EB', color: 'white' }}
          >
            <UserPlus className="w-4 h-4" />
            Rejoindre
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Follow Card (abonnements / abonnés) ──────────────────────────────────────

function FollowCard({ follow, currentUserId, onNavigate, onUnfollow, onAccept, onRefuse, actionLoading }: {
  follow: Follow;
  currentUserId: string;
  onNavigate: (profile: ProfilPublic) => void;
  onUnfollow?: (follow: Follow) => void;
  onAccept?: (follow: Follow) => void;
  onRefuse?: (follow: Follow) => void;
  actionLoading: boolean;
}) {
  const p = follow.profil;
  if (!p) return null;
  const isPendingForMe = follow.statut === 'pending' && follow.following_id === currentUserId;

  return (
    <div className="rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex items-start gap-3">
        <button onClick={() => onNavigate(p)} className="flex-shrink-0">
          <Avatar url={p.photo_profil_url} prenom={p.prenom} nom={p.nom} size="md" />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onNavigate(p)} className="text-left w-full">
            <p className="text-sm font-bold text-white truncate">{p.prenom} {p.nom}</p>
            {p.username && <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>@{p.username}</p>}
          </button>
          <div className="mt-1 flex flex-wrap gap-1.5 items-center">
            {p.visibilite_brevets && p.brevet_principal && <BrevetPill brevet={p.brevet_principal} />}
            {p.visibilite_centre && p.centre_principal && (
              <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.centre_principal}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3">
            {p.visibilite_sauts && p.total_sauts > 0 && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span className="font-semibold text-white">{p.total_sauts}</span> sauts
              </span>
            )}
            {p.visibilite_sauts && p.dernier_saut && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{daysAgo(p.dernier_saut)}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {isPendingForMe && onAccept && onRefuse ? (
          <>
            <button onClick={() => onAccept(follow)} disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg bg-[#001A4D] text-white hover:bg-[#1a3060] transition-colors disabled:opacity-50">
              <UserCheck className="w-3.5 h-3.5" /> Accepter
            </button>
            <button onClick={() => onRefuse(follow)} disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50">
              <UserX className="w-3.5 h-3.5" /> Refuser
            </button>
          </>
        ) : (
          <>
            <button onClick={() => onNavigate(p)}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-[#001A4D] text-[#001A4D] hover:bg-[#001A4D] hover:text-white transition-colors">
              Voir le profil
            </button>
            {onUnfollow && (
              <button onClick={() => onUnfollow(follow)} disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50">
                <UserX className="w-3.5 h-3.5" /> Se désabonner
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ title, subtitle, cta, onCta }: { title: string; subtitle?: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg viewBox="0 0 64 64" className="w-16 h-16 mb-4 opacity-20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 8C20 8 10 20 10 32" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M54 32C54 20 44 8 32 8" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 8L32 50" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M10 32C10 44 20 54 32 54C44 54 54 44 54 32" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 54L28 64M32 54L36 64" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="32" cy="32" rx="18" ry="8" stroke="#F97316" strokeWidth="2" />
      </svg>
      <p className="text-sm font-semibold mb-1 text-white">{title}</p>
      {subtitle && <p className="text-xs max-w-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{subtitle}</p>}
      {cta && onCta && (
        <button onClick={onCta}
          className="mt-4 text-xs font-semibold border px-4 py-2 rounded-lg hover:bg-[#F59E0B] hover:text-white transition-colors text-white border-white">
          {cta}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CommunautePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const centreSearchRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'centres' || tab === 'abonnements' || tab === 'abonnes' || tab === 'suggestions') return tab as Tab;
    return 'abonnements';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeQuery, setActiveQuery] = useState('');

  const [searchResults, setSearchResults] = useState<ProfilPublic[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  const [abonnements, setAbonnements] = useState<Follow[]>([]);
  const [abonnementsLoading, setAbonnementsLoading] = useState(false);

  const [abonnes, setAbonnes] = useState<Follow[]>([]);
  const [abonnesLoading, setAbonnesLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const [suggestions, setSuggestions] = useState<ProfilPublic[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [followStatuses, setFollowStatuses] = useState<Record<string, FollowStatus>>({});
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ── Centres state ─────────────────────────────────────────────────────────────
  const [centres, setCentres] = useState<Centre[]>([]);
  const [centresLoading, setCentresLoading] = useState(false);
  const [centreSearch, setCentreSearch] = useState('');
  const centreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [joinLoading, setJoinLoading] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Counters ─────────────────────────────────────────────────────────────────
  const abonnementCount = abonnements.length;
  const abonneCount = abonnes.length;

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Debounce people search input ─────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setActiveQuery('');
      setSearchResults([]);
      setSearchDone(false);
      return;
    }
    debounceRef.current = setTimeout(() => setActiveQuery(val.trim()), 300);
  };

  // ── Load follow statuses ──────────────────────────────────────────────────────
  const loadFollowStatuses = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    const { data } = await supabase.from('follows').select('following_id, statut').eq('follower_id', user.id).in('following_id', ids);
    if (data) {
      setFollowStatuses((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = 'none';
        for (const row of data) next[row.following_id] = row.statut as FollowStatus;
        return next;
      });
    }
  }, [user]);

  // ── People search ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeQuery || !user) { setSearchResults([]); setSearchDone(false); return; }
    let cancelled = false;
    setSearchLoading(true);
    setSearchDone(false);
    (async () => {
      const term = `%${activeQuery}%`;
      const { data, error } = await supabase.from('profils_publics').select('*').or(`nom.ilike.${term},prenom.ilike.${term},username.ilike.${term}`).neq('id', user.id).limit(20);
      if (cancelled) return;
      if (error) { setSearchLoading(false); setSearchDone(true); return; }
      const results = (data ?? []) as ProfilPublic[];
      setSearchResults(results);
      setSearchDone(true);
      setSearchLoading(false);
      await loadFollowStatuses(results.map((p) => p.id));
    })();
    return () => { cancelled = true; };
  }, [activeQuery, user, loadFollowStatuses]);

  // ── Load centres ──────────────────────────────────────────────────────────────
  const loadCentres = useCallback(async (query = '') => {
    if (!user) return;
    setCentresLoading(true);
    let req = supabase.from('centres').select('id, nom, ville, code_postal, numero_agrement_ffp, logo_url, statut, plan').eq('statut', 'actif').order('nom', { ascending: true });
    if (query.length >= 2) {
      req = req.or(`nom.ilike.%${query}%,ville.ilike.%${query}%,numero_agrement_ffp.ilike.%${query}%`);
    }
    const { data } = await req.limit(30);
    if (!data) { setCentresLoading(false); return; }

    // Fetch user's memberships in a single query
    const { data: memberships } = await supabase.from('licencies_centres').select('centre_id, statut').eq('parachutiste_id', user.id);
    const memberMap: Record<string, 'actif' | 'en_attente'> = {};
    for (const m of memberships ?? []) memberMap[m.centre_id] = m.statut as 'actif' | 'en_attente';

    setCentres(data.map((c) => ({ ...c, mon_statut: memberMap[c.id] ?? null })));
    setCentresLoading(false);
  }, [user]);

  useEffect(() => {
    if (activeTab === 'centres') loadCentres(centreSearch);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce centre search
  const handleCentreSearch = (val: string) => {
    setCentreSearch(val);
    if (centreDebounceRef.current) clearTimeout(centreDebounceRef.current);
    centreDebounceRef.current = setTimeout(() => loadCentres(val), 350);
  };

  // ── Rejoindre un centre ───────────────────────────────────────────────────────
  const rejoindreCentre = useCallback(async (centreId: string, centreNom: string) => {
    if (!user || !profile) return;
    setJoinLoading((prev) => ({ ...prev, [centreId]: true }));

    const { data: existant } = await supabase.from('licencies_centres').select('id, statut').eq('centre_id', centreId).eq('parachutiste_id', user.id).maybeSingle();
    if (existant) {
      showToast('Vous avez déjà une relation avec ce centre.');
      setJoinLoading((prev) => ({ ...prev, [centreId]: false }));
      return;
    }

    const { error } = await supabase.from('licencies_centres').insert({
      centre_id: centreId,
      parachutiste_id: user.id,
      statut: 'en_attente',
      date_adhesion: new Date().toISOString(),
    });

    if (error) {
      showToast('Erreur : ' + error.message, 'error');
      setJoinLoading((prev) => ({ ...prev, [centreId]: false }));
      return;
    }

    // Notify admins
    const { data: admins } = await supabase.from('admin_centres').select('profile_id').eq('centre_id', centreId);
    if (admins?.length) {
      await supabase.from('notifications').insert(
        admins.map((a) => ({
          user_id: a.profile_id,
          type: 'demande_adhesion',
          titre: 'Nouvelle demande d\'adhésion',
          message: `${profile.prenom} ${profile.nom} souhaite rejoindre votre centre.`,
          data: { parachutiste_id: user.id, centre_id: centreId },
          lue: false,
        }))
      );
    }

    setCentres((prev) => prev.map((c) => c.id === centreId ? { ...c, mon_statut: 'en_attente' } : c));
    showToast(`Demande envoyée à ${centreNom} ! En attente de validation.`);
    setJoinLoading((prev) => ({ ...prev, [centreId]: false }));
  }, [user, profile]);

  // ── Fetch abonnements ─────────────────────────────────────────────────────────
  const fetchAbonnements = useCallback(async () => {
    if (!user) return;
    setAbonnementsLoading(true);
    const { data: followRows } = await supabase.from('follows').select('id, follower_id, following_id, statut, created_at').eq('follower_id', user.id).eq('statut', 'accepted').order('created_at', { ascending: false });
    if (!followRows) { setAbonnementsLoading(false); return; }
    const ids = followRows.map((r) => r.following_id);
    let profileMap: Record<string, ProfilPublic> = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('profils_publics').select('*').in('id', ids);
      if (profiles) for (const p of profiles) profileMap[p.id] = p as ProfilPublic;
    }
    setAbonnements(followRows.map((r) => ({ ...r, statut: r.statut as Follow['statut'], profil: profileMap[r.following_id] })));
    setAbonnementsLoading(false);
  }, [user]);

  // ── Fetch abonnés ─────────────────────────────────────────────────────────────
  const fetchAbonnes = useCallback(async () => {
    if (!user) return;
    setAbonnesLoading(true);
    const { data: followRows } = await supabase.from('follows').select('id, follower_id, following_id, statut, created_at').eq('following_id', user.id).in('statut', ['accepted', 'pending']).order('created_at', { ascending: false });
    if (!followRows) { setAbonnesLoading(false); return; }
    setPendingCount(followRows.filter((r) => r.statut === 'pending').length);
    const ids = followRows.map((r) => r.follower_id);
    let profileMap: Record<string, ProfilPublic> = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('profils_publics').select('*').in('id', ids);
      if (profiles) for (const p of profiles) profileMap[p.id] = p as ProfilPublic;
    }
    setAbonnes(followRows.map((r) => ({ ...r, statut: r.statut as Follow['statut'], profil: profileMap[r.follower_id] })));
    setAbonnesLoading(false);
  }, [user]);

  // ── Fetch suggestions ─────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    setSuggestionsLoading(true);
    const { data: existingFollows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
    const followedIds = (existingFollows ?? []).map((r) => r.following_id);
    const excludeIds = [user.id, ...followedIds];
    const { data: myProfile } = await supabase.from('profils_publics').select('centre_id, centre_principal, brevet_principal').eq('id', user.id).maybeSingle();
    const myCentreId = myProfile?.centre_id;
    const myBrevet = myProfile?.brevet_principal;
    const excludeFilter = excludeIds.length > 0 ? `(${excludeIds.join(',')})` : `('${user.id}')`;
    const results: (ProfilPublic & { raison: string })[] = [];
    const seenIds = new Set<string>();
    if (myCentreId) {
      const { data: sameCentre } = await supabase.from('profils_publics').select('*').not('id', 'in', excludeFilter).eq('centre_id', myCentreId).limit(5);
      for (const p of sameCentre ?? []) {
        if (!seenIds.has(p.id)) { seenIds.add(p.id); results.push({ ...(p as ProfilPublic), raison: 'Même centre que vous' }); }
      }
    }
    if (myBrevet) {
      const { data: sameBrevet } = await supabase.from('profils_publics').select('*').not('id', 'in', excludeFilter).eq('brevet_principal', myBrevet).limit(5);
      for (const p of sameBrevet ?? []) {
        if (!seenIds.has(p.id)) { seenIds.add(p.id); results.push({ ...(p as ProfilPublic), raison: `Brevet ${myBrevet} comme vous` }); }
      }
    }
    if (results.length < 8) {
      const { data: actifs } = await supabase.from('profils_publics').select('*').not('id', 'in', excludeFilter).order('total_sauts', { ascending: false }).limit(8 - results.length);
      for (const p of actifs ?? []) {
        if (!seenIds.has(p.id)) { seenIds.add(p.id); results.push({ ...(p as ProfilPublic), raison: 'Très actif' }); }
      }
    }
    setSuggestions(results.slice(0, 8));
    await loadFollowStatuses(results.map((p) => p.id));
    setSuggestionsLoading(false);
  }, [user, loadFollowStatuses]);

  // ── Initial tab loads ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'abonnements') fetchAbonnements();
    else if (activeTab === 'abonnes') fetchAbonnes();
    else if (activeTab === 'suggestions') fetchSuggestions();
    else if (activeTab === 'centres') loadCentres(centreSearch);
  }, [activeTab, fetchAbonnements, fetchAbonnes, fetchSuggestions, loadCentres]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime follows ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`community-follows-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${user.id}` }, () => fetchAbonnes()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchAbonnes]);

  // ── Navigation ────────────────────────────────────────────────────────────────
  const handleNavigate = useCallback((p: ProfilPublic) => {
    if (p.username) navigate(`/parapass/${p.username}`);
    else navigate(`/parapass/id/${p.id}`);
  }, [navigate]);

  // ── Follow / Unfollow ─────────────────────────────────────────────────────────
  const handleFollow = useCallback(async (targetId: string, isPublic: boolean) => {
    if (!user) return;
    const current = followStatuses[targetId] ?? 'none';
    setFollowLoading((prev) => ({ ...prev, [targetId]: true }));
    if (current === 'accepted') {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      setFollowStatuses((prev) => ({ ...prev, [targetId]: 'none' }));
      setAbonnements((prev) => prev.filter((f) => f.following_id !== targetId));
    } else if (current === 'none') {
      const statut = isPublic ? 'accepted' : 'pending';
      const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId, statut });
      if (!error) {
        setFollowStatuses((prev) => ({ ...prev, [targetId]: statut as FollowStatus }));
        if (statut === 'accepted') fetchAbonnements();
      }
    }
    setFollowLoading((prev) => ({ ...prev, [targetId]: false }));
  }, [user, followStatuses, fetchAbonnements]);

  const handleUnfollow = useCallback(async (follow: Follow) => {
    setActionLoading((prev) => ({ ...prev, [follow.id]: true }));
    await supabase.from('follows').delete().eq('id', follow.id);
    setAbonnements((prev) => prev.filter((f) => f.id !== follow.id));
    setFollowStatuses((prev) => ({ ...prev, [follow.following_id]: 'none' }));
    setActionLoading((prev) => ({ ...prev, [follow.id]: false }));
  }, []);

  const handleAccept = useCallback(async (follow: Follow) => {
    setActionLoading((prev) => ({ ...prev, [follow.id]: true }));
    await supabase.from('follows').update({ statut: 'accepted' }).eq('id', follow.id);
    setAbonnes((prev) => prev.map((f) => f.id === follow.id ? { ...f, statut: 'accepted' as const } : f));
    setPendingCount((n) => Math.max(0, n - 1));
    setActionLoading((prev) => ({ ...prev, [follow.id]: false }));
  }, []);

  const handleRefuse = useCallback(async (follow: Follow) => {
    setActionLoading((prev) => ({ ...prev, [follow.id]: true }));
    await supabase.from('follows').delete().eq('id', follow.id);
    setAbonnes((prev) => prev.filter((f) => f.id !== follow.id));
    setPendingCount((n) => Math.max(0, n - 1));
    setActionLoading((prev) => ({ ...prev, [follow.id]: false }));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  const showSearch = activeQuery.length > 0 || (searchQuery.length > 0 && searchLoading);

  const tabs: { key: Tab; label: string; icon?: React.ReactNode }[] = [
    { key: 'abonnements', label: 'Abonnements' },
    { key: 'abonnes', label: 'Abonnés' },
    { key: 'centres', label: 'Centres', icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: 'suggestions', label: 'Suggestions' },
  ];

  return (
    <Layout>
      <div className="min-h-screen" style={{ background: '#001A4D' }}>
        <div className="max-w-5xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <Users className="w-6 h-6 text-[#F97316]" />
              <h1 className="text-2xl font-bold text-white">Communauté</h1>
            </div>
            <p className="text-sm ml-9" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Connectez-vous avec d'autres parachutistes et trouvez votre centre
            </p>
          </div>

          {/* People search — hidden on centres tab */}
          {activeTab !== 'centres' && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Rechercher un parachutiste par nom, prénom..."
                className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent text-white placeholder-white/30"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
              />
              {searchQuery && (
                <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Search results */}
          {showSearch && activeTab !== 'centres' && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {searchLoading ? 'Recherche en cours…' : `${searchResults.length} résultat${searchResults.length !== 1 ? 's' : ''} pour "${activeQuery}"`}
                </p>
              </div>
              {searchLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
              ) : searchDone && searchResults.length === 0 ? (
                <EmptyState title={`Aucun parachutiste trouvé pour "${activeQuery}"`} subtitle="Essayez avec un autre nom ou prénom." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {searchResults.map((p) => (
                    <ProfileCard key={p.id} profile={p} followStatus={followStatuses[p.id] ?? 'none'} followLoading={followLoading[p.id] ?? false} onFollow={handleFollow} onNavigate={handleNavigate} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tabs + content */}
          {(!showSearch || activeTab === 'centres') && (
            <>
              {/* Counters */}
              {activeTab !== 'centres' && (
                <div className="text-xs mb-3 text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <span className="font-semibold text-white">{abonnementCount}</span> abonnement{abonnementCount !== 1 ? 's' : ''}
                  {' · '}
                  <span className="font-semibold text-white">{abonneCount}</span> abonné{abonneCount !== 1 ? 's' : ''}
                </div>
              )}

              {/* Tab bar */}
              <div className="flex gap-1 rounded-xl p-1 mb-5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      activeTab === tab.key ? 'bg-white text-[#001A4D] shadow-sm' : 'hover:text-white'
                    }`}
                    style={activeTab !== tab.key ? { color: 'rgba(255,255,255,0.5)' } : {}}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.key === 'abonnes' && pendingCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#F97316] text-white text-[10px] font-bold flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Tab: Abonnements ── */}
              {activeTab === 'abonnements' && (
                abonnementsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}</div>
                ) : abonnements.length === 0 ? (
                  <EmptyState title="Vous ne suivez personne pour le moment." subtitle="Utilisez la recherche pour trouver des parachutistes de votre DZ." cta="Rechercher des parachutistes" onCta={() => searchRef.current?.focus()} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {abonnements.map((follow) => (
                      <FollowCard key={follow.id} follow={follow} currentUserId={user?.id ?? ''} onNavigate={handleNavigate} onUnfollow={handleUnfollow} actionLoading={actionLoading[follow.id] ?? false} />
                    ))}
                  </div>
                )
              )}

              {/* ── Tab: Abonnés ── */}
              {activeTab === 'abonnes' && (
                abonnesLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}</div>
                ) : abonnes.length === 0 ? (
                  <EmptyState title="Personne ne vous suit encore." subtitle="Partagez votre profil public pour que d'autres parachutistes puissent vous trouver." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {abonnes.map((follow) => (
                      <FollowCard key={follow.id} follow={follow} currentUserId={user?.id ?? ''} onNavigate={handleNavigate} onAccept={handleAccept} onRefuse={handleRefuse} actionLoading={actionLoading[follow.id] ?? false} />
                    ))}
                  </div>
                )
              )}

              {/* ── Tab: Centres ── */}
              {activeTab === 'centres' && (
                <div className="space-y-4">
                  {/* Centre search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                    <input
                      ref={centreSearchRef}
                      type="text"
                      value={centreSearch}
                      onChange={(e) => handleCentreSearch(e.target.value)}
                      placeholder="Rechercher un centre ou une ville..."
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent text-white placeholder-white/30"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                    />
                    {centreSearch && (
                      <button onClick={() => { setCentreSearch(''); loadCentres(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Count */}
                  {!centresLoading && centres.length > 0 && (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {centres.length} centre{centres.length > 1 ? 's' : ''} trouvé{centres.length > 1 ? 's' : ''}
                    </p>
                  )}

                  {/* List */}
                  {centresLoading ? (
                    <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <CentreSkeleton key={i} />)}</div>
                  ) : centres.length === 0 ? (
                    <EmptyState
                      title={centreSearch.length >= 2 ? `Aucun centre trouvé pour "${centreSearch}"` : 'Aucun centre disponible'}
                      subtitle={centreSearch.length < 2 ? "Les centres doivent être validés par ParaPass pour apparaître ici." : undefined}
                    />
                  ) : (
                    <div className="space-y-2">
                      {centres.map((centre) => (
                        <CentreCard
                          key={centre.id}
                          centre={centre}
                          onRejoindre={rejoindreCentre}
                          joinLoading={joinLoading[centre.id] ?? false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Suggestions ── */}
              {activeTab === 'suggestions' && (
                suggestionsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}</div>
                ) : suggestions.length === 0 ? (
                  <EmptyState title="Aucune suggestion disponible." subtitle="Revenez plus tard quand d'autres parachutistes auront rejoint ParaPass." cta="Rechercher un parachutiste" onCta={() => searchRef.current?.focus()} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {suggestions.map((p) => (
                      <ProfileCard key={p.id} profile={p} followStatus={followStatuses[p.id] ?? 'none'} followLoading={followLoading[p.id] ?? false} onFollow={handleFollow} onNavigate={handleNavigate} raison={p.raison} />
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-2xl text-white transition-all"
          style={{ background: toast.type === 'success' ? '#16A34A' : '#DC2626' }}
        >
          {toast.msg}
        </div>
      )}
    </Layout>
  );
}
