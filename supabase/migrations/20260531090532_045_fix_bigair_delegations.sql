/*
  # Fix delegations for BigAir — reactivate Nicolas GIRARD demo and reassign dt_id

  1. Reactivate Nicolas GIRARD demo account delegation (actif=false → true)
  2. Reassign all BigAir delegations to Johnny Guerin as canonical DT
     so the dashboard shows all of them consistently
*/

-- Reactivate Nicolas GIRARD demo delegation
UPDATE delegations_validation
SET 
  actif = true,
  date_expiration = '2026-11-30'
WHERE moniteur_id IN (
  SELECT id FROM profiles WHERE email = 'nicolas.girard.demo@parapass.fr'
)
AND centre_id IN (
  SELECT id FROM centres WHERE nom = 'BigAir Rochefort'
);

-- Reassign all BigAir delegations to Johnny Guerin as canonical DT
-- so they all appear under the same dt_id in the dashboard
UPDATE delegations_validation
SET dt_id = (
  SELECT id FROM profiles WHERE email = 'johnny.guerin@parapass.fr' LIMIT 1
)
WHERE centre_id IN (
  SELECT id FROM centres WHERE nom = 'BigAir Rochefort'
);
