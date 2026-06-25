/*
  # Verify and fix RLS on jump_progression for Sophie Martin

  The data was already injected (migration 058). This migration verifies
  the RLS policies allow Sophie to read her own jump_progression rows,
  and adds any missing policies.
*/

-- Check what policies exist on jump_progression
DO $$
BEGIN
  -- Ensure RLS is enabled
  ALTER TABLE jump_progression ENABLE ROW LEVEL SECURITY;
END $$;

-- Add SELECT policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'jump_progression'
    AND policyname = 'Users can view own jump progression'
  ) THEN
    CREATE POLICY "Users can view own jump progression"
      ON jump_progression FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add INSERT policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'jump_progression'
    AND policyname = 'Users can insert own jump progression'
  ) THEN
    CREATE POLICY "Users can insert own jump progression"
      ON jump_progression FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add UPDATE policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'jump_progression'
    AND policyname = 'Users can update own jump progression'
  ) THEN
    CREATE POLICY "Users can update own jump progression"
      ON jump_progression FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
