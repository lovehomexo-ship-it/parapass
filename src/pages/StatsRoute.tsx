import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { StatsPage } from './Stats';
import type { Saut } from '../lib/types';

export function StatsRoute() {
  const { user } = useAuth();
  const [sauts, setSauts] = useState<Saut[]>([]);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('sauts').select('*').eq('parachutiste_id', user.id).order('date_saut', { ascending: false });
    setSauts(data ?? []);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  return <StatsPage sauts={sauts} />;
}
