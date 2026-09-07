import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════════════════════════
// AVIONNAGE — la file du jour, des deux côtés.
//
// Le parachutiste se met en file ; la DZ répartit dans les rotations. La file
// est une table à part de places_rotation : on se met en file AVANT de savoir
// dans quel avion on part, et la file survit à l'annulation d'un largage.
//
// Toute écriture passe par les RPC (migration 118) : les règles d'entrée —
// module ouvert, licencié actif, pas de doublon — ne s'expriment pas en RLS,
// et surtout une policy ne sait pas dire POURQUOI elle refuse.
// ═══════════════════════════════════════════════════════════════════════════

export type TypeSautFile = 'ecole' | 'accompagne' | 'solo' | 'groupe' | 'wingsuit' | 'video';

export const LIBELLE_TYPE: Record<TypeSautFile, string> = {
  solo: 'Solo', accompagne: 'Accompagné', ecole: 'École',
  groupe: 'Groupe', wingsuit: 'Wingsuit', video: 'Vidéo',
};

/** Une ligne de file, vue par la DZ. */
export interface LigneFile {
  id: string;
  parachutiste_id: string;
  prenom: string;
  nom: string;
  type_saut: TypeSautFile;
  commentaire: string | null;
  groupe_id: string | null;
  demande_le: string;
  position_file: number;
  /** Verdict FEU VERT — le même moteur que les planches et la fiche.
   *  'gris' = une donnée n'a pas pu être lue ; il se traite comme un refus. */
  statut_aptitude: 'vert' | 'orange' | 'rouge' | 'gris';
  motifs_bloquants: number;
  /** Se mettre en file sans s'être déclaré présent est un cas réel, pas une erreur. */
  present: boolean;
}

/** Un avion du jour, tel que le parachutiste peut le voir. */
export interface AvionDuJour {
  id: string;
  numero: number;
  heurePrevue: string | null;
  immat: string | null;
  decolle: boolean;
  /** Nul quand l'aéronef n'est pas affecté : on n'invente pas un plafond. */
  placesLibres: number | null;
}

/** Ce que le parachutiste voit de sa propre situation. */
export interface MaPlaceFile {
  /** Nul quand la personne n'est pas en file. */
  position: number | null;
  /** Nombre total de personnes en attente, pour situer sa position. */
  totalEnAttente: number;
  /** Renseigné dès que la DZ l'a placée dans une rotation. */
  rotationNumero: number | null;
  rotationHeure: string | null;
  aeronef: string | null;
  /** L'id de la rotation où il est placé, pour retrouver son call. */
  rotationId: string | null;
}

// ── Erreurs : les rendre lisibles, pas les avaler ──────────────────────────

/**
 * Les RPC lèvent des exceptions avec un message écrit POUR l'utilisateur et un
 * `hint` qui dit quoi faire. Les recoller ici évite l'écran qui affiche
 * « 42501 » à quelqu'un debout au bord de la piste.
 */
export function messageErreur(e: unknown): string {
  const err = e as { message?: string; hint?: string; details?: string } | null;
  if (!err) return 'Erreur inconnue.';
  const bouts = [err.message, err.hint].filter(Boolean) as string[];
  return bouts.length > 0 ? bouts.join(' ') : 'Erreur inconnue.';
}

// ── Côté PARACHUTISTE ──────────────────────────────────────────────────────

