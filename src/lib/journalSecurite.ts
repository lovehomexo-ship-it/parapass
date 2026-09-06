import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════════════════════════
// FEU VERT · P4 — Vérifier la chaîne, exporter le journal.
//
// La vérification est PURE et n'a besoin que des lignes exportées : un tiers
// qui reçoit le fichier JSON peut la refaire avec ce module, ou avec dix
// lignes dans n'importe quel langage. C'est la note incluse dans l'export.
//
// On ne re-sérialise JAMAIS la charge ni la date : la base a stocké leurs
// formes canoniques (charge_canonique, horodatage_canonique) à côté du hash.
// Re-hacher ces textes tels quels est la seule façon d'obtenir un résultat
// qui ne dépende ni de Postgres, ni de JavaScript, ni de l'ordre des clés.
// ═══════════════════════════════════════════════════════════════════════════

export interface EntreeJournal {
  id: string;
  seq: number;
  centre_id: string;
  type_evenement: string;
  horodatage_canonique: string;
  charge_canonique: string;
  charge_utile: unknown;
  hash_precedent: string | null;
  hash: string;
}

export interface ResultatVerification {
  valide: boolean;
  premiereRuptureId?: string;
  entrees: number;
}

/** La forme canonique — la même, au caractère près, que dans le trigger SQL. */
export function chaineCanonique(e: Pick<EntreeJournal,
  'hash_precedent' | 'centre_id' | 'horodatage_canonique' | 'type_evenement' | 'charge_canonique'>): string {
  return `${e.hash_precedent ?? ''}|${e.centre_id}|${e.horodatage_canonique}|${e.type_evenement}|${e.charge_canonique}`;
}

export async function sha256Hex(texte: string): Promise<string> {
  const octets = new TextEncoder().encode(texte);
  const empreinte = await crypto.subtle.digest('SHA-256', octets);
  return Array.from(new Uint8Array(empreinte)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Recalcule toute la chaîne et s'arrête à la PREMIÈRE rupture.
 * Pure : ne lit rien d'autre que ce qu'on lui donne. Les entrées doivent
 * être celles d'un seul centre, dans l'ordre de `seq`.
 */
export async function verifierChaine(entrees: readonly EntreeJournal[]): Promise<ResultatVerification> {
  const triees = [...entrees].sort((a, b) => a.seq - b.seq);
  let precedent: string | null = null;
  let premiere = true;
  for (const e of triees) {
    // Sur une fenêtre partielle, la première entrée n'a pas de précédente
    // vérifiable : on part de son hash_precedent, puis on enchaîne.
    if (premiere) { precedent = e.hash_precedent; premiere = false; }
    if ((e.hash_precedent ?? null) !== precedent) {
      return { valide: false, premiereRuptureId: e.id, entrees: triees.length };
    }
    const attendu = await sha256Hex(chaineCanonique(e));
    if (attendu !== e.hash) {
      return { valide: false, premiereRuptureId: e.id, entrees: triees.length };
    }
    precedent = e.hash;
  }
  return { valide: true, entrees: triees.length };
}

// ── L'export ───────────────────────────────────────────────────────────────

export interface ExportJournal {
  format: 'parapass-journal-securite/1';
  centre_id: string;
  periode: { debut: string; fin: string };
  exporte_le: string;
  entrees: EntreeJournal[];
  verification: ResultatVerification & { verifiee_par: 'client' | 'serveur+client' };
  methode_de_verification: string;
}

export const METHODE_DE_VERIFICATION = `Chaque entrée porte hash = SHA-256 (hexadécimal) de la chaîne UTF-8 :
  hash_precedent | centre_id | horodatage_canonique | type_evenement | charge_canonique
avec « | » comme séparateur et hash_precedent remplacé par une chaîne vide pour la
première entrée du centre. hash_precedent de chaque entrée doit être égal au hash de
l'entrée précédente (ordre : seq croissant). Les champs horodatage_canonique et
charge_canonique sont fournis tels que stockés : ne les reformatez pas et
ne re-sérialisez pas charge_utile — hachez les textes fournis. Toute entrée modifiée, supprimée ou
insérée après coup rompt la chaîne à partir d'elle. Ce fichier a été produit par le
centre lui-même ; ParaPass ne l'a transmis à personne.`;

/**
 * Déclenché par le centre, jamais automatiquement, et envoyé à personne :
 * la fonction rend un objet, l'appelant décide d'en faire un fichier.
 */
export async function exporterJournal(centreId: string, debut: string, fin: string): Promise<ExportJournal> {
  const [{ data, error }, { data: verifServeur, error: e2 }] = await Promise.all([
    supabase.from('journal_securite')
      .select('id, seq, centre_id, type_evenement, horodatage_canonique, charge_canonique, charge_utile, hash_precedent, hash')
      .eq('centre_id', centreId)
      .gte('horodatage_serveur', debut).lte('horodatage_serveur', fin)
      .order('seq'),
    supabase.rpc('verifier_chaine', { p_centre_id: centreId, p_debut: debut, p_fin: fin }),
  ]);
  if (error) throw new Error(`Export du journal impossible : ${error.message}`);

  const entrees = (data ?? []) as EntreeJournal[];
  // Deux vérifications indépendantes : celle du serveur, et la nôtre sur les
  // lignes reçues. Si elles divergent, c'est le transport qui a menti.
  const local = await verifierChaine(entrees);
  const serveur = !e2 && Array.isArray(verifServeur) && verifServeur[0]
    ? (verifServeur[0] as { valide: boolean; premiere_rupture_id: string | null }) : null;
  const valide = local.valide && (serveur ? serveur.valide : true);

  const exportObj: ExportJournal = {
    format: 'parapass-journal-securite/1',
    centre_id: centreId,
    periode: { debut, fin },
    exporte_le: new Date().toISOString(),
    entrees,
    verification: {
      valide,
      premiereRuptureId: local.premiereRuptureId ?? serveur?.premiere_rupture_id ?? undefined,
      entrees: entrees.length,
      verifiee_par: serveur ? 'serveur+client' : 'client',
    },
    methode_de_verification: METHODE_DE_VERIFICATION,
  };

  // L'export est lui-même un événement du journal : on sait qui a exporté
  // quoi, et quand. Il est écrit APRÈS la lecture, donc hors de la fenêtre
  // exportée — il ne peut pas invalider ce qu'il décrit.
  const { error: e3 } = await supabase.rpc('journaliser', {
    p_centre_id: centreId, p_type: 'export_produit',
    p_charge: { debut, fin, entrees: entrees.length, valide },
  });
  if (e3) console.error('Journalisation de l’export échouée :', e3);

  return exportObj;
}
