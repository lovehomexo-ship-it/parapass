import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════════════════════════
// ACADÉMIE — ce qui vient de la base, et rien en dur.
//
// Le lien vers le QCM officiel de la FFP et la mention « entraînement » sont
// des PARAMÈTRES : une adresse fédérale change, une formulation se précise, et
// cela ne doit pas demander un déploiement. Ils vivent dans
// `academie_parametres`.
//
// Les valeurs ci-dessous ne sont pas la vérité : ce sont des REPLIS, employés
// seulement si la lecture échoue. Un écran d'entraînement sans sa mention
// vaudrait mieux ne pas s'afficher du tout — mais un repli lisible vaut mieux
// qu'un blanc.
// ═══════════════════════════════════════════════════════════════════════════

export const QCM_OFFICIEL_REPLI = 'https://ffp.asso.fr/qcm/';

export const MENTION_ENTRAINEMENT_REPLI =
  'Questions d’entraînement — elles ne remplacent ni la formation ni le QCM '
  + 'officiel de la FFP. En cas de doute, réfère-toi à ton moniteur.';

export interface ParametresAcademie {
  qcmOfficielUrl: string;
  mentionEntrainement: string;
}

let cache: ParametresAcademie | null = null;

export function useParametresAcademie(): ParametresAcademie {
  const [params, setParams] = useState<ParametresAcademie>(
    cache ?? { qcmOfficielUrl: QCM_OFFICIEL_REPLI, mentionEntrainement: MENTION_ENTRAINEMENT_REPLI });

  useEffect(() => {
    if (cache) return;
    supabase.from('academie_parametres').select('cle, valeur').then(({ data, error }) => {
      if (error) { console.error('Chargement des paramètres Académie échoué :', error); return; }
      const m = Object.fromEntries((data ?? []).map(r => [r.cle, r.valeur]));
      cache = {
        qcmOfficielUrl: m.qcm_officiel_url || QCM_OFFICIEL_REPLI,
        mentionEntrainement: m.mention_entrainement || MENTION_ENTRAINEMENT_REPLI,
      };
      setParams(cache);
    });
  }, []);

  return params;
}

/** Les thèmes de révision, dans l'ordre où on les apprend. */
export const THEMES_ACADEMIE: { cle: string; libelle: string }[] = [
  { cle: 'securite', libelle: 'Sécurité' },
  { cle: 'materiel', libelle: 'Matériel' },
  { cle: 'procedures_dz', libelle: 'Procédures DZ' },
  { cle: 'pilotage', libelle: 'Pilotage sous voile' },
  { cle: 'pliage', libelle: 'Pliage' },
  { cle: 'meteo', libelle: 'Météo' },
  { cle: 'reglementation', libelle: 'Réglementation' },
];

export const LIBELLE_THEME = Object.fromEntries(
  THEMES_ACADEMIE.map(t => [t.cle, t.libelle])) as Record<string, string>;
