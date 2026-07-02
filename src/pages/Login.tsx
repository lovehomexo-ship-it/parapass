import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, FlaskConical } from 'lucide-react';
import { ParaPassLogo } from '../components/ParaPassLogo';

const TEST_ACCOUNTS = [
  { label: 'Sophie Martin', sublabel: 'Parachutiste', email: 'sophie.martin@parapass.fr' },
  { label: 'Kevin Lorin', sublabel: 'Nouveau compte', email: 'kevin.lorin@gmail.com' },
  { label: 'Maxime Leroy', sublabel: 'Moniteur', email: 'maxime.leroy@demo.fr' },
  { label: 'Nicolas Girard', sublabel: 'Moniteur délégué', email: 'nicolas.girard@demo.fr' },
  { label: 'Johnny Guerin', sublabel: 'Directeur Technique', email: 'johnny.guerin@parapass.fr' },
  { label: 'BigAir Admin', sublabel: 'Admin Centre', email: 'bigair.admin@parapass.fr' },
];
const TEST_PASS = 'Test1234!';

function getRolePath(role: string) {
  if (role === 'admin_centre') return '/centre/dashboard';
  if (role === 'admin') return '/admin';
  // moniteur and parachutiste both use the unified dashboard
  return '/dashboard';
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showTestPanel = import.meta.env.DEV || searchParams.get('demo') === 'true';

  useEffect(() => {
    if (profile) {
      navigate(getRolePath(profile.role), { replace: true });
    }
  }, [profile, navigate]);

  const loginAndRedirect = async (loginEmail: string, loginPassword: string) => {
    const emailClean = loginEmail.trim().toLowerCase();
    // Clear any lingering demo flags before real login
    sessionStorage.removeItem('demo_mode_type');
    sessionStorage.removeItem('is_demo_mode');

    let authError: Error | null = null;

    // Attempt 1 — direct sign-in
    const { error: err1 } = await supabase.auth.signInWithPassword({ email: emailClean, password: loginPassword });
    authError = err1;

    // Attempt 2 — if email not confirmed, confirm via RPC and retry
    if (err1 && (err1.message.toLowerCase().includes('not confirmed') || err1.message.toLowerCase().includes('confirm'))) {
      await supabase.rpc('confirm_user_email', { user_email: emailClean });
      const { error: err2 } = await supabase.auth.signInWithPassword({ email: emailClean, password: loginPassword });
      authError = err2;
    }

    if (authError) throw authError;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      let { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!prof) {
        // Profile missing — create it from auth metadata
        const meta = user.user_metadata ?? {};
        const { data: created } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email ?? emailClean,
          nom: (meta.nom as string) || emailClean.split('@')[0].toUpperCase(),
          prenom: (meta.prenom as string) || '',
          role: (meta.role as string) || 'parachutiste',
          numero_licence: '',
          type_pratiquant: 'amateur',
          nationalite: 'Française',
        }, { onConflict: 'id' }).select('role').maybeSingle();
        prof = created;
      }
      navigate(getRolePath(prof?.role ?? 'parachutiste'), { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginAndRedirect(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials') || msg.includes('Invalid email or password')) {
        setError('Email ou mot de passe incorrect.');
      } else {
        setError(`Erreur : ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (testEmail: string) => {
    setError('');
    setQuickLoading(testEmail);
    try {
      await loginAndRedirect(testEmail, TEST_PASS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erreur : ${msg}`);
    } finally {
      setQuickLoading(null);
    }
  };

  if (profile) return null;

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #001A4D 0%, #1E3A5F 100%)' }}>
      {/* Left panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <svg viewBox="0 0 400 400" className="w-full h-full"><path d="M40 200 Q40 40 200 40 Q360 40 360 200" stroke="white" strokeWidth="3" fill="none" /><path d="M40 200 Q120 160 200 200 Q280 160 360 200" stroke="white" strokeWidth="2" fill="none" opacity="0.6" /><line x1="40" y1="200" x2="185" y2="360" stroke="white" strokeWidth="3" /><line x1="200" y1="200" x2="185" y2="360" stroke="white" strokeWidth="3" /><line x1="360" y1="200" x2="185" y2="360" stroke="white" strokeWidth="3" /><circle cx="185" cy="360" r="12" fill="white" /></svg>
        </div>
        <Link to="/" className="no-underline">
          <ParaPassLogo />
        </Link>
        <div>
          <blockquote className="text-white/80 text-lg leading-relaxed mb-6">
            "ParaPass a révolutionné la gestion de mon carnet. Mon moniteur valide mes sauts en quelques secondes depuis son téléphone."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/30 flex items-center justify-center text-white font-bold text-sm">JL</div>
            <div>
              <div className="text-white font-medium text-sm">Jean-Luc Moreau</div>
              <div className="text-white/50 text-xs">247 sauts — Centre de Saintes</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-white/40 text-xs">
          <span>✓ Conforme réglementation</span>
          <span>✓ Données chiffrées</span>
          <span>✓ Hébergé en Europe</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-block no-underline">
              <ParaPassLogo mobile />
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-[#0F172A]">Connexion</h1>
              <p className="text-sm text-[#64748B] mt-1">Accédez à votre carnet de sauts ParaPass</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-5 flex items-center gap-2">
                <span className="text-red-500 flex-shrink-0">✕</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Adresse email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-[#0F172A] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="votre@email.fr"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#64748B] mb-1.5">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-[#0F172A] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all pr-10"
                    placeholder="Votre mot de passe"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: loading ? '#93C5FD' : '#2563EB' }}
              >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-[#64748B]">
              Pas encore de compte ?{' '}
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700 no-underline">
                Créer un compte gratuit
              </Link>
            </div>
            <div className="mt-2 text-center text-sm text-[#64748B]">
              Vous gérez une DZ ?{' '}
              <Link to="/inscription-centre" className="font-medium text-[#001A4D] hover:text-[#1E3A5F] no-underline">
                Inscrire mon centre
              </Link>
            </div>

            <div
              className="flex items-center justify-center gap-2 mt-4 pt-4"
              style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}
            >
              <img
                src="/logo-ffp-footer.png"
                alt="Logo FFP — Fédération Française de Parachutisme"
                style={{ height: '22px', width: 'auto', filter: 'brightness(0) saturate(100%)', opacity: 0.45 }}
              />
              <span className="text-xs" style={{ color: '#94A3B8' }}>Carnet de sauts numérique</span>
            </div>

            {showTestPanel && (
              <div className="mt-5 pt-5 border-t border-dashed border-amber-200 bg-amber-50 -mx-8 -mb-8 p-6 rounded-b-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Comptes de test</span>
                  <span className="text-xs text-amber-500 ml-auto">Mot de passe : {TEST_PASS}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEST_ACCOUNTS.map(acc => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleQuickLogin(acc.email)}
                      disabled={quickLoading !== null}
                      className="flex flex-col items-start px-3 py-2.5 bg-white border border-amber-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-all disabled:opacity-50 text-left"
                    >
                      {quickLoading === acc.email ? (
                        <span className="text-xs text-amber-600 font-medium">Connexion...</span>
                      ) : (
                        <>
                          <span className="text-xs font-semibold text-gray-800">{acc.label}</span>
                          <span className="text-[11px] text-gray-400">{acc.sublabel}</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
