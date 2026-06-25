/*
  # Fix missing auth.identities for test accounts

  ## Summary
  Supabase Auth requires a row in auth.identities for every user who signs in
  with email/password. When users are inserted directly into auth.users (bypassing
  the Auth API), the identities row is not created automatically, causing
  signInWithPassword to silently fail.

  This migration inserts the missing identity rows for all 4 test accounts.
*/

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  u.email,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  now(),
  now()
FROM auth.users u
WHERE u.email IN (
  'sophie.martin@parapass.fr',
  'nicolas.girard@parapass.fr',
  'johnny.guerin@parapass.fr',
  'bigair.admin@parapass.fr'
)
AND NOT EXISTS (
  SELECT 1 FROM auth.identities i
  WHERE i.user_id = u.id AND i.provider = 'email'
);