export function useMaFileAvionnage(centreId: string | undefined, userId: string | undefined) {
  const [ouvert, setOuvert] = useState(false);
  const [ma, setMa] = useState<MaPlaceFile>({
    position: null, totalEnAttente: 0, rotationNumero: null, rotationHeure: null,
    aeronef: null, rotationId: null,
  });
  // Les avions du jour. Sans eux, la carte ne répond pas à la seule question
  // que se pose un sauteur au sol : « le prochain avion part quand ? »
  const [avions, setAvions] = useState<AvionDuJour[]>([]);
  const [jour, setJour] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!centreId || !userId) { setChargement(false); return; }
    setErreur(null);

    const aujourdhui = new Date().toISOString().slice(0, 10);
    setJour(aujourdhui);
    const [{ data: centre }, { data: file }, { data: rot }] = await Promise.all([
      supabase.from('centres').select('avionnage_actif').eq('id', centreId).maybeSingle(),
      // La policy de lecture donne toute la file du centre : savoir combien de
      // monde attend devant soi est l'essentiel de l'information.
      supabase.from('file_avionnage')
        .select('id, parachutiste_id, demande_le, statut, place_rotation_id')
        .eq('centre_id', centreId)
        .eq('date_jour', new Date().toISOString().slice(0, 10))
        .in('statut', ['attente', 'placee'])
        .order('demande_le'),
      // Lisible par tout licencié actif (policy rotations_lecture_licencie).
      supabase.from('rotations')
        .select('id, numero, heure_prevue, heure_decollage, statut, aeronefs(immatriculation, places)')
        .eq('centre_id', centreId).eq('date_jour', aujourdhui)
        .neq('statut', 'annulee').order('numero'),
    ]);

    setOuvert(Boolean(centre?.avionnage_actif));

    // Le nombre de places occupées n'est pas lisible par un parachutiste
    // (places_rotation ne lui montre que la sienne) : on ne prétend donc pas
    // afficher un « il reste N places ». Mieux vaut ne rien dire que mentir.
    type Av = { immatriculation?: string; places?: number };
    setAvions(((rot ?? []) as unknown as {
      id: string; numero: number; heure_prevue: string | null;
      heure_decollage: string | null; statut: string; aeronefs: Av | Av[] | null;
    }[]).map(r => {
      const av = Array.isArray(r.aeronefs) ? r.aeronefs[0] : r.aeronefs;
      return {
        id: r.id, numero: r.numero, heurePrevue: r.heure_prevue,
        immat: av?.immatriculation ?? null,
        decolle: r.heure_decollage !== null || r.statut === 'terminee',
        placesLibres: null,
      };
    }));

    const lignes = file ?? [];
    const attente = lignes.filter(l => l.statut === 'attente');
    const moi = lignes.find(l => l.parachutiste_id === userId);
    const monRang = moi?.statut === 'attente'
      ? attente.findIndex(l => l.id === moi.id) + 1 : null;

    let rotationNumero: number | null = null;
    let rotationHeure: string | null = null;
    let aeronef: string | null = null;
    let rotationId: string | null = null;

    if (moi?.statut === 'placee' && moi.place_rotation_id) {
      // Deux lectures plutôt qu'une jointure imbriquée : les policies de
      // places_rotation et rotations sont distinctes, et une jointure qui
      // échoue silencieusement sur l'une des deux rendrait « aucune place »
      // à quelqu'un qui EST embarqué.
      const { data: place } = await supabase.from('places_rotation')
        .select('rotation_id').eq('id', moi.place_rotation_id).maybeSingle();
      rotationId = place?.rotation_id ?? null;
      if (place?.rotation_id) {
        const { data: rot } = await supabase.from('rotations')
          .select('numero, heure_prevue, aeronefs(immatriculation)')
          .eq('id', place.rotation_id).maybeSingle();
        rotationNumero = rot?.numero ?? null;
        rotationHeure = rot?.heure_prevue ?? null;
        const av = rot?.aeronefs as { immatriculation?: string } | { immatriculation?: string }[] | null;
        aeronef = (Array.isArray(av) ? av[0]?.immatriculation : av?.immatriculation) ?? null;
      }
    }

    setMa({
      position: monRang && monRang > 0 ? monRang : null,
      totalEnAttente: attente.length,
      rotationNumero, rotationHeure, aeronef, rotationId,
    });
    setChargement(false);
  }, [centreId, userId]);

  useEffect(() => { charger(); }, [charger]);

  // Temps réel : la file bouge sans cesse un jour de beau temps. Sans ça, le
  // sauteur regarde une position périmée et rate son avion.
  useEffect(() => {
    if (!centreId) return;
    const canal = supabase.channel(`file-avionnage-${centreId}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'file_avionnage', filter: `centre_id=eq.${centreId}` },
          () => charger())
      // Un décollage ou un changement d'heure change le call affiché.
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'rotations', filter: `centre_id=eq.${centreId}` },
          () => charger())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [centreId, charger]);

  const rejoindre = async (type: TypeSautFile, commentaire?: string) => {
    const { error } = await supabase.rpc('rejoindre_file_avionnage', {
      p_centre_id: centreId, p_type_saut: type, p_commentaire: commentaire ?? null,
    });
    if (error) { setErreur(messageErreur(error)); return false; }
    await charger();
    return true;
  };

  const quitter = async () => {
    const { error } = await supabase.rpc('quitter_file_avionnage', { p_centre_id: centreId });
    if (error) { setErreur(messageErreur(error)); return false; }
    await charger();
    return true;
  };

  return { ouvert, ma, avions, jour, chargement, erreur, rejoindre, quitter, recharger: charger };
}

// ── Côté DZ ────────────────────────────────────────────────────────────────

export function useFileDZ(centreId: string | undefined) {
  const [file, setFile] = useState<LigneFile[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!centreId) { setChargement(false); return; }
    const { data, error } = await supabase.rpc('get_file_avionnage', { p_centre_id: centreId });
    if (error) {
      console.error('File d’avionnage — lecture échouée :', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      setErreur(messageErreur(error)); setChargement(false); return;
    }
    setFile((data ?? []) as LigneFile[]);
    setErreur(null);
    setChargement(false);
  }, [centreId]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (!centreId) return;
    const canal = supabase.channel(`file-dz-${centreId}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'file_avionnage', filter: `centre_id=eq.${centreId}` },
          () => charger())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [centreId, charger]);

  return { file, chargement, erreur, recharger: charger };
}

