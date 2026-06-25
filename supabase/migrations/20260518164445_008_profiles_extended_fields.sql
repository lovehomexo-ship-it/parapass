/*
  # Profil étendu — Page de garde carnet FFP (Module 1)

  1. Modifications table "profiles"
     Ajout des champs manquants pour reproduire la page 1 du carnet papier :
     - sexe (enum M/F)
     - adresse, code_postal, ville, telephone, email_contact
     - date_ouverture_carnet
     - photo_identite_url
     - ecole_ouverture_nom, ecole_ouverture_cachet_url
     - ecole_ouverture_dt_nom, ecole_ouverture_dt_signature_url

  2. Pas de suppression de colonnes existantes
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='sexe') THEN
    ALTER TABLE profiles ADD COLUMN sexe text CHECK (sexe IN ('M','F'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='adresse') THEN
    ALTER TABLE profiles ADD COLUMN adresse text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='code_postal') THEN
    ALTER TABLE profiles ADD COLUMN code_postal text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ville') THEN
    ALTER TABLE profiles ADD COLUMN ville text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='telephone') THEN
    ALTER TABLE profiles ADD COLUMN telephone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email_contact') THEN
    ALTER TABLE profiles ADD COLUMN email_contact text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='date_ouverture_carnet') THEN
    ALTER TABLE profiles ADD COLUMN date_ouverture_carnet date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='photo_identite_url') THEN
    ALTER TABLE profiles ADD COLUMN photo_identite_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ecole_ouverture_nom') THEN
    ALTER TABLE profiles ADD COLUMN ecole_ouverture_nom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ecole_ouverture_cachet_url') THEN
    ALTER TABLE profiles ADD COLUMN ecole_ouverture_cachet_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ecole_ouverture_dt_nom') THEN
    ALTER TABLE profiles ADD COLUMN ecole_ouverture_dt_nom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ecole_ouverture_dt_signature_url') THEN
    ALTER TABLE profiles ADD COLUMN ecole_ouverture_dt_signature_url text;
  END IF;
END $$;
