import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, X } from 'lucide-react';
import { supabase } from './supabase';
import {
  DEMO_PROFILE, DEMO_USER, DEMO_SAUTS, DEMO_LICENCES, DEMO_CERTIFICATS,
  DEMO_BREVETS, DEMO_QUALIFICATIONS, DEMO_CENTRES_LICENCIES, DEMO_MODULES,
  DEMO_ALERTES, DEMO_BADGES, DEMO_MATERIEL, DEMO_MAINTENANCES, DEMO_STATS,
  DEMO_PARACHUTISTE_PROFILE, DEMO_PARACHUTISTE_USER, DEMO_PARACHUTISTE_LICENCES,
  DEMO_PARACHUTISTE_CERTIFICATS, DEMO_PARACHUTISTE_BREVETS, DEMO_PARACHUTISTE_SAUTS,
  DEMO_PARACHUTISTE_BADGES, DEMO_PARACHUTISTE_MATERIEL, DEMO_PARACHUTISTE_STATS,
  DEMO_CENTRE_DATA,
} from '../data/demoData';
import type { Saut, Licence, CertificatMedical, Brevet, Qualification, CentreLicencie, ModuleBrevet, Alerte, Badge, Materiel, Maintenance } from './types';
import type { Profile } from './auth';
import type { User } from '@supabase/supabase-js';

// ─── Global demo mode state (sessionStorage-backed) ───────────────────────────

export type DemoType = 'para' | 'centre' | null;

const DEMO_KEY = 'demo_mode_type';

export function getDemoType(): DemoType {
  return (sessionStorage.getItem(DEMO_KEY) as DemoType) ?? null;
}

export function isDemoActive(): boolean {
  return getDemoType() !== null;
}

// ─── New global demo context (replaces sessionStorage checks in components) ───

interface GlobalDemoContextType {
  demoType: DemoType;
  isDemoMode: boolean;
  startDemo: (type: 'para' | 'centre') => void;
  exitDemo: () => void;
}

const GlobalDemoContext = createContext<GlobalDemoContextType>({
  demoType: null,
  isDemoMode: false,
  startDemo: () => {},
  exitDemo: () => {},
});

export function GlobalDemoProvider({ children }: { children: ReactNode }) {
  const [demoType, setDemoType] = useState<DemoType>(() => getDemoType());

  // If a real Supabase session is active, clear all demo flags immediately.
  // This prevents stale sessionStorage from showing the demo banner to real users.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        sessionStorage.removeItem(DEMO_KEY);
        sessionStorage.removeItem('is_demo_mode');
        setDemoType(null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        sessionStorage.removeItem(DEMO_KEY);
        sessionStorage.removeItem('is_demo_mode');
        setDemoType(null);
      }
    });

    return () => { listener.subscription.unsubscribe(); };
  }, []);

  const startDemo = useCallback((type: 'para' | 'centre') => {
    sessionStorage.setItem(DEMO_KEY, type);
    // Keep legacy key for backward compat with useDemoMode()
    sessionStorage.setItem('is_demo_mode', 'true');
    setDemoType(type);
  }, []);

  const exitDemo = useCallback(() => {
    sessionStorage.removeItem(DEMO_KEY);
    sessionStorage.removeItem('is_demo_mode');
    setDemoType(null);
  }, []);

  return (
    <GlobalDemoContext.Provider value={{ demoType, isDemoMode: demoType !== null, startDemo, exitDemo }}>
      {children}
    </GlobalDemoContext.Provider>
  );
}

export function useGlobalDemo() {
  return useContext(GlobalDemoContext);
}

// ─── Backward-compat helpers (used by existing pages) ─────────────────────────

export function useDemoMode(): boolean {
  return sessionStorage.getItem('is_demo_mode') === 'true';
}

