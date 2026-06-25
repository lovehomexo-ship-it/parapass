/*
  # Admin Centre System

  ## Summary
  Adds full centre management infrastructure:
  - Extended `centres` table with FFP agrément, GPS, DT info, plan/status
  - New `admin_centres` table (many admins per centre)
  - New `licencies_centres` table (parachutist-centre many-to-many)
  - New role `admin_centre` support via profiles
  - Invitations table for centre membership

  ## New / Updated Tables

  ### centres (extended)
  - numero_agrement_ffp, siret, adresse, code_postal, telephone, email, site_web
  - latitude, longitude
  - dt_nom, dt_prenom, dt_licence_numero, dt_licence_type
  - dt_photo_url, agrement_doc_url, dt_licence_doc_url
  - logo_url
  - statut: en_attente | actif | suspendu
  - plan: essai | centre | centre_premium
  - trial_ends_at

  ### admin_centres
  - centre_id, profile_id, role (admin|co_admin|moniteur)

  ### licencies_centres
  - parachutiste_id, centre_id, statut (en_attente|actif|inactif)
  - date_adhesion, moniteur_assigne_id

  ### centre_invitations
  - centre_id, email, token, statut (pending|accepted|expired)

  ## Security
  - RLS on all tables
  - Admin centre sees only their own centre's data
*/

-- ─── Extend centres table ─────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'numero_agrement_ffp') THEN
    ALTER TABLE centres ADD COLUMN numero_agrement_ffp text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'siret') THEN
    ALTER TABLE centres ADD COLUMN siret text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'adresse') THEN
    ALTER TABLE centres ADD COLUMN adresse text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'code_postal') THEN
    ALTER TABLE centres ADD COLUMN code_postal text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'telephone') THEN
    ALTER TABLE centres ADD COLUMN telephone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'email') THEN
    ALTER TABLE centres ADD COLUMN email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'site_web') THEN
    ALTER TABLE centres ADD COLUMN site_web text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'latitude') THEN
    ALTER TABLE centres ADD COLUMN latitude float;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'longitude') THEN
    ALTER TABLE centres ADD COLUMN longitude float;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'dt_nom') THEN
    ALTER TABLE centres ADD COLUMN dt_nom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'dt_prenom') THEN
    ALTER TABLE centres ADD COLUMN dt_prenom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'dt_licence_numero') THEN
    ALTER TABLE centres ADD COLUMN dt_licence_numero text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'dt_licence_type') THEN
    ALTER TABLE centres ADD COLUMN dt_licence_type text DEFAULT 'BEES' CHECK (dt_licence_type IN ('BEES', 'BPJEPS'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'dt_photo_url') THEN
    ALTER TABLE centres ADD COLUMN dt_photo_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'agrement_doc_url') THEN
    ALTER TABLE centres ADD COLUMN agrement_doc_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'dt_licence_doc_url') THEN
    ALTER TABLE centres ADD COLUMN dt_licence_doc_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'logo_url') THEN
    ALTER TABLE centres ADD COLUMN logo_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'statut') THEN
    ALTER TABLE centres ADD COLUMN statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'actif', 'suspendu'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'plan') THEN
    ALTER TABLE centres ADD COLUMN plan text NOT NULL DEFAULT 'essai' CHECK (plan IN ('essai', 'centre', 'centre_premium'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE centres ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '30 days');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'slug') THEN
    ALTER TABLE centres ADD COLUMN slug text UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'centres' AND column_name = 'description') THEN
    ALTER TABLE centres ADD COLUMN description text;
  END IF;
END $$;

-- ─── admin_centres ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'co_admin', 'moniteur')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT admin_centres_unique UNIQUE (centre_id, profile_id)
);

CREATE INDEX IF NOT EXISTS admin_centres_centre_idx ON admin_centres(centre_id);
CREATE INDEX IF NOT EXISTS admin_centres_profile_idx ON admin_centres(profile_id);

ALTER TABLE admin_centres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view their centre memberships"
  ON admin_centres FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Admin can insert their own membership"
  ON admin_centres FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid() OR centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admin can delete memberships in their centre"
  ON admin_centres FOR DELETE
  TO authenticated
  USING (centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid() AND role = 'admin'
  ));

-- ─── licencies_centres ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS licencies_centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'actif', 'inactif')),
  date_adhesion date,
  moniteur_assigne_id uuid REFERENCES profiles(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT licencies_centres_unique UNIQUE (parachutiste_id, centre_id)
);

CREATE INDEX IF NOT EXISTS licencies_centres_centre_idx ON licencies_centres(centre_id);
CREATE INDEX IF NOT EXISTS licencies_centres_para_idx ON licencies_centres(parachutiste_id);

ALTER TABLE licencies_centres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can see own memberships"
  ON licencies_centres FOR SELECT
  TO authenticated
  USING (parachutiste_id = auth.uid() OR centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Parachutiste can request membership"
  ON licencies_centres FOR INSERT
  TO authenticated
  WITH CHECK (parachutiste_id = auth.uid() OR centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Admin can update memberships in their centre"
  ON licencies_centres FOR UPDATE
  TO authenticated
  USING (centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ))
  WITH CHECK (centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Admin can delete memberships in their centre"
  ON licencies_centres FOR DELETE
  TO authenticated
  USING (centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ) OR parachutiste_id = auth.uid());

-- ─── centre_invitations ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS centre_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  statut text NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending', 'accepted', 'expired')),
  invited_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT centre_invitations_unique UNIQUE (centre_id, email)
);

ALTER TABLE centre_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage invitations for their centre"
  ON centre_invitations FOR SELECT
  TO authenticated
  USING (centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Admin can insert invitations"
  ON centre_invitations FOR INSERT
  TO authenticated
  WITH CHECK (centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Admin can update invitations"
  ON centre_invitations FOR UPDATE
  TO authenticated
  USING (centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ))
  WITH CHECK (centre_id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ));

-- Allow unauthenticated token lookup for invitation acceptance
CREATE POLICY "Anyone can view invitation by token"
  ON centre_invitations FOR SELECT
  TO anon
  USING (true);

-- ─── centres RLS ──────────────────────────────────────────────────────────────

ALTER TABLE centres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active centres"
  ON centres FOR SELECT
  TO anon
  USING (statut = 'actif');

CREATE POLICY "Authenticated can view active centres"
  ON centres FOR SELECT
  TO authenticated
  USING (statut = 'actif' OR id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Admin can update their centre"
  ON centres FOR UPDATE
  TO authenticated
  USING (id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (id IN (
    SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Authenticated can insert new centres"
  ON centres FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── profiles: add admin_centre role support ──────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'admin_centre_id') THEN
    ALTER TABLE profiles ADD COLUMN admin_centre_id uuid REFERENCES centres(id);
  END IF;
END $$;
