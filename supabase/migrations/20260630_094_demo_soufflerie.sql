-- Migration 094 : Sessions soufflerie de démo pour Alexandre Dupont (demo@parapass.fr)

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'demo@parapass.fr';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'demo@parapass.fr not found, skipping soufflerie demo data';
    RETURN;
  END IF;

  INSERT INTO soufflerie_sessions (user_id, date, duree_min, tunnel, type_vol, disciplines, instructeur, notes, note_globale)
  VALUES
    (v_user_id, '2026-04-12', 20, 'Flyspot Paris', 'coaching', ARRAY['FS', 'Freestyle'], 'Julien Moreau', 'Travail sur la symétrie et le contrôle du corps. Bonne session.', 4),
    (v_user_id, '2026-05-03', 15, 'Flyspot Paris', 'solo', ARRAY['FS'], NULL, 'Session libre — consolidation des acquis de la dernière session coaching.', 3),
    (v_user_id, '2026-06-21', 25, 'Tunnel de Charleroi', 'formation', ARRAY['FS', 'VRW'], 'Marc Delcourt', 'Formation FS4 niveau débutant. Difficultés sur le slot en formation.', 4);
END $$;
