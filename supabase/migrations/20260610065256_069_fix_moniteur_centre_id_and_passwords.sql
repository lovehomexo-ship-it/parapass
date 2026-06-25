
-- Fix Nicolas Girard: set centre_id to BigAir + ensure fresh password
UPDATE public.profiles
SET centre_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
WHERE id = '11111111-1111-1111-1111-111111111106'
  AND email = 'nicolas.girard@demo.fr';

-- Ensure strong bcrypt cost (10) for both moniteur accounts so GoTrue accepts them
UPDATE auth.users
SET
  encrypted_password  = crypt('Test1234!', gen_salt('bf', 10)),
  email_confirmed_at  = COALESCE(email_confirmed_at, now()),
  updated_at          = now()
WHERE email IN ('nicolas.girard@demo.fr', 'maxime.leroy@demo.fr');

-- Ensure Maxime Leroy also has centre_id set
UPDATE public.profiles
SET centre_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
WHERE email = 'maxime.leroy@demo.fr'
  AND centre_id IS NULL;

-- Ensure delegation_validation rows exist for both
INSERT INTO delegations_validation (moniteur_id, centre_id, actif, date_delegation)
SELECT p.id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true, now()
FROM public.profiles p
WHERE p.email IN ('nicolas.girard@demo.fr', 'maxime.leroy@demo.fr')
  AND NOT EXISTS (
    SELECT 1 FROM delegations_validation dv
    WHERE dv.moniteur_id = p.id
      AND dv.centre_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  );
