import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Carnet PAC (Progression Accompagnée en Chute) ────────────────────────────
// Réutilise le moteur existant : brevets_referentiel (PAC1..PAC4), epreuves
// (objectifs, params.domaine), progression_epreuves (acquis, saut_id, moniteur),
// sauts (timeline). AUCUN système parallèle, aucune donnée en dur.

export type Domaine = 'chute' | 'sous_voile' | 'securite';
export const DOMAINES: { key: Domaine; label: string; color: string }[] = [
  { key: 'chute', label: 'Chute', color: '#2563EB' },
  { key: 'sous_voile', label: 'Sous voile', color: '#10B981' },
  { key: 'securite', label: 'Sécurité', color: '#F97316' },
];

export type StatutObjectif = 'a_faire' | 'pret' | 'validee' | 'echouee';

export interface PacObjectif {
  id: string;
  libelle: string;
  domaine: Domaine;
  ordre: number;
  a_valider_ffp: boolean;
}
export interface PacNiveau {
  id: string;
  code: string;      // PAC1..PAC4
  libelle: string;
  description: string | null;
  ordre: number;
  objectifs: PacObjectif[];
  regles: { type: string; description: string | null }[];
}
export interface PacProgression {
  epreuve_id: string;
  statut: StatutObjectif;
  valide_par: string | null;
  valide_at: string | null;
  saut_id: string | null;
  note: string | null;
}
export interface PacSaut {
  id: string;
  date_saut: string;
  programme: string | null;
  statut: string;
  observations_moniteur: string | null;
}

const domaineDe = (params: unknown): Domaine => {
  const d = (params as { domaine?: string } | null)?.domaine;
  return d === 'chute' || d === 'sous_voile' || d === 'securite' ? d : 'securite';
};

// ─── Référentiel PAC (niveaux + objectifs) ────────────────────────────────────

