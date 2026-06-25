/*
  # Create Royan Océan Parachutisme centre

  1. New centre: Royan Océan Parachutisme
     - Located at Aérodrome de Royan-Médis
     - GPS coordinates for weather API

  2. Example créneau: opening day next week

  3. Associate existing test parachutists to this centre
     (Florian PUYBAREAU and Sophie MARTIN) so multi-centre
     selector is testable in PlanningDZ.
*/

-- Insert the centre
INSERT INTO centres (
  nom,
  numero_agrement_ffp,
  ville,
  code_postal,
  adresse,
  telephone,
  email,
  latitude,
  longitude,
  statut,
  plan
)
SELECT
  'Royan Océan Parachutisme',
  'FFP-0917',
  'Royan',
  '17200',
  'Aérodrome de Royan-Médis, 17600 Médis',
  '05 46 00 00 00',
  'contact@royan-parachutisme.fr',
  45.6284,
  -0.9789,
  'actif',
  'essai'
WHERE NOT EXISTS (
  SELECT 1 FROM centres WHERE nom = 'Royan Océan Parachutisme'
);

-- Insert a sample créneau for next week
INSERT INTO creneaux_dz (
  centre_id,
  date,
  heure_debut,
  heure_fin,
  statut,
  titre,
  message,
  nb_places_total,
  nb_places_restantes,
  altitude_prevue,
  latitude,
  longitude,
  type_saut
)
SELECT
  c.id,
  (CURRENT_DATE + INTERVAL '7 days')::date,
  '10:00',
  '17:00',
  'ouvert',
  'Journée découverte',
  'Venez découvrir notre DZ face à l''océan ! Conditions exceptionnelles.',
  15,
  15,
  3800,
  45.6284,
  -0.9789,
  ARRAY['OA','OC','Tandem']
FROM centres c
WHERE c.nom = 'Royan Océan Parachutisme'
  AND NOT EXISTS (
    SELECT 1 FROM creneaux_dz cd
    WHERE cd.centre_id = c.id
      AND cd.date = (CURRENT_DATE + INTERVAL '7 days')::date
  );

-- Associate Florian PUYBAREAU to Royan
INSERT INTO licencies_centres (parachutiste_id, centre_id, statut, date_adhesion)
SELECT p.id, c.id, 'actif', now()
FROM profiles p, centres c
WHERE p.email = 'florian.puybareau@yahoo.fr'
  AND c.nom = 'Royan Océan Parachutisme'
ON CONFLICT DO NOTHING;

-- Associate Sophie MARTIN to Royan
INSERT INTO licencies_centres (parachutiste_id, centre_id, statut, date_adhesion)
SELECT p.id, c.id, 'actif', now()
FROM profiles p, centres c
WHERE p.email = 'sophie.martin@parapass.fr'
  AND c.nom = 'Royan Océan Parachutisme'
ON CONFLICT DO NOTHING;
