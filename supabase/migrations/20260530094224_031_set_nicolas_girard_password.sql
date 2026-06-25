/*
  # Set test password for Nicolas GIRARD (moniteur)

  Sets a bcrypt password hash for the demo moniteur account
  so it can be used for testing the delegation validation flow.

  Email: nicolas.girard.demo@parapass.fr
  Password: Test1234!
*/

UPDATE auth.users
SET
  encrypted_password = crypt('Test1234!', gen_salt('bf')),
  updated_at = now()
WHERE id = 'd0d00001-0000-0000-0000-000000000010';
