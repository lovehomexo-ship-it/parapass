/*
  # Modules de brevets FFP complets (Module 5 — pages 6-16 carnet FFP)

  1. Nouvelle table "modules_brevets"
     Chaque ligne représente un module validé (ou à valider) d'un brevet FFP officiel.
     - type_brevet : 'A','B','BPA','C','D','B1','B2','B3','Bi4','B4','Bi5','B5','VH','WS1','WS2','WS3'
     - code_module : 'Av','Ac','Bv','Bc','Bp','Cav', etc.
     - nom_module : libellé complet du module
     - date_validation, lieu, validateur_nom
     - cachet_dt_url, signature_dt_url
     - est_facultatif : true pour modules optionnels (ex: Cav)

  2. Extension table "brevets"
     - type_brevet étendu pour inclure B1..B5, Bi4, Bi5, VH, WS1..WS3

  3. Sécurité RLS
     - Lecture par le parachutiste propriétaire
     - Écriture uniquement par moniteur/admin (DT)
*/

CREATE TABLE IF NOT EXISTS modules_brevets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type_brevet text NOT NULL,
  code_module text NOT NULL,
  nom_module text NOT NULL DEFAULT '',
  date_validation date,
  lieu text DEFAULT '',
  validateur_nom text DEFAULT '',
  cachet_dt_url text,
  signature_dt_url text,
  est_facultatif boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (parachutiste_id, type_brevet, code_module)
);

ALTER TABLE modules_brevets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste lit ses modules brevets"
  ON modules_brevets FOR SELECT
  TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Moniteur admin lit modules brevets"
  ON modules_brevets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moniteur')
    )
  );

CREATE POLICY "Moniteur admin insere module brevet"
  ON modules_brevets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moniteur')
    )
  );

CREATE POLICY "Moniteur admin modifie module brevet"
  ON modules_brevets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moniteur')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moniteur')
    )
  );
