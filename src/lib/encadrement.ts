import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Encadrement réglementaire des séances ────────────────────────────────────
// Croise : présents du jour (check-in) × qualifications valides × règles FFP
// paramétrables (regles_encadrement, source Manuel FFP 2026 p.26-27).
// L'appli INFORME (« il manque un DSS »), elle ne bloque jamais une séance.

export interface QualificationRef { code: string; libelle: string; categorie: string }

export interface MoniteurQualif {
  id: string;
  user_id: string;
  centre_id: string;
  qualification_code: string;
  numero: string | null;
  date_obtention: string | null;
  date_expiration: string | null;
  actif: boolean;
}

export interface RegleEncadrement {
  id: string;
  type_seance: string;
  libelle_exigence: string;
  qualif_ou_brevet_requis: string; // alternatives séparées par |
  emplacement: 'sol' | 'avion' | 'seance';
  quantite_min: number;
  source_ref: string | null;
  a_verifier: boolean;
}

export interface SeanceJour {
  id: string;
  dz_id: string;
  date_seance: string;
  type_seance: 'ecole' | 'tandem' | 'autonome';
  ouverte: boolean;
}

export const TYPE_SEANCE_LABELS: Record<string, string> = {
  ecole: 'Séance école', tandem: 'Séance tandem', autonome: 'Séance autonome',
};

export interface PersonnePresente {
  user_id: string;
  nom: string;
  prenom: string;
  qualifs: MoniteurQualif[]; // toutes, y compris expirées (pour signaler)
  brevets: Set<string>; // codes détenus (table brevets + délivrances moteur)
}

export interface EtatExigence {
  regle: RegleEncadrement;
  satisfaite: boolean;
  rempliePar: string[]; // noms
  /** présents qui matcheraient mais dont la qualif est expirée — signalés */
  expires: string[];
}

const qualifValide = (q: MoniteurQualif) =>
  q.actif && (!q.date_expiration || new Date(q.date_expiration) >= new Date());

/** Une personne satisfait-elle l'un des codes alternatifs de la règle ? */
function matche(personne: PersonnePresente, codes: string[]): { ok: boolean; expire: boolean } {
  let expire = false;
  for (const code of codes) {
    if (code.startsWith('BREVET_')) {
      if (personne.brevets.has(code.replace('BREVET_', ''))) return { ok: true, expire: false };
    } else {
      const qs = personne.qualifs.filter(q => q.qualification_code === code);
      if (qs.some(qualifValide)) return { ok: true, expire: false };
      if (qs.length > 0) expire = true; // détient la qualif mais expirée/inactive
    }
  }
  return { ok: false, expire };
}

/** Le vérificateur : état de chaque exigence pour une séance donnée.
 *  Une même personne peut satisfaire plusieurs exigences (cumul autorisé) ;
 *  au sein d'une exigence, quantite_min = personnes DISTINCTES. */
