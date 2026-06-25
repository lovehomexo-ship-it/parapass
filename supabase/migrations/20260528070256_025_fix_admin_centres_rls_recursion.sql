/*
  # Fix infinite recursion in admin_centres RLS policies

  ## Problem
  The existing RLS policies on admin_centres self-reference the same table in
  subqueries (e.g. SELECT FROM admin_centres WHERE profile_id = auth.uid()),
  causing infinite recursion (PostgreSQL error 42P17).

  ## Solution
  1. Drop all existing recursive policies on admin_centres
  2. Create a SECURITY DEFINER helper function that bypasses RLS to check
     membership — this breaks the recursion
  3. Recreate policies using the helper function
*/

-- Helper function to check if current user is a member of admin_centres
-- SECURITY DEFINER bypasses RLS so no recursion occurs
CREATE OR REPLACE FUNCTION is_admin_centre_member(p_centre_id uuid, p_role text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_centres
    WHERE profile_id = auth.uid()
      AND centre_id = p_centre_id
      AND (p_role IS NULL OR role = p_role)
  );
$$;

-- Helper: get all centre_ids for the current user
CREATE OR REPLACE FUNCTION get_my_admin_centre_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT centre_id FROM admin_centres WHERE profile_id = auth.uid();
$$;

-- Drop all existing policies on admin_centres
DROP POLICY IF EXISTS "Admin can view their centre memberships" ON admin_centres;
DROP POLICY IF EXISTS "Admin can insert their own membership" ON admin_centres;
DROP POLICY IF EXISTS "Admin can delete memberships in their centre" ON admin_centres;

-- Recreate non-recursive policies

-- SELECT: members can see their own rows and rows in their centres
CREATE POLICY "Members can view their admin_centres rows"
  ON admin_centres FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR centre_id IN (SELECT get_my_admin_centre_ids())
  );

-- INSERT: user can insert their own membership OR admins of the centre can add others
CREATE POLICY "Members can insert into their admin_centres"
  ON admin_centres FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR centre_id IN (SELECT get_my_admin_centre_ids())
  );

-- UPDATE: admins of the centre can update memberships
CREATE POLICY "Admins can update admin_centres in their centre"
  ON admin_centres FOR UPDATE
  TO authenticated
  USING (centre_id IN (SELECT get_my_admin_centre_ids()))
  WITH CHECK (centre_id IN (SELECT get_my_admin_centre_ids()));

-- DELETE: admins of the centre can delete memberships
CREATE POLICY "Admins can delete admin_centres in their centre"
  ON admin_centres FOR DELETE
  TO authenticated
  USING (centre_id IN (SELECT get_my_admin_centre_ids()));
