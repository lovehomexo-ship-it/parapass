import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Moteur de progression des brevets ────────────────────────────────────────
// Le contenu (épreuves, prérequis, quantités) est de la DONNÉE saisie dans le
// référentiel — RIEN n'est codé en dur. Tant que la FFP n'a pas fourni le
// référentiel officiel, l'interface affiche « en attente de la FFP ».
// L'appli informe et trace ; l'humain (moniteur agréé / DT) valide. Toujours.

export interface BrevetRef {
  id: string;
  code: string;
  libelle: string;
  ordre: number;
  brevet_prerequis_id: string | null;
  actif: boolean;
}

export interface Epreuve {
  id: string;
  brevet_id: string;
  libelle: string;
  type: 'saut' | 'theorie' | 'pliage' | 'pratique';
  obligatoire: boolean;
  quantite_requise: number;
  ordre: number;
  prerequis_epreuve_id: string | null;
  description: string | null;
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
  saut: 'Saut (carnet)', theorie: 'Théorie (Académie/QCM)', pliage: 'Pliage (module pliage)', pratique: 'Pratique',
};

// ─── Référentiel ──────────────────────────────────────────────────────────────

export function useReferentielBrevets() {
  const [brevets, setBrevets] = useState<BrevetRef[]>([]);
  const [epreuves, setEpreuves] = useState<Epreuve[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: b, error: bErr }, { data: e, error: eErr }] = await Promise.all([
      supabase.from('brevets_referentiel').select('*').eq('actif', true).order('ordre'),
      supabase.from('epreuves').select('*').order('ordre'),
    ]);
    if (bErr) console.error('Chargement référentiel brevets échoué :', bErr);
    if (eErr) console.error('Chargement épreuves échoué :', eErr);
    setBrevets((b ?? []) as BrevetRef[]);
    setEpreuves((e ?? []) as Epreuve[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const epreuvesDe = (brevetId: string) => epreuves.filter(e => e.brevet_id === brevetId);
  /** Le référentiel est-il renseigné (au moins une épreuve saisie) ? */
  const renseigne = epreuves.length > 0;

  return { brevets, epreuves, epreuvesDe, renseigne, loading, refresh: load };
}

// ─── Logique commune ──────────────────────────────────────────────────────────

/** Prérequis d'une épreuve remplis ? (épreuve prérequise validée) */
export function prerequisEpreuveOk(
  epreuve: Epreuve,
  progressions: Record<string, ProgressionEpreuve>,
  epreuves: Epreuve[]
): { ok: boolean; manque: string | null } {
  if (!epreuve.prerequis_epreuve_id) return { ok: true, manque: null };
  const prog = progressions[epreuve.prerequis_epreuve_id];
  if (prog?.statut === 'validee') return { ok: true, manque: null };
  const preq = epreuves.find(e => e.id === epreuve.prerequis_epreuve_id);
  return { ok: false, manque: preq?.libelle ?? 'une épreuve prérequise' };
}

/** Toutes les épreuves OBLIGATOIRES du brevet sont-elles validées ? */
export function brevetPretADelivrer(
  brevet: BrevetRef,
  epreuves: Epreuve[],
  progressions: Record<string, ProgressionEpreuve>
): boolean {
  const obligatoires = epreuves.filter(e => e.brevet_id === brevet.id && e.obligatoire);
  if (obligatoires.length === 0) return false; // référentiel non renseigné : rien à délivrer
  return obligatoires.every(e => progressions[e.id]?.statut === 'validee');
}

/** « Il te reste … » — calculé, jamais inventé. */
export function resteAFaire(brevet: BrevetRef, epreuves: Epreuve[], progressions: Record<string, ProgressionEpreuve>): string[] {
  return epreuves
    .filter(e => e.brevet_id === brevet.id && e.obligatoire && progressions[e.id]?.statut !== 'validee')
    .map(e => {
      const faites = progressions[e.id]?.quantite_faite ?? 0;
      return e.quantite_requise > 1 ? `${e.libelle} (${faites}/${e.quantite_requise})` : e.libelle;
    });
}

// ─── Côté élève ───────────────────────────────────────────────────────────────

export function useMaProgression(userId: string | undefined, centreId: string | undefined) {
  const [progressions, setProgressions] = useState<Record<string, ProgressionEpreuve>>({});
  const [brevetsDelivres, setBrevetsDelivres] = useState<string[]>([]); // brevet_referentiel ids
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
        statut: complete ? 'validee' : 'a_faire', // à répétition : revient « à faire » jusqu'au compte
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
