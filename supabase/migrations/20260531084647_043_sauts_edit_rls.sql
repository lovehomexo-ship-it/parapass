/*
  # Saut Edit RLS Policy

  1. Changes
    - Adds UPDATE policy on `sauts` table allowing parachutistes to edit only their own non-validated sauts
    - Validated (statut = 'valide') and refused (statut = 'refuse') sauts cannot be modified
    - Existing INSERT/SELECT/DELETE policies are not affected

  2. Security
    - Parachutiste can only UPDATE their own sauts
    - UPDATE is blocked when statut is 'valide' or 'refuse'
*/

DO $$
BEGIN
  -- Drop existing update policy if any, to avoid conflicts
  DROP POLICY IF EXISTS "Parachutiste can update own non-validated sauts" ON sauts;
  DROP POLICY IF EXISTS "parachutiste update own sauts" ON sauts;
END $$;

CREATE POLICY "Parachutiste can update own non-validated sauts"
  ON sauts
  FOR UPDATE
  TO authenticated
  USING (
    parachutiste_id = auth.uid()
    AND statut NOT IN ('valide', 'refuse')
  )
  WITH CHECK (
    parachutiste_id = auth.uid()
    AND statut NOT IN ('valide', 'refuse')
  );
