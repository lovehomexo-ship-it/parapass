/*
  # Fix Maxime Leroy auth account

  Updates the encrypted_password for maxime.leroy@demo.fr to use bcrypt
  cost factor 10 (required by Supabase Auth). The previous cost factor 6
  caused "Database error querying schema" on login.

  Password set to: Test1234!
*/

UPDATE auth.users
SET
  encrypted_password = crypt('Test1234!', gen_salt('bf', 10)),
  updated_at = now()
WHERE email = 'maxime.leroy@demo.fr';
