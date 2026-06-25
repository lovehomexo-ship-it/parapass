/*
  # Incidents / Procédure de secours (Module 4 — page 5 carnet FFP)

  1. Nouvelle table "incidents"
     - date_incident, lieu, motif (ex: "ouverture secours")
     - Visible par parachutiste ET admin/moniteur du centre

  2. Sécurité RLS
     - Parachutiste : lecture seule
     - Moniteur/admin : lecture + écriture
*/

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_incident date NOT NULL,
  lieu text DEFAULT '',
  motif text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste lit ses incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Moniteur admin lit les incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moniteur')
    )
  );

CREATE POLICY "Moniteur admin cree incident"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moniteur')
    )
  );

CREATE POLICY "Moniteur admin modifie incident"
  ON incidents FOR UPDATE
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
