import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('parapass_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  const { user } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('parapass_theme', theme);
  }, [theme]);

  // Load preference from Supabase when user is available
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const pref = data?.preferences as Record<string, unknown> | null;
        if (pref?.theme === 'light' || pref?.theme === 'dark') {
          setTheme(pref.theme as Theme);
        }
      });
  }, [user?.id]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) {
      supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const existing = (data?.preferences as Record<string, unknown>) ?? {};
          supabase
            .from('profiles')
            .update({ preferences: { ...existing, theme: next } })
            .eq('id', user.id);
        });
    }
  }, [theme, user]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
