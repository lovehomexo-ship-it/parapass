/*
  # Add type_pratiquant to profiles

  Adds a `type_pratiquant` column to the `profiles` table to distinguish
  between amateur/recreational jumpers and professionals (SNPP).

  1. New column
    - `type_pratiquant` (text, default 'amateur')
      Values: amateur | professionnel | moniteur | directeur_technique

  2. Notes
    - Existing rows default to 'amateur' — safe, non-destructive
    - The DGAC 20-jump threshold block in the dashboard will only show
      when type_pratiquant IN ('professionnel', 'para_pro')
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'type_pratiquant'
  ) THEN
    ALTER TABLE profiles ADD COLUMN type_pratiquant text NOT NULL DEFAULT 'amateur'
      CHECK (type_pratiquant IN ('amateur', 'professionnel', 'moniteur', 'directeur_technique'));
  END IF;
END $$;
