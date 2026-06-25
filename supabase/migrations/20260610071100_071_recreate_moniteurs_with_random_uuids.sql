
DO $$
DECLARE
  v_maxime  uuid := gen_random_uuid();
  v_nicolas uuid := gen_random_uuid();
  v_bigair  uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_dt      uuid := '00a08887-084d-44d5-b7c5-b7d57a7f2319';
  v_old_maxime  uuid := '11111111-1111-1111-1111-111111111105';
  v_old_nicolas uuid := '11111111-1111-1111-1111-111111111106';
BEGIN

  -- 1. Remove all FK references to old IDs
  UPDATE sauts SET moniteur_id = NULL
    WHERE moniteur_id IN (v_old_maxime, v_old_nicolas);
  DELETE FROM sauts
    WHERE parachutiste_id IN (v_old_maxime, v_old_nicolas);
  UPDATE licencies_centres SET moniteur_assigne_id = NULL
    WHERE moniteur_assigne_id IN (v_old_maxime, v_old_nicolas);
  DELETE FROM licencies_centres
    WHERE parachutiste_id IN (v_old_maxime, v_old_nicolas);
  DELETE FROM delegations_validation
    WHERE moniteur_id IN (v_old_maxime, v_old_nicolas);

  -- 2. Delete old rows
  DELETE FROM public.profiles WHERE id      IN (v_old_maxime, v_old_nicolas);
  DELETE FROM auth.identities  WHERE user_id IN (v_old_maxime, v_old_nicolas);
  DELETE FROM auth.users       WHERE id      IN (v_old_maxime, v_old_nicolas);

  -- 3. Insert new auth rows (trigger creates minimal profiles automatically)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
  VALUES
    (v_maxime,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'maxime.leroy@demo.fr',    crypt('Test1234!', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
    (v_nicolas, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'nicolas.girard@demo.fr', crypt('Test1234!', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false);

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  VALUES
    (v_maxime,  v_maxime,  'maxime.leroy@demo.fr',    'email', jsonb_build_object('sub', v_maxime::text,  'email', 'maxime.leroy@demo.fr'),    now(), now(), now()),
    (v_nicolas, v_nicolas, 'nicolas.girard@demo.fr', 'email', jsonb_build_object('sub', v_nicolas::text, 'email', 'nicolas.girard@demo.fr'), now(), now(), now());

  -- 4. Update profiles with full data (trigger created them with minimal data above)
  UPDATE public.profiles SET
    nom = 'LEROY', prenom = 'Maxime', role = 'moniteur', type_pratiquant = 'professionnel',
    numero_brevet_moniteur = 'BEES-2020-3311', type_brevet_moniteur = 'BEES',
    moniteur_valide_par_dt = true, centre_id = v_bigair
  WHERE id = v_maxime;

  UPDATE public.profiles SET
    nom = 'GIRARD', prenom = 'Nicolas', role = 'moniteur', type_pratiquant = 'professionnel',
    numero_brevet_moniteur = 'BPJEPS-2018-1421', type_brevet_moniteur = 'BPJEPS',
    moniteur_valide_par_dt = true, centre_id = v_bigair
  WHERE id = v_nicolas;

  -- 5. Create delegations with required dt_id
  INSERT INTO delegations_validation (moniteur_id, centre_id, dt_id, actif, date_delegation)
  VALUES
    (v_maxime,  v_bigair, v_dt, true, now()),
    (v_nicolas, v_bigair, v_dt, true, now());

END $$;
