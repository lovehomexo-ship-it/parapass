import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════════════════════════
// FEU VERT · P3 — Le moteur d'évaluation. Aucune interface, aucun React.
//
// Ce module ne connaît AUCUN code de règle. Il reçoit les règles en vigueur
// (regles_en_vigueur) et les faits (faits_conformite), et il rend un verdict.
// Les codes n'apparaissent que dans les tests — c'est le critère P2.3.
//
// Il ne connaît pas non plus le RÉGIME (informatif / bloquant). Il rend un
// verdict, point ; l'appelant décide de ce qu'il en fait. C'est cette
// séparation qui permettra d'ajouter le blocage en version 2 sans le toucher.
//
// P1, FAIL-SAFE, au cœur du calcul : une règle en vigueur sans fait lisible
// est GRISE. Grise, pas verte. Et le gris est un rouge partout en aval.
// ═══════════════════════════════════════════════════════════════════════════

export type Verdict = 'vert' | 'orange' | 'rouge' | 'gris';
/**
 * 'sans_objet' : la règle ne s'applique pas à CE saut (la qualification
 * wingsuit pour un solo, le casque pour un breveté). Elle ne compte NI comme
 * conforme NI comme gris — sinon un verdict vert laisserait croire à dix
 * contrôles passés là où sept n'ont rien contrôlé. Mesuré sur BigAir : 5
 * règles contrôlent vraiment, 3 sont sans objet.
 */
export type EtatFait = 'conforme' | 'non_conforme' | 'indisponible' | 'sans_objet';
export type Gravite = 'bloquant' | 'vigilance';

export interface RegleEnVigueur {
  code: string;
  version: number;
  libelle: string;
  source_texte: string;
  gravite: Gravite;
  portee: 'individu' | 'rotation' | 'centre';
  levable: boolean;
  habilitation_levee: 'DT' | 'moniteur' | 'plieur' | 'aucun';
  duree_levee: 'une_rotation' | 'la_journee' | 'jusqu_a_regularisation' | null;
}

export interface Fait {
  code: string;
  etat: EtatFait;
  detail: string | null;
}

export interface Contexte {
  /** ISO yyyy-mm-dd. */
  date: string;
  typeSaut: string;
  rotationId?: string;
}

export interface Motif {
  codeRegle: string;
  versionRegle: number;
  /** 'indisponible' : la donnée n'a pas pu être lue. C'est un motif à part
   *  entière — le DT doit voir POURQUOI c'est gris. */
  gravite: Gravite | 'indisponible';
  libelle: string;
  /** Le texte fédéral, cité tel quel. C'est lui que le système oppose. */
  source: string;
  detail: string;
}

export interface Evaluation {
  verdict: Verdict;
  motifs: Motif[];
  /** Règles ayant réellement contrôlé quelque chose — conformes ou non.
   *  C'est la COUVERTURE : le seul chiffre qui dit ce que vaut un vert. */
  reglesControlees: number;
  /** Règles qui ne s'appliquaient pas à ce saut. */
  reglesSansObjet: number;
  /** Empreinte des (code, version) en vigueur : deux évaluations ne se
   *  comparent que si elles ont été rendues sous le même référentiel. */
  versionReferentiel: string;
  evalueLe: Date;
}

/**
 * Empreinte déterministe du référentiel. Triée : l'ordre de lecture en base
 * ne doit pas produire deux versions pour le même contenu.
 */
export function versionReferentiel(regles: readonly RegleEnVigueur[]): string {
  return regles
    .map(r => `${r.code}@${r.version}`)
    .sort()
    .join(',');
}

/**
 * LE moteur. Pur : mêmes entrées, même sortie. `maintenant` est injecté pour
 * que deux évaluations au même instant soient strictement identiques.
 *
 * Priorité des verdicts, et pourquoi dans cet ordre :
 *   rouge  — un bloquant CONFIRMÉ, avec son texte : la déclaration la plus
 *            forte et la plus opposable. Elle prime sur l'incertitude.
 *   gris   — au moins une donnée nécessaire n'a pas pu être lue. Traité
 *            comme un rouge en aval, mais nommé différemment : on ne dit pas
 *            à quelqu'un qu'il est non conforme quand on ne sait pas.
 *   orange — vigilance confirmée, rien de bloquant, rien d'inconnu.
 *   vert   — tout lu, tout conforme.
 */
