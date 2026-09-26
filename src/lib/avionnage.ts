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
  solo: 'Solo', accompagne: 'Accompagné', ecole: 'PAC',
  groupe: 'Groupe', wingsuit: 'Wingsuit', video: 'Vidéo',
};

/**
 * Libellé d'un type de place À BORD. Il couvre LIBELLE_TYPE et y ajoute le
 * largueur, qui n'est PAS un type de file : on ne s'inscrit pas en file comme
 * largueur, on est désigné par la DZ.
 */
export const LIBELLE_PLACE: Record<string, string> = {
  ...LIBELLE_TYPE, tandem: 'Tandem', largueur: 'Largueur',
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

// ═══════════════════════════════════════════════════════════════════════════
// VÉRIFICATION DE LA PLANCHE — ce qui empêche CET AVION de partir.
//
// Le Feu Vert répond « cette PERSONNE peut-elle sauter ? ». Il ne répond pas
// « cet AVION est-il prêt ? ». Un avion sans largueur, en surcharge, ou dont
// les rangs de sortie sont en doublon n'a aucun feu rouge à bord et n'est
// pourtant pas prêt. Ce sont deux questions, et il en manquait une.
//
// Fonction PURE : pas de React, pas de réseau, pas de date implicite. Elle ne
// lit que ce que la planche affiche déjà — elle n'invente aucune règle et ne
// va chercher aucune donnée de plus.
// ═══════════════════════════════════════════════════════════════════════════

export type GraviteAnomalie = 'bloquant' | 'vigilance';

export interface AnomaliePlanche {
  /** Stable, pour les tests et les clés React — jamais affiché. */
  code: string;
  gravite: GraviteAnomalie;
  /** Une phrase, à la deuxième personne : ce qu'il faut FAIRE. */
  message: string;
}

export interface EtatPlanche {
  anomalies: AnomaliePlanche[];
  /** rouge = quelque chose empêche ; orange = à regarder ; vert = rien à signaler. */
  verdict: 'rouge' | 'orange' | 'vert';
}

export interface EntreeVerification {
  largueurId: string | null;
  /** Responsable du stick à bord. DISTINCT du largueur. */
  chefAvionId: string | null;
  /** Le largueur désigné occupe-t-il une place ? Il pèse et il doit être vu. */
  largueurABord: boolean;
  heurePrevue: string | null;
  heureDecollage: string | null;
  cloturee: boolean;
  aeronefPlaces: number | null;
  /** Une entrée par place occupée. */
  places: {
    rangSortie: number | null;
    aptitude: 'vert' | 'orange' | 'rouge' | 'gris';
    typeSaut: string;
    /** Un passager de tandem : pas de licence, donc pas de verdict à compter. */
    passager: boolean;
    /** Ce tandem a-t-il son passager saisi ? */
    aSonPassager: boolean;
    masseKg: number | null;
  }[];
  /** Nombre de largueurs qualifiés dans le centre — 0 change le message. */
  largueursDisponibles: number;
  siegesOccupes: number;
}

export function verifierPlanche(e: EntreeVerification): EtatPlanche {
  const a: AnomaliePlanche[] = [];

  // Une planche close ne se vérifie plus : elle est partie, ou annulée. La
  // signaler tous les soirs en rouge n'apprendrait rien à personne.
  if (e.cloturee || e.heureDecollage) return { anomalies: [], verdict: 'vert' };

  if (e.places.length === 0) {
    a.push({ code: 'vide', gravite: 'vigilance', message: 'Personne à bord.' });
  }

  if (!e.largueurId) {
    a.push({
      code: 'largueur',
      gravite: 'bloquant',
      message: e.largueursDisponibles === 0
        ? 'Aucun largueur qualifié dans ce centre : la qualification se saisit dans la fiche du licencié.'
        : 'Désignez le largueur : un avion ne décolle pas sans lui.',
    });
  }

  // Un largueur désigné mais absent de la liste est un mensonge tranquille :
  // on croit l'avion pourvu, et personne ne voit ni sa masse ni son feu.
  if (e.largueurId && !e.largueurABord) {
    a.push({ code: 'largueur_absent', gravite: 'bloquant',
             message: 'Le largueur désigné n’est pas dans la liste des personnes à bord.' });
  }

  // LE CHEF AVION SUIT LE LARGUEUR. On avait fait deux rôles distincts ; sur
  // le terrain c'est la même personne, et deux désignations différentes sur un
  // seul avion se contredisent. La colonne chef_avion_id existe toujours —
  // l'histoire d'un avion parti ne se réécrit pas — mais elle n'est plus ni
  // choisie ni vérifiée à part.

  if (e.aeronefPlaces === null) {
    a.push({ code: 'aeronef', gravite: 'bloquant',
             message: 'Aucun aéronef affecté : la capacité ne peut pas être vérifiée.' });
  } else if (e.siegesOccupes > e.aeronefPlaces) {
    a.push({ code: 'surcharge', gravite: 'bloquant',
             message: `${e.siegesOccupes} places occupées pour ${e.aeronefPlaces} à bord : retirez quelqu’un.` });
  }

  // Le gris compte AVEC le rouge : ne pas savoir se traite comme un refus.
  // Le passager n'a pas de licence : il n'a pas de verdict, et n'entre donc
  // dans aucun décompte de conformité. L'y compter aurait mis tout l'avion au
  // rouge à cause de quelqu'un qu'aucune règle ne vise.
  const juges = e.places.filter(p => !p.passager);
  const refus = juges.filter(p => p.aptitude === 'rouge' || p.aptitude === 'gris').length;
  if (refus > 0) {
    a.push({ code: 'aptitude_refus', gravite: 'bloquant',
             message: `${refus} personne${refus > 1 ? 's' : ''} à bord ${refus > 1 ? 'sont' : 'est'} à examiner ou à vérifier.` });
  }
  const vigilance = juges.filter(p => p.aptitude === 'orange').length;
  if (vigilance > 0) {
    a.push({ code: 'aptitude_vigilance', gravite: 'vigilance',
             message: `${vigilance} personne${vigilance > 1 ? 's' : ''} à bord en vigilance.` });
  }

  // Un tandem sans passager n'est pas un tandem : il manque un siège et une
  // masse. On le dit avant le décollage, quand c'est encore réparable.
  const tandemsIncomplets = e.places.filter(p => p.typeSaut === 'tandem' && !p.passager && !p.aSonPassager).length;
  if (tandemsIncomplets > 0) {
    a.push({ code: 'tandem_sans_passager', gravite: 'vigilance',
             message: `${tandemsIncomplets} tandem${tandemsIncomplets > 1 ? 's' : ''} sans passager saisi : la masse embarquée est incomplète.` });
  }

  // Une masse manquante sur un passager est pire qu'ailleurs : personne ne
  // peut la deviner, il n'a pas de fiche.
  const passagersSansMasse = e.places.filter(p => p.passager && p.masseKg == null).length;
  if (passagersSansMasse > 0) {
    a.push({ code: 'passager_sans_masse', gravite: 'vigilance',
             message: `${passagersSansMasse} passager${passagersSansMasse > 1 ? 's' : ''} sans masse : elle se demande au comptoir, personne ne peut la deviner.` });
  }

  if (!e.heurePrevue) {
    a.push({ code: 'heure', gravite: 'vigilance',
             message: 'Heure de décollage non renseignée : personne ne peut s’y préparer.' });
  }

  // Deux sauteurs au même rang, c'est un ordre de sortie qui ne veut rien dire.
  // Le passager sort ATTACHÉ à son moniteur : il partage son rang, ce n'est
  // pas un doublon. Il n'entre donc pas dans le contrôle de l'ordre de sortie.
  const rangs = juges.map(p => p.rangSortie).filter((r): r is number => r !== null);
  const doublons = rangs.length - new Set(rangs).size;
  if (doublons > 0) {
    a.push({ code: 'rangs_doublon', gravite: 'vigilance',
             message: 'Deux personnes portent le même rang de sortie.' });
  }
  if (juges.length > 0 && rangs.length < juges.length) {
    a.push({ code: 'rangs_manquants', gravite: 'vigilance',
             message: 'Ordre de sortie incomplet.' });
  }

  return {
    anomalies: a,
    verdict: a.some(x => x.gravite === 'bloquant') ? 'rouge' : a.length > 0 ? 'orange' : 'vert',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LES GROUPES DANS L'AVION — repris des manifests professionnels, où un stick
// se lit par blocs : « FF n°1 », « PAC n°2 », « Tandem n°1 ».
//
// Un groupe n'est pas une commodité d'affichage : c'est ce qui sort ensemble.
// Deux personnes d'un même groupe quittent l'avion dans la même seconde, et
// le séparateur suivant attend qu'elles soient parties.
//
// La colonne places_rotation.groupe_id existait depuis l'origine et n'était
// LUE NULLE PART. Aucune migration ici : on se sert de ce qui est déjà là.
//
// Le libellé est DÉRIVÉ, jamais stocké : « PAC n°2 » est le deuxième groupe
// de PAC de cet avion. Le stocker aurait créé un nom à maintenir, et deux
// vérités le jour où un groupe change de discipline.
// ═══════════════════════════════════════════════════════════════════════════

export interface BlocPlanche<P> {
  /** null = personne seule, sans groupe. */
  groupeId: string | null;
  /** « PAC n°2 ». null pour les places isolées : elles n'ont pas de titre. */
  libelle: string | null;
  places: P[];
}

/**
 * Range les places en blocs, dans l'ordre de sortie.
 *
 * L'ordre d'un bloc est celui de son PREMIER sauteur : un groupe ne se
 * disperse pas dans la liste, sinon « sortir ensemble » ne veut plus rien dire.
 */
export function blocsDePlanche<P extends {
  groupe_id?: string | null; rang_sortie: number | null; type_saut: string;
}>(places: P[]): BlocPlanche<P>[] {
  const ordre = (p: P) => p.rang_sortie ?? Number.MAX_SAFE_INTEGER;

  const parGroupe = new Map<string, P[]>();
  const isolees: P[] = [];
  for (const p of places) {
    const g = p.groupe_id ?? null;
    if (g === null) { isolees.push(p); continue; }
    const liste = parGroupe.get(g) ?? [];
    liste.push(p);
    parGroupe.set(g, liste);
  }

  const blocs: BlocPlanche<P>[] = [
    ...[...parGroupe.entries()].map(([groupeId, ps]) => ({
      groupeId,
      libelle: null as string | null,
      places: [...ps].sort((a, b) => ordre(a) - ordre(b)),
    })),
    ...isolees.map(p => ({ groupeId: null, libelle: null as string | null, places: [p] })),
  ].sort((a, b) => ordre(a.places[0]) - ordre(b.places[0]));

  // La numérotation suit l'ordre de sortie : le premier groupe de PAC de
  // l'avion est « PAC n°1 », quel que soit son identifiant.
  const compteurs = new Map<string, number>();
  for (const b of blocs) {
    if (b.groupeId === null) continue;
    const type = b.places[0].type_saut;
    const n = (compteurs.get(type) ?? 0) + 1;
    compteurs.set(type, n);
    b.libelle = `${LIBELLE_TYPE[type as TypeSautFile] ?? type} n°${n}`;
  }
  return blocs;
}

// ═══════════════════════════════════════════════════════════════════════════
// LA MASSE EMBARQUÉE — un avion se remplit par la masse avant les sièges.
//
// Dix personnes légères passent là où huit lourdes ne passent pas. Les
// manifests professionnels affichent « 875 kg, 10/10 pax » : les deux
// chiffres, parce qu'aucun des deux ne suffit.
//
// LE TOTAL DIT CE QU'IL IGNORE. Un total calculé sur 6 masses connues et 4
// inconnues n'est pas « la masse de l'avion » : c'est un minimum. L'afficher
// sans le dire ferait croire à de la marge là où il n'y en a peut-être pas —
// et c'est exactement le genre de silence que P1 interdit.
// ═══════════════════════════════════════════════════════════════════════════

export interface MasseEmbarquee {
  /** Somme des masses CONNUES. Jamais « la masse totale ». */
  total: number;
  connues: number;
  inconnues: number;
  /** true quand tout le monde est pesé — seul cas où le total est un total. */
  complet: boolean;
}

export function masseEmbarquee(masses: (number | null | undefined)[]): MasseEmbarquee {
  let total = 0, connues = 0, inconnues = 0;
  for (const m of masses) {
    if (typeof m === 'number' && Number.isFinite(m) && m > 0) { total += m; connues++; }
    else inconnues++;
  }
  return {
    total: Math.round(total * 10) / 10,
    connues, inconnues,
    complet: inconnues === 0 && connues > 0,
  };
}

/**
 * Ce que la planche écrit à côté du nombre de sièges.
 *
 * Sans aucune masse connue, on ne dit RIEN plutôt que « 0 kg » : zéro est un
 * chiffre, et celui-là serait faux.
 */
export function libelleMasse(m: MasseEmbarquee, maxKg: number | null): string | null {
  if (m.connues === 0) return null;
  const base = `${m.total} kg`;
  const plafond = maxKg ? ` / ${maxKg} kg` : '';
  if (m.complet) return base + plafond;
  return `${base}${plafond} — ${m.inconnues} masse${m.inconnues > 1 ? 's' : ''} inconnue${m.inconnues > 1 ? 's' : ''}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIRE UNE LIGNE D'UN COUP D'ŒIL — la discipline, et la radio.
//
// Sur une planche, dix noms se ressemblent. Le chef d'avionnage doit voir
// SANS LIRE qui est en progression, qui part en tandem, qui est équipage.
//
// LES TEINTES DE DISCIPLINE NE SONT PAS DES ÉTATS. Elles ne réemploient
// aucune couleur de sévérité : un saut d'école n'est ni un danger ni une
// alerte. Elles portent un LIBELLÉ, jamais une couleur seule — sur un écran
// en plein soleil, et pour qui distingue mal les teintes, c'est le mot qui
// renseigne, la couleur ne fait que grouper.
// ═══════════════════════════════════════════════════════════════════════════

export const TEINTE_DISCIPLINE: Record<string, string> = {
  ecole:      '#A78BFA',   // violet — la progression
  accompagne: '#A78BFA',
  tandem:     '#2DD4BF',   // turquoise — le passager
  video:      '#38BDF8',   // ciel — l'image
  largueur:   '#94A3B8',   // ardoise — l'équipage, pas un sauteur
  groupe:     '#818CF8',   // indigo — on sort ensemble
  wingsuit:   '#818CF8',
  solo:       '#94A3B8',
};

/**
 * La radio est-elle ATTENDUE sur cette place ?
 *
 * Fondée sur la DISCIPLINE, pas sur un nombre de sauts : ParaPass ne connaît
 * aucun texte fédéral fixant un seuil, et P2 interdit d'en inventer un. Un
 * élève guidé au sol porte une radio parce que quelqu'un le guide — c'est un
 * fait d'exploitation, et l'écran le présente comme tel.
 *
 * Si la fédération fixe un seuil, il devra venir du référentiel, avec sa
 * référence, comme toutes les autres règles.
 */
export function radioAttendue(typeSaut: string): boolean {
  return typeSaut === 'ecole' || typeSaut === 'accompagne';
}
