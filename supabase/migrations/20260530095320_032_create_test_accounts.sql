/*
  # Create 4 Functional Test Accounts

  ## Summary
  Creates 4 clean, fully-functional test accounts with proper gen_random_uuid() UUIDs
  and bcrypt cost factor 10. Previous attempts used synthetic UUIDs (d0d00001-...) with
  cost factor 6, causing "Database error querying schema" on login.

  ## Accounts (all password: Test1234!)
  1. sophie.martin@parapass.fr — parachutiste, amateur, BigAir Rochefort member
  2. nicolas.girard@parapass.fr — moniteur, BigAir Rochefort team + active delegation
  3. johnny.guerin@parapass.fr — directeur_technique, admin_centre of BigAir Rochefort
  4. bigair.admin@parapass.fr — admin_centre of BigAir Rochefort

  ## Relations
  - sophie + nicolas linked to BigAir Rochefort
  - nicolas has active delegation from johnny in delegations_validation
  - johnny + bigair.admin in admin_centres for BigAir Rochefort
  - 3 sample sauts created for sophie (en_attente validation)
*/

DO $$
DECLARE
  v_sophie   uuid;
  v_nicolas  uuid;
  v_johnny   uuid;
  v_bigair   uuid;
  v_centre   uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN

  -- 1. Create auth.users entries (skip if already exists)

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sophie.martin@parapass.fr') THEN
    v_sophie := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_sophie, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'sophie.martin@parapass.fr',
      crypt('Test1234!', gen_salt('bf', 10)),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );
  ELSE
    SELECT id INTO v_sophie FROM auth.users WHERE email = 'sophie.martin@parapass.fr';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'nicolas.girard@parapass.fr') THEN
    v_nicolas := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_nicolas, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'nicolas.girard@parapass.fr',
      crypt('Test1234!', gen_salt('bf', 10)),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );
  ELSE
    SELECT id INTO v_nicolas FROM auth.users WHERE email = 'nicolas.girard@parapass.fr';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'johnny.guerin@parapass.fr') THEN
    v_johnny := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_johnny, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'johnny.guerin@parapass.fr',
      crypt('Test1234!', gen_salt('bf', 10)),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );
  ELSE
    SELECT id INTO v_johnny FROM auth.users WHERE email = 'johnny.guerin@parapass.fr';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'bigair.admin@parapass.fr') THEN
    v_bigair := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_bigair, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'bigair.admin@parapass.fr',
      crypt('Test1234!', gen_salt('bf', 10)),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );
  ELSE
    SELECT id INTO v_bigair FROM auth.users WHERE email = 'bigair.admin@parapass.fr';
  END IF;

  -- 2. Create profiles

  IF v_sophie IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_sophie) THEN
    INSERT INTO profiles (
      id, email, nom, prenom, numero_licence, role, type_pratiquant,
      centre_id, nationalite, date_naissance, lieu_naissance, created_at
    ) VALUES (
      v_sophie, 'sophie.martin@parapass.fr',
      'Martin', 'Sophie', 'FFP-2024-8801',
      'parachutiste', 'amateur',
      v_centre, 'Française', '1995-03-12', 'Lyon', now()
    );
  END IF;

  IF v_nicolas IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_nicolas) THEN
    INSERT INTO profiles (
      id, email, nom, prenom, numero_licence, role, type_pratiquant,
      centre_id, nationalite, date_naissance, lieu_naissance, created_at
    ) VALUES (
      v_nicolas, 'nicolas.girard@parapass.fr',
      'Girard', 'Nicolas', 'BEES-2019-4521',
      'moniteur', 'moniteur',
      v_centre, 'Française', '1988-07-24', 'Bordeaux', now()
    );
  END IF;

  IF v_johnny IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_johnny) THEN
    INSERT INTO profiles (
      id, email, nom, prenom, numero_licence, role, type_pratiquant,
      centre_id, nationalite, date_naissance, lieu_naissance, created_at
    ) VALUES (
      v_johnny, 'johnny.guerin@parapass.fr',
      'Guerin', 'Johnny', 'DT-FFP-2015-0042',
      'admin_centre', 'directeur_technique',
      v_centre, 'Française', '1978-11-05', 'Rochefort', now()
    );
  END IF;

  IF v_bigair IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_bigair) THEN
    INSERT INTO profiles (
      id, email, nom, prenom, numero_licence, role, type_pratiquant,
      centre_id, nationalite, date_naissance, lieu_naissance, created_at
    ) VALUES (
      v_bigair, 'bigair.admin@parapass.fr',
      'Admin', 'BigAir', 'FFP-ADMIN-0001',
      'admin_centre', 'amateur',
      v_centre, 'Française', '1985-05-20', 'Rochefort', now()
    );
  END IF;

  -- 3. Link to BigAir via licencies_centres and admin_centres

  IF v_sophie IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM licencies_centres WHERE parachutiste_id = v_sophie AND centre_id = v_centre
  ) THEN
    INSERT INTO licencies_centres (parachutiste_id, centre_id, statut, date_adhesion, moniteur_assigne_id)
    VALUES (v_sophie, v_centre, 'actif', '2024-01-15', v_nicolas);
  END IF;

  IF v_nicolas IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM admin_centres WHERE profile_id = v_nicolas AND centre_id = v_centre
  ) THEN
    INSERT INTO admin_centres (centre_id, profile_id, role)
    VALUES (v_centre, v_nicolas, 'moniteur');
  END IF;

  IF v_johnny IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM admin_centres WHERE profile_id = v_johnny AND centre_id = v_centre
  ) THEN
    INSERT INTO admin_centres (centre_id, profile_id, role)
    VALUES (v_centre, v_johnny, 'admin');
  END IF;

  IF v_bigair IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM admin_centres WHERE profile_id = v_bigair AND centre_id = v_centre
  ) THEN
    INSERT INTO admin_centres (centre_id, profile_id, role)
    VALUES (v_centre, v_bigair, 'admin');
  END IF;

  -- 4. Delegation: johnny (DT) delegates to nicolas (moniteur)

  IF v_nicolas IS NOT NULL AND v_johnny IS NOT NULL THEN
    INSERT INTO delegations_validation (centre_id, dt_id, moniteur_id, actif, date_expiration, note)
    VALUES (
      v_centre, v_johnny, v_nicolas,
      true,
      (now() + interval '6 months')::timestamptz,
      'Délégation de validation pour les sauts standards'
    )
    ON CONFLICT (centre_id, moniteur_id) DO UPDATE
      SET dt_id = EXCLUDED.dt_id,
          actif = true,
          date_expiration = EXCLUDED.date_expiration;
  END IF;

  -- 5. Sample sauts for sophie (en_attente validation, correct categorie values)

  IF v_sophie IS NOT NULL AND v_nicolas IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM sauts WHERE parachutiste_id = v_sophie) < 3 THEN
      INSERT INTO sauts (
        parachutiste_id, date_saut, lieu, hauteur_m, nature_saut,
        categorie, statut, moniteur_id, created_at
      ) VALUES
        (v_sophie, '2026-05-10', 'BigAir Rochefort', 4000, 'entrainement', 'OA', 'en_attente', v_nicolas, now()),
        (v_sophie, '2026-05-17', 'BigAir Rochefort', 4000, 'entrainement', 'OC', 'en_attente', v_nicolas, now()),
        (v_sophie, '2026-05-24', 'BigAir Rochefort', 3000, 'entrainement', 'OR30', 'en_attente', v_nicolas, now());
    END IF;
  END IF;

END $$;
