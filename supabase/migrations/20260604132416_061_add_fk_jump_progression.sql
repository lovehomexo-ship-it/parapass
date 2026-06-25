/*
  # Ajouter FK sur jump_progression → sauts et auth.users

  Sans FK, la jointure PostgREST `sauts!jump_id` échoue silencieusement,
  ce qui fait que progData reste vide même si les lignes existent.
*/

DO $$
BEGIN
  -- FK jump_id → sauts.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jump_progression_jump_id_fkey'
    AND table_name = 'jump_progression'
  ) THEN
    ALTER TABLE jump_progression
      ADD CONSTRAINT jump_progression_jump_id_fkey
      FOREIGN KEY (jump_id) REFERENCES sauts(id) ON DELETE CASCADE;
  END IF;

  -- FK user_id → auth.users.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jump_progression_user_id_fkey'
    AND table_name = 'jump_progression'
  ) THEN
    ALTER TABLE jump_progression
      ADD CONSTRAINT jump_progression_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
