import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { UserCheck, UserPlus, Clock, Lock, Shield, Award, MapPin, TrendingUp, Calendar, ChevronRight, QrCode, CreditCard as Edit, Activity, MessageSquare, Key, Star } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { TYPE_BREVET_LABELS, BADGES } from '../lib/types';
import type { Badge } from '../lib/types';
import { getOrCreateConversation } from '../lib/useMessages';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfilPublic {
  id: string;
  nom: string;
  prenom: string;
  username: string | null;
  bio: string | null;
  photo_profil_url: string | null;
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
}

interface FollowRecord {
  id: string;
  follower_id: string;
  following_id: string;
  statut: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}

interface BrevetRecord {
  id: string;
  type_brevet: string;
  date_obtention: string;
  centre_delivrance: string | null;
}

interface SautActivity {
  id: string;
  date_saut: string;
  lieu: string;
  hauteur_m: number;
  nature_saut: string;
  categorie: string;
  statut: string;
}

// ─── Brevet chip styling ──────────────────────────────────────────────────────

function getBrevetStyle(type: string): { bg: string; text: string; border: string } {
  if (type === 'D') return { bg: 'bg-slate-200', text: 'text-slate-700', border: 'border-slate-400' };
  if (type === 'C') return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' };
  if (type === 'B') return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' };
  if (type === 'A' || type === 'BPA') return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
  if (type.startsWith('WS')) return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' };
  if (['B1', 'B2', 'B3', 'Bi4', 'B4', 'Bi5', 'B5', 'VH'].includes(type)) {
    return { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' };
  }
  return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function getInitials(prenom: string, nom: string): string {
  return `${(prenom?.[0] ?? '').toUpperCase()}${(nom?.[0] ?? '').toUpperCase()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-1">
      <div className="text-[#F97316]">{icon}</div>
      <span className="text-2xl font-bold text-[#001A4D]">{value}</span>
      <span className="text-xs text-gray-500 text-center leading-tight">{label}</span>
    </div>
  );
}

function LockedContent({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
        <Lock className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-gray-500 text-sm max-w-xs">{message}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProfilPublicPage() {
  const { username, id: idParam } = useParams<{ username?: string; id?: string }>();
  const { user, profile: viewerProfile } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfilPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [dzVisitees, setDzVisitees] = useState(0);
  const [brevets, setBrevets] = useState<BrevetRecord[]>([]);
  const [recentActivity, setRecentActivity] = useState<SautActivity[]>([]);
  const [profileBadges, setProfileBadges] = useState<Badge[]>([]);
  const [mutualFollow, setMutualFollow] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [delegationBadge, setDelegationBadge] = useState<{ type: 'delegue' | 'dt'; centreName: string } | null>(null);

  const [followRecord, setFollowRecord] = useState<FollowRecord | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwner = user?.id === profile?.id;
  const isAdmin = viewerProfile?.role === 'admin';

  // ── Load profile from profils_publics view ────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      setNotFound(false);
      setProfile(null);

      let data: ProfilPublic | null = null;

      if (idParam) {
        const { data: row } = await supabase
          .from('profils_publics')
          .select('*')
          .eq('id', idParam)
          .maybeSingle();
        data = row as ProfilPublic | null;

        // Fallback: own profile (owner can always view)
        if (!data && user?.id === idParam) {
          const { data: ownRow } = await supabase
            .from('profiles')
            .select('id, nom, prenom, username, photo_profil_url, avatar_url, bio, niveau_profil, profil_public, visibilite_sauts, visibilite_brevets, visibilite_badges, visibilite_centre, centre_id')
            .eq('id', idParam)
            .maybeSingle();
          if (ownRow) {
            data = {
              ...(ownRow as Record<string, unknown>),
              photo_profil_url: (ownRow as Record<string, unknown>).photo_profil_url as string | null
                ?? (ownRow as Record<string, unknown>).avatar_url as string | null,
              brevet_principal: null, centre_principal: null,
              total_sauts: 0, sauts_annee: 0, dernier_saut: null, nb_badges: 0,
            } as ProfilPublic;
          }
        }
      } else if (username) {
        const { data: byUsername } = await supabase
          .from('profils_publics')
          .select('*')
          .eq('username', username)
          .maybeSingle();
        data = byUsername as ProfilPublic | null;

        if (!data) {
          const { data: byId } = await supabase
            .from('profils_publics')
            .select('*')
            .eq('id', username)
            .maybeSingle();
          data = byId as ProfilPublic | null;
        }
      }

      if (!data) { setNotFound(true); setLoading(false); return; }
      setProfile(data);
      setLoading(false);
    }
    load();
  }, [username, idParam, user?.id]);

  // ── Load follow record ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile || !user || isOwner) return;
    (async () => {
      const { data } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', profile.id)
        .maybeSingle();
      setFollowRecord(data as FollowRecord | null);

      // Check mutual follow (they follow me back)
      const { data: reverse } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', profile.id)
        .eq('following_id', user.id)
        .eq('statut', 'accepted')
        .maybeSingle();
      const iFollow = (data as FollowRecord | null)?.statut === 'accepted';
      setMutualFollow(iFollow && !!reverse);
    })();
  }, [profile, user, isOwner]);

  // ── Load secondary data ───────────────────────────────────────────────────────

  const loadSecondaryData = useCallback(async (p: ProfilPublic, hasAccess: boolean) => {
    // DZ visitées (uses own sauts count)
    if (p.visibilite_sauts) {
      const { data: sauts } = await supabase
        .from('sauts').select('lieu').eq('parachutiste_id', p.id).eq('statut', 'valide');
      if (sauts) {
        const unique = new Set(sauts.map((s) => s.lieu?.toLowerCase().trim()).filter(Boolean));
        setDzVisitees(unique.size);
      }
    }

    // Brevets
    if (p.visibilite_brevets) {
      const { data } = await supabase
        .from('brevets').select('id, type_brevet, date_obtention, centre_delivrance')
        .eq('parachutiste_id', p.id).order('date_obtention', { ascending: true });
      if (data) setBrevets(data as BrevetRecord[]);
    }

    // Badges
    if (p.visibilite_badges) {
      const { data } = await supabase
        .from('badges').select('*').eq('parachutiste_id', p.id);
      if (data) setProfileBadges(data as Badge[]);
    }

    // Delegation badge (check if this person is DT or delegated validator)
    const { data: adminEntry } = await supabase
      .from('admin_centres')
      .select('role, centre:centres(nom)')
      .eq('profile_id', p.id)
      .maybeSingle();
    if (adminEntry) {
      const ae = adminEntry as { role: string; centre: { nom: string } | null };
      if (ae.role === 'admin' || ae.role === 'co_admin') {
        setDelegationBadge({ type: 'dt', centreName: ae.centre?.nom ?? '' });
      }
    } else {
      // Check delegation
      const { data: del } = await supabase
        .from('delegations_validation')
        .select('actif, date_expiration, centre:centres(nom)')
        .eq('moniteur_id', p.id)
        .eq('actif', true)
        .maybeSingle();
      if (del) {
        const d = del as { actif: boolean; date_expiration: string | null; centre: { nom: string } | null };
        if (!d.date_expiration || new Date(d.date_expiration) > new Date()) {
          setDelegationBadge({ type: 'delegue', centreName: d.centre?.nom ?? '' });
        }
      }
    }

    // Recent activity (only with full access)
    if (hasAccess && p.visibilite_sauts) {
      const { data } = await supabase
        .from('sauts').select('id, date_saut, lieu, hauteur_m, nature_saut, categorie, statut')
        .eq('parachutiste_id', p.id).eq('statut', 'valide')
        .order('date_saut', { ascending: false }).limit(5);
      if (data) setRecentActivity(data as SautActivity[]);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    const niveau = profile.niveau_profil ?? 'public';
    const hasAccess =
      isOwner || isAdmin ||
      niveau === 'public' ||
      (niveau === 'communaute' && followRecord?.statut === 'accepted');
    loadSecondaryData(profile, hasAccess);
  }, [profile, followRecord, isOwner, isAdmin, loadSecondaryData]);

  // ── Follow actions ────────────────────────────────────────────────────────────

  const handleFollow = async () => {
    if (!user || !profile) return;
    setFollowLoading(true);
    const isPublic = profile.profil_public || profile.niveau_profil === 'public';
    const statut = isPublic ? 'accepted' : 'pending';
    const { data, error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: profile.id, statut })
      .select().single();
    if (!error && data) setFollowRecord(data as FollowRecord);
    setFollowLoading(false);
  };

  const handleUnfollow = async () => {
    if (!user || !profile || !followRecord) return;
    setFollowLoading(true);
    await supabase.from('follows').delete().eq('id', followRecord.id);
    setFollowRecord(null);
    setFollowLoading(false);
  };

  const handleMessage = async () => {
    if (!user || !profile) return;
    setMsgLoading(true);
    try {
      const conv = await getOrCreateConversation(user.id, profile.id);
      navigate(`/messages?convId=${conv.id}`);
    } catch {
      // ignore
    } finally {
      setMsgLoading(false);
    }
  };

  // ── Privacy gate ──────────────────────────────────────────────────────────────

  const canViewFullContent = () => {
    if (isOwner || isAdmin) return true;
    if (!profile) return false;
    const niveau = profile.niveau_profil ?? 'public';
    if (niveau === 'public') return true;
    if (niveau === 'communaute') return followRecord?.statut === 'accepted';
    return false;
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#001A4D]" />
        </div>
      </Layout>
    );
  }

  if (notFound || !profile) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-4 max-w-sm w-full text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Shield className="w-8 h-8 text-gray-400" />
            </div>
            <h1 className="text-xl font-bold text-[#001A4D]">Profil introuvable</h1>
            <p className="text-sm text-gray-500">Ce profil n'existe pas ou n'est pas accessible.</p>
            <button onClick={() => navigate(-1)}
              className="mt-2 bg-[#001A4D] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1E3A5F] transition-colors">
              Retour
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const fullName = `${profile.prenom ?? ''} ${profile.nom ?? ''}`.trim();
  const initials = getInitials(profile.prenom ?? '', profile.nom ?? '');
  const fullAccess = canViewFullContent();
  const niveau = profile.niveau_profil ?? 'public';

  // Follow button
  let followButton: React.ReactNode = null;
  if (user && !isOwner) {
    if (!followRecord) {
      followButton = (
        <button onClick={handleFollow} disabled={followLoading}
          className="flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60">
          <UserPlus className="w-4 h-4" /> Suivre
        </button>
      );
    } else if (followRecord.statut === 'pending') {
      followButton = (
        <button onClick={handleUnfollow} disabled={followLoading}
          className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60">
          <Clock className="w-4 h-4" /> Demande envoyée
        </button>
      );
    } else if (followRecord.statut === 'accepted') {
      followButton = (
        <button onClick={handleUnfollow} disabled={followLoading}
          className="flex items-center gap-2 bg-white hover:bg-red-50 hover:text-red-600 border border-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60">
          <UserCheck className="w-4 h-4" /> Suivi
        </button>
      );
    }
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* Header */}
          <div className="rounded-2xl p-6 shadow-lg text-white"
            style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              <div className="flex-shrink-0 self-center sm:self-start">
                {profile.photo_profil_url ? (
                  <img src={profile.photo_profil_url} alt={fullName}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-lg" />
                ) : (
                  <div className="w-24 h-24 rounded-full flex items-center justify-center border-4 border-white/20 shadow-lg text-white text-3xl font-bold"
                    style={{ background: '#2563EB' }}>
                    {initials}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-white leading-tight">{fullName || 'Parachutiste'}</h1>
                {profile.username && <p className="text-[#F97316] font-semibold mt-0.5">@{profile.username}</p>}
                {profile.bio && <p className="text-white/70 text-sm mt-2 leading-relaxed">{profile.bio}</p>}
                {profile.visibilite_centre && profile.centre_principal && (
                  <div className="flex items-center gap-1.5 mt-2 justify-center sm:justify-start">
                    <MapPin className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white/60 text-sm">{profile.centre_principal}</span>
                  </div>
                )}
                {/* Delegation / DT badge */}
                {delegationBadge && (
                  <div className="flex justify-center sm:justify-start mt-2">
                    {delegationBadge.type === 'dt' ? (
                      <span className="inline-flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-semibold px-3 py-1 rounded-full">
                        <Star className="w-3 h-3" />
                        Directeur Technique{delegationBadge.centreName ? ` — ${delegationBadge.centreName}` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs font-semibold px-3 py-1 rounded-full">
                        <Key className="w-3 h-3" />
                        Validateur délégué{delegationBadge.centreName ? ` — ${delegationBadge.centreName}` : ''}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                  {isOwner ? (
                    <Link to="/profil"
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors no-underline">
                      <Edit className="w-4 h-4" /> Modifier mon profil
                    </Link>
                  ) : (
                    <>
                      {followButton}
                      {user && !isOwner && (
                        mutualFollow ? (
                          <button
                            onClick={handleMessage}
                            disabled={msgLoading}
                            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
                          >
                            <MessageSquare className="w-4 h-4" />
                            {msgLoading ? 'Chargement...' : 'Message'}
                          </button>
                        ) : (
                          <div className="relative group">
                            <button
                              disabled
                              className="flex items-center gap-2 bg-white/10 border border-white/20 text-white/40 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-not-allowed"
                            >
                              <MessageSquare className="w-4 h-4" /> Message
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-[#001A4D] text-white text-[11px] text-center px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-10">
                              Vous devez vous suivre mutuellement pour envoyer un message
                            </div>
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Privacy gates */}
          {niveau === 'prive' && !isOwner && !isAdmin ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <LockedContent message="Ce profil est privé. Seul son propriétaire peut le consulter." />
            </div>
          ) : niveau === 'communaute' && !fullAccess ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <LockedContent
                message={followRecord?.statut === 'pending'
                  ? "Votre demande est en attente d'acceptation. Vous pourrez voir ce profil une fois accepté."
                  : 'Ce profil est réservé à la communauté. Envoyez une demande de suivi pour voir le contenu.'}
              />
            </div>
          ) : (
            <>
              {/* Stats */}
              {profile.visibilite_sauts && (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  <StatCard label="Sauts certifiés" value={profile.total_sauts} icon={<TrendingUp className="w-5 h-5" />} />
                  <StatCard label="Cette année" value={profile.sauts_annee} icon={<Calendar className="w-5 h-5" />} />
                  <StatCard label="DZ visitées" value={dzVisitees} icon={<MapPin className="w-5 h-5" />} />
                  {profile.visibilite_badges && (
                    <StatCard label="Badges" value={profile.nb_badges} icon={<Award className="w-5 h-5" />} />
                  )}
                </div>
              )}

              {/* Brevets */}
              {profile.visibilite_brevets && brevets.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-[#001A4D] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#F97316]" />
                    Brevets &amp; Qualifications
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {brevets.map((brevet) => {
                      const style = getBrevetStyle(brevet.type_brevet);
                      const label = TYPE_BREVET_LABELS[brevet.type_brevet] ?? brevet.type_brevet;
                      return (
                        <div key={brevet.id}
                          className={`flex flex-col items-center px-3 py-2 rounded-xl border ${style.bg} ${style.text} ${style.border} text-xs font-semibold shadow-sm min-w-[80px]`}>
                          <span className="font-bold">{brevet.type_brevet}</span>
                          <span className="font-normal opacity-70 mt-0.5 text-center leading-tight">{label.replace(/^Brevet /, '')}</span>
                          <span className="mt-1 font-normal opacity-60">{formatDate(brevet.date_obtention)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Badges */}
              {profile.visibilite_badges && profileBadges.length > 0 && (() => {
                const RARETE_ORDER = { legendaire: 0, epique: 1, rare: 2, commun: 3 };
                const obtainedSet = new Set(profileBadges.map((b) => b.type_badge));
                const displayBadges = BADGES
                  .filter((b) => obtainedSet.has(b.type))
                  .sort((a, b) => RARETE_ORDER[a.rarete] - RARETE_ORDER[b.rarete])
                  .slice(0, 6);
                const RARITY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
                  commun: { border: '#CBD5E1', bg: '#F8FAFC', text: '#64748B' },
                  rare: { border: '#86EFAC', bg: '#F0FDF4', text: '#16A34A' },
                  epique: { border: '#93C5FD', bg: '#EFF6FF', text: '#2563EB' },
                  legendaire: { border: '#FCD34D', bg: '#FFFBEB', text: '#D97706' },
                };
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-[#001A4D] uppercase tracking-wider flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#F97316]" /> Badges
                      </h2>
                      {profileBadges.length > 6 && (
                        <span className="text-xs text-[#001A4D] font-medium">
                          {profileBadges.length} badges au total
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {displayBadges.map((def) => {
                        const cfg = RARITY_COLORS[def.rarete];
                        const badgeRecord = profileBadges.find((b) => b.type_badge === def.type);
                        return (
                          <div
                            key={def.type}
                            title={`${def.nom} — ${def.description}${badgeRecord ? '\nObtenu le ' + new Date(badgeRecord.date_obtention).toLocaleDateString('fr-FR') : ''}`}
                            className="flex flex-col items-center p-3 rounded-xl border text-center"
                            style={{ background: cfg.bg, borderColor: cfg.border }}
                          >
                            <div className="text-2xl mb-1">{def.icone}</div>
                            <div className="text-[10px] font-semibold leading-tight" style={{ color: '#0F172A' }}>{def.nom}</div>
                            <div className="text-[9px] mt-0.5 font-bold uppercase tracking-wider" style={{ color: cfg.text }}>{def.rarete}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Recent activity */}
              {profile.visibilite_sauts && fullAccess && recentActivity.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-[#001A4D] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#F97316]" /> Activité récente
                  </h2>
                  <div className="space-y-2">
                    {recentActivity.map((saut) => (
                      <div key={saut.id}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#001A4D]/10 flex items-center justify-center">
                          <ChevronRight className="w-4 h-4 text-[#001A4D]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#001A4D] truncate">{saut.lieu}</span>
                            <span className="text-xs text-gray-400">{formatDate(saut.date_saut)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500">{saut.hauteur_m.toLocaleString('fr-FR')} m</span>
                            {saut.categorie && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="text-xs text-gray-500">{saut.categorie}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                          <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity hidden notice */}
              {!profile.visibilite_sauts && fullAccess && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-[#001A4D] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#F97316]" /> Activité récente
                  </h2>
                  <LockedContent message="Ce parachutiste a choisi de masquer son activité récente." />
                </div>
              )}
            </>
          )}

          {/* Mini passeport */}
          <div className="rounded-2xl p-5 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}>
            <div className="flex items-center gap-4">
              {profile.photo_profil_url ? (
                <img src={profile.photo_profil_url} alt={fullName}
                  className="w-14 h-14 rounded-full object-cover border-2 border-white/20 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold border-2 border-white/20 flex-shrink-0"
                  style={{ background: '#2563EB' }}>
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold truncate">{fullName}</p>
                {profile.brevet_principal && (
                  <p className="text-white/60 text-sm mt-0.5">
                    {TYPE_BREVET_LABELS[profile.brevet_principal] ?? profile.brevet_principal}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#F97316]" />
                  <span className="text-[#F97316] text-xs font-semibold">Certifié ParaPass</span>
                </div>
              </div>
              <Link to={`/verify/${profile.id}`}
                className="flex-shrink-0 flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors no-underline group">
                <div className="w-10 h-10 rounded-xl bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-xs">QR Code</span>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