export function usePacReferentiel() {
  const [niveaux, setNiveaux] = useState<PacNiveau[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: brs, error: bErr } = await supabase
      .from('brevets_referentiel')
      .select('id, code, libelle, description, ordre')
      .like('code', 'PAC%').eq('actif', true).order('ordre');
    if (bErr) { console.error('Chargement niveaux PAC échoué :', bErr); setLoading(false); return; }
    const ids = (brs ?? []).map(b => b.id);
    const [{ data: eps, error: eErr }, { data: regs, error: rErr }] = await Promise.all([
      ids.length ? supabase.from('epreuves').select('id, brevet_id, libelle, ordre, params').in('brevet_id', ids).order('ordre') : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from('brevet_regles').select('brevet_id, type_regle, description').in('brevet_id', ids) : Promise.resolve({ data: [], error: null }),
    ]);
    if (eErr) console.error('Chargement objectifs PAC échoué :', eErr);
    if (rErr) console.error('Chargement règles PAC échoué :', rErr);
    setNiveaux((brs ?? []).map(b => ({
      id: b.id, code: b.code, libelle: b.libelle, description: b.description, ordre: b.ordre,
      objectifs: ((eps ?? []) as { id: string; brevet_id: string; libelle: string; ordre: number; params: unknown }[])
        .filter(e => e.brevet_id === b.id)
        .map(e => ({ id: e.id, libelle: e.libelle, domaine: domaineDe(e.params), ordre: e.ordre, a_valider_ffp: !!(e.params as { a_valider_ffp?: boolean } | null)?.a_valider_ffp })),
      regles: ((regs ?? []) as { brevet_id: string; type_regle: string; description: string | null }[])
        .filter(r => r.brevet_id === b.id).map(r => ({ type: r.type_regle, description: r.description })),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { niveaux, loading, refresh: load };
}

// ─── Progression d'un élève (les 3 vues dérivent d'ici) ───────────────────────

export function niveauComplet(n: PacNiveau, prog: Record<string, PacProgression>): boolean {
  return n.objectifs.length > 0 && n.objectifs.every(o => prog[o.id]?.statut === 'validee');
}

/** % d'objectifs validés par domaine, tous niveaux confondus. */
export function rouesParDomaine(niveaux: PacNiveau[], prog: Record<string, PacProgression>) {
  const total: Record<Domaine, number> = { chute: 0, sous_voile: 0, securite: 0 };
  const acquis: Record<Domaine, number> = { chute: 0, sous_voile: 0, securite: 0 };
  for (const n of niveaux) for (const o of n.objectifs) {
    total[o.domaine]++;
    if (prog[o.id]?.statut === 'validee') acquis[o.domaine]++;
  }
  return DOMAINES.map(d => ({ ...d, acquis: acquis[d.key], total: total[d.key], pct: total[d.key] ? Math.round((acquis[d.key] / total[d.key]) * 100) : 0 }));
}

export function usePacEleve(userId: string | undefined) {
  const { niveaux, loading: refLoading } = usePacReferentiel();
  const [prog, setProg] = useState<Record<string, PacProgression>>({});
  const [sauts, setSauts] = useState<PacSaut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: pr, error: pErr }, { data: sa, error: sErr }] = await Promise.all([
      supabase.from('progression_epreuves').select('epreuve_id, statut, valide_par, valide_at, saut_id, note').eq('user_id', userId),
      supabase.from('sauts').select('id, date_saut, programme, statut, observations_moniteur')
        .eq('parachutiste_id', userId).ilike('programme', 'PAC%').order('date_saut'),
    ]);
    if (pErr) console.error('Chargement progression PAC échoué :', pErr);
    if (sErr) console.error('Chargement sauts PAC échoué :', sErr);
    setProg(Object.fromEntries(((pr ?? []) as PacProgression[]).map(p => [p.epreuve_id, p])));
    setSauts((sa ?? []) as PacSaut[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const niveauCourant = niveaux.find(n => !niveauComplet(n, prog)) ?? niveaux[niveaux.length - 1];
  const pac4 = niveaux.find(n => n.code === 'PAC4');
  const pretPourBrevetA = !!pac4 && niveauComplet(pac4, prog);

  return { niveaux, prog, sauts, niveauCourant, pretPourBrevetA, loading: loading || refLoading, refresh: load };
}

// ─── Côté moniteur / DT ───────────────────────────────────────────────────────

export interface PacEleveResume {
  user_id: string;
  nom: string; prenom: string;
  niveauCourant: string;      // libellé
  niveauCode: string;
  acquisTotal: number; objectifsTotal: number;
  dernierSaut: string | null;
  sautsDepuisValidation: number;   // signal de stagnation
  pretPourBrevetA: boolean;
}

export function usePacStaff(centreId: string | undefined) {
  const { niveaux, loading: refLoading } = usePacReferentiel();
  const [eleves, setEleves] = useState<PacEleveResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId || niveaux.length === 0) return;
    setError(null);
    const epIds = niveaux.flatMap(n => n.objectifs.map(o => o.id));
    // élèves = membres du centre ayant une progression PAC OU des sauts PAC
    const [{ data: prog, error: pErr }, { data: lic, error: lErr }] = await Promise.all([
      supabase.from('progression_epreuves').select('user_id, epreuve_id, statut, valide_at').eq('centre_id', centreId).in('epreuve_id', epIds.length ? epIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('licencies_centres').select('parachutiste_id').eq('centre_id', centreId).eq('statut', 'actif'),
    ]);
    if (pErr) { console.error('Chargement progression PAC (staff) échoué :', pErr); setError('Chargement impossible.'); setLoading(false); return; }
    if (lErr) console.error('Chargement licenciés échoué :', lErr);

    const progList = (prog ?? []) as { user_id: string; epreuve_id: string; statut: string; valide_at: string | null }[];
    const licIds = (lic ?? []).map(l => l.parachutiste_id as string);
    const userIds = [...new Set(progList.map(p => p.user_id))].filter(id => licIds.includes(id));
    if (userIds.length === 0) { setEleves([]); setLoading(false); return; }

    const [{ data: profs }, { data: sauts }] = await Promise.all([
      supabase.from('profiles').select('id, nom, prenom').in('id', userIds),
      supabase.from('sauts').select('parachutiste_id, date_saut, valide_le').in('parachutiste_id', userIds).ilike('programme', 'PAC%').order('date_saut', { ascending: false }),
    ]);
    const profMap = Object.fromEntries((profs ?? []).map(p => [p.id, p]));
    const progByUser = new Map<string, Record<string, string>>();
    const dernValidByUser = new Map<string, string>();
    for (const p of progList) {
      (progByUser.get(p.user_id) ?? progByUser.set(p.user_id, {}).get(p.user_id)!)[p.epreuve_id] = p.statut;
      if (p.statut === 'validee' && p.valide_at && (!dernValidByUser.get(p.user_id) || p.valide_at > dernValidByUser.get(p.user_id)!)) dernValidByUser.set(p.user_id, p.valide_at);
    }
    const sautsByUser = new Map<string, string[]>();
    for (const s of (sauts ?? []) as { parachutiste_id: string; date_saut: string }[]) {
      (sautsByUser.get(s.parachutiste_id) ?? sautsByUser.set(s.parachutiste_id, []).get(s.parachutiste_id)!).push(s.date_saut);
    }

    setEleves(userIds.map(uid => {
      const pm = progByUser.get(uid) ?? {};
      const complet = (n: typeof niveaux[0]) => n.objectifs.length > 0 && n.objectifs.every(o => pm[o.id] === 'validee');
      const courant = niveaux.find(n => !complet(n)) ?? niveaux[niveaux.length - 1];
      const pac4 = niveaux.find(n => n.code === 'PAC4');
      const acquisTotal = niveaux.flatMap(n => n.objectifs).filter(o => pm[o.id] === 'validee').length;
      const objectifsTotal = niveaux.flatMap(n => n.objectifs).length;
      const sautsList = sautsByUser.get(uid) ?? [];
      const derniereVal = dernValidByUser.get(uid);
      // sauts postérieurs à la dernière validation = signal de stagnation
      const sautsDepuis = derniereVal ? sautsList.filter(d => d > derniereVal).length : sautsList.length;
      return {
        user_id: uid, nom: profMap[uid]?.nom ?? '?', prenom: profMap[uid]?.prenom ?? '',
        niveauCourant: courant?.libelle ?? '—', niveauCode: courant?.code ?? '',
        acquisTotal, objectifsTotal,
        dernierSaut: sautsList[0] ?? null,
        sautsDepuisValidation: sautsDepuis,
        pretPourBrevetA: !!pac4 && complet(pac4),
      };
    }).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom)));
    setLoading(false);
  }, [centreId, niveaux]);

  useEffect(() => { load(); }, [load]);
  return { niveaux, eleves, loading: loading || refLoading, error, refresh: load };
}

