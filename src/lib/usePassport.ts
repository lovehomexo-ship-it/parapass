import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Licence, Brevet, CertificatMedical, CentreLicencie, Qualification, ModuleBrevet, ContactUrgence, Incident, InterdictionSaut } from './types';

export function usePassport(userId: string | undefined) {
  const [licences, setLicences] = useState<Licence[]>([]);
  const [brevets, setBrevets] = useState<Brevet[]>([]);
  const [certificats, setCertificats] = useState<CertificatMedical[]>([]);
  const [centresLicencies, setCentresLicencies] = useState<CentreLicencie[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [modulesBrevets, setModulesBrevets] = useState<ModuleBrevet[]>([]);
  const [contacts, setContacts] = useState<ContactUrgence[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [interdictions, setInterdictions] = useState<InterdictionSaut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [l, b, c, cl, q, mb, cu, inc, inter] = await Promise.all([
      supabase.from('licences').select('*').eq('parachutiste_id', userId).order('created_at', { ascending: false }),
      supabase.from('brevets').select('*').eq('parachutiste_id', userId).order('date_obtention', { ascending: false }),
      supabase.from('certificats_medicaux').select('*').eq('parachutiste_id', userId).order('date_expiration', { ascending: false }),
      supabase.from('centres_licencies').select('*, centre:centres(*)').eq('parachutiste_id', userId),
      supabase.from('qualifications').select('*').eq('parachutiste_id', userId).order('date_obtention', { ascending: false }),
      supabase.from('modules_brevets').select('*').eq('parachutiste_id', userId),
      supabase.from('contacts_urgence').select('*').eq('parachutiste_id', userId).order('created_at', { ascending: true }),
      supabase.from('incidents').select('*').eq('parachutiste_id', userId).order('date_incident', { ascending: false }),
      supabase.from('interdictions_sauts').select('*').eq('parachutiste_id', userId).order('date_interdiction', { ascending: false }),
    ]);
    setLicences(l.data ?? []);
    setBrevets(b.data ?? []);
    setCertificats(c.data ?? []);
    setCentresLicencies(cl.data ?? []);
    setQualifications(q.data ?? []);
    setModulesBrevets(mb.data ?? []);
    setContacts(cu.data ?? []);
    setIncidents(inc.data ?? []);
    setInterdictions(inter.data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { licences, brevets, certificats, centresLicencies, qualifications, modulesBrevets, contacts, incidents, interdictions, loading, refresh: load };
}

export async function uploadDocument(
  userId: string,
  file: File,
  folder: string
): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('parapass-docs').upload(path, file);
  if (error) return null;
  return path;
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('parapass-docs').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
