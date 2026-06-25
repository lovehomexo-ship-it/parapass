-- Kevin LORIN (a73d3889-18b4-441e-bda5-20ca0cd9942e) has role=moniteur_delegue
-- but no delegation row exists. Create it for BigAir Rochefort.
INSERT INTO delegations_validation (moniteur_id, centre_id, dt_id, actif, date_delegation)
VALUES (
  'a73d3889-18b4-441e-bda5-20ca0cd9942e',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'd0ad77f7-41cc-4d39-86b4-01a233bf305b',
  true,
  now()
)
ON CONFLICT (centre_id, moniteur_id) DO UPDATE SET actif = true;
