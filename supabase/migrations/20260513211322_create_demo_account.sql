/*
  # Création du compte démo ParaPass

  Crée un utilisateur de démonstration dans auth.users avec son profil
  et quelques données représentatives (licence, brevet, certif médical, sauts).

  - Email : demo@parapass.fr
  - Mot de passe : demo1234 (hash bcrypt)
  - Rôle : parachutiste
*/

DO $$
DECLARE
  demo_id uuid := gen_random_uuid();
BEGIN
  -- Vérifier si le compte existe déjà
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@parapass.fr') THEN

    -- Créer l'utilisateur dans auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      demo_id,
      '00000000-0000-0000-0000-000000000000',
      'demo@parapass.fr',
      crypt('demo1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      'authenticated',
      'authenticated'
    );

    -- Créer l'identité email
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      demo_id,
      jsonb_build_object('sub', demo_id::text, 'email', 'demo@parapass.fr'),
      'email',
      demo_id::text,
      now(),
      now()
    );

    -- Créer le profil
    INSERT INTO public.profiles (
      id, email, nom, prenom, numero_licence, role,
      type_pratiquant, nationalite, date_naissance, lieu_naissance
    ) VALUES (
      demo_id,
      'demo@parapass.fr',
      'Dupont',
      'Alexandre',
      '27-1042',
      'parachutiste',
      'amateur',
      'Française',
      '1990-06-15',
      'Lyon'
    );

    -- Licence active
    INSERT INTO public.licences (
      parachutiste_id, numero_licence, date_delivrance, date_expiration,
      organisme, statut, nom_club, code_club,
      assurance_individuelle, assurance_rc, type_licence
    ) VALUES (
      demo_id, '27-1042', '2025-01-10', '2026-01-09',
      'FFP', 'actif', 'Parachutisme Club du Rhône', 'PCR69',
      true, true, 'lps'
    );

    -- Brevet B
    INSERT INTO public.brevets (
      parachutiste_id, type_brevet, date_obtention,
      centre_delivrance, numero_brevet
    ) VALUES (
      demo_id, 'B', '2019-07-20',
      'Centre de Parachutisme de Gap-Tallard', 'B-2019-4721'
    );

    -- Certificat médical valide
    INSERT INTO public.certificats_medicaux (
      parachutiste_id, medecin, date_visite, date_expiration, type
    ) VALUES (
      demo_id,
      'Dr. Martin Bernard',
      '2025-03-01',
      '2026-03-01',
      'aptitude_totale'
    );

    -- Quelques sauts de démo
    INSERT INTO public.sauts (
      parachutiste_id, date_saut, lieu, aeronef_immat,
      nature_saut, categorie, hauteur_m, fonction,
      temps_vol_min, parachute, statut
    ) VALUES
      (demo_id, '2025-04-12', 'Gap-Tallard', 'F-HBGP', 'entrainement', 'OA', 4000, 'parachutiste', 0, 'PD-Storm 190', 'valide'),
      (demo_id, '2025-04-20', 'Gap-Tallard', 'F-HBGP', 'entrainement', 'OA', 4200, 'parachutiste', 0, 'PD-Storm 190', 'valide'),
      (demo_id, '2025-05-03', 'Spa-La Sauvenière', 'OO-TAT', 'competition', 'OC', 3800, 'parachutiste', 0, 'PD-Storm 190', 'valide'),
      (demo_id, '2025-05-10', 'Gap-Tallard', 'F-HBGP', 'entrainement', 'OA', 4000, 'parachutiste', 0, 'PD-Storm 190', 'valide'),
      (demo_id, '2025-05-11', 'Gap-Tallard', 'F-HBGP', 'entrainement', 'OR30', 2500, 'parachutiste', 0, 'PD-Storm 190', 'valide');

  END IF;
END $$;
