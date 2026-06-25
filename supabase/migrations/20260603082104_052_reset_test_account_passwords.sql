/*
  # Reset passwords for all test accounts to Test1234!

  Sets the bcrypt-hashed password for all demo/test accounts and ensures
  email_confirmed_at is set so they can sign in without any confirmation step.

  Accounts covered:
  - kevin.lorin@gmail.com
  - sophie.martin@parapass.fr
  - maxime.leroy@demo.fr
  - nicolas.girard@demo.fr
  - nicolas.girard@parapass.fr
  - johnny.guerin@parapass.fr
  - bigair.admin@parapass.fr
*/

UPDATE auth.users
SET
  encrypted_password = crypt('Test1234!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email IN (
  'kevin.lorin@gmail.com',
  'sophie.martin@parapass.fr',
  'maxime.leroy@demo.fr',
  'nicolas.girard@demo.fr',
  'nicolas.girard@parapass.fr',
  'johnny.guerin@parapass.fr',
  'bigair.admin@parapass.fr'
);
