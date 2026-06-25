/*
  # Fix BigAir moniteur memberships

  1. Remove fake Florian PUYBAREAU (parachutiste role) entries from admin_centres
     - These accounts have role='parachutiste' but are incorrectly listed as 'moniteur'
     in admin_centres, causing them to appear in the moniteur picker for Sophie.

  2. Ensure Nicolas GIRARD, Maxime LEROY appear as moniteurs for BigAir
     - Both demo accounts should be in admin_centres with role='moniteur'

  3. Set placeholder brevet values on demo moniteur profiles so they display
     correctly in the UI (the filter was checking for non-null values).
     We use the profile role='moniteur' as the authoritative check instead.
*/

-- Step 1: Remove fake Florian PUYBAREAU entries (parachutiste accounts in admin_centres as moniteur)
DELETE FROM admin_centres
WHERE profile_id IN (
  SELECT id FROM profiles
  WHERE nom = 'PUYBAREAU'
    AND prenom = 'Florian'
    AND role = 'parachutiste'
);

-- Step 2: Ensure Nicolas GIRARD (nicolas.girard@parapass.fr) is moniteur of BigAir
INSERT INTO admin_centres (centre_id, profile_id, role)
SELECT c.id, p.id, 'moniteur'
FROM centres c
CROSS JOIN profiles p
WHERE c.nom = 'BigAir Rochefort'
  AND p.email = 'nicolas.girard@parapass.fr'
ON CONFLICT (centre_id, profile_id) DO UPDATE SET role = 'moniteur';

-- Step 3: Ensure Nicolas GIRARD demo account is moniteur of BigAir
INSERT INTO admin_centres (centre_id, profile_id, role)
SELECT c.id, p.id, 'moniteur'
FROM centres c
CROSS JOIN profiles p
WHERE c.nom = 'BigAir Rochefort'
  AND p.email = 'nicolas.girard.demo@parapass.fr'
ON CONFLICT (centre_id, profile_id) DO UPDATE SET role = 'moniteur';

-- Step 4: Ensure Maxime LEROY is moniteur of BigAir
INSERT INTO admin_centres (centre_id, profile_id, role)
SELECT c.id, p.id, 'moniteur'
FROM centres c
CROSS JOIN profiles p
WHERE c.nom = 'BigAir Rochefort'
  AND p.email = 'maxime.leroy@demo.fr'
ON CONFLICT (centre_id, profile_id) DO UPDATE SET role = 'moniteur';

-- Step 5: Set brevet placeholder on demo moniteur profiles that have none
-- This ensures the UI can display brevet info
UPDATE profiles
SET
  numero_brevet_moniteur = CASE
    WHEN email = 'nicolas.girard@parapass.fr' THEN 'BPJEPS-2018-1421'
    WHEN email = 'nicolas.girard.demo@parapass.fr' THEN 'BPJEPS-2018-1422'
    WHEN email = 'maxime.leroy@demo.fr' THEN 'BEES-2020-3311'
    ELSE numero_brevet_moniteur
  END,
  type_brevet_moniteur = CASE
    WHEN email IN ('nicolas.girard@parapass.fr', 'nicolas.girard.demo@parapass.fr') THEN 'BPJEPS'
    WHEN email = 'maxime.leroy@demo.fr' THEN 'BEES'
    ELSE type_brevet_moniteur
  END
WHERE email IN (
  'nicolas.girard@parapass.fr',
  'nicolas.girard.demo@parapass.fr',
  'maxime.leroy@demo.fr'
)
AND numero_brevet_moniteur IS NULL;
