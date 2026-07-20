import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Moteur de progression des brevets ────────────────────────────────────────
// La progression FFP est un ARBRE : prérequis multiples et typés (brevet_regles),
// modules indépendants avec prérequis croisés (epreuve_prerequis), conditions
// automatiques calculées depuis le carnet (seuils de sauts, âge, expérience
// récente) distinctes des épreuves qualitatives validées par l'humain.
// Tout le contenu est de la DONNÉE (référentiel FFP 2026 saisi, sourcé,
// « à confirmer DT ») — rien n'est codé en dur.

export interface BrevetRef {
  id: string;
  code: string;
  libelle: string;
  ordre: number;
  brevet_prerequis_id: string | null; // hérité — remplacé par brevet_regles
  actif: boolean;
  description: string | null;
  source: string | null;
}

export interface BrevetRegle {
  id: string;
  brevet_id: string;
  type_regle: string; // tous_brevets / au_moins_un_brevet / nombre_de_sauts / experience_recente / age / formation_initiale / …
  params: Record<string, unknown>;
  description: string | null;
  source: string | null;
}

export interface Epreuve {
  id: string;
  brevet_id: string;
  libelle: string;
  type: 'saut' | 'theorie' | 'pliage' | 'pratique' | 'module' | 'pratique_sol' | 'nombre_sauts' | 'experience_recente' | 'administratif' | 'age';
  obligatoire: boolean;
  quantite_requise: number;
  ordre: number;
  prerequis_epreuve_id: string | null; // hérité — remplacé par epreuve_prerequis
  params: { sauts_min?: number; brevets_requis?: string[] };
  description: string | null;
  source: string | null;
}

export interface ProgressionEpreuve {
  id: string;
  user_id: string;
  epreuve_id: string;
  centre_id: string | null;
  statut: 'a_faire' | 'pret' | 'validee' | 'echouee';
  quantite_faite: number;
  declare_pret_at: string | null;
  valide_par: string | null;
  valide_at: string | null;
  saut_id: string | null;
  note: string | null;
}

export const TYPE_EPREUVE_LABELS: Record<Epreuve['type'], string> = {
  saut: 'Saut (carnet)', theorie: 'Théorie (QCM/Académie)', pliage: 'Pliage (module pliage)',
  pratique: 'Pratique', module: 'Module indépendant', pratique_sol: 'Pratique au sol',
  nombre_sauts: 'Seuil de sauts (calculé)', experience_recente: 'Expérience récente (calculée)',
  administratif: 'Fiche / administratif', age: 'Condition d\'âge (calculée)',
};

// ─── Référentiel ──────────────────────────────────────────────────────────────

