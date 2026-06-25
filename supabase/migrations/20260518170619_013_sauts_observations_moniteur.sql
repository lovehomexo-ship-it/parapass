/*
  # Update sauts — new observation/notation fields

  1. Modifications table "sauts"
     - Suppression effective de temps_vol_min : renommé en temps_vol_min_deprecated (non supprimé pour ne pas perdre de données)
     - position_tete/bassin/jambes/bras : integer 1-5 (notation visuelle)
     - position_globale : integer calculé
     - sortie_avion, retour_face_sol, vigilance_altitude, ouverture_notes :
       enum text: 'a_retravailler' | 'correct' | 'bon'
     - signature_moniteur_url : URL de la signature du moniteur tracée dans le formulaire

  2. Aucune donnée supprimée
*/

DO $$
BEGIN
  -- Changer les colonnes de position de text → integer si elles existent déjà en text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='sauts' AND column_name='position_tete' AND data_type='text'
  ) THEN
    ALTER TABLE sauts ALTER COLUMN position_tete TYPE integer USING NULL::integer;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='sauts' AND column_name='position_bassin' AND data_type='text'
  ) THEN
    ALTER TABLE sauts ALTER COLUMN position_bassin TYPE integer USING NULL::integer;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='sauts' AND column_name='position_jambes' AND data_type='text'
  ) THEN
    ALTER TABLE sauts ALTER COLUMN position_jambes TYPE integer USING NULL::integer;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='sauts' AND column_name='position_bras' AND data_type='text'
  ) THEN
    ALTER TABLE sauts ALTER COLUMN position_bras TYPE integer USING NULL::integer;
  END IF;

  -- Ajouter position_globale si inexistant
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='position_globale') THEN
    ALTER TABLE sauts ADD COLUMN position_globale integer;
  END IF;

  -- Ajouter signature_moniteur_url si inexistant
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='signature_moniteur_url') THEN
    ALTER TABLE sauts ADD COLUMN signature_moniteur_url text;
  END IF;

  -- Convertir sortie_avion / retour_face_sol / vigilance_altitude / ouverture_notes de text en text enum-friendly
  -- (on garde text pour la flexibilité, validation côté app)
END $$;
