/*
  # Add nom_dt column to centres

  1. Changes
    - Adds `nom_dt` (text, nullable) to `centres` table to store the Directeur Technique's name
    - Used in the "Cachet officiel" section of MonCentreSection in CentreDashboard
    - Also displayed on the verso card stamp via PasseportCardView
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centres' AND column_name = 'nom_dt'
  ) THEN
    ALTER TABLE centres ADD COLUMN nom_dt text DEFAULT NULL;
  END IF;
END $$;
