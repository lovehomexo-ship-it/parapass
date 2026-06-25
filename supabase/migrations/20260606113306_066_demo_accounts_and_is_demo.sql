-- ─── 1. Add is_demo columns ──────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE centres  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 2. Create demo accounts ──────────────────────────────────────────────────
DO $$
DECLARE
  v_sophie     profiles%ROWTYPE;
  v_bigair_id  UUID;
  v_thomas_id  UUID;
  v_skydive_id UUID;
  v_admin_id   UUID;
  v_saut       RECORD;
  v_lic        RECORD;
  v_brev       RECORD;
  v_certif     RECORD;
BEGIN

  SELECT * INTO v_sophie FROM profiles WHERE email = 'sophie.martin@parapass.fr' LIMIT 1;
  SELECT id INTO v_bigair_id FROM centres WHERE nom ILIKE '%BigAir%' LIMIT 1;

  -- ── Thomas Laurent ──────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'thomas.laurent@parapass.fr') THEN
    v_thomas_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      v_thomas_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'thomas.laurent@parapass.fr',
      crypt('DemoPass2026!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), 'thomas.laurent@parapass.fr', v_thomas_id,
      jsonb_build_object('sub', v_thomas_id::text, 'email', 'thomas.laurent@parapass.fr'),
      'email', now(), now(), now()
    );

    INSERT INTO profiles (
      id, email, nom, prenom, date_naissance, lieu_naissance, nationalite,
      type_brevet_principal, numero_licence, role, type_pratiquant, centre_id, is_demo
    ) VALUES (
      v_thomas_id, 'thomas.laurent@parapass.fr', 'LAURENT', 'Thomas',
      COALESCE(v_sophie.date_naissance, '1993-07-15'),
      COALESCE(v_sophie.lieu_naissance, 'Lyon'),
      COALESCE(v_sophie.nationalite, 'Française'),
      v_sophie.type_brevet_principal, 'FFP-2023-04521',
      'parachutiste', 'amateur', v_bigair_id, TRUE
    ) ON CONFLICT (id) DO NOTHING;

    IF v_sophie.id IS NOT NULL THEN
      -- Licences
      FOR v_lic IN SELECT * FROM licences WHERE parachutiste_id = v_sophie.id LOOP
        INSERT INTO licences (
          parachutiste_id, numero_licence, date_delivrance, date_expiration,
          organisme, statut, code_club, nom_club,
          assurance_individuelle, assurance_rc,
          beneficiaire_nom, beneficiaire_lien, type_licence
        ) VALUES (
          v_thomas_id, 'FFP-2023-04521',
          v_lic.date_delivrance, v_lic.date_expiration,
          v_lic.organisme, v_lic.statut, v_lic.code_club, v_lic.nom_club,
          v_lic.assurance_individuelle, v_lic.assurance_rc,
          v_lic.beneficiaire_nom, v_lic.beneficiaire_lien, v_lic.type_licence
        );
      END LOOP;

      -- Brevets
      FOR v_brev IN SELECT * FROM brevets WHERE parachutiste_id = v_sophie.id LOOP
        INSERT INTO brevets (parachutiste_id, type_brevet, date_obtention, centre_delivrance, numero_brevet)
        VALUES (v_thomas_id, v_brev.type_brevet, v_brev.date_obtention, v_brev.centre_delivrance, v_brev.numero_brevet)
        ON CONFLICT DO NOTHING;
      END LOOP;

      -- Certificats médicaux
      FOR v_certif IN SELECT * FROM certificats_medicaux WHERE parachutiste_id = v_sophie.id LOOP
        INSERT INTO certificats_medicaux (parachutiste_id, medecin, date_visite, date_expiration, type)
        VALUES (v_thomas_id, v_certif.medecin, v_certif.date_visite, v_certif.date_expiration, v_certif.type);
      END LOOP;

      -- Sauts (max 50)
      FOR v_saut IN SELECT * FROM sauts WHERE parachutiste_id = v_sophie.id ORDER BY date_saut DESC LIMIT 50 LOOP
        INSERT INTO sauts (
          id, parachutiste_id, date_saut, lieu, aeronef_immat,
          nature_saut, categorie, hauteur_m, fonction,
          temps_vol_min, parachute, voilure_principale,
          statut, moniteur_id, observations, programme
        ) VALUES (
          gen_random_uuid(), v_thomas_id,
          v_saut.date_saut, v_saut.lieu, v_saut.aeronef_immat,
          v_saut.nature_saut, v_saut.categorie, v_saut.hauteur_m, v_saut.fonction,
          v_saut.temps_vol_min, v_saut.parachute, v_saut.voilure_principale,
          'valide', v_saut.moniteur_id, v_saut.observations, v_saut.programme
        );
      END LOOP;

      IF v_bigair_id IS NOT NULL THEN
        INSERT INTO licencies_centres (centre_id, parachutiste_id, date_adhesion, statut)
        VALUES (v_bigair_id, v_thomas_id, now(), 'actif')
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- ── SkyDive Atlantique ───────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM centres WHERE nom = 'SkyDive Atlantique') THEN
    INSERT INTO centres (nom, ville, code, is_demo)
    VALUES ('SkyDive Atlantique', 'La Rochelle', '0442', TRUE)
    RETURNING id INTO v_skydive_id;
  ELSE
    SELECT id INTO v_skydive_id FROM centres WHERE nom = 'SkyDive Atlantique' LIMIT 1;
    UPDATE centres SET is_demo = TRUE WHERE id = v_skydive_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@skydive-atlantique.fr') THEN
    v_admin_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      v_admin_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@skydive-atlantique.fr',
      crypt('DemoPass2026!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), 'admin@skydive-atlantique.fr', v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@skydive-atlantique.fr'),
      'email', now(), now(), now()
    );

    INSERT INTO profiles (
      id, email, nom, prenom, role, type_pratiquant, nationalite,
      centre_id, admin_centre_id, is_demo
    ) VALUES (
      v_admin_id, 'admin@skydive-atlantique.fr', 'SKYDIVE', 'Admin',
      'admin_centre', 'professionnel', 'Française',
      v_skydive_id, v_skydive_id, TRUE
    ) ON CONFLICT (id) DO NOTHING;

    -- Link as admin_centre
    INSERT INTO admin_centres (centre_id, profile_id, role)
    VALUES (v_skydive_id, v_admin_id, 'admin')
    ON CONFLICT DO NOTHING;

    -- 15 licenciés BigAir → SkyDive
    IF v_bigair_id IS NOT NULL THEN
      INSERT INTO licencies_centres (centre_id, parachutiste_id, date_adhesion, statut)
      SELECT v_skydive_id, parachutiste_id, now(), 'actif'
      FROM licencies_centres
      WHERE centre_id = v_bigair_id
      LIMIT 15
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

END $$;
