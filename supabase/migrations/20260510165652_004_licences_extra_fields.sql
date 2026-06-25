/*
  # Add extended fields to licences table

  Adds club info, beneficiary, insurance toggles, and DZ validation
  fields to the existing `licences` table.

  1. New columns on `licences`
    - code_club (text, nullable) — club/DZ code e.g. "0916001"
    - nom_club (text, nullable) — club or centre name
    - beneficiaire_nom (text, nullable) — death beneficiary full name
    - beneficiaire_lien (text, nullable) — relationship enum: conjoint/enfant/parent/frere_soeur/autre
    - beneficiaire_telephone (text, nullable)
    - assurance_individuelle (boolean, default false)
    - assurance_rc (boolean, default false)
    - tampon_dz_url (text, nullable) — storage path for DZ stamp scan
    - tampon_valide_par (text, nullable) — DT / DZ responsible name
    - tampon_date_validation (date, nullable)
    - tampon_signature_url (text, nullable) — storage path for base64 signature
    - tampon_statut (text, default 'en_attente') — en_attente/valide/refuse

  2. Notes
    - All columns are nullable or have safe defaults — non-destructive
    - RLS already enabled on licences from initial migration
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='code_club') THEN
    ALTER TABLE licences ADD COLUMN code_club text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='nom_club') THEN
    ALTER TABLE licences ADD COLUMN nom_club text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='beneficiaire_nom') THEN
    ALTER TABLE licences ADD COLUMN beneficiaire_nom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='beneficiaire_lien') THEN
    ALTER TABLE licences ADD COLUMN beneficiaire_lien text CHECK (beneficiaire_lien IN ('conjoint','enfant','parent','frere_soeur','autre'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='beneficiaire_telephone') THEN
    ALTER TABLE licences ADD COLUMN beneficiaire_telephone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='assurance_individuelle') THEN
    ALTER TABLE licences ADD COLUMN assurance_individuelle boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='assurance_rc') THEN
    ALTER TABLE licences ADD COLUMN assurance_rc boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='tampon_dz_url') THEN
    ALTER TABLE licences ADD COLUMN tampon_dz_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='tampon_valide_par') THEN
    ALTER TABLE licences ADD COLUMN tampon_valide_par text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='tampon_date_validation') THEN
    ALTER TABLE licences ADD COLUMN tampon_date_validation date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='tampon_signature_url') THEN
    ALTER TABLE licences ADD COLUMN tampon_signature_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='tampon_statut') THEN
    ALTER TABLE licences ADD COLUMN tampon_statut text NOT NULL DEFAULT 'en_attente'
      CHECK (tampon_statut IN ('en_attente','valide','refuse'));
  END IF;
END $$;
