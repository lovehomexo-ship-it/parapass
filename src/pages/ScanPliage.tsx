import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ParaPassLogo } from '../components/ParaPassLogo';

interface SacInfo {
  id: string;
  qr_code_token: string;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
  user_id: string;
  profil: { nom: string; prenom: string } | null;
}

export function ScanPliagePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [sac, setSac] = useState<SacInfo | null>(null);
  const [statut, setStatut] = useState<'plieur_paye' | 'auto'>('plieur_paye');
  const [nomPlieur, setNomPlieur] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setErreur('QR code invalide.'); setLoading(false); return; }
    supabase
      .from('sacs_parachute')
      .select('id, qr_code_token, marque, modele, numero_serie, user_id, profil:profiles!sacs_parachute_user_id_fkey(nom, prenom)')
      .eq('qr_code_token', token)
      .eq('actif', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setErreur('Sac introuvable ou QR code expiré.'); }
        else { setSac(data as SacInfo); }
        setLoading(false);
      });
  }, [token]);

  const validerPliage = async () => {
    if (!sac) return;
    if (statut === 'plieur_paye' && !nomPlieur.trim()) {
      setErreur('Veuillez saisir votre nom.');
      return;
    }
    setSubmitting(true);
    setErreur(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('validations_pliage').insert({
      sac_id: sac.id,
      user_id: sac.user_id,
      plieur_id: user?.id ?? null,
      type_pliage: statut,
      plieur_nom_libre: statut === 'plieur_paye' ? nomPlieur.trim() : null,
      valide_par_plieur: true,
      date_pliage: new Date().toISOString(),
    });
    if (error) { setErreur('Erreur lors de la validation. Réessayez.'); setSubmitting(false); return; }
    setSuccess(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A1628' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (success && sac) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0A1628' }}>
        <div className="text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)' }}>
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Pliage validé !</h1>
          <p className="mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Sac de <strong className="text-white">{sac.profil?.prenom} {sac.profil?.nom}</strong>
          </p>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {statut === 'plieur_paye' ? `Plié par ${nomPlieur}` : 'Auto-plié'}
          </p>
          <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p className="text-sm font-medium" style={{ color: '#34D399' }}>
              Validé · {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
            className="mt-6 w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  if (erreur && !sac) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0A1628' }}>
        <div className="text-center max-w-sm w-full">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2">QR code invalide</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{erreur}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0A1628' }}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <ParaPassLogo className="h-8" />
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)' }}>
            🪂 Gestion du pliage
          </div>
          <h1 className="text-xl font-bold text-white mb-1">
            {sac?.profil?.prenom} {sac?.profil?.nom}
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {[sac?.marque, sac?.modele, sac?.numero_serie ? `N°${sac.numero_serie}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {/* Pliage type selector */}
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Type de pliage
          </p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {([
              { val: 'plieur_paye' as const, icon: '💰', label: 'Plieur payé', color: '#10B981', activeBg: 'rgba(16,185,129,0.12)', activeBorder: '#10B981' },
              { val: 'auto' as const, icon: '🙋', label: 'Auto-plié', color: '#A78BFA', activeBg: 'rgba(139,92,246,0.12)', activeBorder: '#A78BFA' },
            ] as const).map(opt => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setStatut(opt.val)}
                className="rounded-xl py-4 text-center transition-all"
                style={{
                  border: `2px solid ${statut === opt.val ? opt.activeBorder : 'rgba(255,255,255,0.12)'}`,
                  background: statut === opt.val ? opt.activeBg : 'transparent',
                  color: statut === opt.val ? opt.color : 'rgba(255,255,255,0.45)',
                }}
              >
                <div className="text-2xl mb-1">{opt.icon}</div>
                <div className="text-sm font-semibold">{opt.label}</div>
              </button>
            ))}
          </div>

          {/* Plieur name input */}
          {statut === 'plieur_paye' && (
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Votre nom (plieur)
              </label>
              <input
                type="text"
                value={nomPlieur}
                onChange={(e) => setNomPlieur(e.target.value)}
                placeholder="Prénom Nom"
                className="w-full rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', fontSize: 15 }}
                autoFocus
              />
            </div>
          )}

          {erreur && (
            <p className="text-sm text-red-400 mb-4 text-center">{erreur}</p>
          )}

          <button
            type="button"
            onClick={validerPliage}
            disabled={submitting}
            className="w-full py-4 rounded-xl font-bold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 14px rgba(249,115,22,0.35)', fontSize: 15 }}
          >
            {submitting ? 'Validation...' : '✓ Valider le pliage'}
          </button>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
          ParaPass · Gestion numérique du pliage
        </p>
      </div>
    </div>
  );
}
