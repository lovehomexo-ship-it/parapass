/*
  # Restrictions médicales & interdictions de sauts (Module 3 — page 4 carnet FFP)

  1. Modifications table "certificats_medicaux"
     - restrictions_medicales (text) : ex "port de verres correcteurs"

  2. Nouvelle table "interdictions_sauts"
     - date_interdiction, duree, motif
     - cachet_url, signature_url
     - Seul le DT/admin peut écrire, le parachutiste peut lire

  3. Sécurité RLS stricte sur les deux objets
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='certificats_medicaux' AND column_name='restrictions_medicales'
  ) THEN
    ALTER TABLE certificats_medicaux ADD COLUMN restrictions_medicales text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS interdictions_sauts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_interdiction date NOT NULL,
  duree text DEFAULT '',
  motif text DEFAULT '',
  cachet_url text,
  signature_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE interdictions_sauts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste lit ses interdictions"
  ON interdictions_sauts FOR SELECT
  TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Admin ou moniteur cree interdiction"
  ON interdictions_sauts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moniteur')
    )
  );

CREATE POLICY "Admin ou moniteur modifie interdiction"
  ON interdictions_sauts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moniteur')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moniteur')
    )
  );