export function verifierSeance(
  seance: SeanceJour,
  regles: RegleEncadrement[],
  presents: PersonnePresente[]
): EtatExigence[] {
  return regles
    .filter(r => r.type_seance === seance.type_seance || r.type_seance === 'toutes')
    .map(regle => {
      const codes = regle.qualif_ou_brevet_requis.split('|');
      const rempliePar: string[] = [];
      const expires: string[] = [];
      for (const p of presents) {
        const m = matche(p, codes);
        if (m.ok) rempliePar.push(`${p.prenom} ${p.nom}`);
        else if (m.expire) expires.push(`${p.prenom} ${p.nom}`);
      }
      return { regle, satisfaite: rempliePar.length >= regle.quantite_min, rempliePar, expires };
    });
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useEncadrement(centreId: string | undefined) {
  const [seances, setSeances] = useState<SeanceJour[]>([]);
  const [regles, setRegles] = useState<RegleEncadrement[]>([]);
  const [qualifsRef, setQualifsRef] = useState<QualificationRef[]>([]);
  const [moniteursQualifs, setMoniteursQualifs] = useState<MoniteurQualif[]>([]);
  const [presents, setPresents] = useState<PersonnePresente[]>([]);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId) return;
    const today = new Date().toISOString().substring(0, 10);
    const [s, r, qr, mq, pres] = await Promise.all([
      supabase.from('seances_jour').select('*').eq('dz_id', centreId).eq('date_seance', today).eq('ouverte', true).order('created_at'),
      supabase.from('regles_encadrement').select('*'),
      supabase.from('qualifications_ref').select('code, libelle, categorie').eq('actif', true),
      supabase.from('moniteurs_qualifications').select('*').eq('centre_id', centreId),
      supabase.from('dz_presences').select('user_id').eq('dz_id', centreId).eq('date_presence', today).eq('statut', 'present'),
    ]);
    for (const { error } of [s, r, qr, mq, pres]) if (error) console.error('Chargement encadrement échoué :', error);

    const presentIds = [...new Set((pres.data ?? []).map(p => p.user_id as string))];
    const mqList = (mq.data ?? []) as MoniteurQualif[];

    // Brevets des présents : table brevets (détenus) + délivrances du moteur — reliés, pas dupliqués
    let brevetsMap: Record<string, Set<string>> = {};
    let profils: Record<string, { nom: string; prenom: string }> = {};
    if (presentIds.length) {
      const [b, vb, pr] = await Promise.all([
        supabase.from('brevets').select('parachutiste_id, type_brevet').in('parachutiste_id', presentIds),
        supabase.from('validations_brevet').select('user_id, brevet:brevets_referentiel(code)').in('user_id', presentIds),
        supabase.from('profiles').select('id, nom, prenom').in('id', presentIds),
      ]);
      for (const { error } of [b, vb, pr]) if (error) console.error('Chargement brevets/profils échoué :', error);
      brevetsMap = {};
      for (const row of b.data ?? []) (brevetsMap[row.parachutiste_id] ??= new Set()).add(row.type_brevet as string);
      for (const row of vb.data ?? []) {
        const code = (row.brevet as { code?: string } | null)?.code;
        if (code) (brevetsMap[row.user_id] ??= new Set()).add(code);
      }
      profils = Object.fromEntries((pr.data ?? []).map(p => [p.id, { nom: p.nom, prenom: p.prenom }]));
    }
    // Noms pour l'annuaire (tous les détenteurs de qualifs du centre)
    const annuaireIds = [...new Set(mqList.map(q => q.user_id))].filter(id => !profils[id]);
    if (annuaireIds.length) {
      const { data: pr2, error: e2 } = await supabase.from('profiles').select('id, nom, prenom').in('id', annuaireIds);
      if (e2) console.error('Chargement profils annuaire échoué :', e2);
      for (const p of pr2 ?? []) profils[p.id] = { nom: p.nom, prenom: p.prenom };
    }

    setSeances((s.data ?? []) as SeanceJour[]);
    setRegles((r.data ?? []) as RegleEncadrement[]);
    setQualifsRef((qr.data ?? []) as QualificationRef[]);
    setMoniteursQualifs(mqList);
    setPresents(presentIds.map(id => ({
      user_id: id,
      nom: profils[id]?.nom ?? '?',
      prenom: profils[id]?.prenom ?? '',
      qualifs: mqList.filter(q => q.user_id === id),
      brevets: brevetsMap[id] ?? new Set(),
    })));
    setNoms(Object.fromEntries(Object.entries(profils).map(([id, p]) => [id, `${p.prenom} ${p.nom}`])));
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);
  // Temps réel léger : recalcul quand quelqu'un se déclare / part + filet 30 s
  useEffect(() => {
    if (!centreId) return;
    const channel = supabase
      .channel(`encadrement-${centreId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dz_presences', filter: `dz_id=eq.${centreId}` }, () => load())
      .subscribe();
    const poll = setInterval(load, 30_000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [centreId, load]);

  const ouvrirSeance = async (type: SeanceJour['type_seance'], userId: string): Promise<void> => {
    setError(null);
    const { data: written, error } = await supabase
      .from('seances_jour')
      .insert({ dz_id: centreId, type_seance: type, created_by: userId })
      .select('id');
    if (error || !written || written.length === 0) {
      console.error('Ouverture séance échouée :', error);
      setError(error?.message ?? 'La séance n\'a pas pu être ouverte.');
      return;
    }
    load();
  };

  const fermerSeance = async (seanceId: string): Promise<void> => {
    setError(null);
    const { data: written, error } = await supabase
      .from('seances_jour').update({ ouverte: false }).eq('id', seanceId).select('id');
    if (error || !written || written.length === 0) {
      console.error('Fermeture séance échouée :', error);
      setError(error?.message ?? 'La séance n\'a pas pu être fermée.');
      return;
    }
    load();
  };

  return { seances, regles, qualifsRef, moniteursQualifs, presents, noms, loading, error, setError, ouvrirSeance, fermerSeance, refresh: load };
}
