/*
  # Observations moniteur dans les sauts (Module 6 — pages 20-27 carnet FFP)

  1. Modifications table "sauts"
     Ajout des colonnes manquantes pour reproduire le verso de la fiche de saut papier :
     - programme : ex "PAC 1", "PAC 2", "Solo"
     - voilure_principale : taille/modèle voilure
     - observations_moniteur : texte libre
     - sortie_avion, retour_face_sol, vigilance_altitude, ouverture_notes
     - position_tete, position_bassin, position_jambes, position_bras
     - exercice_chute, exercice_voile

  2. Pas de modification des données existantes
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='programme') THEN
    ALTER TABLE sauts ADD COLUMN programme text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='voilure_principale') THEN
    ALTER TABLE sauts ADD COLUMN voilure_principale text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='observations_moniteur') THEN
    ALTER TABLE sauts ADD COLUMN observations_moniteur text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='sortie_avion') THEN
    ALTER TABLE sauts ADD COLUMN sortie_avion text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='retour_face_sol') THEN
    ALTER TABLE sauts ADD COLUMN retour_face_sol text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='vigilance_altitude') THEN
    ALTER TABLE sauts ADD COLUMN vigilance_altitude text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='ouverture_notes') THEN
    ALTER TABLE sauts ADD COLUMN ouverture_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='position_tete') THEN
    ALTER TABLE sauts ADD COLUMN position_tete text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='position_bassin') THEN
    ALTER TABLE sauts ADD COLUMN position_bassin text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='position_jambes') THEN
    ALTER TABLE sauts ADD COLUMN position_jambes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='position_bras') THEN
    ALTER TABLE sauts ADD COLUMN position_bras text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='exercice_chute') THEN
    ALTER TABLE sauts ADD COLUMN exercice_chute text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='exercice_voile') THEN
    ALTER TABLE sauts ADD COLUMN exercice_voile text;
  END IF;
END $$;
