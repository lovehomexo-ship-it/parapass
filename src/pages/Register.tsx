import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Eye, EyeOff } from 'lucide-react';
import { ParaPassLogo } from '../components/ParaPassLogo';

export function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', nom: '', prenom: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    try {
      await signUp(form.email.trim().toLowerCase(), form.password, {
        nom: form.nom.trim().toUpperCase(),
        prenom: form.prenom.trim(),
        numero_licence: '',
        role: 'parachutiste',
        centre_id: null,
        type_pratiquant: 'amateur',
        nationalite: 'Française',
        date_naissance: null,
        lieu_naissance: null,
        signature_url: null,
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('already exists')) {
        setError('Cette adresse email est déjà utilisée. Connectez-vous plutôt.');
      } else if (msg.includes('Password') || msg.includes('password')) {
        setError('Le mot de passe doit contenir au moins 6 caractères.');
      } else if (msg.includes('email')) {
        setError('Adresse email invalide.');
      } else {
        setError("Erreur lors de l'inscription. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const inputCls = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-[#0F172A] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block no-underline">
            <ParaPassLogo />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-[#0F172A]">Créer un compte</h1>
            <p className="text-sm text-[#64748B] mt-1">Votre carnet de sauts numérique, gratuit et conforme DGAC</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.prenom}
                  onChange={(e) => update('prenom', e.target.value)}
                  required
                  autoComplete="given-name"
                  className={inputCls}
                  placeholder="Kevin"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => update('nom', e.target.value)}
                  required
                  autoComplete="family-name"
                  className={inputCls}
                  placeholder="LORIN"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">
                Adresse email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
                autoComplete="email"
                className={inputCls}
                placeholder="kevin.lorin@gmail.com"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">
                Mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`${inputCls} pr-10`}
                  placeholder="Minimum 6 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 mt-2"
              style={{ background: loading ? '#93C5FD' : '#2563EB' }}
            >
              {loading ? 'Création du compte...' : 'Créer mon compte gratuit'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-[#64748B]">
            <div>
              Déjà un compte ?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700 no-underline">
                Se connecter
              </Link>
            </div>
            <div>
              Vous gérez une DZ ?{' '}
              <Link to="/inscription-centre" className="font-medium text-blue-600 hover:text-blue-700 no-underline">
                Inscrire mon centre
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
