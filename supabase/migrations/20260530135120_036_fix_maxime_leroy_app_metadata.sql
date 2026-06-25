/*
  # Fix maxime.leroy@demo.fr auth record

  Two issues preventing login:
  1. raw_app_meta_data was NULL — Supabase Auth requires {"provider":"email","providers":["email"]}
  2. Identity provider_id was the UUID instead of the email address

  Also ensures all other demo/test accounts have correct raw_app_meta_data.
*/

-- Fix raw_app_meta_data for maxime.leroy
UPDATE auth.users
SET raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
    updated_at = now()
WHERE email = 'maxime.leroy@demo.fr';

-- Fix the identity: provider_id must be the email, not the UUID
UPDATE auth.identities
SET provider_id = 'maxime.leroy@demo.fr',
    identity_data = '{"sub":"11111111-1111-1111-1111-111111111105","email":"maxime.leroy@demo.fr","email_verified":true}'::jsonb,
    updated_at = now()
WHERE user_id = '11111111-1111-1111-1111-111111111105'
  AND provider = 'email';

-- Apply same raw_app_meta_data fix to all test accounts that may be missing it
UPDATE auth.users
SET raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
    updated_at = now()
WHERE email IN (
  'sophie.martin@parapass.fr',
  'nicolas.girard@parapass.fr',
  'johnny.guerin@parapass.fr',
  'bigair.admin@parapass.fr'
)
AND (raw_app_meta_data IS NULL OR raw_app_meta_data = '{}'::jsonb);
