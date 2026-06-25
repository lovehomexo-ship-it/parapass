/*
  # Add signature DT field to centres

  ## Changes
  - Adds `signature_dt_url` column to `centres` table to store the uploaded
    DT signature image path (relative to the parapass-docs storage bucket).
  - This URL is used on the back of the passeport card to display the official
    DT stamp / signature.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centres' AND column_name = 'signature_dt_url'
  ) THEN
    ALTER TABLE centres ADD COLUMN signature_dt_url text DEFAULT NULL;
  END IF;
END $$;
