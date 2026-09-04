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
  /** Issu de get_aptitude_du_jour — jamais recalculé ici. */
  statut_aptitude: 'vert' | 'orange' | 'rouge' | 'inconnu';
  motifs_bloquants: number;
  /** Se mettre en file sans s'être déclaré présent est un cas réel, pas une erreur. */
  present: boolean;
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
    position: null, totalEnAttente: 0, rotationNumero: null, rotationHeure: null, aeronef: null,
  });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!centreId || !userId) { setChargement(false); return; }
    setErreur(null);

    const [{ data: centre }, { data: file }] = await Promise.all([
      supabase.from('centres').select('avionnage_actif').eq('id', centreId).maybeSingle(),
      // La policy de lecture donne toute la file du centre : savoir combien de
      // monde attend devant soi est l'essentiel de l'information.
      supabase.from('file_avionnage')
        .select('id, parachutiste_id, demande_le, statut, place_rotation_id')
        .eq('centre_id', centreId)
        .eq('date_jour', new Date().toISOString().slice(0, 10))
        .in('statut', ['attente', 'placee'])
        .order('demande_le'),
    ]);

    setOuvert(Boolean(centre?.avionnage_actif));

    const lignes = file ?? [];
    const attente = lignes.filter(l => l.statut === 'attente');
    const moi = lignes.find(l => l.parachutiste_id === userId);
    const monRang = moi?.statut === 'attente'
      ? attente.findIndex(l => l.id === moi.id) + 1 : null;

    let rotationNumero: number | null = null;
    let rotationHeure: string | null = null;
    let aeronef: string | null = null;

    if (moi?.statut === 'placee' && moi.place_rotation_id) {
      // Deux lectures plutôt qu'une jointure imbriquée : les policies de
      // places_rotation et rotations sont distinctes, et une jointure qui
      // échoue silencieusement sur l'une des deux rendrait « aucune place »
      // à quelqu'un qui EST embarqué.
      const { data: place } = await supabase.from('places_rotation')
        .select('rotation_id').eq('id', moi.place_rotation_id).maybeSingle();
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
      rotationNumero, rotationHeure, aeronef,
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

  return { ouvert, ma, chargement, erreur, rejoindre, quitter, recharger: charger };
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