/** Validation d'un objectif par le moniteur : validee / echouee (à retravailler).
 *  Tracé : valide_par + valide_at, rattaché au saut. Jamais automatique. */
export async function validerObjectifPac(params: {
  userId: string; epreuveId: string; centreId: string;
  statut: 'validee' | 'echouee'; note: string; sautId: string | null; moniteurId: string;
}): Promise<string | null> {
  const { userId, epreuveId, centreId, statut, note, sautId, moniteurId } = params;
  const { data: existing } = await supabase.from('progression_epreuves').select('id').eq('user_id', userId).eq('epreuve_id', epreuveId).maybeSingle();
  const payload = {
    statut, note: note.trim() || null, saut_id: sautId,
    valide_par: moniteurId, valide_at: new Date().toISOString(),
    quantite_faite: statut === 'validee' ? 1 : 0, updated_at: new Date().toISOString(),
  };
  const { data, error } = existing
    ? await supabase.from('progression_epreuves').update(payload).eq('id', existing.id).select('id')
    : await supabase.from('progression_epreuves').insert({ user_id: userId, epreuve_id: epreuveId, centre_id: centreId, ...payload }).select('id');
  if (error || !data?.length) { console.error('Validation objectif PAC échouée :', error); return error?.message ?? 'Validation impossible.'; }
  return null;
}
