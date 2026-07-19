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
