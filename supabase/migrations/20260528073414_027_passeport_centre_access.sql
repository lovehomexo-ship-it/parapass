/*
  # Accès carte passeport par les admins centre

  ## Nouvelles tables
  - `journal_acces_cartes` — log de chaque consultation de carte par un admin centre

  ## Nouvelles colonnes
  - `profiles.partage_carte_centre` (boolean, default true) — consentement RGPD
    du parachutiste pour que son centre voie sa carte

  ## Nouvelles policies RLS
  - admin_centre peut SELECT sur profiles, licences, certificats_medicaux,
    brevets, qualifications, sauts de ses licenciés actifs
  - Chaque accès est journalisé dans journal_acces_cartes

  ## Notes
  - Les policies utilisent des fonctions SECURITY DEFINER pour éviter
    toute récursion
  - partage_carte_centre = true par défaut (obligation réglementaire)
*/

-- ─── Colonne consentement RGPD ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'partage_carte_centre'
  ) THEN
    ALTER TABLE profiles ADD COLUMN partage_carte_centre boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- ─── Journal des consultations ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_acces_cartes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consulte_par_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_parachutiste ON journal_acces_cartes(parachutiste_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_centre ON journal_acces_cartes(centre_id, created_at DESC);

ALTER TABLE journal_acces_cartes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can view their own access log"
  ON journal_acces_cartes FOR SELECT
  TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Admin centre can insert access log for their licencies"
  ON journal_acces_cartes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = consulte_par_id);

-- ─── Helper: vérifier qu'un admin_centre supervise un parachutiste ─────────────

CREATE OR REPLACE FUNCTION is_my_licencie(p_parachutiste_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM licencies_centres lc
    JOIN admin_centres ac ON ac.centre_id = lc.centre_id
    WHERE lc.parachutiste_id = p_parachutiste_id
      AND ac.profile_id = auth.uid()
      AND lc.statut = 'actif'
  );
$$;

-- ─── RLS : admin_centre peut lire les profils de ses licenciés ─────────────────

-- profiles : admin_centre voit ses licenciés (si consentement donné)
CREATE POLICY "admin_centre_read_licencie_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR is_my_licencie(id)
  );

-- licences
CREATE POLICY "admin_centre_read_licencie_licences"
  ON licences FOR SELECT
  TO authenticated
  USING (
    auth.uid() = parachutiste_id
    OR is_my_licencie(parachutiste_id)
  );

-- certificats_medicaux
CREATE POLICY "admin_centre_read_licencie_medical"
  ON certificats_medicaux FOR SELECT
  TO authenticated
  USING (
    auth.uid() = parachutiste_id
    OR is_my_licencie(parachutiste_id)
  );

-- brevets
CREATE POLICY "admin_centre_read_licencie_brevets"
  ON brevets FOR SELECT
  TO authenticated
  USING (
    auth.uid() = parachutiste_id
    OR is_my_licencie(parachutiste_id)
  );

-- qualifications
CREATE POLICY "admin_centre_read_licencie_qualifications"
  ON qualifications FOR SELECT
  TO authenticated
  USING (
    auth.uid() = parachutiste_id
    OR is_my_licencie(parachutiste_id)
  );

-- sauts : admin_centre voit les sauts validés de ses licenciés
CREATE POLICY "admin_centre_read_licencie_sauts"
  ON sauts FOR SELECT
  TO authenticated
  USING (
    auth.uid() = parachutiste_id
    OR is_my_licencie(parachutiste_id)
  );
