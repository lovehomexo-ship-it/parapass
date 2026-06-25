/*
  # Add admin_centre to profiles role constraint
*/
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['parachutiste'::text, 'moniteur'::text, 'admin'::text, 'admin_centre'::text]));
