import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, X } from 'lucide-react';

interface ReAuthModalProps {
  open: boolean;
  onConfirmed: () => void;
  onCancel: () => void;
  email: string;
  title?: string;
  description?: string;
}

/**
 * Modal de re-authentification obligatoire avant toute action de validation.
 * Demande au moniteur de ressaisir son mot de passe pour confirmer son identité.
 */
export function ReAuthModal({ open, onConfirmed, onCancel, email, title, description }: ReAuthModalProps) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError('Mot de passe incorrect. Veuillez réessayer.');
      setPassword('');
      return;
    }

    setPassword('');
    onConfirmed();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#001A4D] flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-[#001A4D] text-base">{title ?? 'Confirmez votre identité'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{description ?? 'Re-saisissez votre mot de passe pour valider ce saut'}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="px-6 pb-6 space-y-4">
          <div className="bg-[#001A4D]/5 rounded-xl px-4 py-3">
            <p className="text-xs text-[#001A4D] font-medium">Compte : {email}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Mot de passe</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                placeholder="Votre mot de passe"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-gray-200 bg-white text-gray-600 py-2.5 rounded-xl text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="flex-1 bg-[#001A4D] hover:bg-[#1E3A5F] disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {loading ? 'Vérification...' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
