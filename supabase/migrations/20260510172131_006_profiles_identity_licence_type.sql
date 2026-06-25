/*
  # Ajout champs identité sur profiles + type_licence sur licences

  1. Table `profiles` — champs identité officiels DGAC
    - date_naissance (date, nullable)
    - lieu_naissance (text, nullable)
    - nationalite (text, default 'Française')
    - signature_url (text, nullable) — signature personnelle en Storage

  2. Table `licences` — type de licence FFP
    - type_licence (text, nullable)
      Valeurs : lps (Licence de Parachutisme Sportif),
                lp (Licence Professionnelle),
                lj (Licence Jeune),
                ld (Licence Dirigeant)

  3. Notes
    - Toutes les colonnes sont nullable ou avec défault safe
    - RLS déjà activé sur ces tables
*/

DO $$
BEGIN
  -- profiles: identity fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='date_naissance') THEN
    ALTER TABLE profiles ADD COLUMN date_naissance date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='lieu_naissance') THEN
    ALTER TABLE profiles ADD COLUMN lieu_naissance text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='nationalite') THEN
    ALTER TABLE profiles ADD COLUMN nationalite text NOT NULL DEFAULT 'Française';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='signature_url') THEN
    ALTER TABLE profiles ADD COLUMN signature_url text;
  END IF;

  -- licences: type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='type_licence') THEN
    ALTER TABLE licences ADD COLUMN type_licence text
      CHECK (type_licence IN ('lps','lp','lj','ld'));
  END IF;
END $$;
