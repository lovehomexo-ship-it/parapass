
-- ── Fix Maxime Leroy password ──────────────────────────────────────────────────
UPDATE auth.users
SET
  encrypted_password = crypt('Test1234!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at         = now()
WHERE email = 'maxime.leroy@demo.fr';

-- ── Create / fix Nicolas Girard ────────────────────────────────────────────────
DO $$
DECLARE
  v_uid       uuid := '11111111-1111-1111-1111-111111111106';
  v_bigair_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_dt_id     uuid := '44189402-3ea4-48e4-8d57-48564f8216b1';
  v_existing  uuid;
BEGIN
  SELECT id INTO v_existing FROM auth.users WHERE email = 'nicolas.girard@demo.fr';

  IF v_existing IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      is_sso_user, is_anonymous
    ) VALUES (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'nicolas.girard@demo.fr',
      crypt('Test1234!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(), now(),
      false, false
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider,
      identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_uid, v_uid,
      'nicolas.girard@demo.fr', 'email',
      jsonb_build_object('sub', v_uid::text, 'email', 'nicolas.girard@demo.fr'),
      now(), now(), now()
    );
  ELSE
    v_uid := v_existing;
    UPDATE auth.users
    SET
      encrypted_password = crypt('Test1234!', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at         = now()
    WHERE id = v_uid;
  END IF;

  INSERT INTO public.profiles (
    id, email, nom, prenom, role, type_pratiquant,
    numero_brevet_moniteur, type_brevet_moniteur, moniteur_valide_par_dt,
    centre_id
  ) VALUES (
    v_uid, 'nicolas.girard@demo.fr',
    'GIRARD', 'Nicolas',
    'moniteur', 'professionnel',
    'BPJEPS-2018-1421', 'BPJEPS', true,
    v_bigair_id
  )
  ON CONFLICT (id) DO UPDATE SET
    nom              = EXCLUDED.nom,
    prenom           = EXCLUDED.prenom,
    role             = EXCLUDED.role,
    type_pratiquant  = EXCLUDED.type_pratiquant;

  INSERT INTO delegations_validation (moniteur_id, centre_id, dt_id, actif, date_delegation)
  SELECT v_uid, v_bigair_id, v_dt_id, true, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM delegations_validation
    WHERE moniteur_id = v_uid AND centre_id = v_bigair_id
  );
END $$;
