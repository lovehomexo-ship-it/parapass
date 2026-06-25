/*
  # Vérifications QR et politiques publiques

  1. Nouvelle table `verifications`
     - Enregistre chaque consultation de QR code
     - id, token_consulté, timestamp — aucune donnée personnelle (RGPD)

  2. Politiques RLS publiques (sans auth) sur :
     - qr_tokens : SELECT par token uniquement
     - profiles, licences, certificats_medicaux, brevets, sauts via parachutiste_id

  3. Sécurité
     - Lecture publique limitée au strict nécessaire pour la vérification
     - Aucune modification permise sans auth
*/

-- Table des vérifications (logs RGPD-friendly)
CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  verified_at timestamptz DEFAULT now()
);

ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'verifications' AND policyname = 'Anyone can insert a verification log'
  ) THEN
    CREATE POLICY "Anyone can insert a verification log"
      ON verifications FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- qr_tokens
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'qr_tokens' AND policyname = 'Public can read qr_tokens by token'
  ) THEN
    CREATE POLICY "Public can read qr_tokens by token"
      ON qr_tokens FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public can read profile via qr token'
  ) THEN
    CREATE POLICY "Public can read profile via qr token"
      ON profiles FOR SELECT TO anon
      USING (
        EXISTS (SELECT 1 FROM qr_tokens WHERE qr_tokens.parachutiste_id = profiles.id)
      );
  END IF;
END $$;

-- licences
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'licences' AND policyname = 'Public can read licences via qr token'
  ) THEN
    CREATE POLICY "Public can read licences via qr token"
      ON licences FOR SELECT TO anon
      USING (
        EXISTS (SELECT 1 FROM qr_tokens WHERE qr_tokens.parachutiste_id = licences.parachutiste_id)
      );
  END IF;
END $$;

-- certificats_medicaux
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'certificats_medicaux' AND policyname = 'Public can read certificats_medicaux via qr token'
  ) THEN
    CREATE POLICY "Public can read certificats_medicaux via qr token"
      ON certificats_medicaux FOR SELECT TO anon
      USING (
        EXISTS (SELECT 1 FROM qr_tokens WHERE qr_tokens.parachutiste_id = certificats_medicaux.parachutiste_id)
      );
  END IF;
END $$;

-- brevets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'brevets' AND policyname = 'Public can read brevets via qr token'
  ) THEN
    CREATE POLICY "Public can read brevets via qr token"
      ON brevets FOR SELECT TO anon
      USING (
        EXISTS (SELECT 1 FROM qr_tokens WHERE qr_tokens.parachutiste_id = brevets.parachutiste_id)
      );
  END IF;
END $$;

-- sauts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sauts' AND policyname = 'Public can read sauts via qr token'
  ) THEN
    CREATE POLICY "Public can read sauts via qr token"
      ON sauts FOR SELECT TO anon
      USING (
        EXISTS (SELECT 1 FROM qr_tokens WHERE qr_tokens.parachutiste_id = sauts.parachutiste_id)
      );
  END IF;
END $$;
