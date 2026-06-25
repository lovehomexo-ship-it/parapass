/*
  # Contacts d'urgence (Module 2 — page 2 carnet FFP)

  1. Nouvelle table "contacts_urgence"
     - contact_urgence_nom
     - contact_urgence_telephone
     - contact_urgence_adresse
     - created_at

  2. Sécurité
     - RLS activé
     - Lecture/écriture par le parachutiste propriétaire
     - Lecture supplémentaire par moniteur/admin du même centre
*/

CREATE TABLE IF NOT EXISTS contacts_urgence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parachutiste_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nom text NOT NULL DEFAULT '',
  telephone text DEFAULT '',
  adresse text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contacts_urgence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parachutiste lit ses contacts urgence"
  ON contacts_urgence FOR SELECT
  TO authenticated
  USING (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste insere ses contacts urgence"
  ON contacts_urgence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste modifie ses contacts urgence"
  ON contacts_urgence FOR UPDATE
  TO authenticated
  USING (auth.uid() = parachutiste_id)
  WITH CHECK (auth.uid() = parachutiste_id);

CREATE POLICY "Parachutiste supprime ses contacts urgence"
  ON contacts_urgence FOR DELETE
  TO authenticated
  USING (auth.uid() = parachutiste_id);
