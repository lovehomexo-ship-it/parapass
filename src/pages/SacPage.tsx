import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sacPrendre, sacDeposer, sacAnnulerDepot, sacRendre, pliageEnregistrer, pliageAttribuer } from '../lib/pliage';
import { ParaPassLogo } from '../components/ParaPassLogo';
import { ChevronDown, AlertTriangle, CheckCircle, ArrowLeft, Backpack, Hand } from 'lucide-react';
import { ParachuteGlyph } from '../design/BadgeIcon';
import { CycleHelpButton } from '../components/CyclePliageSchema';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SacInfo {
  id: string;
  nom_court: string | null;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
  statut: string;          // en_service | au_repliage_secours | retire
  etat_journee: string;    // libre | pris | a_plier
  centre_id: string;
  centre: { nom: string; ville: string; tarif_pliage: number } | null;
  owner_licencie_id: string | null;
}

interface Assignment {
  id: string;
  licencie_id: string;
  start_at: string;
  porteur: { nom: string; prenom: string } | null;
}

interface CurrentUser {
  id: string;
  nom: string;
  prenom: string;
  role: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsed(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  return `il y a ${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const CARENCE_MIN = 30; // minutes — paramètre centre (valeur par défaut)

// ─── Attribution panel post-pliage ────────────────────────────────────────────

function AttributionPanel({
  pliageId,
  centreId,
  defaultLicencieId,
  defaultNom,
  onDone,
}: {
  pliageId: string;
  centreId: string;
  defaultLicencieId: string | null;
  defaultNom: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [licencies, setLicencies] = useState<{ id: string; nom: string; prenom: string }[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [attributed, setAttributed] = useState<string | null>(defaultNom);

  // L'attribution au porteur est faite par le serveur au moment du pliage
  // (pliage_enregistrer) : rien à pré-écrire ici. On ne fait que corriger.
  void defaultLicencieId;
  const [erreurAttrib, setErreurAttrib] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('licencies_centres')
      .select('parachutiste_id, profil:profiles!licencies_centres_parachutiste_id_fkey(id, nom, prenom)')
      .eq('centre_id', centreId).eq('statut', 'actif')
      .then(({ data }) => {
        if (data) setLicencies(
          data.map((l: { profil: { id: string; nom: string; prenom: string } | null }) => l.profil)
            .filter((p): p is { id: string; nom: string; prenom: string } => !!p)
        );
      });
  }, [open, centreId]);

  const attribuer = async (id: string, nom: string, _isAuto: boolean) => {
    void _isAuto;
    setSaving(true); setErreurAttrib(null);
    const r = await pliageAttribuer(pliageId, id);
    setSaving(false);
    if (!r.ok) { setErreurAttrib(r.erreur ?? 'Attribution impossible.'); return; }
    setAttributed(nom);
    setOpen(false);
    onDone();
  };

  const filtered = licencies.filter(l =>
    `${l.prenom} ${l.nom}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Attribution du pliage</p>
          <p className="text-sm font-semibold text-white">
            {attributed ?? 'Non attribué (non payable)'}
            {erreurAttrib && <span className="block text-xs" style={{ color: '#FCA5A5' }}>{erreurAttrib}</span>}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer' }}>
          <ChevronDown className="w-4 h-4 text-white/50" style={{ transform: open ? 'rotate(180deg)' : '' }} />
        </button>
      </div>
      {open && (
        <div className="px-5 pb-4 space-y-2">
          <input type="text" placeholder="Chercher un licencié..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }} />
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {filtered.slice(0, 8).map(l => (
              <button key={l.id} type="button" disabled={saving}
                onClick={() => attribuer(l.id, `${l.prenom} ${l.nom}`, false)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', border: 'none', cursor: 'pointer' }}>
                {l.prenom} {l.nom}
              </button>
            ))}
          </div>
          <button type="button" onClick={onDone}
            className="w-full py-2 text-xs rounded-lg" style={{ color: 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            Passer — attribuer plus tard
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'loading' | 'error' | 'hors_service' | 'libre' | 'pris_moi' | 'pris_autre' | 'a_plier_moi' | 'a_plier_plieur' | 'success_prise' | 'success_a_plier' | 'success_auto_plie' | 'success_pliage' | 'success_rendu';

export function SacPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sac, setSac] = useState<SacInfo | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null); // attribution active
  const [myAssignment, setMyAssignment] = useState<Assignment | null>(null); // mon sac actuel (autre sac)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [lastPliageAt, setLastPliageAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [flagQualif, setFlagQualif] = useState(false);
  const [newPliageId, setNewPliageId] = useState<string | null>(null);
  // À qui le serveur a attribué le pliage (porteur du sac, ou qui l'a déposé).
  const [destinataire, setDestinataire] = useState<{ id: string; nom: string | null } | null>(null);
  const [confirmRendre, setConfirmRendre] = useState(false);

  const loadSac = useCallback(async (sacId: string) => {
    // Support UUID ou ancien token
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sacId);
    const q = supabase.from('sacs_parachute')
      .select('id, nom_court, marque, modele, numero_serie, statut, etat_journee, centre_id, owner_licencie_id, centre:centres(nom, ville, tarif_pliage)')
      .eq('actif', true);
    const { data: sacData } = isUUID
      ? await q.eq('id', sacId).maybeSingle()
      : await q.eq('qr_code_token', sacId).maybeSingle();
    return sacData as SacInfo | null;
  }, []);

  useEffect(() => {
    if (!id) { setErreur('Identifiant manquant.'); setLoading(false); return; }
    (async () => {
      // Auth + profil
      const { data: { user } } = await supabase.auth.getUser();
      let cu: CurrentUser | null = null;
      let myAssign: Assignment | null = null;
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('id, nom, prenom, role').eq('id', user.id).maybeSingle();
        if (prof) cu = prof as CurrentUser;
        // L'habilitation au pliage se lit au registre de la DZ, par le serveur,
        // au moment du pliage — un brevet C n'est pas une qualification de plieur.
        // Mon attribution active (peut être un autre sac) — hoistée pour view determination
        const { data: myAssignData } = await supabase.from('sac_assignments').select('id, sac_id, licencie_id, start_at, porteur:profiles!sac_assignments_licencie_id_fkey(nom, prenom)').eq('licencie_id', user.id).is('end_at', null).maybeSingle();
        myAssign = myAssignData as Assignment | null;
        setMyAssignment(myAssign);
      }
      setCurrentUser(cu);

      // Sac
      const sacData = await loadSac(id);
      if (!sacData) { setErreur('Sac introuvable ou QR code invalide.'); setLoading(false); return; }
      setSac(sacData);

      // Attribution active sur ce sac
      const { data: assign } = await supabase
        .from('sac_assignments')
        .select('id, licencie_id, start_at, porteur:profiles!sac_assignments_licencie_id_fkey(nom, prenom)')
        .eq('sac_id', sacData.id).is('end_at', null).maybeSingle();
      setAssignment(assign as Assignment | null);

      // Dernier pliage (carence)
      const { data: lastPliage } = await supabase
        .from('pliages').select('created_at').eq('sac_id', sacData.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (lastPliage) setLastPliageAt(new Date(lastPliage.created_at));

      setLoading(false);

      // ── Source de vérité unique : sac_assignments (pas etat_journee) ──
      if (sacData.statut !== 'en_service') { setView('hors_service'); return; }

      // Pas d'attribution active → LIBRE (quelle que soit etat_journee en base)
      if (!assign) {
        setView('libre');
        setErreur(null); // effacer toute erreur résiduelle
        return;
      }

      // Attribution active → PRIS ou À_PLIER selon etat_journee
      const isMySac = assign.licencie_id === cu?.id || myAssign?.sac_id === sacData.id;
      if (sacData.etat_journee === 'a_plier') {
        setView(isMySac ? 'a_plier_moi' : 'a_plier_plieur'); return;
      }
      // Par défaut: pris
      if (!cu) { setView('pris_autre'); return; }
      setView(isMySac ? 'pris_moi' : 'pris_autre');
    })();
  }, [id, loadSac]);

  // ── Actions ──

  async function prendre() {
    if (!sac || !currentUser) return;
    setSubmitting(true); setErreur(null);
    // Le serveur vérifie tout (sac en service, déjà pris, sac déjà détenu) et
    // relie le sac à la présence du jour.
    const r = await sacPrendre(sac.id);
    setSubmitting(false);
    if (!r.ok) { setErreur(r.erreur ?? 'Le sac n’a pas pu être pris.'); return; }
    setView('success_prise');
    setSac(s => s ? { ...s, etat_journee: 'pris' } : s);
    setAssignment({ id: '', licencie_id: currentUser.id, start_at: new Date().toISOString(), porteur: { nom: currentUser.nom, prenom: currentUser.prenom } });
  }

  async function marquerAPlier() {
    if (!sac) return;
    setSubmitting(true); setErreur(null);
    const r = await sacDeposer(sac.id);
    setSubmitting(false);
    if (!r.ok) { setErreur(r.erreur ?? 'Le sac n’a pas pu être déposé.'); return; }
    setSac(s => s ? { ...s, etat_journee: 'a_plier' } : s);
    setView('success_a_plier');
  }

  async function autoPlier() {
    if (!sac || !currentUser) return;
    setSubmitting(true); setErreur(null);
    const r = await pliageEnregistrer(sac.id, { auto: true });
    setSubmitting(false);
    if (!r.ok) { setErreur(r.erreur ?? 'L’auto-pliage n’a pas pu être enregistré.'); return; }
    setNewPliageId(r.data?.pliage_id ?? null);
    setView('success_auto_plie');
  }

  /** Rendre : plié (il repart libre) ou après avoir sauté (il part au tapis). */
  async function rendreLesSac(aPlier: boolean) {
    if (!sac) return;
    setSubmitting(true); setErreur(null);
    const r = await sacRendre(sac.id, aPlier);
    setSubmitting(false);
    if (!r.ok) { setErreur(r.erreur ?? 'Le sac n’a pas pu être rendu.'); return; }
    setAssignment(null);
    setSac(s => s ? { ...s, etat_journee: aPlier ? 'a_plier' : 'libre' } : s);
    setView('success_rendu');
  }

  async function annulerAPlier() {
    if (!sac) return;
    setSubmitting(true); setErreur(null);
    const r = await sacAnnulerDepot(sac.id);
    setSubmitting(false);
    if (!r.ok) { setErreur(r.erreur ?? 'Le sac n’a pas pu être repris.'); return; }
    setSac(s => s ? { ...s, etat_journee: 'pris' } : s);
    setView('pris_moi');
  }

  /** Le plieur touche « plié ». Habilitation, carence, destinataire et montant
   *  sont décidés par le serveur : l'écran ne peut plus se tromper. */
  async function enregistrerPliage(forceHorsFile = false) {
    if (!sac || !currentUser) return;
    setSubmitting(true); setErreur(null);
    const r = await pliageEnregistrer(sac.id, { horsFile: forceHorsFile });
    setSubmitting(false);
    if (!r.ok || !r.data) { setErreur(r.erreur ?? 'Le pliage n’a pas pu être enregistré.'); return; }
    setFlagQualif(!r.data.habilite);
    setNewPliageId(r.data.pliage_id);
    setDestinataire(r.data.destinataire_id ? { id: r.data.destinataire_id, nom: r.data.destinataire } : null);
    setSac(s => s ? { ...s, etat_journee: assignment ? 'pris' : 'libre' } : s);
    setView('success_pliage');
    setLastPliageAt(new Date());
  }

  // ── Layout base ──
  const nomSac = sac?.nom_court || [sac?.marque, sac?.modele].filter(Boolean).join(' ') || 'Sac';
  const base: React.CSSProperties = { minHeight: '100vh', background: '#0A1628' };

  const Loader = () => (
    <div style={base} className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
    </div>
  );

  const Btn = ({ children, onClick, color = '#10B981', disabled = false, secondary = false }: {
    children: React.ReactNode; onClick: () => void; color?: string; disabled?: boolean; secondary?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled || submitting}
      className="w-full font-bold text-white transition-all disabled:opacity-50 active:scale-95"
      style={{
        padding: secondary ? '14px 0' : '18px 0',
        borderRadius: 16,
        fontSize: secondary ? 15 : 18,
        background: secondary ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${color}, ${color}cc)`,
        border: secondary ? '1px solid rgba(255,255,255,0.15)' : 'none',
        boxShadow: secondary ? 'none' : `0 8px 30px ${color}55`,
        cursor: 'pointer',
      }}
    >
      {submitting ? '...' : children}
    </button>
  );

  // ── Bandeau identité ──
  const IdentityBandeau = () => {
    const redirectParam = encodeURIComponent(window.location.pathname);
    if (!currentUser) {
      return (
        <div className="px-4 py-2 flex items-center justify-between text-xs" style={{ background: 'rgba(249,115,22,0.12)', borderBottom: '1px solid rgba(249,115,22,0.2)' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Non connecté — lecture seule</span>
          <a href={`/login?redirect=${redirectParam}`} className="font-semibold" style={{ color: '#F97316', textDecoration: 'none' }}>
            Se connecter →
          </a>
        </div>
      );
    }
    return (
      <div className="px-4 py-2 flex items-center justify-between text-xs" style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>
          Connecté : <strong className="text-white">{currentUser.prenom} {currentUser.nom}</strong>
        </span>
        <button
          onClick={async () => {
            await import('../lib/supabase').then(m => m.supabase.auth.signOut({ scope: 'local' }));
            window.location.href = `/login?redirect=${redirectParam}`;
          }}
          className="font-semibold"
          style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}
        >
          Changer de compte
        </button>
      </div>
    );
  };

  // ── Destination du bouton retour selon le rôle ──
  const dashboardPath = currentUser
    ? (currentUser.role === 'admin_centre' ? '/centre/journee' : '/dashboard')
    : '/';

  // ── Header commun ──
  const Header = ({ etatLabel, etatColor }: { etatLabel: string; etatColor: string }) => (
    <div>
      <IdentityBandeau />
      <div className="px-4 pt-3 pb-1">
        <button
          onClick={() => navigate(dashboardPath)}
          className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour au tableau de bord
        </button>
      </div>
      <div className="px-5 pt-3 pb-4 flex items-center justify-between">
        <ParaPassLogo className="h-7" />
        <div className="flex items-center gap-2">
          <CycleHelpButton />
          <span className="text-[11px] font-bold px-3 py-1 rounded-full" style={{ background: `${etatColor}20`, color: etatColor, border: `1px solid ${etatColor}40` }}>
            {etatLabel}
          </span>
        </div>
      </div>
    </div>
  );

  const NomSacBlock = ({ sub }: { sub?: string }) => (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 text-center">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-5xl mb-5"
        style={{ background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.25)' }}><Backpack className="w-7 h-7" style={{ color: '#F97316' }} aria-hidden /></div>
      <h1 className="text-4xl font-black text-white mb-2 leading-tight">{nomSac}</h1>
      {sub && <p className="text-base" style={{ color: 'rgba(255,255,255,0.45)' }}>{sub}</p>}
      <p className="text-xs font-mono mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
        {sac?.centre?.nom} · {sac?.centre?.ville}
      </p>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  if (loading || view === 'loading') return <Loader />;

  if (erreur && !sac) return (
    <div style={base} className="flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4"><AlertTriangle className="w-12 h-12 text-amber-500" aria-hidden /></div>
        <h1 className="text-xl font-bold text-white mb-2">QR code invalide</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{erreur}</p>
      </div>
    </div>
  );

  // ═══ HORS SERVICE ═══
  if (view === 'hors_service') return (
    <div style={base} className="flex flex-col">
      <Header etatLabel={sac?.statut === 'au_repliage_secours' ? 'Au repliage secours' : 'Retiré'} etatColor="#EF4444" />
      <NomSacBlock sub={sac?.statut === 'au_repliage_secours' ? 'Ce sac est au repliage secours' : 'Ce sac est retiré du service'} />
    </div>
  );

  // ═══ LIBRE ═══
  if (view === 'libre') return (
    <div style={base} className="flex flex-col">
      <Header etatLabel="Libre" etatColor="#10B981" />
      <NomSacBlock />
      <div className="px-5 pb-10 space-y-3 max-w-xs w-full mx-auto">
        {currentUser ? (
          <>
            {myAssignment && myAssignment.sac_id !== sac?.id && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                <p className="text-xs" style={{ color: '#FCD34D' }}>Vous avez déjà un sac. Rendez-le d'abord.</p>
              </div>
            )}
            {erreur && <p className="text-sm text-red-400 text-center">{erreur}</p>}
            <Btn onClick={prendre} color="#10B981" disabled={!!(myAssignment && myAssignment.sac_id !== sac?.id)}>
              ✓ Prendre ce sac
            </Btn>
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Connecté : {currentUser.prenom} {currentUser.nom}
            </p>
          </>
        ) : (
          <Btn onClick={() => navigate('/login')} color="#F97316">Se connecter pour prendre ce sac</Btn>
        )}
      </div>
    </div>
  );

  // ═══ PRIS — MON SAC ═══
  if (view === 'pris_moi') return (
    <div style={base} className="flex flex-col">
      <Header etatLabel="Mon sac" etatColor="#60A5FA" />
      <NomSacBlock sub={assignment ? `Pris à ${heure(assignment.start_at)} (${elapsed(assignment.start_at)})` : undefined} />
      <div className="px-5 pb-10 space-y-3 max-w-xs w-full mx-auto">
        <Btn onClick={marquerAPlier} color="#F97316"><ParachuteGlyph className="w-4 h-4 inline-block mr-1.5 align-[-2px]" aria-hidden />Déposer au tapis (à plier)</Btn>
        <Btn onClick={autoPlier} color="#A78BFA" secondary>Je l’ai plié moi-même</Btn>
        {confirmRendre ? (
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <p className="text-sm text-center font-semibold text-white">Rendre ce sac : dans quel état ?</p>
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Un sac qui a sauté part au tapis ; un sac encore plié repart pour les autres.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => rendreLesSac(false)} disabled={submitting}
                className="py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'rgba(16,185,129,0.7)', border: 'none', cursor: 'pointer', minHeight: 48 }}>
                {submitting ? '…' : 'Il est plié'}
              </button>
              <button type="button" onClick={() => rendreLesSac(true)} disabled={submitting}
                className="py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'rgba(249,115,22,0.8)', border: 'none', cursor: 'pointer', minHeight: 48 }}>
                {submitting ? '…' : 'J’ai sauté : à plier'}
              </button>
            </div>
            <div className="flex">
              <button type="button" onClick={() => setConfirmRendre(false)}
                className="flex-1 py-2.5 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <Btn onClick={() => setConfirmRendre(true)} secondary>Rendre le sac</Btn>
        )}
      </div>
    </div>
  );

  // ═══ PRIS — PAR UN AUTRE ═══
  if (view === 'pris_autre') return (
    <div style={base} className="flex flex-col">
      <Header etatLabel="Pris" etatColor="#60A5FA" />
      <NomSacBlock />
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8 max-w-xs mx-auto w-full space-y-4">
        <div className="rounded-2xl p-5 w-full text-center" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
          {assignment ? (
            <>
              <p className="text-lg font-bold text-white">{assignment.porteur?.prenom} {assignment.porteur?.nom}</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Depuis {heure(assignment.start_at)} ({elapsed(assignment.start_at)})
              </p>
            </>
          ) : (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Pris (porteur inconnu)</p>
          )}
        </div>
        {/* Bouton secondaire plieur "plier quand même" */}
        {currentUser && (
          <button type="button" onClick={() => enregistrerPliage(true)} disabled={submitting}
            className="text-xs px-4 py-2.5 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
            Plier quand même (hors file — flag audit)
          </button>
        )}
        {erreur && <p className="text-sm text-red-400 text-center">{erreur}</p>}
      </div>
    </div>
  );

  // ═══ À PLIER — JE SUIS LE PORTEUR ═══
  if (view === 'a_plier_moi') return (
    <div style={base} className="flex flex-col">
      <Header etatLabel="En file — à plier" etatColor="#F97316" />
      <NomSacBlock sub="En attente de pliage" />
      <div className="px-5 pb-10 space-y-3 max-w-xs w-full mx-auto">
        <Btn onClick={autoPlier} color="#A78BFA">
          <Hand className="w-4 h-4 inline-block mr-1 align-[-2px]" aria-hidden /> Je l’ai plié moi-même
        </Btn>
        <Btn onClick={annulerAPlier} secondary>
          ← Reprendre le sac (annuler dépose)
        </Btn>
      </div>
    </div>
  );

  // ═══ À PLIER — VUE PLIEUR ═══
  if (view === 'a_plier_plieur') {
    const carence = lastPliageAt && (Date.now() - lastPliageAt.getTime()) / 60000 < CARENCE_MIN;
    const restant = lastPliageAt ? Math.ceil(CARENCE_MIN - (Date.now() - lastPliageAt.getTime()) / 60000) : 0;
    return (
      <div style={base} className="flex flex-col">
        <Header etatLabel="À plier" etatColor="#F97316" />
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-6 text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-5xl mb-5"
            style={{ background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.3)' }}><Backpack className="w-7 h-7" style={{ color: '#F97316' }} aria-hidden /></div>
          <h1 className="text-4xl font-black text-white mb-1 leading-tight">{nomSac}</h1>
          <p className="text-base mb-1" style={{ color: 'rgba(249,115,22,0.9)' }}>à plier</p>
          {assignment && (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Pris par {assignment.porteur?.prenom} {assignment.porteur?.nom} · {elapsed(assignment.start_at)}
            </p>
          )}
        </div>
        <div className="px-5 pb-10 space-y-3 max-w-xs w-full mx-auto">
          {carence ? (
            <div className="rounded-xl px-4 py-4 text-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-sm font-bold text-red-400">⏱ Carence active</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Réessayez dans {restant} min (dernière validation trop récente)
              </p>
            </div>
          ) : (
            <>
              {erreur && <p className="text-sm text-red-400 text-center">{erreur}</p>}
              {currentUser ? (
                <Btn onClick={() => enregistrerPliage()} color="#10B981">✓ Pliage effectué</Btn>
              ) : (
                <Btn onClick={() => navigate('/login')} color="#F97316">Se connecter pour valider</Btn>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══ SUCCÈS : PRISE DE SAC ═══
  if (view === 'success_prise') return (
    <div style={base} className="flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(96,165,250,0.15)', border: '2px solid rgba(96,165,250,0.4)' }}>
          <CheckCircle className="w-10 h-10" style={{ color: '#60A5FA' }} />
        </div>
        <h1 className="text-2xl font-black text-white">Sac pris !</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <strong className="text-white">{nomSac}</strong> est attribué à vous jusqu'à la fin de la journée.
        </p>
        <div className="rounded-xl p-4 text-left space-y-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>PROCHAINES ACTIONS</p>
          <p className="text-sm flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}><ParachuteGlyph className="w-4 h-4 flex-shrink-0" aria-hidden /> Avant de sauter : scannez à nouveau pour "Déposer au tapis"</p>
          <p className="text-sm flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}><Backpack className="w-4 h-4 flex-shrink-0" aria-hidden /> Fin de journée : scannez pour "Rendre le sac"</p>
        </div>
        <button onClick={() => navigate(dashboardPath)} className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
          ← Retour
        </button>
      </div>
    </div>
  );

  // ═══ SUCCÈS : À PLIER ═══
  if (view === 'success_a_plier') return (
    <div style={base} className="flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="flex justify-center mb-2"><ParachuteGlyph className="w-14 h-14" style={{ color: '#F97316' }} aria-hidden /></div>
        <h1 className="text-2xl font-black text-white">Sac en file de pliage</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <strong className="text-white">{nomSac}</strong> est déposé au tapis. Un plieur va s'en occuper.
        </p>
        <button onClick={() => navigate(dashboardPath)} className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
          ← Retour
        </button>
      </div>
    </div>
  );

  // ═══ SUCCÈS : AUTO-PLIÉ ═══
  if (view === 'success_auto_plie') return (
    <div style={base} className="flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}>
          <p className="flex justify-center mb-3"><Hand className="w-12 h-12" aria-hidden /></p>
          <h1 className="text-2xl font-black text-white mb-1">Auto-plié !</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{nomSac} · Gratuit · Hors circuit paiement</p>
        </div>
                <button onClick={() => navigate(dashboardPath)} className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
          ← Retour
        </button>
      </div>
    </div>
  );

  // ═══ SUCCÈS : PLIAGE ENREGISTRÉ ═══
  if (view === 'success_pliage') return (
    <div style={base} className="flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <CheckCircle className="w-16 h-16 mx-auto mb-3" style={{ color: '#10B981' }} />
          <h1 className="text-2xl font-black text-white mb-1">Pliage enregistré !</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {nomSac} · {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {flagQualif && (
          <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
            <p className="text-xs" style={{ color: '#FCD34D' }}>Vous n’êtes pas habilité plieur par cette DZ : le pliage est enregistré et signalé au DT, sans être facturé.</p>
          </div>
        )}
        {newPliageId && (
          <AttributionPanel
            pliageId={newPliageId}
            centreId={sac!.centre_id}
            defaultLicencieId={destinataire?.id ?? null}
            defaultNom={destinataire?.nom ?? null}
            onDone={() => navigate(dashboardPath)}
          />
        )}
        <button onClick={() => navigate(dashboardPath)} className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
          ← Scanner suivant
        </button>
      </div>
    </div>
  );

  // ═══ SUCCÈS : SAC RENDU ═══
  if (view === 'success_rendu') return (
    <div style={base} className="flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="flex justify-center mb-2"><CheckCircle className="w-14 h-14 text-green-500" aria-hidden /></div>
        <h1 className="text-2xl font-black text-white">Sac rendu</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <strong className="text-white">{nomSac}</strong> est de nouveau disponible pour vos collègues.
        </p>
        <button onClick={() => navigate(dashboardPath)} className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
          ← Retour
        </button>
      </div>
    </div>
  );

  return <Loader />;
}
