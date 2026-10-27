import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { StatsPage } from './Stats';
import type { Saut } from '../lib/types';
import { lireTout } from '../lib/lireTout';

export function StatsRoute() {
  const { user } = useAuth();
  const [sauts, setSauts] = useState<Saut[]>([]);

  const fetch = useCallback(async () => {
    if (!user) return;
    // Tout le carnet, par pages (une lecture simple est coupée à 1 000 lignes).
    const { data } = await lireTout<Saut>((d, f) => supabase.from('sauts').select('*')
      .eq('parachutiste_id', user.id).eq('is_tunnel', false).order('date_saut', { ascending: false }).range(d, f));
    setSauts(data);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  return <StatsPage sauts={sauts} />;
}
