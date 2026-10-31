import { supabase } from './supabase';

// ─── Pliage — table de vérité unique : `pliages` ──────────────────────────────
// (validations_pliage est dépréciée : renommée *_deprecated, jamais référencée)
// Deux origines : plieur habilité (plieurs_valides) ou auto-pliage déclaré par
// le para. L'auto-pliage est une information de sécurité, pas un défaut caché.

export interface DernierPliage {
  date_pliage: string;
  type_pliage: 'habilite' | 'auto';
  plieur_nom: string | null;
}

/** Dernier pliage d'une voile perso (module matériel). */
export async function fetchDernierPliageMateriel(materielId: string): Promise<DernierPliage | null> {
  const { data, error } = await supabase
    .from('pliages')
    .select('date_pliage, type_pliage, plieur:profiles!pliages_plieur_id_fkey(nom, prenom)')
    .eq('materiel_id', materielId)
    .order('date_pliage', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('Chargement dernier pliage échoué :', error); return null; }
  if (!data) return null;
  const plieur = data.plieur as { nom: string; prenom: string } | null;
  return {
    date_pliage: data.date_pliage as string,
    type_pliage: data.type_pliage as 'habilite' | 'auto',
    plieur_nom: plieur ? `${plieur.prenom} ${plieur.nom}` : null,
  };
}

/** Déclaration d'auto-pliage par le para sur SA voile. Renvoie une erreur ou null. */
export async function declarerAutoPliage(opts: {
  materielId: string; userId: string; centreId: string; note?: string;
}): Promise<string | null> {
  const { data: written, error } = await supabase
    .from('pliages')
    .insert({
      materiel_id: opts.materielId,
      parachutiste_id: opts.userId,
      centre_id: opts.centreId,
      type_pliage: 'auto',
      plieur_id: null,
      statut_paiement: 'auto_plie', // pas de facturation sur un auto-pliage
      note: opts.note ?? null,
    })
    .select('id');
  if (error || !written || written.length === 0) {
    console.error('Déclaration auto-pliage échouée :', error);
    return error?.message ?? 'La déclaration n\'a pas pu être enregistrée.';
  }
  return null;
}

export interface PlieurHabilite {
  plieur_id: string;
  actif: boolean;
  date_expiration: string | null;
}

/** Habilitation valide = ligne active et non expirée dans plieurs_valides. */
export function habilitationValide(plieurId: string | null, habilitations: PlieurHabilite[]): boolean {
  if (!plieurId) return false;
  const h = habilitations.find(h => h.plieur_id === plieurId);
  if (!h || !h.actif) return false;
  if (h.date_expiration && new Date(h.date_expiration) < new Date()) return false;
  return true;
}

// ─── Les gestes du pliage, côté serveur ───────────────────────────────────────
// Chaque geste est UNE fonction serveur (migration 217) qui contrôle, écrit
// d'un bloc et date. L'écran n'enchaîne plus d'écritures directes : l'une
// d'elles refusée en silence laissait un sac bloqué dans la file.

export interface ResultatGeste<T = unknown> { ok: boolean; data?: T; erreur?: string }

async function geste<T>(fn: string, args: Record<string, unknown>): Promise<ResultatGeste<T>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`${fn} échoué :`, error);
    return { ok: false, erreur: error.message };
  }
  return { ok: true, data: data as T };
}

/** Le sauteur prend un sac de la DZ (et sa présence du jour le retient). */
export const sacPrendre = (sacId: string) => geste('sac_prendre', { p_sac_id: sacId });
/** Il le dépose au tapis : à plier. */
export const sacDeposer = (sacId: string) => geste('sac_deposer', { p_sac_id: sacId });
/** Il le reprend, déposé par erreur. */
export const sacAnnulerDepot = (sacId: string) => geste('sac_annuler_depot', { p_sac_id: sacId });
/** Il le rend — plié (libre) ou après avoir sauté (à plier). */
export const sacRendre = (sacId: string, aPlier: boolean) => geste('sac_rendre', { p_sac_id: sacId, p_a_plier: aPlier });

export interface PliageEnregistre {
  pliage_id: string; destinataire_id: string | null; destinataire: string | null; habilite: boolean; auto: boolean;
}
/** Le plieur touche « plié » : le serveur décide de l'attribution, du montant, de l'habilitation. */
export const pliageEnregistrer = (sacId: string, opts: { auto?: boolean; horsFile?: boolean } = {}) =>
  geste<PliageEnregistre>('pliage_enregistrer', { p_sac_id: sacId, p_auto: !!opts.auto, p_hors_file: !!opts.horsFile });
/** Corriger le destinataire d'un pliage (le plieur le jour même, ou la DZ). */
export const pliageAttribuer = (pliageId: string, parachutisteId: string | null) =>
  geste('pliage_attribuer', { p_pliage_id: pliageId, p_parachutiste_id: parachutisteId });
/** Régler les plieurs en une fois. */
export const pliagesRegler = (centreId: string, ids: string[]) =>
  geste<number>('pliages_regler', { p_centre_id: centreId, p_ids: ids });
/** Habiliter (ou prolonger) un plieur — tracé au journal. */
export const plieurHabiliter = (centreId: string, plieurId: string, opts: { expiration?: string | null; numero?: string | null; note?: string | null } = {}) =>
  geste<string>('plieur_habiliter', { p_centre_id: centreId, p_plieur_id: plieurId,
    p_date_expiration: opts.expiration || null, p_numero: opts.numero || null, p_note: opts.note || null });
/** Retirer une habilitation — tracé au journal. */
export const plieurRetirer = (centreId: string, plieurId: string, motif?: string) =>
  geste('plieur_retirer', { p_centre_id: centreId, p_plieur_id: plieurId, p_motif: motif || null });
