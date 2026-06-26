import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MaintenancePage } from './pages/MaintenancePage';
import { AuthProvider, useAuth } from './lib/auth';
import { AlertesProvider } from './lib/AlertesContext';
import { GlobalDemoProvider, DemoToastProvider } from './lib/DemoContext';
import { ThemeProvider } from './lib/ThemeContext';
import { CompleteProfileModal, isProfileIncomplete } from './components/CompleteProfileModal';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { DashboardPage } from './pages/Dashboard';
import { QRCodePage } from './pages/QRCode';
import { VerifyPage } from './pages/Verify';
import { MoniteurPage } from './pages/Moniteur';
import { ValidationsPage } from './pages/Validations';
import { AdminPage } from './pages/Admin';
import { ParachutisteViewPage } from './pages/ParachutisteView';
import { PasseportPage } from './pages/Passeport';
import { MaterielPage } from './pages/Materiel';
import { StatsRoute } from './pages/StatsRoute';
import { TamponAdminPage } from './pages/TamponAdmin';
import { ProfilPage } from './pages/Profil';
import { ParametresPage } from './pages/Parametres';
import { ReglesFFPPage } from './pages/ReglesFFP';
import { CommunautePage } from './pages/Communaute';
import { ProfilPublicPage } from './pages/ProfilPublic';
import { InscriptionCentrePage } from './pages/InscriptionCentre';
import { CentreDashboardPage } from './pages/CentreDashboard';
import { MessagesPage } from './pages/Messages';
import { BadgesPage } from './pages/Badges';
import { ProgressionPage } from './pages/Progression';
import { DemoPage } from './pages/Demo';
import { DemoDashboardPage } from './pages/demo/DemoDashboard';
import { DemoCentrePage } from './pages/demo/DemoCentre';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ScanPliagePage } from './pages/ScanPliage';

function AuthRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#001A4D]" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role === 'admin_centre') return <Navigate to="/centre/dashboard" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  // parachutiste AND moniteur both go to /dashboard
  return <Navigate to="/dashboard" replace />;
}

// Intercepts authenticated sessions with incomplete profiles and forces completion
function ProfileGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile } = useAuth();

  // Demo accounts are pre-seeded and must not trigger the completion modal
  const showGate = !loading && !!user && isProfileIncomplete(profile) && !profile?.is_demo;

  if (showGate) {
    return (
      <>
        {/* Render children so the DOM exists, but cover with the modal */}
        {children}
        <CompleteProfileModal onComplete={refreshProfile} />
      </>
    );
  }

  return <>{children}</>;
}

function App() {
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
    return <MaintenancePage />;
  }

  return (
    <BrowserRouter>
      <GlobalDemoProvider>
      <AuthProvider>
        <DemoToastProvider>
        <ThemeProvider>
        <AlertesProvider>
        <ProfileGate>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Parachutiste + moniteur shared routes */}
          <Route path="/dashboard" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><DashboardPage /></ProtectedRoute>} />
          <Route path="/passeport" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><PasseportPage /></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><StatsRoute /></ProtectedRoute>} />
          <Route path="/progression" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><ProgressionPage /></ProtectedRoute>} />
          <Route path="/materiel" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><MaterielPage /></ProtectedRoute>} />
          <Route path="/badges" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><BadgesPage /></ProtectedRoute>} />
          <Route path="/communaute" element={<ProtectedRoute><CommunautePage /></ProtectedRoute>} />
          <Route path="/qr-code" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><QRCodePage /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          <Route path="/regles-ffp" element={<ProtectedRoute><ReglesFFPPage /></ProtectedRoute>} />
          {/* Validations — accessible to anyone with active delegation */}
          <Route path="/validations" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><ValidationsPage /></ProtectedRoute>} />
          {/* Legacy moniteur route — kept for backward compat */}
          <Route path="/moniteur" element={<ProtectedRoute roles={['moniteur']}><MoniteurPage /></ProtectedRoute>} />
          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminPage /></ProtectedRoute>} />
          <Route path="/parachutiste/:id" element={<ProtectedRoute roles={['admin']}><ParachutisteViewPage /></ProtectedRoute>} />
          <Route path="/tampon" element={<ProtectedRoute roles={['admin']}><TamponAdminPage /></ProtectedRoute>} />
          {/* Profile */}
          <Route path="/profil" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue', 'admin']}><ProfilPage /></ProtectedRoute>} />
          <Route path="/parametres" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><ParametresPage /></ProtectedRoute>} />
          {/* Centre */}
          <Route path="/centre/dashboard" element={<ProtectedRoute roles={['admin_centre']}><CentreDashboardPage /></ProtectedRoute>} />
          {/* Public */}
          <Route path="/parapass/:username" element={<ProfilPublicPage />} />
          <Route path="/parapass/id/:id" element={<ProfilPublicPage />} />
          <Route path="/inscription-centre" element={<InscriptionCentrePage />} />
          {/* Demo routes (fully local, no Supabase) */}
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/demo/dashboard" element={<DemoDashboardPage />} />
          <Route path="/demo/centre" element={<DemoCentrePage />} />
          <Route path="/pliage/scan/:token" element={<ScanPliagePage />} />
          <Route path="/verify/:token" element={<VerifyPage />} />
          <Route path="/auth-redirect" element={<AuthRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ProfileGate>
        </AlertesProvider>
        </ThemeProvider>
        </DemoToastProvider>
      </AuthProvider>
      </GlobalDemoProvider>
    </BrowserRouter>
  );
}

export default App;
