import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MaintenancePage } from './pages/MaintenancePage';
import { AdminSecretPage } from './pages/AdminSecret';
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
import { VerifyOfflinePage } from './pages/VerifyOffline';
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
import { SacPage } from './pages/SacPage';
import { TandemPublicPage } from './pages/TandemPublicPage';
import { TandemPreparerPage } from './pages/TandemPreparerPage';
import { TandemCertifPage } from './pages/TandemCertifPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabase } from './lib/supabase';

// ─── AuthRedirect ─────────────────────────────────────────────────────────────

function AuthRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#001A4D]" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role === 'admin_centre') return <Navigate to="/centre/dashboard" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

// ─── ProfileGate ──────────────────────────────────────────────────────────────

function ProfileGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const showGate = !loading && !!user && isProfileIncomplete(profile) && !profile?.is_demo;
  if (showGate) {
    return (
      <>
        {children}
        <CompleteProfileModal onComplete={refreshProfile} />
      </>
    );
  }
  return <>{children}</>;
}

// ─── MaintenanceGate ─────────────────────────────────────────────────────────
// Sits inside BrowserRouter so it can read useLocation().
// The /admin-fp2026 route always bypasses maintenance.

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [maintenanceOn, setMaintenanceOn] = useState(
    import.meta.env.VITE_MAINTENANCE_MODE === 'true',
  );

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle();
      if (data) setMaintenanceOn(data.value === 'true');
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (maintenanceOn && pathname !== '/admin-fp2026') {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <BrowserRouter>
      <MaintenanceGate>
        <Routes>
          {/* Secret admin route — outside auth providers, always accessible */}
          <Route path="/admin-fp2026" element={<AdminSecretPage />} />

          {/* All other routes wrapped in auth/theme/alert providers */}
          <Route path="*" element={
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
                <Route path="/dashboard" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><DashboardPage /></ProtectedRoute>} />
                <Route path="/passeport" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><PasseportPage /></ProtectedRoute>} />
                <Route path="/stats" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><StatsRoute /></ProtectedRoute>} />
                <Route path="/progression" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><ProgressionPage /></ProtectedRoute>} />
                <Route path="/materiel" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><MaterielPage /></ProtectedRoute>} />
                <Route path="/badges" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><BadgesPage /></ProtectedRoute>} />
                <Route path="/communaute" element={<ProtectedRoute><CommunautePage /></ProtectedRoute>} />
                <Route path="/qr-code" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><QRCodePage /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><ErrorBoundary><MessagesPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/regles-ffp" element={<ProtectedRoute><ErrorBoundary><ReglesFFPPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/validations" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><ValidationsPage /></ProtectedRoute>} />
                <Route path="/moniteur" element={<ProtectedRoute roles={['moniteur']}><MoniteurPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminPage /></ProtectedRoute>} />
                <Route path="/parachutiste/:id" element={<ProtectedRoute roles={['admin']}><ParachutisteViewPage /></ProtectedRoute>} />
                <Route path="/tampon" element={<ProtectedRoute roles={['admin']}><TamponAdminPage /></ProtectedRoute>} />
                <Route path="/profil" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue', 'admin']}><ProfilPage /></ProtectedRoute>} />
                <Route path="/parametres" element={<ProtectedRoute roles={['parachutiste', 'moniteur', 'moniteur_delegue']}><ParametresPage /></ProtectedRoute>} />
                <Route path="/centre/dashboard" element={<ProtectedRoute roles={['admin_centre']}><ErrorBoundary><CentreDashboardPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/parapass/:username" element={<ProfilPublicPage />} />
                <Route path="/parapass/id/:id" element={<ProfilPublicPage />} />
                <Route path="/inscription-centre" element={<InscriptionCentrePage />} />
                <Route path="/demo" element={<DemoPage />} />
                <Route path="/demo/dashboard" element={<DemoDashboardPage />} />
                <Route path="/demo/centre" element={<DemoCentrePage />} />
                <Route path="/sac/:id" element={<SacPage />} />
                <Route path="/dz/:slug/tandem" element={<TandemPublicPage />} />
                <Route path="/tandem/preparer/:token" element={<TandemPreparerPage />} />
                <Route path="/tandem/certif/:certifToken" element={<TandemCertifPage />} />
                <Route path="/pliage/scan/:token" element={<ScanPliagePage />} />
                <Route path="/verify/:token" element={<VerifyPage />} />
                <Route path="/v" element={<VerifyOfflinePage />} />
                <Route path="/auth-redirect" element={<AuthRedirect />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </ProfileGate>
              </AlertesProvider>
              </ThemeProvider>
              </DemoToastProvider>
            </AuthProvider>
            </GlobalDemoProvider>
          } />
        </Routes>
      </MaintenanceGate>
    </BrowserRouter>
  );
}

export default App;