export function useReferentielBrevets() {
  const [brevets, setBrevets] = useState<BrevetRef[]>([]);
  const [epreuves, setEpreuves] = useState<Epreuve[]>([]);
  const [regles, setRegles] = useState<BrevetRegle[]>([]);
  const [prerequisMap, setPrerequisMap] = useState<Record<string, string[]>>({}); // epreuve_id → prerequis ids
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [b, e, r, pj] = await Promise.all([
      supabase.from('brevets_referentiel').select('*').eq('actif', true).order('ordre'),
      supabase.from('epreuves').select('*').order('ordre'),
      supabase.from('brevet_regles').select('*'),
      supabase.from('epreuve_prerequis').select('*'),
    ]);
    for (const { error } of [b, e, r, pj]) if (error) console.error('Chargement référentiel échoué :', error);
    setBrevets((b.data ?? []) as BrevetRef[]);
    setEpreuves((e.data ?? []) as Epreuve[]);
    setRegles((r.data ?? []) as BrevetRegle[]);
    const map: Record<string, string[]> = {};
    for (const row of (pj.data ?? []) as { epreuve_id: string; prerequis_id: string }[]) {
      (map[row.epreuve_id] ??= []).push(row.prerequis_id);
    }
    setPrerequisMap(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const epreuvesDe = (brevetId: string) => epreuves.filter(e => e.brevet_id === brevetId);
  const reglesDe = (brevetId: string) => regles.filter(r => r.brevet_id === brevetId);
  const renseigne = epreuves.length > 0;

  return { brevets, epreuves, regles, prerequisMap, epreuvesDe, reglesDe, renseigne, loading, refresh: load };
}

// ─── Contexte élève (conditions AUTOMATIQUES, calculées depuis le carnet) ─────

export interface ContexteEleve {
  sautsValides: number;
  sautsDates: string[]; // dates des sauts valides/historiques (hors soufflerie)
  age: number | null;
  brevetsAcquis: Set<string>; // codes — délivrances du moteur + brevets déjà détenus (table brevets)
}

export function useContexteEleve(userId: string | undefined): ContexteEleve | null {
  const [ctx, setCtx] = useState<ContexteEleve | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [sauts, profil, delivres, detenus] = await Promise.all([
        supabase.from('sauts').select('date_saut').eq('parachutiste_id', userId).eq('is_tunnel', false).in('statut', ['valide', 'historique']),
        supabase.from('profiles').select('date_naissance').eq('id', userId).maybeSingle(),
        supabase.from('validations_brevet').select('brevet:brevets_referentiel(code)').eq('user_id', userId),
        supabase.from('brevets').select('type_brevet').eq('parachutiste_id', userId),
      ]);
      for (const { error } of [sauts, profil, delivres, detenus]) if (error) console.error('Chargement contexte élève échoué :', error);
      const dates = (sauts.data ?? []).map(s => s.date_saut as string);
      const naissance = profil.data?.date_naissance as string | null;
      const age = naissance ? Math.floor((Date.now() - new Date(naissance).getTime()) / (365.25 * 86_400_000)) : null;
      const acquis = new Set<string>();
      for (const d of delivres.data ?? []) {
        const code = (d.brevet as { code?: string } | null)?.code;
        if (code) acquis.add(code);
      }
      for (const d of detenus.data ?? []) acquis.add(d.type_brevet as string);
      setCtx({ sautsValides: dates.length, sautsDates: dates, age, brevetsAcquis: acquis });
    })();
  }, [userId]);

  return ctx;
}

/** Évalue une règle de prérequis. Les règles non calculables (formation_initiale…)
 *  sont affichées et laissées à l'appréciation humaine — jamais inventées. */
export function evalRegle(regle: BrevetRegle, ctx: ContexteEleve): { ok: boolean | null; label: string } {
  const p = regle.params as Record<string, unknown>;
  switch (regle.type_regle) {
    case 'tous_brevets': {
      const codes = (p.codes as string[]) ?? [];
      const ok = codes.every(c => ctx.brevetsAcquis.has(c));
      return { ok, label: `Brevet${codes.length > 1 ? 's' : ''} ${codes.join(' + ')}` };
    }
    case 'au_moins_un_brevet': {
      const codes = (p.codes as string[]) ?? [];
      const ok = codes.some(c => ctx.brevetsAcquis.has(c));
      return { ok, label: `Un brevet parmi ${codes.join(', ')}` };
    }
    case 'nombre_de_sauts': {
      const min = (p.sauts_min as number) ?? 0;
      return { ok: ctx.sautsValides >= min, label: `${min} sauts (${ctx.sautsValides}/${min})` };
    }
    case 'experience_recente': {
      const sauts = (p.sauts as number) ?? 0;
      const jours = (p.jours as number) ?? 365;
      const depuis = Date.now() - jours * 86_400_000;
      const recents = ctx.sautsDates.filter(d => new Date(d).getTime() >= depuis).length;
      return { ok: recents >= sauts, label: `${sauts} sauts sur ${jours} j (${recents}/${sauts})` };
    }
    case 'age': {
      const min = (p.age_min as number) ?? 18;
      return { ok: ctx.age === null ? null : ctx.age >= min, label: min === 18 ? 'Être majeur' : `${min} ans minimum` };
    }
    default:
      // Non calculable (ex : formation_initiale) : affiché, apprécié par l'humain
      return { ok: null, label: regle.description ?? regle.type_regle };
  }
}

/** Conditions du brevet remplies ? (les non-calculables ne bloquent pas — l'humain apprécie) */
export function conditionsBrevetOk(regles: BrevetRegle[], ctx: ContexteEleve): boolean {
  return regles.every(r => evalRegle(r, ctx).ok !== false);
}

// ─── Logique épreuves ─────────────────────────────────────────────────────────

