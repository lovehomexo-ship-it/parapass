-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 086 : Compte démo lecture seule demo@parapass.fr
--
-- Ce script est à exécuter UNE SEULE FOIS dans Supabase SQL Editor.
-- Il crée l'utilisateur demo@parapass.fr et copie les données de
-- thomas.laurent@parapass.fr (compte démo parachutiste existant).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_source_id   uuid;
  v_demo_id     uuid := gen_random_uuid();
BEGIN

  -- ── 1. Récupérer l'UUID du compte source (Laurent Thomas) ─────────────────
  SELECT id INTO v_source_id
  FROM auth.users
  WHERE email = 'thomas.laurent@parapass.fr'
  LIMIT 1;

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'Compte source thomas.laurent@parapass.fr introuvable.';
  END IF;

  -- ── 2. Créer l'utilisateur auth demo@parapass.fr ──────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@parapass.fr') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_demo_id,
      'authenticated',
      'authenticated',
      'demo@parapass.fr',
      crypt('Demo1234!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      ''
    );

    -- identity entry requis par Supabase Auth
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_demo_id,
      json_build_object('sub', v_demo_id::text, 'email', 'demo@parapass.fr'),
      'email',
      v_demo_id::text,
      now(), now(), now()
    );
  ELSE
    SELECT id INTO v_demo_id FROM auth.users WHERE email = 'demo@parapass.fr';
  END IF;

  -- ── 3. Créer le profil (copie de Laurent Thomas + flags démo) ─────────────
  INSERT INTO profiles (
    id, email, nom, prenom, numero_licence, role, centre_id,
    type_pratiquant, date_naissance, lieu_naissance, nationalite,
    signature_url, avatar_url, brevet, total_sauts,
    declaration_honneur_faite, declaration_honneur_nb,
    is_demo, preferences, created_at
  )
  SELECT
    v_demo_id,
    'demo@parapass.fr',
    nom, prenom, numero_licence || '-DEMO', role, centre_id,
    type_pratiquant, date_naissance, lieu_naissance, nationalite,
    signature_url, avatar_url, brevet, total_sauts,
    declaration_honneur_faite, declaration_honneur_nb,
    true,                                      -- is_demo = true
    jsonb_build_object('demo_readonly', true), -- navigation libre, actions off
    now()
  FROM profiles
  WHERE id = v_source_id
  ON CONFLICT (id) DO NOTHING;

  -- ── 4. Copier les sauts ───────────────────────────────────────────────────
  INSERT INTO sauts (
    parachutiste_id, date_saut, lieu, hauteur_m, nature_saut,
    categorie, fonction, statut, valide_par, valide_le,
    observations, programme_saut, notation, created_at
  )
  SELECT
    v_demo_id,
    date_saut, lieu, hauteur_m, nature_saut,
    categorie, fonction, statut, valide_par, valide_le,
    observations, programme_saut, notation, created_at
  FROM sauts
  WHERE parachutiste_id = v_source_id;

  -- ── 5. Copier les licences ────────────────────────────────────────────────
  INSERT INTO licences (
    parachutiste_id, numero_licence, type_licence,
    date_delivrance, date_expiration, organisme, created_at
  )
  SELECT
    v_demo_id,
    numero_licence, type_licence,
    date_delivrance, date_expiration, organisme, created_at
  FROM licences
  WHERE parachutiste_id = v_source_id;

  -- ── 6. Copier les certificats médicaux ───────────────────────────────────
  INSERT INTO certificats_medicaux (
    parachutiste_id, date_delivrance, date_expiration,
    medecin, type_certificat, created_at
  )
  SELECT
    v_demo_id,
    date_delivrance, date_expiration,
    medecin, type_certificat, created_at
  FROM certificats_medicaux
  WHERE parachutiste_id = v_source_id;

  -- ── 7. Copier les brevets ─────────────────────────────────────────────────
  INSERT INTO brevets (
    parachutiste_id, type_brevet, date_obtention,
    numero, centre_formation, created_at
  )
  SELECT
    v_demo_id,
    type_brevet, date_obtention,
    numero, centre_formation, created_at
  FROM brevets
  WHERE parachutiste_id = v_source_id;

  -- ── 8. Copier les badges ──────────────────────────────────────────────────
  INSERT INTO badges (
    parachutiste_id, badge_id, obtenu_le, created_at
  )
  SELECT
    v_demo_id,
    badge_id, obtenu_le, created_at
  FROM badges
  WHERE parachutiste_id = v_source_id;

  -- ── 9. Copier le matériel ─────────────────────────────────────────────────
  INSERT INTO materiel (
    parachutiste_id, type_materiel, marque, modele,
    numero_serie, date_fabrication, date_revision,
    prochain_entretien, created_at
  )
  SELECT
    v_demo_id,
    type_materiel, marque, modele,
    numero_serie, date_fabrication, date_revision,
    prochain_entretien, created_at
  FROM materiel
  WHERE parachutiste_id = v_source_id;

  RAISE NOTICE 'Compte demo@parapass.fr créé avec succès (UUID: %)', v_demo_id;
END $$;
