/*
  # Champs de validation moniteur (Module 1)

  1. Modifications table "profiles"
     - numero_brevet_moniteur : numéro BEES ou BPJEPS
     - type_brevet_moniteur : enum BEES / BPJEPS
     - moniteur_valide_par_dt : booléen, false par défaut
     - moniteur_valide_le : timestamp de validation DT
     - moniteur_valide_par_id : FK vers le profil DT validateur

  2. Un moniteur avec moniteur_valide_par_dt = false
     ne pourra pas valider de sauts (contrôle côté RLS
     et côté application).
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='numero_brevet_moniteur') THEN
    ALTER TABLE profiles ADD COLUMN numero_brevet_moniteur text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='type_brevet_moniteur') THEN
    ALTER TABLE profiles ADD COLUMN type_brevet_moniteur text CHECK (type_brevet_moniteur IN ('BEES','BPJEPS'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='moniteur_valide_par_dt') THEN
    ALTER TABLE profiles ADD COLUMN moniteur_valide_par_dt boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='moniteur_valide_le') THEN
    ALTER TABLE profiles ADD COLUMN moniteur_valide_le timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='moniteur_valide_par_id') THEN
    ALTER TABLE profiles ADD COLUMN moniteur_valide_par_id uuid REFERENCES profiles(id);
  END IF;
END $$;