export function exitDemoMode(navigate: ReturnType<typeof useNavigate>) {
  sessionStorage.removeItem(DEMO_KEY);
  sessionStorage.removeItem('is_demo_mode');
  navigate('/register');
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastContextType {
  showDemoToast: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function DemoToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const showDemoToast = () => {
    setVisible(true);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setVisible(false), 3000);
    setTimer(t);
  };

  return (
    <ToastContext.Provider value={{ showDemoToast }}>
      {children}
      {visible && (
        <div
          className="fixed bottom-6 left-1/2 z-[10000] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white"
          style={{
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            animation: 'fadeInUp 0.25s ease',
          }}
        >
          <Zap className="w-4 h-4 flex-shrink-0" />
          Action désactivée en mode démo — créez un compte pour sauvegarder
        </div>
      )}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useDemoToast() {
  return useContext(ToastContext);
}

// ─── DemoBanner ───────────────────────────────────────────────────────────────

export function DemoBanner({ isCentre = false }: { isCentre?: boolean }) {
  const navigate = useNavigate();
  const { exitDemo } = useGlobalDemo();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleExit = async () => {
    const { supabase: sb } = await import('./supabase');
    await sb.auth.signOut();
    exitDemo();
    sessionStorage.removeItem('demo_mode');
    navigate(isCentre ? '/inscription-centre' : '/register');
  };

  const label = isCentre
    ? 'DÉMO — Tableau de bord et Licenciés disponibles'
    : 'DÉMO — Tableau de bord et Passeport disponibles';
  const cta = isCentre ? '🏢 Inscrire mon centre →' : '✨ Créer mon compte gratuit →';

  return (
    <div
      className="w-full flex items-center justify-between px-4 py-2.5 gap-3"
      style={{
        background: 'linear-gradient(90deg, #F97316 0%, #EA580C 100%)',
        minHeight: '44px',
      }}
    >
      <div className="flex items-center gap-2 text-white text-sm font-semibold min-w-0">
        <Zap className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">MODE DEMONSTRATION — {label}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleExit}
          className="bg-white text-orange-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF7ED')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
        >
          {cta}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded transition-colors"
          style={{ color: 'rgba(255,255,255,0.8)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          aria-label="Fermer la bannière"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Legacy DemoProvider (used by old Demo.tsx page) ─────────────────────────

interface DemoContextType {
  isDemo: true;
  user: User;
  profile: Profile;
  sauts: Saut[];
  licences: Licence[];
  certificats: CertificatMedical[];
  brevets: Brevet[];
  qualifications: Qualification[];
  centresLicencies: CentreLicencie[];
  modules: ModuleBrevet[];
  alertes: Alerte[];
  badges: Badge[];
  materiel: Materiel[];
  maintenances: Maintenance[];
  stats: typeof DEMO_STATS;
}

const DemoContext = createContext<DemoContextType | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const value: DemoContextType = {
    isDemo: true,
    user: DEMO_USER,
    profile: DEMO_PROFILE,
    sauts: DEMO_SAUTS,
    licences: DEMO_LICENCES,
    certificats: DEMO_CERTIFICATS,
    brevets: DEMO_BREVETS,
    qualifications: DEMO_QUALIFICATIONS,
    centresLicencies: DEMO_CENTRES_LICENCIES,
    modules: DEMO_MODULES,
    alertes: DEMO_ALERTES,
    badges: DEMO_BADGES,
    materiel: DEMO_MATERIEL,
    maintenances: DEMO_MAINTENANCES,
    stats: DEMO_STATS,
  };
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  return useContext(DemoContext);
}

// ─── Para demo context (Lucas Bernard) ───────────────────────────────────────

interface ParaDemoContextType {
  isDemo: true;
  user: User;
  profile: Profile;
  sauts: Saut[];
  licences: Licence[];
  certificats: CertificatMedical[];
  brevets: Brevet[];
  badges: Badge[];
  materiel: Materiel[];
  stats: typeof DEMO_PARACHUTISTE_STATS;
}

const ParaDemoContext = createContext<ParaDemoContextType | null>(null);

export function ParaDemoProvider({ children }: { children: ReactNode }) {
  const value: ParaDemoContextType = {
    isDemo: true,
    user: DEMO_PARACHUTISTE_USER,
    profile: DEMO_PARACHUTISTE_PROFILE,
    sauts: DEMO_PARACHUTISTE_SAUTS,
    licences: DEMO_PARACHUTISTE_LICENCES,
    certificats: DEMO_PARACHUTISTE_CERTIFICATS,
    brevets: DEMO_PARACHUTISTE_BREVETS,
    badges: DEMO_PARACHUTISTE_BADGES,
    materiel: DEMO_PARACHUTISTE_MATERIEL,
    stats: DEMO_PARACHUTISTE_STATS,
  };
  return <ParaDemoContext.Provider value={value}>{children}</ParaDemoContext.Provider>;
}

export function useParaDemo() {
  return useContext(ParaDemoContext);
}

// ─── Centre demo context (SkyDive Atlantique) ─────────────────────────────────

interface CentreDemoContextType {
  isDemo: true;
  centreData: typeof DEMO_CENTRE_DATA;
}

const CentreDemoContext = createContext<CentreDemoContextType | null>(null);

export function CentreDemoProvider({ children }: { children: ReactNode }) {
  const value: CentreDemoContextType = {
    isDemo: true,
    centreData: DEMO_CENTRE_DATA,
  };
  return <CentreDemoContext.Provider value={value}>{children}</CentreDemoContext.Provider>;
}

export function useCentreDemo() {
  return useContext(CentreDemoContext);
}
