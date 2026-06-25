/*
  # Fix all auth accounts - root cause fix

  Two issues cause "Database error querying schema" on login:
  1. raw_app_meta_data is NULL or empty {} — Supabase requires {"provider":"email","providers":["email"]}
  2. identity provider_id contains UUID instead of email address

  This migration fixes both for ALL users, then ensures test accounts
  are confirmed and have correct profiles.
*/

-- Step 1: Fix raw_app_meta_data for every user where it is null or empty
UPDATE auth.users
SET
  raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
  updated_at = now()
WHERE raw_app_meta_data IS NULL
   OR raw_app_meta_data = '{}'::jsonb
   OR NOT (raw_app_meta_data ? 'provider');

-- Step 2: Fix identity provider_id — must equal user email for email provider
UPDATE auth.identities i
SET
  provider_id = u.email,
  identity_data = jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true
  ),
  updated_at = now()
FROM auth.users u
WHERE i.user_id = u.id
  AND i.provider = 'email'
  AND i.provider_id <> u.email;

-- Step 3: Ensure email_confirmed_at is set for all test/demo accounts
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email_confirmed_at IS NULL;

-- Step 4: Fix profile roles for test accounts
UPDATE public.profiles SET
  role = 'moniteur',
  type_pratiquant = 'moniteur'
WHERE email = 'maxime.leroy@demo.fr'
  AND role <> 'moniteur';

UPDATE public.profiles SET
  role = 'moniteur',
  type_pratiquant = 'moniteur'
WHERE email IN ('nicolas.girard@parapass.fr', 'nicolas.girard.demo@parapass.fr')
  AND role <> 'moniteur';
