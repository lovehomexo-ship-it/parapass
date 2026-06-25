/*
  # Add preferences column to profiles

  ## Change
  Adds a `preferences` jsonb column to the `profiles` table to store
  per-user UI preferences such as `suivi_dgac` (DGAC threshold tracking).

  ## Default behaviour
  - Professionals (type_pratiquant = 'professionnel') get suivi_dgac = true
  - Everyone else gets suivi_dgac = false (no noisy "Seuil DGAC" banner by default)
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}';

-- Professionals: opt-in by default
UPDATE profiles
SET preferences = jsonb_set(COALESCE(preferences, '{}'), '{suivi_dgac}', 'true')
WHERE type_pratiquant = 'professionnel';

-- Everyone else: explicitly false so the banner never shows
UPDATE profiles
SET preferences = jsonb_set(COALESCE(preferences, '{}'), '{suivi_dgac}', 'false')
WHERE type_pratiquant IS NULL
   OR type_pratiquant != 'professionnel';
