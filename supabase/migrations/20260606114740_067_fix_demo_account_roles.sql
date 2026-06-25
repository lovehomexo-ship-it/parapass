-- Fix demo account profiles: trigger created parachutiste defaults, override with correct values
UPDATE profiles SET
  role             = 'admin_centre',
  type_pratiquant  = 'professionnel',
  nom              = 'SKYDIVE',
  prenom           = 'Admin',
  nationalite      = 'Française',
  is_demo          = TRUE
WHERE email = 'admin@skydive-atlantique.fr';

UPDATE profiles SET
  role             = 'parachutiste',
  type_pratiquant  = 'amateur',
  nom              = 'LAURENT',
  prenom           = 'Thomas',
  numero_licence   = 'FFP-2023-04521',
  is_demo          = TRUE
WHERE email = 'thomas.laurent@parapass.fr';

-- Ensure centre link for admin
UPDATE profiles p
SET
  centre_id       = c.id,
  admin_centre_id = c.id
FROM centres c
WHERE c.nom = 'SkyDive Atlantique'
  AND p.email = 'admin@skydive-atlantique.fr';

-- Ensure centre link for Thomas (BigAir)
UPDATE profiles p
SET centre_id = c.id
FROM centres c
WHERE c.nom ILIKE '%BigAir%'
  AND p.email = 'thomas.laurent@parapass.fr';

-- Ensure admin_centres row exists for SkyDive admin
INSERT INTO admin_centres (centre_id, profile_id, role)
SELECT c.id, p.id, 'admin'
FROM centres c, profiles p
WHERE c.nom = 'SkyDive Atlantique'
  AND p.email = 'admin@skydive-atlantique.fr'
ON CONFLICT DO NOTHING;