// ── Capacité ───────────────────────────────────────────────────────────────

/**
 * Sièges occupés d'une rotation. Un moniteur qui accompagne occupe un siège :
 * l'oublier ferait afficher « 3/4 » à un avion plein.
 *
 * Le plafond est appliqué par la BASE (trigger, migration 117) ; ce calcul ne
 * sert qu'à l'AFFICHER. Ne jamais s'en servir pour autoriser ou refuser :
 * deux clics simultanés passeraient tous les deux.
 */
export function siegesOccupes(
  places: readonly { moniteur_id?: string | null }[],
): number {
  return places.length + places.filter(p => p.moniteur_id).length;
}

export function libelleCapacite(occupes: number, total: number | null): string {
  if (total === null) return `${occupes} inscrit${occupes > 1 ? 's' : ''} · aéronef non renseigné`;
  const restant = total - occupes;
  if (restant <= 0) return `${occupes}/${total} — complet`;
  return `${occupes}/${total} · ${restant} place${restant > 1 ? 's' : ''} libre${restant > 1 ? 's' : ''}`;
}

// ── Le « call » ────────────────────────────────────────────────────────────
// Convention reprise des manifests professionnels (Burble DZM et consorts) :
// une planche n'est pas « à 14 h 30 », elle est « à 20 minutes ». Le chef
// d'avionnage et les sauteurs raisonnent en temps restant, pas en heure
// absolue — c'est le décompte qui déclenche l'habillage et le rassemblement.

export type UrgenceCall = 'lointain' | 'call' | 'imminent' | 'retard' | 'parti';

export interface Call {
  /** Minutes avant décollage. Négatif = l'heure est passée. Nul si non planifié. */
  minutes: number | null;
  libelle: string;
  urgence: UrgenceCall;
}

/**
 * @example  calculerCall('2026-09-04', '14:30:00', new Date('2026-09-04T14:15:00'))
 *           // → { minutes: 15, libelle: 'call 15 min', urgence: 'call' }
 */
export function calculerCall(
  dateJour: string,
  heurePrevue: string | null,
  decolle: string | null,
  maintenant: Date = new Date(),
): Call {
  if (decolle) return { minutes: null, libelle: 'décollé', urgence: 'parti' };
  if (!heurePrevue) {
    // Pas d'heure = pas de call. Afficher « 0 min » serait un chiffre inventé.
    return { minutes: null, libelle: 'heure non fixée', urgence: 'lointain' };
  }

  const cible = new Date(`${dateJour}T${heurePrevue.slice(0, 8)}`);
  if (Number.isNaN(cible.getTime())) {
    return { minutes: null, libelle: 'heure non fixée', urgence: 'lointain' };
  }

  const minutes = Math.round((cible.getTime() - maintenant.getTime()) / 60000);

  if (minutes < 0) {
    return { minutes, libelle: `en retard de ${-minutes} min`, urgence: 'retard' };
  }
  // 5 minutes ou moins : on ne « call » plus, on embarque.
  if (minutes <= 5) {
    return { minutes, libelle: minutes === 0 ? 'embarquement' : `embarquement dans ${minutes} min`,
             urgence: 'imminent' };
  }
  if (minutes <= 20) return { minutes, libelle: `call ${minutes} min`, urgence: 'call' };
  return { minutes, libelle: `décollage ${heurePrevue.slice(0, 5)}`, urgence: 'lointain' };
}

/** La gravité d'un call, pour la rayure de bord (règle 5 : la forme d'abord). */
export const SEVERITE_CALL: Record<UrgenceCall, 'critique' | 'vigilance' | 'conforme' | 'neutre'> = {
  retard: 'critique', imminent: 'critique', call: 'vigilance',
  parti: 'conforme', lointain: 'neutre',
};

/**
 * « en retard de 501 min » est exact et illisible. Au-delà de deux heures, le
 * chef d'avionnage lit des heures — et un retard de plus d'une journée veut
 * dire que la planche a été oubliée, pas qu'elle décolle bientôt.
 *
 * @example  formaterRetard('en retard de 501 min')  // 'en retard de 8 h 21'
 */
export function formaterRetard(libelle: string): string {
  const m = libelle.match(/^en retard de (\d+) min$/);
  if (!m) return libelle;
  const min = Number(m[1]);
  if (min < 120) return libelle;
  if (min >= 1440) return 'planche non décollée — à clôturer ou annuler';
  return `en retard de ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
