import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { ymdLocal } from './datetime';

// ═══════════════════════════════════════════════════════════════════════════
// F01 — SOURCE UNIQUE de l'acquittement du briefing.
//
// Trois calculs coexistaient sur la même page, avec trois résultats :
//   1. BriefingRecap    — dénominateur = licenciés du centre (29), et surtout
//      il comptait les acquittements de TOUTES les révisions confondues.
//   2. SuiviAcquittements — dénominateur = présents du jour (4).
//   3. presence.ts      — troisième lecture, pour le badge de chaque ligne.
//
// Le périmètre de référence est « les parachutistes PRÉSENTS ce jour sur le
// centre », jamais les licenciés du centre. Le mot « présents » est obligatoire
// dans tout libellé produit à partir de ce hook : c'est lui qui nomme le
// périmètre, et son absence est précisément ce qui rendait les trois chiffres
// incomparables.
//
// La révision COURANTE seule fait foi (P8) : un acquittement sur une version
// antérieure ne compte pas.
// ═══════════════════════════════════════════════════════════════════════════

export interface PersonneManquante {
  parachutiste_id: string;
  nom: string;
  prenom: string;
  /** A lu une version antérieure : la relance n'est pas la même. */
  acquitte_revision_anterieure: boolean;
}

export interface AcquittementJour {
  /** Aucun briefing publié ce jour : aucun ratio n'a de sens. */
  publie: boolean;
  publieA: Date | null;
  revision: number | null;
  presents: number;
  acquittes: number;
  manquants: PersonneManquante[];
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/** Libellé imposé — « présents » nomme le périmètre, il ne se retire pas. */
export function libelleAck(a: Pick<AcquittementJour, 'acquittes' | 'presents'>): string {
  return `Briefing acquitté par ${a.acquittes} des ${a.presents} présents`;
}

// Nommé useAcquittementJour et non useBriefingAck : ce dernier existe déjà
// dans lib/briefing.ts pour l'acquittement PERSONNEL d'un parachutiste. Deux
// hooks homonymes de sens différents auraient recréé la confusion que ce lot
// supprime.
export function useAcquittementJour(centreId: string | undefined, date?: string): AcquittementJour {
  const jour = date ?? ymdLocal(new Date());
  const [etat, setEtat] = useState<Omit<AcquittementJour, 'recharger'>>({
    publie: false, publieA: null, revision: null,
    presents: 0, acquittes: 0, manquants: [],
    chargement: true, erreur: null,
  });

  const charger = useCallback(async () => {
    if (!centreId) { setEtat(e => ({ ...e, chargement: false })); return; }
    setEtat(e => ({ ...e, chargement: true, erreur: null }));

    const [{ data: brief, error: eB }, { count, error: eP }] = await Promise.all([
      supabase.from('dz_briefings').select('id, revision, published_at')
        .eq('dz_id', centreId).eq('date_briefing', jour)
        .not('published_at', 'is', null)
        .order('revision', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('dz_presences').select('*', { count: 'exact', head: true })
        .eq('dz_id', centreId).eq('date_presence', jour),
    ]);

    if (eB || eP) {
      const e = eB ?? eP!;
      console.error('Acquittement du briefing — chargement échoué :', {
        code: e.code, message: e.message, details: e.details, hint: e.hint,
      });
      setEtat(s => ({ ...s, chargement: false, erreur: e.message }));
      return;
    }

    if (!brief) {
      setEtat({ publie: false, publieA: null, revision: null, presents: count ?? 0,
        acquittes: 0, manquants: [], chargement: false, erreur: null });
      return;
    }

    const { data: manquants, error: eM } = await supabase.rpc('get_non_acquittes', {
      p_centre_id: centreId, p_date: jour,
    });
    if (eM) {
      console.error('Acquittement du briefing — non-acquittés :', {
        code: eM.code, message: eM.message, details: eM.details, hint: eM.hint,
      });
      setEtat(s => ({ ...s, chargement: false, erreur: eM.message }));
      return;
    }

    const liste = (manquants ?? []) as PersonneManquante[];
    const presents = count ?? 0;
    setEtat({
      publie: true,
      publieA: brief.published_at ? new Date(brief.published_at) : null,
      revision: brief.revision ?? 1,
      presents,
      acquittes: Math.max(0, presents - liste.length),
      manquants: liste,
      chargement: false,
      erreur: null,
    });
  }, [centreId, jour]);

  useEffect(() => { charger(); }, [charger]);

  return { ...etat, recharger: charger };
}