export function evaluer(
  regles: readonly RegleEnVigueur[],
  faits: readonly Fait[],
  _contexte: Contexte,
  maintenant: Date = new Date(),
): Evaluation {
  // Les règles de portée rotation ou centre ne produisent JAMAIS de motif
  // individuel : elles s'évaluent sur la rotation (ENC-001), pas sur la personne.
  const individuelles = regles.filter(r => r.portee === 'individu');
  const parCode = new Map(faits.map(f => [f.code, f]));

  const motifs: Motif[] = [];
  let controlees = 0;
  let sansObjet = 0;
  for (const r of individuelles) {
    const f = parCode.get(r.code);
    // Sans objet : on passe, sans compter la règle dans la couverture.
    if (f?.etat === 'sans_objet') { sansObjet++; continue; }
    // P1 : pas de fait, ou fait indisponible → motif « indisponible ».
    // Jamais « conforme par défaut ».
    if (!f || f.etat === 'indisponible') {
      motifs.push({
        codeRegle: r.code, versionRegle: r.version, gravite: 'indisponible',
        libelle: r.libelle, source: r.source_texte,
        detail: f?.detail ?? 'donnée indisponible : aucun fait lisible pour cette règle',
      });
      continue;
    }
    controlees++;
    if (f.etat === 'non_conforme') {
      motifs.push({
        codeRegle: r.code, versionRegle: r.version, gravite: r.gravite,
        libelle: r.libelle, source: r.source_texte, detail: f.detail ?? '',
      });
    }
  }

  const aBloquant   = motifs.some(m => m.gravite === 'bloquant');
  const aIndispo    = motifs.some(m => m.gravite === 'indisponible');
  const aVigilance  = motifs.some(m => m.gravite === 'vigilance');
  const verdict: Verdict = aBloquant ? 'rouge' : aIndispo ? 'gris' : aVigilance ? 'orange' : 'vert';

  // Ordre de lecture : ce qui bloque, puis ce qu'on ignore, puis le reste ;
  // à gravité égale, par code — pour que deux évaluations identiques
  // rendent des motifs dans le même ordre (stabilité).
  const rang: Record<Motif['gravite'], number> = { bloquant: 0, indisponible: 1, vigilance: 2 };
  motifs.sort((a, b) => rang[a.gravite] - rang[b.gravite] || a.codeRegle.localeCompare(b.codeRegle));

  return { verdict, motifs, reglesControlees: controlees, reglesSansObjet: sansObjet,
           versionReferentiel: versionReferentiel(regles), evalueLe: maintenant };
}

/**
 * Le gris est un rouge partout en aval. Cette fonction est LE point où l'aval
 * pose la question, pour qu'aucun écran n'ait à se souvenir de la règle.
 */
export function estRefus(v: Verdict): boolean {
  return v === 'rouge' || v === 'gris';
}

// ── L'enveloppe qui lit la base — la seule partie non pure ─────────────────

/**
 * Signature demandée : evaluerConformite(parachutisteId, centreId, contexte).
 * Va chercher les règles et les faits, puis délègue tout le calcul à
 * evaluer(). Une lecture qui échoue ne rend PAS une évaluation vide et verte :
 * elle rend un GRIS avec le motif de l'échec (P1 — une panne n'est jamais une
 * autorisation).
 */
export async function evaluerConformite(
  parachutisteId: string,
  centreId: string,
  contexte: Contexte,
): Promise<Evaluation> {
  const [{ data: regles, error: e1 }, { data: faits, error: e2 }] = await Promise.all([
    supabase.rpc('regles_en_vigueur', { p_centre_id: centreId }),
    supabase.rpc('faits_conformite', {
      p_parachutiste_id: parachutisteId, p_centre_id: centreId,
      p_date: contexte.date, p_type_saut: contexte.typeSaut,
    }),
  ]);

  if (e1 || e2 || !regles) {
    const e = e1 ?? e2;
    console.error('Feu Vert — lecture impossible :', {
      code: e?.code, message: e?.message, details: e?.details, hint: e?.hint,
    });
    return {
      verdict: 'gris',
      motifs: [{
        codeRegle: '—', versionRegle: 0, gravite: 'indisponible',
        libelle: 'Évaluation impossible', source: '',
        detail: `lecture des ${e1 ? 'règles' : 'faits'} en échec : ${e?.message ?? 'erreur inconnue'}`,
      }],
      reglesControlees: 0, reglesSansObjet: 0,
      versionReferentiel: '',
      evalueLe: new Date(),
    };
  }

  return evaluer(regles as RegleEnVigueur[], (faits ?? []) as Fait[], contexte);
}
