import type { Verdict } from './feuVert';

// ═══════════════════════════════════════════════════════════════════════════
// FEU VERT · P5 — Le geste d'embarquement, en logique pure.
//
// Ce qui se teste sans caméra ni base : lire un QR, décider ce que l'écran
// fait d'un verdict. La règle absolue du régime informatif : le système
// n'empêche rien, il constate. Le mot « bloqué » n'existe donc pas ici, et un
// test le vérifie — en régime informatif, ce serait un mensonge.
// ═══════════════════════════════════════════════════════════════════════════

export type LectureQr = { valeur: string; forme: 'token' | 'id' } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Le QR de la licence encode https://parapass.fr/verify/<token|id>. On accepte
 * aussi la valeur nue, pour la saisie manuelle quand la caméra est morte.
 * Tout le reste — un QR de sac, un lien quelconque — est refusé : null.
 */
export function interpreterQr(brut: string): LectureQr {
  const t = brut.trim();
  if (!t) return null;
  let valeur = t;
  const m = t.match(/\/verify\/([^/?#\s]+)/i);
  if (m) valeur = decodeURIComponent(m[1]);
  else if (/^https?:\/\//i.test(t)) return null;   // une URL, mais pas la nôtre
  if (UUID.test(valeur)) return { valeur: valeur.toLowerCase(), forme: 'id' };
  if (/^[A-Za-z0-9_-]{8,}$/.test(valeur)) return { valeur, forme: 'token' };
  return null;
}

export type Regime = 'informatif' | 'bloquant';

export interface ActionEmbarquement {
  cle: 'lever' | 'refuser' | 'prevenir_dt' | 'consigner_et_laisser';
  libelle: string;
  /** Un motif écrit non vide est exigé AVANT que l'action n'écrive quoi que ce soit. */
  motifObligatoire: boolean;
  /** Habilitation demandée pour signer. */
  habilitation: 'DT' | 'moniteur' | 'plieur' | 'aucun';
  rang: 'principal' | 'secondaire';
}

export interface Comportement {
  /** Vert : rien à lire, rien à toucher — retour au scan tout seul. */
  retourAutomatiqueMs: number | null;
  titre: string;
  /** Ce que l'écran doit dire de vrai sur ce qu'il fait. */
  sousTitre: string;
  actions: ActionEmbarquement[];
}

/**
 * Le régime informatif ne bloque rien ; il le dit. Le gris se traite
 * exactement comme le rouge (P1), avec un mot qui dit la vraie cause.
 */
export function comportement(verdict: Verdict, regime: Regime = 'informatif'): Comportement {
  switch (verdict) {
    case 'vert':
      return { retourAutomatiqueMs: 1500, titre: 'Peut embarquer', sousTitre: 'Retour au scan…', actions: [] };
    case 'orange':
      return {
        retourAutomatiqueMs: null, titre: 'Vigilance', sousTitre: 'À traiter avant l’embarquement.',
        actions: [
          { cle: 'lever', libelle: 'Lever', motifObligatoire: true, habilitation: 'DT', rang: 'principal' },
          { cle: 'refuser', libelle: 'Refuser', motifObligatoire: true, habilitation: 'aucun', rang: 'secondaire' },
        ],
      };
    case 'rouge':
    case 'gris': {
      const cause = verdict === 'gris' ? 'Donnée indisponible' : 'Non conforme';
      return {
        retourAutomatiqueMs: null, titre: cause,
        // La vérité du régime : on constate, on n'empêche pas.
        sousTitre: regime === 'informatif'
          ? 'Le système n’empêche rien : il constate et consigne.'
          : 'Le régime bloquant est actif : cette personne ne peut pas être manifestée.',
        actions: regime === 'informatif'
          ? [
              { cle: 'prevenir_dt', libelle: 'Prévenir le DT', motifObligatoire: false, habilitation: 'aucun', rang: 'principal' },
              { cle: 'consigner_et_laisser', libelle: 'Consigner et laisser monter',
                motifObligatoire: true, habilitation: 'DT', rang: 'secondaire' },
            ]
          : [
              { cle: 'prevenir_dt', libelle: 'Prévenir le DT', motifObligatoire: false, habilitation: 'aucun', rang: 'principal' },
            ],
      };
    }
  }
}

/** Le motif d'un franchissement : au moins trois caractères utiles. Comme en base. */
export function motifRecevable(motif: string): boolean {
  return motif.trim().length >= 3;
}
