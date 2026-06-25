/*
  # Table audit_log — journal immuable des validations

  1. Nouvelle table "audit_log"
     - INSERT ONLY : personne ne peut modifier ou supprimer les entrées
     - Enregistre chaque validation de saut, refus, validation de module
     - Contient les données avant/après, le hash, le timestamp UTC

  2. Sécurité RLS stricte
     - INSERT : tout utilisateur authentifié peut insérer (via l'app)
     - SELECT : le parachutiste lit ses propres entrées, moniteur/admin lit tout
     - UPDATE : interdit à tous
     - DELETE : interdit à tous

  Note : En production, renforcer avec une politique Supabase "no delete"
  au niveau du service role pour empêcher même les admins de supprimer.
*/

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  acteur_id uuid REFERENCES profiles(id),
  acteur_nom text NOT NULL DEFAULT '',
  acteur_role text NOT NULL DEFAULT '',
  acteur_licence_moniteur text,
  cible_id uuid,
  cible_type text NOT NULL DEFAULT '',
  donnees_avant jsonb,
  donnees_apres jsonb,
  hash_donnees text,
  timestamp_utc timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- INSERT ouvert à tout utilisateur authentifié
CREATE POLICY "Utilisateur authentifie peut inserer audit log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = acteur_id);

-- SELECT : parachutiste lit les entrées qui le concernent, moniteur/admin voit tout
CREATE POLICY "Parachutiste lit ses entrees audit"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    cible_id = auth.uid()
    OR acteur_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moniteur')
    )
  );

-- Pas de politique UPDATE → UPDATE interdit
-- Pas de politique DELETE → DELETE interdit
