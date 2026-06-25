/*
  # Delegations de validation des sauts

  ## Objectif
  Permettre au Directeur Technique (DT) d'un centre de déléguer la capacité
  de valider des sauts à des moniteurs diplômés (BEES/BPJEPS).

  ## Nouvelles tables

  ### delegations_validation
  - `id` (uuid, PK)
  - `centre_id` (uuid, FK centres) — Centre concerné
  - `dt_id` (uuid, FK profiles) — DT qui accorde la délégation
  - `moniteur_id` (uuid, FK profiles) — Moniteur délégué
  - `actif` (boolean, default true) — Peut être révoqué
  - `date_delegation` (timestamptz) — Date d'accordement
  - `date_expiration` (timestamptz, nullable) — null = sans limite
  - `note` (text, nullable) — Ex: "Délégation saison été 2026"
  - Contrainte UNIQUE(centre_id, moniteur_id) — 1 délégation par moniteur/centre

  ## Sécurité (RLS)
  - DT peut lire/écrire ses propres délégations
  - Moniteur peut lire ses délégations (lecture seule)
  - Admin centre peut lire toutes les délégations de son centre
  - Admin global peut tout lire

  ## Modifications
  - Aucune modification de tables existantes
*/

CREATE TABLE IF NOT EXISTS delegations_validation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  dt_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  moniteur_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actif boolean DEFAULT true NOT NULL,
  date_delegation timestamptz DEFAULT now() NOT NULL,
  date_expiration timestamptz,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(centre_id, moniteur_id)
);

ALTER TABLE delegations_validation ENABLE ROW LEVEL SECURITY;

-- DT can read their own delegations
CREATE POLICY "DT can view delegations they created"
  ON delegations_validation FOR SELECT
  TO authenticated
  USING (dt_id = auth.uid());

-- DT can insert delegations for their centre
CREATE POLICY "DT can create delegations"
  ON delegations_validation FOR INSERT
  TO authenticated
  WITH CHECK (dt_id = auth.uid());

-- DT can update (revoke/modify) their delegations
CREATE POLICY "DT can update their delegations"
  ON delegations_validation FOR UPDATE
  TO authenticated
  USING (dt_id = auth.uid())
  WITH CHECK (dt_id = auth.uid());

-- DT can delete their delegations
CREATE POLICY "DT can delete their delegations"
  ON delegations_validation FOR DELETE
  TO authenticated
  USING (dt_id = auth.uid());

-- Moniteur can view their own delegations
CREATE POLICY "Moniteur can view own delegations"
  ON delegations_validation FOR SELECT
  TO authenticated
  USING (moniteur_id = auth.uid());

-- Admin centre can view all delegations for their centre
CREATE POLICY "Admin centre can view centre delegations"
  ON delegations_validation FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_centres
      WHERE admin_centres.profile_id = auth.uid()
        AND admin_centres.centre_id = delegations_validation.centre_id
    )
  );

-- Global admin can view all
CREATE POLICY "Admin can view all delegations"
  ON delegations_validation FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_delegations_moniteur ON delegations_validation(moniteur_id, actif);
CREATE INDEX IF NOT EXISTS idx_delegations_centre ON delegations_validation(centre_id);
CREATE INDEX IF NOT EXISTS idx_delegations_dt ON delegations_validation(dt_id);