/** Prérequis d'une épreuve : TOUTES les épreuves prérequises validées + conditions params. */
export function prerequisEpreuveOk(
  epreuve: Epreuve,
  progressions: Record<string, ProgressionEpreuve>,
  epreuves: Epreuve[],
  prerequisMap: Record<string, string[]>,
  ctx: ContexteEleve | null
): { ok: boolean; manque: string | null } {
  for (const preqId of prerequisMap[epreuve.id] ?? []) {
    if (progressions[preqId]?.statut !== 'validee') {
      const preq = epreuves.find(e => e.id === preqId);
      return { ok: false, manque: preq?.libelle ?? 'une épreuve prérequise' };
    }
  }
  if (ctx) {
    if (epreuve.params.sauts_min && ctx.sautsValides < epreuve.params.sauts_min) {
      return { ok: false, manque: `${epreuve.params.sauts_min} sauts (tu en as ${ctx.sautsValides})` };
    }
    for (const code of epreuve.params.brevets_requis ?? []) {
      if (!ctx.brevetsAcquis.has(code)) return { ok: false, manque: `le brevet ${code}` };
    }
  }
  return { ok: true, manque: null };
}

/** Toutes les épreuves OBLIGATOIRES validées (le signal « prêt à délivrer » côté épreuves). */
export function epreuvesBrevetCompletes(
  brevet: BrevetRef,
  epreuves: Epreuve[],
  progressions: Record<string, ProgressionEpreuve>
): boolean {
  const obligatoires = epreuves.filter(e => e.brevet_id === brevet.id && e.obligatoire);
  if (obligatoires.length === 0) return false;
  return obligatoires.every(e => progressions[e.id]?.statut === 'validee');
}

/** « Il te reste … » — épreuves manquantes + conditions non remplies, calculé. */
export function resteAFaire(
  brevet: BrevetRef,
  epreuves: Epreuve[],
  regles: BrevetRegle[],
  progressions: Record<string, ProgressionEpreuve>,
  ctx: ContexteEleve | null
): string[] {
  const items = epreuves
    .filter(e => e.brevet_id === brevet.id && e.obligatoire && progressions[e.id]?.statut !== 'validee')
    .map(e => {
      const faites = progressions[e.id]?.quantite_faite ?? 0;
      return e.quantite_requise > 1 ? `${e.libelle} (${faites}/${e.quantite_requise})` : e.libelle;
    });
  if (ctx) {
    for (const r of regles.filter(r => r.brevet_id === brevet.id)) {
      const ev = evalRegle(r, ctx);
      if (ev.ok === false) items.push(ev.label);
    }
  }
  return items;
}

// ─── Côté élève ───────────────────────────────────────────────────────────────

