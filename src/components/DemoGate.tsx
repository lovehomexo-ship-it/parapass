import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Lock } from 'lucide-react';

// Only these routes are accessible in parachutiste demo
const ALLOWED_PARA = ['/dashboard', '/passeport'];
// Only these routes are accessible in centre demo
const ALLOWED_CENTRE = ['/centre/dashboard'];

function isAllowed(pathname: string, allowed: string[]): boolean {
  return allowed.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export function DemoGate({ children }: { children: React.ReactNode }) {
  const { isDemoAccount, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isDemoAccount) return <>{children}</>;

  const allowed = profile?.role === 'admin_centre' ? ALLOWED_CENTRE : ALLOWED_PARA;
  if (isAllowed(location.pathname, allowed)) return <>{children}</>;

  const isCentre = profile?.role === 'admin_centre';

  const handleCreateAccount = async () => {
    await signOut();
    sessionStorage.removeItem('demo_mode');
    navigate(isCentre ? '/inscription-centre' : '/register');
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center gap-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(249,115,22,0.12)', border: '1.5px solid rgba(249,115,22,0.3)' }}
      >
        <Lock className="w-7 h-7 text-orange-400" />
      </div>

      <div className="max-w-sm">
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--c-text)' }}>
          Fonctionnalité complète
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>
          Vous explorez ParaPass en mode démonstration.{' '}
          {isCentre
            ? 'Inscrivez votre centre pour accéder à toutes les fonctionnalités.'
            : 'Créez votre compte gratuit pour accéder à toutes les fonctionnalités.'}
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleCreateAccount}
          className="w-full py-3 px-6 rounded-xl text-sm font-bold text-white transition-all"
          style={{ background: '#F97316' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#EA580C')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#F97316')}
        >
          {isCentre ? '🏢 Inscrire mon centre →' : '✨ Créer mon compte gratuit →'}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="w-full py-2.5 px-6 rounded-xl text-sm transition-all"
          style={{ color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          ← Retour
        </button>
      </div>
    </div>
  );
}

// Returns the demo-allowed routes for a given role (used by Layout for nav graying)
export function getDemoAllowedRoutes(role: string | undefined): string[] {
  if (role === 'admin_centre') return ALLOWED_CENTRE;
  return ALLOWED_PARA;
}
