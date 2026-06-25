/*
  # Fix profiles RLS for admin_centre role

  1. Problem
    - The admin_centre role cannot search profiles to add team members
    - Existing policy only allows 'admin' and 'moniteur' roles
    
  2. Changes
    - Add policy allowing admin_centre users to read all profiles (needed for member search)
    - This lets centre admins search and add moniteurs to their team
    
  3. Security
    - Restricted to authenticated users with admin_centre role
    - Only SELECT, no modifications allowed through this policy
*/

CREATE POLICY "Admin centre can search profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_centres ac
      WHERE ac.profile_id = auth.uid()
      AND ac.role = 'admin'
    )
  );
