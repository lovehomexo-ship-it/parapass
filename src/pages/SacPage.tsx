import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ParaPassLogo } from '../components/ParaPassLogo';
import { ChevronDown, AlertTriangle, Clock, CheckCircle, X } from 'lucide-react';

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

  // Pre-attribute to the porteur if known
  useEffect(() => {
    if (defaultLicencieId) {
      supabase.from('pliages').update({
        parachutiste_id: defaultLicencieId,
        statut_paiement: 'a_regler',
      }).eq('id', pliageId).then(() => {});
    }
  }, [pliageId, defaultLicencieId]);

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

  const attribuer = async (id: string, nom: string, isAuto: boolean) => {
    setSaving(true);
    await supabase.from('pliages').update({
      parachutiste_id: id,
      statut_paiement: isAuto ? 'auto_plie' : 'a_regler',
    }).eq('id', pliageId);
    setSaving(false);
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
  const [isQualif, setIsQualif] = useState(false); // brevet C/D/moniteur
  const [lastPliageAt, setLastPliageAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [flagQualif, setFlagQualif] = useState(false);
  const [newPliageId, setNewPliageId] = useState<string | null>(null);

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
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('id, nom, prenom').eq('id', user.id).maybeSingle();
        if (prof) cu = prof as CurrentUser;
        // Qualification plieur
        const { data: brevets } = await supabase.from('brevets').select('type_brevet').eq('parachutiste_id', user.id).in('type_brevet', ['C', 'D', 'moniteur', 'moniteur_delegue', 'DT053']);
        setIsQualif((brevets?.length ?? 0) > 0);
        // Mon attribution active (peut être un autre sac)
        const { data: myAssign } = await supabase.from('sac_assignments').select('id, sac_id, licencie_id, start_at, porteur:profiles!sac_assignments_licencie_id_fkey(nom, prenom)').eq('licencie_id', user.id).is('end_at', null).maybeSingle();
        setMyAssignment(myAssign as Assignment | null);
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

      // Déterminer la vue
      if (sacData.statut !== 'en_service') { setView('hors_service'); return; }
      const etat = sacData.etat_journee;
      if (etat === 'libre') { setView('libre'); return; }
      if (etat === 'pris') {
        if (!cu) { setView('pris_autre'); return; }
        if (assign?.licencie_id === cu.id) { setView('pris_moi'); return; }
        setView('pris_autre'); return;
      }
      if (etat === 'a_plier') {
        if (!cu) { setView('a_plier_plieur'); return; }
        if (assign?.licencie_id === cu.id) { setView('a_plier_moi'); return; }
        setView('a_plier_plieur'); return;
      }
    })();
  }, [id, loadSac]);

  // ── Actions ──

  async function prendre() {
    if (!sac || !currentUser) return;
    if (myAssignment && myAssignment.sac_id !== sac.id) {
      setErreur(`Vous avez déjà le sac "${myAssignment.sac_id.slice(0, 8)}" en cours. Rendez-le d'abord.`);
      return;
    }
    setSubmitting(true);
    // Insert assignment (unique index rejettera si race condition)
    const { error: assignErr } = await supabase.from('sac_assignments').insert({
      sac_id: sac.id,
      licencie_id: currentUser.id,
      centre_id: sac.centre_id,
    });
    if (assignErr) {
      if (assignErr.code === '23505') setErreur('Ce sac vient d\'être pris par quelqu\'un d\'autre. Actualisez la page.');
      else setErreur('Erreur : ' + assignErr.message);
      setSubmitting(false);
      return;
    }
    await supabase.from('sacs_parachute').update({ etat_journee: 'pris' }).eq('id', sac.id);
    setSubmitting(false);
    setView('success_prise');
    setSac(s => s ? { ...s, etat_journee: 'pris' } : s);
    setAssignment({ id: '', licencie_id: currentUser.id, start_at: new Date().toISOString(), porteur: { nom: currentUser.nom, prenom: currentUser.prenom } });
  }

  async function marquerAPlier() {
    if (!sac || !assignment) return;
    setSubmitting(true);
    await supabase.from('sacs_parachute').update({ etat_journee: 'a_plier' }).eq('id', sac.id);
    setSubmitting(false);
    setSac(s => s ? { ...s, etat_journee: 'a_plier' } : s);
    setView('success_a_plier');
  }

  async function autoPlier() {
    if (!sac || !currentUser || !assignment) return;
    setSubmitting(true);
    const montant = (sac.centre as { tarif_pliage?: number } | null)?.tarif_pliage ?? 7;
    const qualifie = isQualif;
    const { data: p } = await supabase.from('pliages').insert({
      sac_id: sac.id,
      plieur_id: currentUser.id,
      centre_id: sac.centre_id,
      parachutiste_id: currentUser.id,
      statut_paiement: 'auto_plie',
      montant,
      flag_qualif: !qualifie,
    }).select('id').single();
    if (!qualifie) setFlagQualif(true);
    if (p) setNewPliageId(p.id);
    // Reste PRIS
    setSubmitting(false);
    setView('success_auto_plie');
  }

  async function rendreLesSac() {
    if (!sac || !assignment) return;
    setSubmitting(true);
    await supabase.from('sac_assignments').update({ end_at: new Date().toISOString(), ended_by: 'user' }).eq('id', assignment.id).is('end_at', null).eq('sac_id', sac.id);
    await supabase.from('sacs_parachute').update({ etat_journee: 'libre' }).eq('id', sac.id);
    setSubmitting(false);
    setAssignment(null);
    setView('success_rendu');
  }

  async function annulerAPlier() {
    if (!sac) return;
    setSubmitting(true);
    await supabase.from('sacs_parachute').update({ etat_journee: 'pris' }).eq('id', sac.id);
    setSubmitting(false);
    setSac(s => s ? { ...s, etat_journee: 'pris' } : s);
    setView('pris_moi');
  }

  async function enregistrerPliage(forceHorsFile = false) {
    if (!sac || !currentUser) return;
    // Carence
    if (lastPliageAt) {
      const age = (Date.now() - lastPliageAt.getTime()) / 60000;
      if (age < CARENCE_MIN) {
        setErreur(`Carence : dernier pliage il y a ${Math.round(age)} min (minimum ${CARENCE_MIN} min). Réessayez dans ${Math.round(CARENCE_MIN - age)} min.`);
        return;
      }
    }
    setSubmitting(true);
    const montant = (sac.centre as { tarif_pliage?: number } | null)?.tarif_pliage ?? 7;
    const qualifie = isQualif;
    const { data: p } = await supabase.from('pliages').insert({
      sac_id: sac.id,
      plieur_id: currentUser.id,
      centre_id: sac.centre_id,
      parachutiste_id: assignment?.licencie_id ?? null,
      statut_paiement: assignment?.licencie_id ? 'a_regler' : 'non_attribue',
      montant,
      flag_qualif: !qualifie || forceHorsFile,
      note: forceHorsFile ? 'Pliage hors file (bouton "plier quand même")' : null,
    }).select('id').single();
    if (!qualifie) setFlagQualif(true);
    if (p) setNewPliageId(p.id);
    // Repasse PRIS (le sac sort de la file)
    await supabase.from('sacs_parachute').update({ etat_journee: 'pris' }).eq('id', sac.id);
    setSac(s => s ? { ...s, etat_journee: 'pris' } : s);
    setSubmitting(false);
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

  // ── Header commun ──
  const Header = ({ etatLabel, etatColor }: { etatLabel: string; etatColor: string }) => (
    <div className="px-5 pt-6 pb-4 flex items-center justify-between">
      <ParaPassLogo className="h-7" />
      <span className="text-[11px] font-bold px-3 py-1 rounded-full" style={{ background: `${etatColor}20`, color: etatColor, border: `1px solid ${etatColor}40` }}>
        {etatLabel}
      </span>
    </div>
  );

  const NomSacBlock = ({ sub }: { sub?: string }) => (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 text-center">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-5xl mb-5"
        style={{ background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.25)' }}>🎒</div>
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
        <div className="text-5xl mb-4">⚠️</div>
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
        <Btn onClick={marquerAPlier} color="#F97316">🪂 Déposer au tapis (à plier)</Btn>
        <Btn onClick={autoPlier} color="#A78BFA" secondary>
          Auto-plié {!isQualif ? '⚠️' : ''}
        </Btn>
        {!isQualif && (
          <p className="text-xs text-center" style={{ color: 'rgba(245,158,11,0.8)' }}>
            ⚠️ Qualification plieur non renseignée sur votre profil
          </p>
        )}
        <Btn onClick={rendreLesSac} secondary>Rendre le sac</Btn>
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
          🙋 Auto-plié {!isQualif ? '⚠️' : ''}
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
            style={{ background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.3)' }}>🎒</div>
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
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>🪂 Avant de sauter : scannez à nouveau pour "Déposer au tapis"</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>🎒 Fin de journée : scannez pour "Rendre le sac"</p>
        </div>
        <button onClick={() => navigate(-1)} className="w-full py-3 rounded-xl text-sm font-semibold"
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
        <div className="text-6xl mb-2">🪂</div>
        <h1 className="text-2xl font-black text-white">Sac en file de pliage</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <strong className="text-white">{nomSac}</strong> est déposé au tapis. Un plieur va s'en occuper.
        </p>
        <button onClick={() => navigate(-1)} className="w-full py-3 rounded-xl text-sm font-semibold"
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
          <p className="text-5xl mb-3">🙋</p>
          <h1 className="text-2xl font-black text-white mb-1">Auto-plié !</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{nomSac} · Gratuit · Hors circuit paiement</p>
        </div>
        {flagQualif && (
          <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
            <p className="text-xs" style={{ color: '#FCD34D' }}>Qualification plieur non renseignée — pliage flagué pour le DT.</p>
          </div>
        )}
        <button onClick={() => navigate(-1)} className="w-full py-3 rounded-xl text-sm font-semibold"
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
            <p className="text-xs" style={{ color: '#FCD34D' }}>Qualification plieur non renseignée — flagué pour le DT.</p>
          </div>
        )}
        {newPliageId && assignment?.licencie_id && (
          <AttributionPanel
            pliageId={newPliageId}
            centreId={sac!.centre_id}
            defaultLicencieId={assignment.licencie_id}
            defaultNom={assignment.porteur ? `${assignment.porteur.prenom} ${assignment.porteur.nom}` : null}
            onDone={() => navigate(-1)}
          />
        )}
        <button onClick={() => navigate(-1)} className="w-full py-3 rounded-xl text-sm font-semibold"
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
        <div className="text-6xl mb-2">✅</div>
        <h1 className="text-2xl font-black text-white">Sac rendu</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <strong className="text-white">{nomSac}</strong> est de nouveau disponible pour vos collègues.
        </p>
        <button onClick={() => navigate(-1)} className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
          ← Retour
        </button>
      </div>
    </div>
  );

  return <Loader />;
}
