/*
  # Reseed Sophie Martin jump_progression avec le bon user_id auth

  Le problème : les données ont été insérées avec l'id de la table profiles,
  mais auth.uid() retourne l'id de auth.users.
  Dans ce projet profiles.id = auth.users.id (FK), donc ce sont normalement les mêmes.

  Cette migration supprime et réinsère proprement en passant par auth.users
  pour garantir que user_id correspond exactement à ce que auth.uid() retourne.

  Elle corrige aussi la FK sur jump_id : la table est sauts (pas jumps).
*/

-- Supprimer toutes les données existantes pour Sophie
DELETE FROM jump_progression
WHERE user_id IN (
  SELECT au.id FROM auth.users au WHERE au.email = 'sophie.martin@parapass.fr'
);

-- Aussi nettoyer par email via profiles au cas où
DELETE FROM jump_progression
WHERE user_id IN (
  SELECT p.id FROM profiles p WHERE p.email = 'sophie.martin@parapass.fr'
);

-- Réinsérer avec auth.users.id explicitement
INSERT INTO jump_progression (
  jump_id,
  user_id,
  note_globale,
  note_ouverture_voile,
  note_atterrissage,
  note_mental,
  score_position,
  sortie_avion,
  retour_face_sol,
  vigilance_altitude,
  ouverture,
  separation,
  trajectoire,
  declenchement,
  pilotage_voile,
  circuit_atterro,
  precision_atterro,
  gestion_urgences,
  exercices_chute,
  exercices_voile,
  precision_metres,
  observations_moniteur,
  created_at
)
SELECT
  s.id                                                          AS jump_id,
  au.id                                                         AS user_id,
  -- note_globale
  CASE rn
    WHEN 1  THEN 3  WHEN 2  THEN 3  WHEN 3  THEN 3
    WHEN 4  THEN 4  WHEN 5  THEN 3  WHEN 6  THEN 4
    WHEN 7  THEN 4  WHEN 8  THEN 3  WHEN 9  THEN 4
    WHEN 10 THEN 4  WHEN 11 THEN 5  WHEN 12 THEN 4
    WHEN 13 THEN 4  WHEN 14 THEN 5  WHEN 15 THEN 4
    WHEN 16 THEN 5  WHEN 17 THEN 4  WHEN 18 THEN 5
    WHEN 19 THEN 5  WHEN 20 THEN 4  WHEN 21 THEN 5
    WHEN 22 THEN 4  WHEN 23 THEN 5  WHEN 24 THEN 5
    WHEN 25 THEN 4  WHEN 26 THEN 5  WHEN 27 THEN 5
    WHEN 28 THEN 4  WHEN 29 THEN 5  WHEN 30 THEN 5
    ELSE 5
  END,
  -- note_ouverture_voile (point fort)
  CASE rn
    WHEN 1  THEN 3  WHEN 2  THEN 3  WHEN 3  THEN 4
    WHEN 4  THEN 3  WHEN 5  THEN 4  WHEN 6  THEN 4
    WHEN 7  THEN 4  WHEN 8  THEN 5  WHEN 9  THEN 4
    WHEN 10 THEN 5  WHEN 11 THEN 4  WHEN 12 THEN 5
    WHEN 13 THEN 5  WHEN 14 THEN 4  WHEN 15 THEN 5
    WHEN 16 THEN 5  WHEN 17 THEN 5  WHEN 18 THEN 4
    WHEN 19 THEN 5  WHEN 20 THEN 5  WHEN 21 THEN 5
    WHEN 22 THEN 5  WHEN 23 THEN 4  WHEN 24 THEN 5
    WHEN 25 THEN 5  WHEN 26 THEN 5  WHEN 27 THEN 5
    WHEN 28 THEN 5  WHEN 29 THEN 5  WHEN 30 THEN 5
    ELSE 5
  END,
  -- note_atterrissage (point faible qui progresse)
  CASE rn
    WHEN 1  THEN 2  WHEN 2  THEN 2  WHEN 3  THEN 3
    WHEN 4  THEN 2  WHEN 5  THEN 3  WHEN 6  THEN 3
    WHEN 7  THEN 3  WHEN 8  THEN 2  WHEN 9  THEN 3
    WHEN 10 THEN 4  WHEN 11 THEN 3  WHEN 12 THEN 4
    WHEN 13 THEN 4  WHEN 14 THEN 4  WHEN 15 THEN 3
    WHEN 16 THEN 4  WHEN 17 THEN 4  WHEN 18 THEN 5
    WHEN 19 THEN 4  WHEN 20 THEN 4  WHEN 21 THEN 5
    WHEN 22 THEN 4  WHEN 23 THEN 5  WHEN 24 THEN 5
    WHEN 25 THEN 4  WHEN 26 THEN 5  WHEN 27 THEN 5
    WHEN 28 THEN 5  WHEN 29 THEN 5  WHEN 30 THEN 5
    ELSE 5
  END,
  -- note_mental
  CASE rn
    WHEN 1  THEN 3  WHEN 2  THEN 4  WHEN 3  THEN 3
    WHEN 4  THEN 4  WHEN 5  THEN 3  WHEN 6  THEN 4
    WHEN 7  THEN 5  WHEN 8  THEN 4  WHEN 9  THEN 4
    WHEN 10 THEN 3  WHEN 11 THEN 5  WHEN 12 THEN 4
    WHEN 13 THEN 4  WHEN 14 THEN 5  WHEN 15 THEN 5
    WHEN 16 THEN 4  WHEN 17 THEN 5  WHEN 18 THEN 5
    WHEN 19 THEN 5  WHEN 20 THEN 4  WHEN 21 THEN 5
    WHEN 22 THEN 5  WHEN 23 THEN 5  WHEN 24 THEN 4
    WHEN 25 THEN 5  WHEN 26 THEN 5  WHEN 27 THEN 5
    WHEN 28 THEN 4  WHEN 29 THEN 5  WHEN 30 THEN 5
    ELSE 5
  END,
  -- score_position
  CASE rn
    WHEN 1  THEN 3.0  WHEN 2  THEN 3.2  WHEN 3  THEN 3.5
    WHEN 4  THEN 3.3  WHEN 5  THEN 3.7  WHEN 6  THEN 3.8
    WHEN 7  THEN 4.0  WHEN 8  THEN 3.8  WHEN 9  THEN 4.0
    WHEN 10 THEN 4.0  WHEN 11 THEN 4.2  WHEN 12 THEN 4.0
    WHEN 13 THEN 4.2  WHEN 14 THEN 4.3  WHEN 15 THEN 4.2
    WHEN 16 THEN 4.5  WHEN 17 THEN 4.3  WHEN 18 THEN 4.5
    WHEN 19 THEN 4.5  WHEN 20 THEN 4.3  WHEN 21 THEN 4.5
    WHEN 22 THEN 4.3  WHEN 23 THEN 4.7  WHEN 24 THEN 4.5
    WHEN 25 THEN 4.5  WHEN 26 THEN 4.7  WHEN 27 THEN 4.7
    WHEN 28 THEN 4.5  WHEN 29 THEN 4.7  WHEN 30 THEN 4.8
    ELSE 5.0
  END,
  CASE WHEN rn <= 5  THEN 'en_cours' ELSE 'maitrise' END,  -- sortie_avion
  CASE WHEN rn <= 8  THEN 'en_cours' ELSE 'maitrise' END,  -- retour_face_sol
  CASE WHEN rn <= 3  THEN 'non' WHEN rn <= 12 THEN 'en_cours' ELSE 'maitrise' END, -- vigilance_altitude
  CASE WHEN rn <= 6  THEN 'en_cours' ELSE 'maitrise' END,  -- ouverture
  CASE WHEN rn <= 10 THEN 'en_cours' ELSE 'maitrise' END,  -- separation
  CASE WHEN rn <= 7  THEN 'en_cours' ELSE 'maitrise' END,  -- trajectoire
  CASE WHEN rn <= 4  THEN 'en_cours' ELSE 'maitrise' END,  -- declenchement
  CASE WHEN rn <= 9  THEN 'en_cours' ELSE 'maitrise' END,  -- pilotage_voile
  CASE WHEN rn <= 12 THEN 'en_cours' ELSE 'maitrise' END,  -- circuit_atterro
  CASE WHEN rn <= 15 THEN 'en_cours' ELSE 'maitrise' END,  -- precision_atterro
  CASE WHEN rn <= 5  THEN 'non' WHEN rn <= 18 THEN 'en_cours' ELSE 'maitrise' END, -- gestion_urgences
  -- exercices_chute
  CASE (rn % 5)
    WHEN 1 THEN 'Arche stable, 360° gauche'
    WHEN 2 THEN '360° droite, Avancée, Reculée'
    WHEN 3 THEN 'Tonneau, Tracking'
    WHEN 4 THEN 'Loop, Docking'
    ELSE      'Lâché de mains, 360° gauche, 360° droite'
  END,
  -- exercices_voile
  CASE (rn % 4)
    WHEN 1 THEN 'Virages 90°, Posé précision'
    WHEN 2 THEN 'Virages 180°, Navigation vent fort'
    WHEN 3 THEN 'Virages 360°, Spiral'
    ELSE      'Posé précision, Voile contact'
  END,
  -- precision_metres (55 → 4 progressivement)
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
  -- observations_moniteur sur sauts clés
  CASE rn
    WHEN 5  THEN 'Bonne sortie avion — travailler la finale d''approche'
    WHEN 10 THEN 'Nette amélioration du circuit atterrissage, continuez !'
    WHEN 15 THEN 'Premier posé debout propre — excellente progression !'
    WHEN 20 THEN 'Maîtrise confirmée, se concentrer sur la précision cible'
    WHEN 25 THEN 'Niveau B bien consolidé, prête pour la compétition'
    WHEN 31 THEN 'Progression exemplaire sur 31 sauts — parachutiste confirmée'
    ELSE NULL
  END,
  s.created_at
FROM (
  SELECT
    s2.id,
    s2.created_at,
    ROW_NUMBER() OVER (ORDER BY s2.created_at ASC, s2.id ASC) AS rn
  FROM sauts s2
  WHERE s2.parachutiste_id = (
    SELECT au.id FROM auth.users au WHERE au.email = 'sophie.martin@parapass.fr'
  )
) s
CROSS JOIN (
  SELECT id FROM auth.users WHERE email = 'sophie.martin@parapass.fr'
) au;