export function useMaProgression(userId: string | undefined, centreId: string | undefined) {
  const [progressions, setProgressions] = useState<Record<string, ProgressionEpreuve>>({});
  const [brevetsDelivres, setBrevetsDelivres] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: prog, error: pErr }, { data: valid, error: vErr }] = await Promise.all([
      supabase.from('progression_epreuves').select('*').eq('user_id', userId),
      supabase.from('validations_brevet').select('brevet_id').eq('user_id', userId),
    ]);
    if (pErr) console.error('Chargement progression échoué :', pErr);
    if (vErr) console.error('Chargement validations brevet échoué :', vErr);
    setProgressions(Object.fromEntries(((prog ?? []) as ProgressionEpreuve[]).map(p => [p.epreuve_id, p])));
    setBrevetsDelivres((valid ?? []).map(v => v.brevet_id));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  /** « Je suis prêt » : signale au moniteur, n'auto-valide JAMAIS. */
  const declarerPret = async (epreuveId: string): Promise<void> => {
    if (!userId) return;
    setError(null);
    const existing = progressions[epreuveId];
    const { data: written, error } = existing
      ? await supabase.from('progression_epreuves')
          .update({ statut: 'pret', declare_pret_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', existing.id).select('*')
      : await supabase.from('progression_epreuves')
          .insert({ user_id: userId, epreuve_id: epreuveId, centre_id: centreId ?? null, statut: 'pret', declare_pret_at: new Date().toISOString() })
          .select('*');
    if (error || !written || written.length === 0) {
      console.error('Déclaration « prêt » échouée :', error);
      setError(error?.message ?? 'La déclaration n\'a pas pu être enregistrée.');
      return;
    }
    setProgressions(p => ({ ...p, [epreuveId]: written[0] as ProgressionEpreuve }));
  };

  return { progressions, brevetsDelivres, declarerPret, error, refresh: load };
}

// ─── Côté moniteur / DT ───────────────────────────────────────────────────────

export interface FileValidationRow extends ProgressionEpreuve {
  nom: string; prenom: string;
  epreuve: Epreuve | null;
  brevetCode: string | null;
}

export function useValidationStaff(centreId: string | undefined) {
  const [rows, setRows] = useState<FileValidationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId) return;
    const [{ data: prog, error: pErr }, { data: eps, error: eErr }, { data: brs, error: bErr }] = await Promise.all([
      supabase.from('progression_epreuves').select('*').eq('centre_id', centreId).order('declare_pret_at', { ascending: true }),
      supabase.from('epreuves').select('*'),
      supabase.from('brevets_referentiel').select('id, code'),
    ]);
    if (pErr) { console.error('Chargement file validation échoué :', pErr); return; }
    if (eErr) console.error('Chargement épreuves échoué :', eErr);
    if (bErr) console.error('Chargement brevets échoué :', bErr);
    const list = (prog ?? []) as ProgressionEpreuve[];
    const userIds = [...new Set(list.map(p => p.user_id))];
    let profils: Record<string, { nom: string; prenom: string }> = {};
    if (userIds.length) {
      const { data: pr, error: prErr } = await supabase.from('profiles').select('id, nom, prenom').in('id', userIds);
      if (prErr) console.error('Chargement profils échoué :', prErr);
      profils = Object.fromEntries((pr ?? []).map(p => [p.id, { nom: p.nom, prenom: p.prenom }]));
    }
    const epMap = Object.fromEntries(((eps ?? []) as Epreuve[]).map(e => [e.id, e]));
    const brMap = Object.fromEntries(((brs ?? []) as { id: string; code: string }[]).map(b => [b.id, b.code]));
    setRows(list.map(p => ({
      ...p,
      nom: profils[p.user_id]?.nom ?? '?',
      prenom: profils[p.user_id]?.prenom ?? '',
      epreuve: epMap[p.epreuve_id] ?? null,
      brevetCode: epMap[p.epreuve_id] ? brMap[epMap[p.epreuve_id].brevet_id] ?? null : null,
    })));
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  /** Validation signée du moniteur : qui, quand, note — tracée dans l'historique. */
  const valider = async (row: FileValidationRow, note: string, moniteurId: string): Promise<string | null> => {
    const requise = row.epreuve?.quantite_requise ?? 1;
    const nouvelleQuantite = Math.min(row.quantite_faite + 1, requise);
    const complete = nouvelleQuantite >= requise;
    const { data: written, error } = await supabase
      .from('progression_epreuves')
      .update({
        quantite_faite: nouvelleQuantite,
        statut: complete ? 'validee' : 'a_faire',
        valide_par: moniteurId,
        valide_at: new Date().toISOString(),
        note: note.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id).select('id');
    if (error || !written || written.length === 0) {
      console.error('Validation épreuve échouée :', error);
      return error?.message ?? 'La validation n\'a pas pu être enregistrée.';
    }
    await load();
    return null;
  };

  const marquerEchec = async (row: FileValidationRow, note: string, moniteurId: string): Promise<string | null> => {
    const { data: written, error } = await supabase
      .from('progression_epreuves')
      .update({ statut: 'echouee', valide_par: moniteurId, valide_at: new Date().toISOString(), note: note.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', row.id).select('id');
    if (error || !written || written.length === 0) {
      console.error('Marquage échec échoué :', error);
      return error?.message ?? 'L\'échec n\'a pas pu être enregistré.';
    }
    await load();
    return null;
  };

  /** Délivrance du brevet complet — acte explicite, jamais automatique. */
  const delivrerBrevet = async (userId: string, brevetId: string, moniteurId: string, numero: string | null): Promise<string | null> => {
    const { data: written, error } = await supabase
      .from('validations_brevet')
      .insert({ user_id: userId, brevet_id: brevetId, centre_id: centreId, valide_par: moniteurId, numero })
      .select('id');
    if (error || !written || written.length === 0) {
      console.error('Délivrance brevet échouée :', error);
      return error?.message ?? 'La délivrance n\'a pas pu être enregistrée.';
    }
    return null;
  };

  return { rows, valider, marquerEchec, delivrerBrevet, error, setError, refresh: load };
}
