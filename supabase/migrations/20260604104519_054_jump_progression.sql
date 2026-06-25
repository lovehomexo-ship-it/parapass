/*
  # Table jump_progression — Données de progression par saut

  Stocke toutes les données d'évaluation technique liées à chaque saut :
  note globale, éléments techniques, notes de position corps, notes voile/atterrissage,
  exercices pratiqués et observations moniteur.

  Tables créées :
  - `jump_progression` : données de progression rattachées à chaque saut (sauts.id)

  Colonnes :
  - note_globale (1-5) : évaluation globale du saut
  - 11 éléments techniques : 'non' | 'en_cours' | 'maitrise'
  - 4 notes de position corps (1-5) + score_position calculé
  - 3 notes voile/atterrissage (1-5) : ouverture_voile, atterrissage, mental
  - precision_metres : distance au cible en mètres
  - exercices_chute, exercices_voile : texte libre
  - observations_moniteur : texte libre

  Sécurité :
  - RLS activé
  - SELECT/INSERT/UPDATE réservés au propriétaire (user_id = auth.uid())
*/

CREATE TABLE IF NOT EXISTS jump_progression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jump_id UUID REFERENCES sauts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),

  note_globale INTEGER CHECK (note_globale BETWEEN 1 AND 5),

  sortie_avion TEXT CHECK (sortie_avion IN ('non', 'en_cours', 'maitrise')),
  retour_face_sol TEXT CHECK (retour_face_sol IN ('non', 'en_cours', 'maitrise')),
  vigilance_altitude TEXT CHECK (vigilance_altitude IN ('non', 'en_cours', 'maitrise')),
  ouverture TEXT CHECK (ouverture IN ('non', 'en_cours', 'maitrise')),
  separation TEXT CHECK (separation IN ('non', 'en_cours', 'maitrise')),
  trajectoire TEXT CHECK (trajectoire IN ('non', 'en_cours', 'maitrise')),
  declenchement TEXT CHECK (declenchement IN ('non', 'en_cours', 'maitrise')),
  pilotage_voile TEXT CHECK (pilotage_voile IN ('non', 'en_cours', 'maitrise')),
  circuit_atterro TEXT CHECK (circuit_atterro IN ('non', 'en_cours', 'maitrise')),
  precision_atterro TEXT CHECK (precision_atterro IN ('non', 'en_cours', 'maitrise')),
  gestion_urgences TEXT CHECK (gestion_urgences IN ('non', 'en_cours', 'maitrise')),

  note_tete INTEGER CHECK (note_tete BETWEEN 1 AND 5),
  note_bassin INTEGER CHECK (note_bassin BETWEEN 1 AND 5),
  note_jambes INTEGER CHECK (note_jambes BETWEEN 1 AND 5),
  note_bras INTEGER CHECK (note_bras BETWEEN 1 AND 5),
  score_position NUMERIC(3,2),

  note_ouverture_voile INTEGER CHECK (note_ouverture_voile BETWEEN 1 AND 5),
  note_atterrissage INTEGER CHECK (note_atterrissage BETWEEN 1 AND 5),
  note_mental INTEGER CHECK (note_mental BETWEEN 1 AND 5),
  precision_metres INTEGER CHECK (precision_metres BETWEEN 0 AND 500),

  exercices_chute TEXT DEFAULT '',
  exercices_voile TEXT DEFAULT '',
  observations_moniteur TEXT DEFAULT '',

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jump_progression_jump_id ON jump_progression(jump_id);
CREATE INDEX IF NOT EXISTS idx_jump_progression_user_id ON jump_progression(user_id);

ALTER TABLE jump_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own progression"
  ON jump_progression FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own progression"
  ON jump_progression FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own progression"
  ON jump_progression FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
