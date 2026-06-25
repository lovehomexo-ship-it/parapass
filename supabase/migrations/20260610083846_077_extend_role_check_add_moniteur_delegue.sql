
-- Drop the old role check constraint and add moniteur_delegue + directeur_technique
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY[
    'parachutiste'::text,
    'moniteur'::text,
    'moniteur_delegue'::text,
    'admin'::text,
    'admin_centre'::text,
    'directeur_technique'::text
  ]));

-- Now fix Kevin Lorin's role
UPDATE public.profiles
SET role = 'moniteur_delegue'
WHERE email = 'kevin.lorin@gmail.com';
