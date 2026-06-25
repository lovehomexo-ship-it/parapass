/*
  # Fix centres RLS policy to avoid recursive subquery deadlock
  
  The existing "Authenticated can view active centres" policy uses a subquery on
  admin_centres which itself references centres via FK. This can cause PostgREST
  to return empty results for admin_centre users.

  Fix: drop conflicting policies and replace with a simpler non-recursive version
  that uses profiles.admin_centre_id directly.

  Also ensures BigAir Rochefort centre is set to 'actif'.
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Authenticated can view active centres" ON centres;
DROP POLICY IF EXISTS "Authenticated users can read centres" ON centres;

-- New simple policy: authenticated users see active centres OR their own centre via profile
CREATE POLICY "Authenticated can view centres"
  ON centres FOR SELECT
  TO authenticated
  USING (
    statut = 'actif'
    OR id IN (
      SELECT admin_centre_id FROM profiles WHERE id = auth.uid() AND admin_centre_id IS NOT NULL
    )
  );

-- Make sure BigAir Rochefort is active
UPDATE centres SET statut = 'actif' WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
