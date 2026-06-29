-- Migration 091 : Mise à jour données démo Alexandre Dupont (demo@parapass.fr)
-- Licence FFP → valide jusqu'au 31/12/2026
-- Certificat médical → valide jusqu'au 15/06/2027
-- Nombre de sauts → 47

DO $$
DECLARE
  v_demo_id uuid;
BEGIN
  SELECT id INTO v_demo_id FROM auth.users WHERE email = 'demo@parapass.fr';
  IF v_demo_id IS NULL THEN
    RAISE EXCEPTION 'Compte demo@parapass.fr introuvable';
  END IF;

  -- Licence FFP
  UPDATE licences
  SET date_expiration = '2026-12-31'
  WHERE parachutiste_id = v_demo_id
    AND type_licence = 'FFP';

  -- Certificat médical
  UPDATE certificats_medicaux
  SET date_expiration = '2027-06-15'
  WHERE parachutiste_id = v_demo_id;

  -- Nombre de sauts sur le profil
  UPDATE profiles
  SET total_sauts = 47
  WHERE id = v_demo_id;

  RAISE NOTICE 'Données démo mises à jour pour % (UUID: %)', 'demo@parapass.fr', v_demo_id;
END $$;
