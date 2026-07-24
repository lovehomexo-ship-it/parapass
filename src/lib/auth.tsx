import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  numero_licence: string;
  role: 'parachutiste' | 'moniteur' | 'moniteur_delegue' | 'admin' | 'admin_centre' | 'directeur_technique';
  centre_id: string | null;
  admin_centre_id?: string | null;
  type_pratiquant: 'amateur' | 'professionnel' | 'moniteur' | 'directeur_technique';
  date_naissance: string | null;
  lieu_naissance: string | null;
  nationalite: string;
  signature_url: string | null;
  created_at: string;
  avatar_url?: string | null;
  preferences?: Record<string, unknown> | null;
  is_demo?: boolean;
  brevet?: string | null;
  total_sauts?: number | null;
  declaration_honneur_faite?: boolean | null;
  declaration_honneur_nb?: number | null;
  declaration_honneur_date?: string | null;
  declaration_honneur_methode?: string | null;
}

export interface Delegation {
  id: string;
  centre_id: string;
  dt_id: string;
  moniteur_id: string;
  actif: boolean;
  date_delegation: string;
  date_expiration: string | null;
  note: string | null;
  centre: { id: string; nom: string; ville?: string } | null;
  dt: { nom: string; prenom: string } | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  delegation: Delegation | null;
  sautsEnAttente: number;
  isDemo: boolean;
  isDemoAccount: boolean;
  isDemoReadonly: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile: Omit<Profile, 'id' | 'created_at' | 'email'>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshDelegation: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isDelegationActive(d: Delegation | null): boolean {
  if (!d || !d.actif) return false;
  if (d.date_expiration && new Date(d.date_expiration) < new Date()) return false;
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [sautsEnAttente, setSautsEnAttente] = useState(0);

  const fetchProfile = async (userId: string, userEmail?: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!data && userEmail) {
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          nom: '',
          prenom: '',
          numero_licence: '',
          role: 'parachutiste',
          type_pratiquant: 'amateur',
          nationalite: 'Française',
        })
        .select()
        .maybeSingle();
      setProfile(created as Profile | null);
    } else {
      setProfile(data as Profile | null);
    }
  };

  const fetchDelegation = useCallback(async (userId: string) => {
    const now = new Date().toISOString();
    // Fetch active delegation(s) — take the most recent one
    const { data } = await supabase
      .from('delegations_validation')
      .select(`
        *,
        centre:centres(id, nom, ville),
        dt:profiles!dt_id(nom, prenom)
      `)
      .eq('moniteur_id', userId)
      .eq('actif', true)
      .or(`date_expiration.is.null,date_expiration.gt.${now}`)
      .order('date_delegation', { ascending: false })
      .limit(1)
      .maybeSingle();

    setDelegation(data as Delegation | null);
    return data as Delegation | null;
  }, []);

  const fetchSautsEnAttente = useCallback(async (centreId: string) => {
    const { data: licencies } = await supabase
      .from('licencies_centres')
      .select('parachutiste_id')
      .eq('centre_id', centreId);

    if (!licencies || licencies.length === 0) {
      setSautsEnAttente(0);
      return;
    }

    const ids = licencies.map((l) => l.parachutiste_id);
    const { count } = await supabase
      .from('sauts')
      .select('*', { count: 'exact', head: true })
      .eq('statut', 'en_attente')
      .in('parachutiste_id', ids);

    setSautsEnAttente(count ?? 0);
  }, []);

  const refreshDelegation = useCallback(async () => {
    if (!user) return;
    const d = await fetchDelegation(user.id);
    if (isDelegationActive(d)) {
      await fetchSautsEnAttente(d!.centre_id);
    } else {
      setSautsEnAttente(0);
    }
  }, [user, fetchDelegation, fetchSautsEnAttente]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id, user.email);
  }, [user]);  

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await fetchProfile(s.user.id, s.user.email);
        const d = await fetchDelegation(s.user.id);
        if (isDelegationActive(d)) {
          await fetchSautsEnAttente(d!.centre_id);
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          await fetchProfile(s.user.id, s.user.email);
          const d = await fetchDelegation(s.user.id);
          if (isDelegationActive(d)) {
            await fetchSautsEnAttente(d!.centre_id);
          }
        })();
      } else {
        setProfile(null);
        setDelegation(null);
        setSautsEnAttente(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: watch profile changes (e.g. role promoted by admin_centre)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-rt-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          setProfile((prev) => prev ? { ...prev, ...(payload.new as Profile) } : prev);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Realtime: watch delegation changes for this user
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`delegation-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delegations_validation',
          filter: `moniteur_id=eq.${user.id}`,
        },
        async () => {
          const d = await fetchDelegation(user.id);
          if (isDelegationActive(d)) {
            await fetchSautsEnAttente(d!.centre_id);
          } else {
            setSautsEnAttente(0);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchDelegation, fetchSautsEnAttente]);

  // Realtime: watch sauts en_attente changes when delegation is active
  useEffect(() => {
    if (!delegation || !isDelegationActive(delegation)) return;

    const channel = supabase
      .channel(`sauts-attente-${delegation.centre_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sauts' },
        () => {
          fetchSautsEnAttente(delegation.centre_id);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [delegation, fetchSautsEnAttente]);

  const signIn = async (email: string, password: string) => {
    // Clear any lingering demo flags before real sign-in
    sessionStorage.removeItem('demo_mode_type');
    sessionStorage.removeItem('is_demo_mode');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // If the account exists but email isn't confirmed, confirm it and retry once
      if (error.message.toLowerCase().includes('not confirmed') || error.message.toLowerCase().includes('email not confirmed')) {
        await supabase.rpc('confirm_user_email', { user_email: email.trim().toLowerCase() });
        const { error: err2 } = await supabase.auth.signInWithPassword({ email, password });
        if (err2) throw err2;
        return;
      }
      throw error;
    }
  };

  const signUp = async (email: string, password: string, profileData: Omit<Profile, 'id' | 'created_at' | 'email'>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nom: profileData.nom,
          prenom: profileData.prenom,
          role: profileData.role ?? 'parachutiste',
        },
      },
    });
    if (error) throw error;
    if (data.user) {
      // The on_auth_user_created trigger may have already inserted the profile row.
      // Use upsert so we don't fail on a duplicate key conflict.
      const { error: profileError } = await supabase.from('profiles').upsert(
        { id: data.user.id, email, ...profileData },
        { onConflict: 'id' }
      );
      if (profileError) throw profileError;
    }
    // If email confirmation is still required (no session returned), confirm and sign in
    if (!data.session && data.user) {
      await supabase.rpc('confirm_user_email', { user_email: email.trim().toLowerCase() });
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setDelegation(null);
    setSautsEnAttente(0);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading,
      delegation, sautsEnAttente,
      isDemo: profile?.is_demo === true,
      isDemoAccount: profile?.is_demo === true && !(profile?.preferences as Record<string, unknown> | null)?.demo_readonly,
      isDemoReadonly: profile?.is_demo === true && (profile?.preferences as Record<string, unknown> | null)?.demo_readonly === true,
      signIn, signUp, signOut, refreshDelegation, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export { isDelegationActive };
