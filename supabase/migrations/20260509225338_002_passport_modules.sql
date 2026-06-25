/*
  # Module Passeport, Alertes, Badges, Matériel

  ## Nouvelles tables
  1. licences — Licences FFP/DGAC du parachutiste
  2. brevets — Brevets obtenus (A, B, BPA, C, D, PAC, etc.)
  3. certificats_medicaux — Certificats d'aptitude médicale
  4. centres_licencies — Relation many-to-many parachutiste ↔ centre
  5. qualifications — Qualifications (moniteur tandem, DT, etc.)
  6. alertes — Notifications intelligentes stockées
  7. badges — Badges/jalons débloqués
  8. materiels — Équipements parachutisme
  9. maintenances — Historique de maintenance du matériel

  ## Sécurité
  - RLS activée sur toutes les tables
  - Chaque parachutiste ne voit et modifie que ses propres données
*/

-- ─── LICENCES ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS licences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  numero_licence text NOT NULL DEFAULT '',
  date_delivrance date,
  date_expiration date,
  organisme text NOT NULL DEFAULT 'FFP' CHECK (organisme IN ('FFP', 'DGAC', 'autre')),
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'expire', 'suspendu')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE licences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can read own licences"
  ON licences FOR SELECT TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can insert own licences"
  ON licences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can update own licences"
  ON licences FOR UPDATE TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can delete own licences"
  ON licences FOR DELETE TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE INDEX IF NOT EXISTS idx_licences_parachutiste ON licences(parachutiste_id);

-- ─── BREVETS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brevets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type_brevet text NOT NULL CHECK (type_brevet IN ('A', 'B', 'BPA', 'C', 'D', 'PAC', 'tandem', 'wingsuit', 'voile_contact', 'BASE', 'indoor')),
  date_obtention date NOT NULL,
  centre_delivrance text NOT NULL DEFAULT '',
  numero_brevet text,
  scan_diplome_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE brevets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can read own brevets"
  ON brevets FOR SELECT TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can insert own brevets"
  ON brevets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can update own brevets"
  ON brevets FOR UPDATE TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can delete own brevets"
  ON brevets FOR DELETE TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE INDEX IF NOT EXISTS idx_brevets_parachutiste ON brevets(parachutiste_id);

-- ─── CERTIFICATS MÉDICAUX ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certificats_medicaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  medecin text NOT NULL DEFAULT '',
  date_visite date NOT NULL,
  date_expiration date NOT NULL,
  type text NOT NULL DEFAULT 'aptitude_totale' CHECK (type IN ('aptitude_totale', 'aptitude_restrictive', 'inapte')),
  scan_certificat_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE certificats_medicaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can read own certificats"
  ON certificats_medicaux FOR SELECT TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can insert own certificats"
  ON certificats_medicaux FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can update own certificats"
  ON certificats_medicaux FOR UPDATE TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can delete own certificats"
  ON certificats_medicaux FOR DELETE TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE INDEX IF NOT EXISTS idx_certificats_parachutiste ON certificats_medicaux(parachutiste_id);

-- ─── CENTRES LICENCIES (many-to-many) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS centres_licencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  date_adhesion date NOT NULL,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),
  numero_adhesion text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (parachutiste_id, centre_id)
);

ALTER TABLE centres_licencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can read own centres_licencies"
  ON centres_licencies FOR SELECT TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can insert own centres_licencies"
  ON centres_licencies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can update own centres_licencies"
  ON centres_licencies FOR UPDATE TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can delete own centres_licencies"
  ON centres_licencies FOR DELETE TO authenticated
  USING (auth.uid() = parachutiste_id);

-- ─── QUALIFICATIONS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('moniteur_tandem', 'directeur_technique', 'initiateur_VR', 'initiateur_freestyle', 'formateur_PAC', 'largueur', 'pilote_planeur')),
  date_obtention date NOT NULL,
  date_expiration date,
  organisme_delivrance text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can read own qualifications"
  ON qualifications FOR SELECT TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can insert own qualifications"
  ON qualifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can update own qualifications"
  ON qualifications FOR UPDATE TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can delete own qualifications"
  ON qualifications FOR DELETE TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE INDEX IF NOT EXISTS idx_qualifications_parachutiste ON qualifications(parachutiste_id);

