/*
  # Fix: recréation de jump_progression sans contraintes FK

  Supprime jump_progression et la recrée sans FK ni CHECK constraints
  pour forcer PostgREST à recharger son schema proprement.
  Les contraintes seront rajoutées une fois la connexion rétablie.
*/

-- Supprimer la table existante
DROP TABLE IF EXISTS jump_progression CASCADE;

-- Recréer sans aucune FK ni CHECK constraint
CREATE TABLE jump_progression (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jump_id UUID,
  user_id UUID,
  note_globale INTEGER,
  note_tete INTEGER,
  note_bassin INTEGER,
  note_jambes INTEGER,
  note_bras INTEGER,
  score_position NUMERIC(3,2),
  note_ouverture_voile INTEGER,
  note_atterrissage INTEGER,
  note_mental INTEGER,
  precision_metres INTEGER,
  sortie_avion TEXT,
  retour_face_sol TEXT,
  vigilance_altitude TEXT,
  ouverture TEXT,
  separation TEXT,
  trajectoire TEXT,
  declenchement TEXT,
  pilotage_voile TEXT,
  circuit_atterro TEXT,
  precision_atterro TEXT,
  gestion_urgences TEXT,
  exercices_chute TEXT,
  exercices_voile TEXT,
  observations_moniteur TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jump_progression_jump_id ON jump_progression(jump_id);
CREATE INDEX IF NOT EXISTS idx_jump_progression_user_id ON jump_progression(user_id);

ALTER TABLE jump_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progression_select"
  ON jump_progression FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "progression_insert"
  ON jump_progression FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progression_update"
  ON jump_progression FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
