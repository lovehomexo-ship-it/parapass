-- LA FICHE AÉRONEF — ce que le chef d'avionnage lit sur la fiche de pesée.
--
-- Jusqu'ici un avion n'avait que des places, un plafond et une « masse max »
-- comparée aux seuls sauteurs : ni la masse à vide, ni le pilote, ni le
-- carburant n'entraient dans le calcul, et le centrage n'existait pas.
--
-- Tout est facultatif : un champ vide reste vide, et l'écran dit ce qu'il ne
-- peut pas calculer plutôt que d'inventer un chiffre. `masse_max_kg` garde son
-- nom et devient explicitement la MTOW (masse maximale au décollage).

alter table public.aeronefs
  add column if not exists nom                         text,
  add column if not exists masse_max_atterrissage_kg   numeric,
  add column if not exists parachute_pilote            boolean not null default true,
  add column if not exists masse_pilote_kg             numeric,
  add column if not exists vario_montee_min_ftmin      integer,
  add column if not exists vario_montee_max_ftmin      integer,
  add column if not exists taux_descente_max_ftmin     integer,
  add column if not exists temps_kero_min              integer,
  add column if not exists conso_rotation_l            numeric,
  add column if not exists rotations_par_plein         integer,
  add column if not exists reserve_kero_l              numeric,
  add column if not exists densite_carburant           numeric not null default 0.8,
  add column if not exists couleur                     text,
  add column if not exists corde_mac_m                 numeric,
  add column if not exists distance_reference_m        numeric,
  -- Le domaine de centrage : une suite de sommets [masse kg, % de corde].
  add column if not exists domaine_centrage            jsonb,
  add column if not exists bras_vide_m                 numeric,
  add column if not exists bras_pilote_m               numeric,
  add column if not exists bras_carburant_m            numeric,
  -- Un bras de levier par siège parachutiste, du siège n°1 au dernier.
  add column if not exists bras_places_m               numeric[];

alter table public.aeronefs drop constraint if exists aeronefs_couleur_hex;
alter table public.aeronefs add constraint aeronefs_couleur_hex
  check (couleur is null or couleur ~ '^#[0-9A-Fa-f]{6}$');
alter table public.aeronefs drop constraint if exists aeronefs_vario_ordre;
alter table public.aeronefs add constraint aeronefs_vario_ordre
  check (vario_montee_min_ftmin is null or vario_montee_max_ftmin is null
         or vario_montee_min_ftmin <= vario_montee_max_ftmin);
alter table public.aeronefs drop constraint if exists aeronefs_densite;
alter table public.aeronefs add constraint aeronefs_densite
  check (densite_carburant > 0.5 and densite_carburant < 1);

-- La démo : un Pilatus PC-6 B2H4 renseigné avec les valeurs d'exemple d'un
-- PC-6 B2H2 (corde 1,9 m, référence 3,0 m), pour que la planche de démo montre
-- un vrai bilan de masse et centrage.
update public.aeronefs a set
  nom = coalesce(a.nom, 'Pilatus de démo'),
  masse_a_vide_kg = coalesce(a.masse_a_vide_kg, 1410),
  -- L'ancienne « masse max » de la démo (1 100 kg) bornait les seuls sauteurs ;
  -- c'est désormais la MTOW, celle de la fiche de pesée.
  masse_max_kg = case when a.masse_a_vide_kg is null then 2800 else a.masse_max_kg end,
  masse_max_atterrissage_kg = coalesce(a.masse_max_atterrissage_kg, 2660),
  masse_pilote_kg = coalesce(a.masse_pilote_kg, 85),
  vario_montee_min_ftmin = coalesce(a.vario_montee_min_ftmin, 1000),
  vario_montee_max_ftmin = coalesce(a.vario_montee_max_ftmin, 1500),
  taux_descente_max_ftmin = coalesce(a.taux_descente_max_ftmin, 4500),
  temps_kero_min = coalesce(a.temps_kero_min, 20),
  conso_rotation_l = coalesce(a.conso_rotation_l, 55),
  rotations_par_plein = coalesce(a.rotations_par_plein, 4),
  reserve_kero_l = coalesce(a.reserve_kero_l, 100),
  couleur = coalesce(a.couleur, '#1E45FF'),
  corde_mac_m = coalesce(a.corde_mac_m, 1.9),
  distance_reference_m = coalesce(a.distance_reference_m, 3.0),
  domaine_centrage = coalesce(a.domaine_centrage, '[[0,11],[1450,11],[2200,25],[2800,32],[2800,38],[0,38]]'::jsonb),
  bras_vide_m = coalesce(a.bras_vide_m, 3.376),
  bras_pilote_m = coalesce(a.bras_pilote_m, 3.05),
  bras_carburant_m = coalesce(a.bras_carburant_m, 3.93),
  bras_places_m = coalesce(a.bras_places_m, array[3.05,3.55,4.05,4.55,5.05,3.65,4.15,4.65,5.15,3.55]::numeric[])
from public.centres c
where c.id = a.centre_id and c.is_demo and a.type ilike '%pilatus%';
