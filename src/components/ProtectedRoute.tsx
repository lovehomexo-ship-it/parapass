import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { accueilDuRole } from '../lib/accueil';

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#001A4D]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  // Un rôle non autorisé ici rentre CHEZ LUI. Le renvoyer vers « /dashboard »
  // bouclait pour un compte centre (page réservée aux parachutistes) : écran blanc.
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to={accueilDuRole(profile.role)} replace />;

  return <>{children}</>;
}
