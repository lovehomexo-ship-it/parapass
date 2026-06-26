import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User, Building2, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
}

const DEMO_ACCOUNTS = {
  para: { email: 'demo@parapass.fr', password: 'Demo1234!', dest: '/dashboard' },
  centre: { email: 'admin@skydive-atlantique.fr', password: 'DemoPass2026!', dest: '/centre/dashboard' },
} as const;

export function DemoSelectModal({ onClose }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<'para' | 'centre' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (which: 'para' | 'centre') => {
    setLoading(which);
    setError(null);
    const { email, password, dest } = DEMO_ACCOUNTS[which];
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError('Impossible de démarrer la démo. Réessayez dans un instant.');
      setLoading(null);
      return;
    }
    // Tag the session as demo so the banner and gate can detect it
    sessionStorage.setItem('demo_mode', which === 'para' ? 'parachutiste' : 'centre');
    onClose();
    navigate(dest);
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,26,77,0.95)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#002266', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-xl font-bold text-white">Choisissez votre profil de démonstration</h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Explorez ParaPass avec de vraies données — compte temporaire
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ml-4"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Cards */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Parachutiste card */}
          <button
            type="button"
            onClick={() => handleSelect('para')}
            disabled={!!loading}
            className="group text-left rounded-xl p-5 flex flex-col gap-4 transition-all disabled:opacity-60"
            style={{ background: '#002266', border: '1.5px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.borderColor = 'rgba(245,158,11,0.6)'; }}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.2)', border: '1.5px solid rgba(245,158,11,0.4)' }}>
                <User className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Parachutiste</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Compte démo · Navigation libre · Lecture seule</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Carnet numérique, sauts validés, passeport FFP, badges, statistiques de vol et matériel.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {['Tableau de bord', 'Passeport', 'Stats', 'Progression', 'Matériel', 'Badges'].map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: 'rgba(245,158,11,0.9)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  {t}
                </span>
              ))}
            </div>

            <div
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors"
              style={{ background: loading === 'para' ? 'rgba(245,158,11,0.4)' : '#F59E0B', color: '#fff' }}
            >
              {loading === 'para' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Connexion en cours...</>
              ) : (
                <>Explorer en tant que parachutiste <ChevronRight className="w-4 h-4" /></>
              )}
            </div>
          </button>

          {/* Centre card */}
          <button
            type="button"
            onClick={() => handleSelect('centre')}
            disabled={!!loading}
            className="group text-left rounded-xl p-5 flex flex-col gap-4 transition-all disabled:opacity-60"
            style={{ background: '#002266', border: '1.5px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget.style.borderColor = 'rgba(37,99,235,0.6)'); }}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.2)', border: '1.5px solid rgba(37,99,235,0.4)' }}>
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Centre DZ</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>SkyDive Atlantique · La Rochelle</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Tableau de bord centre, gestion licenciés, planning DZ, validations moniteurs et alertes.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {['Tableau de bord', 'Licenciés', 'Planning', 'Statistiques', 'Équipe'].map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(37,99,235,0.15)', color: 'rgba(96,165,250,0.9)', border: '1px solid rgba(37,99,235,0.3)' }}>
                  {t}
                </span>
              ))}
            </div>

            <div
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors"
              style={{ background: loading === 'centre' ? 'rgba(37,99,235,0.4)' : '#2563EB', color: '#fff' }}
            >
              {loading === 'centre' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Connexion en cours...</>
              ) : (
                <>Explorer en tant que centre <ChevronRight className="w-4 h-4" /></>
              )}
            </div>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs pb-5" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Données réelles de démonstration · Compte temporaire · Aucune modification sauvegardée
        </p>
      </div>
    </div>
  );
}
