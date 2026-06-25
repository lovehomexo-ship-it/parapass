/*
  # Sophie Martin — Données de progression fictives réalistes

  ## Objectif
  Injecter des données jump_progression pour les 31 sauts de Sophie Martin
  (sophie.martin@parapass.fr) afin d'alimenter la page Ma Progression.

  ## Données injectées
  - 31 enregistrements de progression liés à chaque saut via jump_id
  - Progression croissante des notes (3.0 → 4.5 avec variations naturelles)
  - Point faible : atterrissage (progresse de 2 → 5 sur la durée)
  - Points forts : ouverture voile, mental
  - Éléments techniques graduellement maîtrisés au fil des sauts
  - Précision atterrissage : 55m → 5m (amélioration progressive)
  - Exercices chute et voile variés
  - Observations moniteur sur 6 sauts clés

  ## Sécurité
  Suppression préalable des données existantes avant insertion (idempotent).
*/

-- ── Suppression des données existantes ─────────────────────────────────────────
DELETE FROM jump_progression
WHERE user_id = (SELECT id FROM profiles WHERE email = 'sophie.martin@parapass.fr');

-- ── Injection des 31 enregistrements ───────────────────────────────────────────
INSERT INTO jump_progression (
  jump_id, user_id,
  note_globale,
  note_ouverture_voile, note_atterrissage, note_mental,
  score_position,
  sortie_avion, retour_face_sol, vigilance_altitude, ouverture,
  separation, trajectoire, declenchement, pilotage_voile,
  circuit_atterro, precision_atterro, gestion_urgences,
  exercices_chute, exercices_voile,
  precision_metres,
  observations_moniteur,
  created_at
)
SELECT
  j.id AS jump_id,
  p.id AS user_id,
  -- Note globale : progression de 3 → 5 avec variations naturelles
  CASE rn
    WHEN 1  THEN 3 WHEN 2  THEN 3 WHEN 3  THEN 3
    WHEN 4  THEN 4 WHEN 5  THEN 3 WHEN 6  THEN 4
    WHEN 7  THEN 4 WHEN 8  THEN 3 WHEN 9  THEN 4
    WHEN 10 THEN 4 WHEN 11 THEN 5 WHEN 12 THEN 4
    WHEN 13 THEN 4 WHEN 14 THEN 5 WHEN 15 THEN 4
    WHEN 16 THEN 5 WHEN 17 THEN 4 WHEN 18 THEN 5
    WHEN 19 THEN 5 WHEN 20 THEN 4 WHEN 21 THEN 5
    WHEN 22 THEN 4 WHEN 23 THEN 5 WHEN 24 THEN 5
    WHEN 25 THEN 4 WHEN 26 THEN 5 WHEN 27 THEN 5
    WHEN 28 THEN 4 WHEN 29 THEN 5 WHEN 30 THEN 5
    WHEN 31 THEN 5 ELSE 4
  END,
  -- Note ouverture voile (point fort)
  CASE rn
    WHEN 1  THEN 3 WHEN 2  THEN 3 WHEN 3  THEN 4
    WHEN 4  THEN 3 WHEN 5  THEN 4 WHEN 6  THEN 4
    WHEN 7  THEN 4 WHEN 8  THEN 5 WHEN 9  THEN 4
    WHEN 10 THEN 5 WHEN 11 THEN 4 WHEN 12 THEN 5
    WHEN 13 THEN 5 WHEN 14 THEN 4 WHEN 15 THEN 5
    WHEN 16 THEN 5 WHEN 17 THEN 5 WHEN 18 THEN 4
    WHEN 19 THEN 5 WHEN 20 THEN 5 WHEN 21 THEN 5
    WHEN 22 THEN 5 WHEN 23 THEN 4 WHEN 24 THEN 5
    WHEN 25 THEN 5 WHEN 26 THEN 5 WHEN 27 THEN 5
    WHEN 28 THEN 5 WHEN 29 THEN 5 WHEN 30 THEN 5
    WHEN 31 THEN 5 ELSE 4
  END,
  -- Note atterrissage (point faible au début, s'améliore)
  CASE rn
    WHEN 1  THEN 2 WHEN 2  THEN 2 WHEN 3  THEN 3
    WHEN 4  THEN 2 WHEN 5  THEN 3 WHEN 6  THEN 3
    WHEN 7  THEN 3 WHEN 8  THEN 2 WHEN 9  THEN 3
    WHEN 10 THEN 4 WHEN 11 THEN 3 WHEN 12 THEN 4
    WHEN 13 THEN 4 WHEN 14 THEN 4 WHEN 15 THEN 3
    WHEN 16 THEN 4 WHEN 17 THEN 4 WHEN 18 THEN 5
    WHEN 19 THEN 4 WHEN 20 THEN 4 WHEN 21 THEN 5
    WHEN 22 THEN 4 WHEN 23 THEN 5 WHEN 24 THEN 5
    WHEN 25 THEN 4 WHEN 26 THEN 5 WHEN 27 THEN 5
    WHEN 28 THEN 5 WHEN 29 THEN 5 WHEN 30 THEN 5
    WHEN 31 THEN 5 ELSE 4
  END,
  -- Note mental (globalement bon, quelques baisses)
  CASE rn
    WHEN 1  THEN 3 WHEN 2  THEN 4 WHEN 3  THEN 3
    WHEN 4  THEN 4 WHEN 5  THEN 3 WHEN 6  THEN 4
    WHEN 7  THEN 5 WHEN 8  THEN 4 WHEN 9  THEN 4
    WHEN 10 THEN 3 WHEN 11 THEN 5 WHEN 12 THEN 4
    WHEN 13 THEN 4 WHEN 14 THEN 5 WHEN 15 THEN 5
    WHEN 16 THEN 4 WHEN 17 THEN 5 WHEN 18 THEN 5
    WHEN 19 THEN 5 WHEN 20 THEN 4 WHEN 21 THEN 5
    WHEN 22 THEN 5 WHEN 23 THEN 5 WHEN 24 THEN 4
    WHEN 25 THEN 5 WHEN 26 THEN 5 WHEN 27 THEN 5
    WHEN 28 THEN 4 WHEN 29 THEN 5 WHEN 30 THEN 5
    WHEN 31 THEN 5 ELSE 4
  END,
  -- Score position (brevet B → pas de notes individuelles tête/bassin/etc,
  -- mais score_position calculé globalement)
  CASE rn
    WHEN 1  THEN 3.0 WHEN 2  THEN 3.2 WHEN 3  THEN 3.5
    WHEN 4  THEN 3.3 WHEN 5  THEN 3.7 WHEN 6  THEN 3.8
    WHEN 7  THEN 4.0 WHEN 8  THEN 3.8 WHEN 9  THEN 4.0
    WHEN 10 THEN 4.0 WHEN 11 THEN 4.2 WHEN 12 THEN 4.0
    WHEN 13 THEN 4.2 WHEN 14 THEN 4.3 WHEN 15 THEN 4.2
    WHEN 16 THEN 4.5 WHEN 17 THEN 4.3 WHEN 18 THEN 4.5
    WHEN 19 THEN 4.5 WHEN 20 THEN 4.3 WHEN 21 THEN 4.5
    WHEN 22 THEN 4.3 WHEN 23 THEN 4.7 WHEN 24 THEN 4.5
    WHEN 25 THEN 4.5 WHEN 26 THEN 4.7 WHEN 27 THEN 4.7
    WHEN 28 THEN 4.5 WHEN 29 THEN 4.7 WHEN 30 THEN 4.8
    WHEN 31 THEN 5.0 ELSE 4.0
  END,
  -- sortie_avion
  CASE WHEN rn <= 5 THEN 'en_cours' WHEN rn <= 15 THEN 'maitrise' ELSE 'maitrise' END,
  -- retour_face_sol
  CASE WHEN rn <= 8 THEN 'en_cours' WHEN rn <= 18 THEN 'maitrise' ELSE 'maitrise' END,
  -- vigilance_altitude
  CASE WHEN rn <= 3 THEN 'non' WHEN rn <= 12 THEN 'en_cours' ELSE 'maitrise' END,
  -- ouverture
  CASE WHEN rn <= 6 THEN 'en_cours' WHEN rn <= 16 THEN 'maitrise' ELSE 'maitrise' END,
  -- separation
  CASE WHEN rn <= 10 THEN 'en_cours' ELSE 'maitrise' END,
  -- trajectoire
  CASE WHEN rn <= 7 THEN 'en_cours' ELSE 'maitrise' END,
  -- declenchement
  CASE WHEN rn <= 4 THEN 'en_cours' WHEN rn <= 14 THEN 'maitrise' ELSE 'maitrise' END,
  -- pilotage_voile
  CASE WHEN rn <= 9 THEN 'en_cours' WHEN rn <= 20 THEN 'maitrise' ELSE 'maitrise' END,
  -- circuit_atterro
  CASE WHEN rn <= 12 THEN 'en_cours' WHEN rn <= 22 THEN 'maitrise' ELSE 'maitrise' END,
  -- precision_atterro
  CASE WHEN rn <= 15 THEN 'en_cours' ELSE 'maitrise' END,
  -- gestion_urgences
  CASE WHEN rn <= 5 THEN 'non' WHEN rn <= 18 THEN 'en_cours' ELSE 'maitrise' END,
  -- Exercices chute (variés)
  CASE
    WHEN rn % 5 = 0 THEN 'Arche stable, 360° gauche'
    WHEN rn % 5 = 1 THEN '360° droite, Avancée, Reculée'
    WHEN rn % 5 = 2 THEN 'Tonneau, Tracking'
    WHEN rn % 5 = 3 THEN 'Loop, Docking'
    WHEN rn % 5 = 4 THEN 'Lâché de mains, 360° gauche, 360° droite'
    ELSE 'Arche stable'
  END,
  -- Exercices voile (variés)
  CASE
    WHEN rn % 4 = 0 THEN 'Virages 90°, Posé précision'
    WHEN rn % 4 = 1 THEN 'Virages 180°, Navigation vent fort'
    WHEN rn % 4 = 2 THEN 'Virages 360°, Spiral'
    WHEN rn % 4 = 3 THEN 'Posé précision, Voile contact'
    ELSE 'Virages 90°'
  END,
  -- Précision atterrissage en mètres (amélioration progressive 55m → 4m)
  CASE
    WHEN rn <= 3  THEN 55
    WHEN rn <= 6  THEN 45
    WHEN rn <= 9  THEN 35
    WHEN rn <= 12 THEN 28
    WHEN rn <= 15 THEN 22
    WHEN rn <= 18 THEN 16
    WHEN rn <= 21 THEN 12
    WHEN rn <= 24 THEN 9
    WHEN rn <= 27 THEN 7
    WHEN rn <= 29 THEN 5
    ELSE 4
  END,
  -- Observations moniteur (sauts clés seulement)
  CASE rn
    WHEN 5  THEN 'Bonne sortie avion, travailler la finale d''approche'
    WHEN 10 THEN 'Nette amélioration du circuit atterrissage, continuez sur cette lancée'
    WHEN 15 THEN 'Premier posé debout propre — excellente progression !'
    WHEN 20 THEN 'Maîtrise confirmée, se concentrer maintenant sur la précision'
    WHEN 25 THEN 'Niveau Brevet B bien consolidé, prête pour la compétition débutante'
    WHEN 31 THEN 'Sophie est une parachutiste confirmée, progression exemplaire sur 31 sauts'
    ELSE NULL
  END,
  -- created_at calé sur la date du saut
  j.created_at
FROM (
  SELECT
    s.id,
    s.created_at,
    ROW_NUMBER() OVER (ORDER BY s.created_at ASC, s.id ASC) AS rn
  FROM sauts s
  WHERE s.parachutiste_id = (SELECT id FROM profiles WHERE email = 'sophie.martin@parapass.fr')
) j
CROSS JOIN (
  SELECT id FROM profiles WHERE email = 'sophie.martin@parapass.fr'
) p;