-- ─── ALERTES ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('licence_expire', 'certificat_medical', 'materiel_revision', 'saut_requis', 'qualification_expire', 'brevet_anniversaire')),
  titre text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  date_echeance date,
  urgence text NOT NULL DEFAULT 'info' CHECK (urgence IN ('critique', 'attention', 'info')),
  lue boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alertes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can read own alertes"
  ON alertes FOR SELECT TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can insert own alertes"
  ON alertes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can update own alertes"
  ON alertes FOR UPDATE TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can delete own alertes"
  ON alertes FOR DELETE TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE INDEX IF NOT EXISTS idx_alertes_parachutiste ON alertes(parachutiste_id);
CREATE INDEX IF NOT EXISTS idx_alertes_lue ON alertes(parachutiste_id, lue);

-- ─── BADGES ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type_badge text NOT NULL,
  date_obtention timestamptz NOT NULL DEFAULT now(),
  notifie boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (parachutiste_id, type_badge)
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can read own badges"
  ON badges FOR SELECT TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can insert own badges"
  ON badges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can update own badges"
  ON badges FOR UPDATE TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE INDEX IF NOT EXISTS idx_badges_parachutiste ON badges(parachutiste_id);

-- ─── PROFILS — champs étendus ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='date_adhesion_ffp') THEN
    ALTER TABLE profiles ADD COLUMN date_adhesion_ffp date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='numero_brevet') THEN
    ALTER TABLE profiles ADD COLUMN numero_brevet text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='type_brevet_principal') THEN
    ALTER TABLE profiles ADD COLUMN type_brevet_principal text;
  END IF;
END $$;

-- ─── MATERIELS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS materiels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('parachute_principal', 'parachute_secours', 'conteneur', 'aad', 'altimetre', 'casque', 'combinaison', 'autre')),
  marque text NOT NULL DEFAULT '',
  modele text NOT NULL DEFAULT '',
  numero_serie text,
  date_fabrication date,
  date_acquisition date,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'remise', 'vendu', 'hors_service')),
  photo_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE materiels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can read own materiels"
  ON materiels FOR SELECT TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can insert own materiels"
  ON materiels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can update own materiels"
  ON materiels FOR UPDATE TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste can delete own materiels"
  ON materiels FOR DELETE TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE INDEX IF NOT EXISTS idx_materiels_parachutiste ON materiels(parachutiste_id);

-- ─── MAINTENANCES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  materiel_id uuid NOT NULL REFERENCES materiels(id) ON DELETE CASCADE,
  type_maintenance text NOT NULL CHECK (type_maintenance IN ('pliage_secours', 'revision_aad', 'controle_altimetre', 'inspection_conteneur', 'autre')),
  date_maintenance date NOT NULL,
  prochain_echeance date,
  technicien text NOT NULL DEFAULT '',
  centre text,
  notes text,
  document_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste can read own maintenances via materiel"
  ON maintenances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM materiels
      WHERE materiels.id = maintenances.materiel_id
      AND materiels.parachutiste_id = auth.uid()
    )
  );

CREATE POLICY "Parachutiste can insert own maintenances via materiel"
  ON maintenances FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM materiels
      WHERE materiels.id = maintenances.materiel_id
      AND materiels.parachutiste_id = auth.uid()
    )
  );

CREATE POLICY "Parachutiste can update own maintenances via materiel"
  ON maintenances FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM materiels
      WHERE materiels.id = maintenances.materiel_id
      AND materiels.parachutiste_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM materiels
      WHERE materiels.id = maintenances.materiel_id
      AND materiels.parachutiste_id = auth.uid()
    )
  );

CREATE POLICY "Parachutiste can delete own maintenances via materiel"
  ON maintenances FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM materiels
      WHERE materiels.id = maintenances.materiel_id
      AND materiels.parachutiste_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_maintenances_materiel ON maintenances(materiel_id);

-- ─── SAUT — champ matériel ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='materiel_id') THEN
    ALTER TABLE sauts ADD COLUMN materiel_id uuid REFERENCES materiels(id) ON DELETE SET NULL;
  END IF;
END $$;
