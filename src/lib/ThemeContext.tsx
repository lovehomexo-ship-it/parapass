import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

type Theme = 'dark' | 'light';
/** Le choix de la personne : un thème fixé, ou « comme le téléphone ». */
export type PreferenceTheme = Theme | 'auto';

interface ThemeContextType {
  /** Le thème affiché, une fois « auto » résolu. */
  theme: Theme;
  isDark: boolean;
  preference: PreferenceTheme;
  setPreference: (p: PreferenceTheme) => void;
  /** Bascule clair ⇄ sombre (choix explicite). */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// LE THÈME SUIT CELUI DU TÉLÉPHONE PAR DÉFAUT. Il était forcé en sombre, et
// réécrit dans `parapass_theme` à chaque chargement : tout le monde semblait
// avoir « choisi » le sombre. La nouvelle clé ne reçoit que des choix
// explicites (bouton, Réglages, ou préférence déjà enregistrée sur le compte).
const CLE = 'parapass_theme_pref';

const systemeSombre = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPref] = useState<PreferenceTheme>(() => {
    try {
      const v = localStorage.getItem(CLE);
      return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto';
    } catch { return 'auto'; }
  });
  const [sombreSysteme, setSombreSysteme] = useState<boolean>(() => systemeSombre() ?? true);
  const { user } = useAuth();

  // Le téléphone passe en sombre le soir : l'application suit, sans recharger.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const maj = () => setSombreSysteme(mq.matches);
    mq.addEventListener?.('change', maj);
    return () => mq.removeEventListener?.('change', maj);
  }, []);

  const theme: Theme = preference === 'auto' ? (sombreSysteme ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Une préférence enregistrée sur le compte (choix fait sur un autre appareil)
  // l'emporte sur « auto ».
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        const pref = (data?.preferences as Record<string, unknown> | null)?.theme;
        if (pref === 'light' || pref === 'dark' || pref === 'auto') setPref(pref);
      });
  }, [user?.id]);

  const setPreference = useCallback((p: PreferenceTheme) => {
    setPref(p);
    try { localStorage.setItem(CLE, p); } catch { /* mode privé : le choix vaut pour la session */ }
    if (!user) return;
    supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        const existing = (data?.preferences as Record<string, unknown>) ?? {};
        supabase.from('profiles').update({ preferences: { ...existing, theme: p } }).eq('id', user.id);
      });
  }, [user]);

  const toggleTheme = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [theme, setPreference]);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', preference, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
