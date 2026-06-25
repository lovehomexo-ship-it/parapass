/*
  # JumpPass - Initial Database Schema

  1. New Tables
    - `centres`: Parachute training centres in France
      - `id` (uuid, primary key)
      - `nom` (text, centre name)
      - `ville` (text, city)
      - `created_at` (timestamp)
    - `profiles`: User profiles linked to Supabase Auth
      - `id` (uuid, primary key, FK to auth.users)
      - `email` (text, unique)
      - `nom` (text, last name)
      - `prenom` (text, first name)
      - `numero_licence` (text, FFP licence number)
      - `role` (text, one of: parachutiste, moniteur, admin)
      - `centre_id` (uuid, FK to centres, nullable)
      - `created_at` (timestamp)
    - `sauts`: Jump records (the core logbook)
      - `id` (uuid, primary key)
      - `parachutiste_id` (uuid, FK to profiles)
      - `date_saut` (date)
      - `lieu` (text, dropzone/location)
      - `aeronef_immat` (text, aircraft registration)
      - `nature_saut` (text: entrainement, competition, manifestation, travail_aerien, nuit, largage, tandem)
      - `categorie` (text: OA, OC, OR30, OR60, OR60plus)
      - `hauteur_m` (integer, altitude in meters)
      - `fonction` (text: parachutiste, eleve, instructeur, largueur)
      - `temps_vol_min` (integer, freefall time in minutes)
      - `parachute` (text, nullable)
      - `observations` (text, nullable)
      - `moniteur_id` (uuid, FK to profiles, nullable)
      - `valide_par` (text, nullable, monitor name who validated)
      - `valide_le` (timestamp, nullable, validation timestamp)
      - `statut` (text: en_attente, valide, refuse)
      - `created_at` (timestamp)
    - `qr_tokens`: QR code tokens for offline profile verification
      - `id` (uuid, primary key)
      - `parachutiste_id` (uuid, FK to profiles)
      - `token` (text, unique, used in QR code URL)
      - `created_at` (timestamp)

  2. Security
    - RLS enabled on all tables
    - Profiles: users can read/update own data; moniteurs/admins can read profiles in their centre
    - Sauts: parachutistes CRUD own jumps; moniteurs can update status for validation
    - QR tokens: parachutistes can manage own tokens; public read via token
    - Centres: readable by authenticated users

  3. Important Notes
    - Role values are stored as text for simplicity (no custom enum type needed)
    - Nature_saut, categorie, fonction, statut use text check constraints for validation
    - Demo centre and demo user data will be seeded separately
*/

-- Create centres table
CREATE TABLE IF NOT EXISTS centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  ville text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  nom text NOT NULL DEFAULT '',
  prenom text NOT NULL DEFAULT '',
  numero_licence text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'parachutiste' CHECK (role IN ('parachutiste', 'moniteur', 'admin')),
  centre_id uuid REFERENCES centres(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create sauts table
CREATE TABLE IF NOT EXISTS sauts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_saut date NOT NULL DEFAULT CURRENT_DATE,
  lieu text NOT NULL DEFAULT '',
  aeronef_immat text NOT NULL DEFAULT '',
  nature_saut text NOT NULL DEFAULT 'entrainement' CHECK (nature_saut IN ('entrainement', 'competition', 'manifestation', 'travail_aerien', 'nuit', 'largage', 'tandem')),
  categorie text NOT NULL DEFAULT 'OA' CHECK (categorie IN ('OA', 'OC', 'OR30', 'OR60', 'OR60plus')),
  hauteur_m integer NOT NULL DEFAULT 4000,
  fonction text NOT NULL DEFAULT 'parachutiste' CHECK (fonction IN ('parachutiste', 'eleve', 'instructeur', 'largueur')),
  temps_vol_min integer NOT NULL DEFAULT 0,
  parachute text,
  observations text,
  moniteur_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  valide_par text,
  valide_le timestamptz,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'valide', 'refuse')),
  created_at timestamptz DEFAULT now()
);

-- Create qr_tokens table
CREATE TABLE IF NOT EXISTS qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sauts ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;

-- Centres policies: authenticated users can read
CREATE POLICY "Authenticated users can read centres"
  ON centres FOR SELECT
  TO authenticated
  USING (true);

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Moniteurs and admins can read profiles in their centre"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    centre_id IS NOT NULL
    AND centre_id = (
      SELECT centre_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('moniteur', 'admin')
  );

-- Sauts policies
CREATE POLICY "Parachutistes can read own sauts"
  ON sauts FOR SELECT
  TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutistes can insert own sauts"
  ON sauts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutistes can update own sauts"
  ON sauts FOR UPDATE
  TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutistes can delete own sauts"
  ON sauts FOR DELETE
  TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Moniteurs can read sauts awaiting their validation"
  ON sauts FOR SELECT
  TO authenticated
  USING (
    moniteur_id = auth.uid()
    OR (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('moniteur', 'admin')
  );

CREATE POLICY "Moniteurs can update sauts for validation"
  ON sauts FOR UPDATE
  TO authenticated
  USING (
    moniteur_id = auth.uid()
    OR (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('moniteur', 'admin')
  )
  WITH CHECK (
    moniteur_id = auth.uid()
    OR (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('moniteur', 'admin')
  );

-- QR tokens policies
CREATE POLICY "Parachutistes can read own qr tokens"
  ON qr_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutistes can insert own qr tokens"
  ON qr_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutistes can delete own qr tokens"
  ON qr_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = parachutiste_id);

-- Public read for QR token verification (no auth required)
CREATE POLICY "Public can verify qr tokens"
  ON qr_tokens FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read profiles via QR token (for verification page)
CREATE POLICY "Public can read profile via qr token"
  ON profiles FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM qr_tokens WHERE qr_tokens.parachutiste_id = profiles.id
    )
  );

-- Allow anon to read sauts count via QR token (for verification page)
CREATE POLICY "Public can read sauts via qr token"
  ON sauts FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM qr_tokens WHERE qr_tokens.parachutiste_id = sauts.parachutiste_id
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sauts_parachutiste ON sauts(parachutiste_id);
CREATE INDEX IF NOT EXISTS idx_sauts_date ON sauts(date_saut);
CREATE INDEX IF NOT EXISTS idx_sauts_statut ON sauts(statut);
CREATE INDEX IF NOT EXISTS idx_sauts_moniteur ON sauts(moniteur_id);
CREATE INDEX IF NOT EXISTS idx_profiles_centre ON profiles(centre_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_parachutiste ON qr_tokens(parachutiste_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
