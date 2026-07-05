import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ParaPassLogo } from '../components/ParaPassLogo';
import { CheckCircle, AlertTriangle, ChevronDown, X, Clock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SacInfo {
  id: string;
  nom_court: string | null;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
  statut: string;
  centre_id: string;
  centre: { nom: string; ville: string; tarif_pliage: number } | null;
  owner_licencie_id: string | null;
  owner: { nom: string; prenom: string } | null;
}

interface DernierPliage {
  id: string;
  created_at: string;
  plieur: { nom: string; prenom: string } | null;
  statut_paiement: string;
}

interface Licencie {
  id: string;
  nom: string;
  prenom: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statutLabel(s: string) {
  if (s === 'en_service') return { label: 'En service', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
  if (s === 'au_repliage_secours') return { label: 'Au repliage secours', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
  return { label: 'Retiré', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

// ─── Attribution panel (shown after pliage enregistré) ───────────────────────

function AttributionPanel({
  pliageId,
  centreId,
  currentUserId,
  onDone,
}: {
  pliageId: string;
  centreId: string;
  currentUserId: string;
  onDone: () => void;
}) {
  const [licencies, setLicencies] = useState<Licencie[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase
      .from('licencies_centres')
      .select('parachutiste_id, profil:profiles!licencies_centres_parachutiste_id_fkey(id, nom, prenom)')
      .eq('centre_id', centreId)
      .eq('statut', 'actif')
      .then(({ data }) => {
        if (data) {
          setLicencies(
            data
              .map((l: { profil: { id: string; nom: string; prenom: string } | null }) => l.profil)
              .filter((p): p is Licencie => !!p),
          );
        }
      });
  }, [centreId]);

  const attribuer = async (licencieId: string, isAutoPlied: boolean) => {
    setSaving(true);
    await supabase
      .from('pliages')
      .update({
        parachutiste_id: licencieId,
        statut_paiement: isAutoPlied ? 'auto_plie' : 'a_regler',
      })
      .eq('id', pliageId);
    setSaving(false);
    onDone();
  };

  const filtered = licencies.filter(l =>
    `${l.prenom} ${l.nom}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-sm font-semibold text-white">Attribuer à un sauteur</span>
        <ChevronDown
          className="w-4 h-4 transition-transform"
          style={{ color: 'rgba(255,255,255,0.4)', transform: expanded ? 'rotate(180deg)' : '' }}
        />
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          <input
            type="text"
            placeholder="Chercher un licencié..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          />
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {/* Auto-pliage (soi-même) */}
            <button
              type="button"
              onClick={() => attribuer(currentUserId, true)}
              disabled={saving}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
              style={{ background: 'rgba(139,92,246,0.12)', color: '#C4B5FD', border: '1px solid rgba(139,92,246,0.25)' }}
            >
              🙋 Moi-même (auto-plié · gratuit)
            </button>
            {filtered.slice(0, 8).map(l => (
              <button
                key={l.id}
                type="button"
                onClick={() => attribuer(l.id, l.id === currentUserId)}
                disabled={saving}
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {l.prenom} {l.nom}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onDone}
            className="w-full py-2 text-sm rounded-xl"
            style={{ color: 'rgba(255,255,255,0.35)', background: 'transparent' }}
          >
            Passer (attribuer plus tard)
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SacPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sac, setSac] = useState<SacInfo | null>(null);
  const [dernierPliage, setDernierPliage] = useState<DernierPliage | null>(null);
  const [totalPliages, setTotalPliages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; nom: string; prenom: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pliageResult, setPliageResult] = useState<{ id: string; flagQualif: boolean } | null>(null);
  const [showAttribution, setShowAttribution] = useState(false);

  const loadSac = useCallback(async () => {
    if (!id) { setErreur('Identifiant de sac manquant.'); setLoading(false); return; }

    // Support ancien token (backward compat)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const query = supabase
      .from('sacs_parachute')
      .select('id, nom_court, marque, modele, numero_serie, statut, centre_id, owner_licencie_id, centre:centres(nom, ville, tarif_pliage), owner:profiles!sacs_parachute_owner_licencie_id_fkey(nom, prenom)')
      .eq('actif', true);

    const { data: sacData, error } = isUUID
      ? await query.eq('id', id).maybeSingle()
      : await query.eq('qr_code_token', id).maybeSingle();

    if (error || !sacData) {
      setErreur('Sac introuvable. Ce QR code n\'est peut-être plus valide.');
      setLoading(false);
      return;
    }
    setSac(sacData as SacInfo);

    // Dernier pliage
    const { data: pliageData } = await supabase
      .from('pliages')
      .select('id, created_at, statut_paiement, plieur:profiles!pliages_plieur_id_fkey(nom, prenom)')
      .eq('sac_id', sacData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pliageData) setDernierPliage(pliageData as unknown as DernierPliage);

    const { count } = await supabase
      .from('pliages')
      .select('*', { count: 'exact', head: true })
      .eq('sac_id', sacData.id);
    setTotalPliages(count ?? 0);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadSac();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('id, nom, prenom')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setCurrentUser(data as { id: string; nom: string; prenom: string });
        });
    });
  }, [loadSac]);

  const enregistrerPliage = async () => {
    if (!sac || !currentUser) return;
    setSubmitting(true);

    // Vérification qualification : brevet C, D ou DT053
    const { data: brevets } = await supabase
      .from('brevets')
      .select('type_brevet')
      .eq('parachutiste_id', currentUser.id)
      .in('type_brevet', ['C', 'D', 'DT053', 'moniteur', 'moniteur_delegue']);
    const qualifie = (brevets?.length ?? 0) > 0;

    const centreId = sac.centre_id;
    const montant = (sac.centre as { tarif_pliage?: number } | null)?.tarif_pliage ?? 7;

    const { data: newPliage, error } = await supabase
      .from('pliages')
      .insert({
        sac_id: sac.id,
        plieur_id: currentUser.id,
        centre_id: centreId,
        statut_paiement: 'non_attribue',
        montant,
        flag_qualif: !qualifie,
      })
      .select('id')
      .single();

    setSubmitting(false);
    if (error || !newPliage) {
      setErreur('Erreur lors de l\'enregistrement. Réessayez.');
      return;
    }
    setPliageResult({ id: newPliage.id, flagQualif: !qualifie });
    setShowAttribution(true);
    // Refresh counts
    setTotalPliages(t => t + 1);
    setDernierPliage({
      id: newPliage.id,
      created_at: new Date().toISOString(),
      plieur: { nom: currentUser.nom, prenom: currentUser.prenom },
      statut_paiement: 'non_attribue',
    });
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A1628' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  // ── Erreur ──
  if (erreur && !sac) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0A1628' }}>
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2">QR code invalide</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{erreur}</p>
        </div>
      </div>
    );
  }

  if (!sac) return null;

  const statutInfo = statutLabel(sac.statut ?? 'en_service');
  const nomSac = sac.nom_court || [sac.marque, sac.modele].filter(Boolean).join(' ') || 'Sac sans nom';

  // ── Succès pliage + attribution ──
  if (pliageResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0A1628' }}>
        <div className="w-full max-w-sm space-y-4">
          {/* Success card */}
          <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle className="w-16 h-16 mx-auto mb-3" style={{ color: '#10B981' }} />
            <h1 className="text-2xl font-bold text-white mb-1">Pliage enregistré !</h1>
            <p className="text-sm mb-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{nomSac}</p>
            <p className="text-xs" style={{ color: '#34D399' }}>
              {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Avertissement qualification */}
          {pliageResult.flagQualif && (
            <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
              <p className="text-xs" style={{ color: '#FCD34D' }}>
                Qualification plieur non renseignée sur votre profil. Le pliage est flagué pour le DT.
              </p>
            </div>
          )}

          {/* Attribution */}
          {showAttribution && currentUser && (
            <AttributionPanel
              pliageId={pliageResult.id}
              centreId={sac.centre_id}
              currentUserId={currentUser.id}
              onDone={() => {
                navigate(-1);
              }}
            />
          )}

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            ← Scanner suivant
          </button>
        </div>
      </div>
    );
  }

  // ── Page principale ──
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A1628' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <ParaPassLogo className="h-7" />
        <span
          className="text-[11px] font-bold px-3 py-1 rounded-full"
          style={{ background: statutInfo.bg, color: statutInfo.color }}
        >
          {statutInfo.label}
        </span>
      </div>

      {/* Sac identity */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 text-center">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-6"
          style={{ background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.25)' }}
        >
          🎒
        </div>

        {/* Nom court — grand */}
        <h1 className="text-4xl font-black text-white mb-2 leading-tight">{nomSac}</h1>
        <p className="text-base mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {(sac.centre as { nom?: string; ville?: string } | null)?.nom ?? 'DZ'}
          {(sac.centre as { ville?: string } | null)?.ville ? ` · ${(sac.centre as { ville: string }).ville}` : ''}
        </p>
        {sac.numero_serie && (
          <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>N°{sac.numero_serie}</p>
        )}

        {/* Dernier pliage */}
        {dernierPliage && (
          <div className="mt-6 flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Clock className="w-3.5 h-3.5" />
            <span>
              Dernier pliage {timeAgo(dernierPliage.created_at)}
              {dernierPliage.plieur ? ` par ${dernierPliage.plieur.prenom} ${dernierPliage.plieur.nom}` : ''}
            </span>
          </div>
        )}
        <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {totalPliages} pliage{totalPliages !== 1 ? 's' : ''} enregistré{totalPliages !== 1 ? 's' : ''}
        </p>

        {/* CTA */}
        <div className="mt-10 w-full max-w-xs space-y-3">
          {currentUser ? (
            sac.statut === 'en_service' ? (
              <>
                <button
                  type="button"
                  onClick={enregistrerPliage}
                  disabled={submitting}
                  className="w-full py-5 rounded-2xl font-black text-white text-xl transition-all disabled:opacity-50 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    boxShadow: '0 8px 30px rgba(16,185,129,0.4)',
                  }}
                >
                  {submitting ? '...' : '✓  Pliage effectué'}
                </button>
                <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Connecté en tant que {currentUser.prenom} {currentUser.nom}
                </p>
              </>
            ) : (
              <div className="py-4 px-5 rounded-xl text-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <p className="text-sm font-semibold text-red-400">Sac non disponible</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{statutInfo.label}</p>
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-4 rounded-2xl font-bold text-white text-base"
              style={{ background: 'rgba(249,115,22,0.8)', border: '1px solid rgba(249,115,22,0.5)' }}
            >
              Se connecter pour valider
            </button>
          )}

          {erreur && (
            <p className="text-sm text-red-400 text-center">{erreur}</p>
          )}
        </div>
      </div>

      <p className="text-center text-xs pb-6" style={{ color: 'rgba(255,255,255,0.15)' }}>
        ParaPass · Gestion numérique du pliage
      </p>
    </div>
  );
}
