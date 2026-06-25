
-- Seed complete jump logs + profile data for the two BigAir moniteurs.
-- nature_saut allowed: entrainement, competition, manifestation, travail_aerien, nuit, largage, tandem

DO $$
DECLARE
  v_maxime  uuid := '49eeff7e-9934-4601-af19-fd773a6a5e6a';
  v_nicolas uuid := 'e8ae2da6-8082-452f-af41-dc0fa50761af';
BEGIN

  -- 1. Enrich profiles
  UPDATE public.profiles SET
    date_naissance         = '1985-03-12',
    lieu_naissance         = 'Bordeaux',
    nationalite            = 'Française',
    numero_brevet          = 'BPA',
    numero_licence         = 'FFP-2008-3311',
    type_brevet_moniteur   = 'BEES',
    numero_brevet_moniteur = 'BEES-2020-3311',
    moniteur_valide_par_dt = true,
    type_pratiquant        = 'professionnel'
  WHERE id = v_maxime;

  UPDATE public.profiles SET
    date_naissance         = '1980-07-28',
    lieu_naissance         = 'Lyon',
    nationalite            = 'Française',
    numero_brevet          = 'BPA',
    numero_licence         = 'FFP-2003-1421',
    type_brevet_moniteur   = 'BPJEPS',
    numero_brevet_moniteur = 'BPJEPS-2018-1421',
    moniteur_valide_par_dt = true,
    type_pratiquant        = 'professionnel'
  WHERE id = v_nicolas;

  -- 2. Sauts de Maxime LEROY — 30 sauts récents
  INSERT INTO public.sauts (parachutiste_id, date_saut, lieu, aeronef_immat, nature_saut, categorie, hauteur_m, hauteur_ouverture, fonction, voilure_principale, programme, moniteur_id, statut, valide_par, valide_le) VALUES
    (v_maxime,'2026-06-01','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,1000,'instructeur','Pilot 168','PAC moniteur',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-05-28','BigAir Rochefort','F-GHVO','travail_aerien','OC',4000,900,'instructeur','Pilot 168','PAC 3',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-05-25','BigAir Rochefort','F-GHVO','entrainement','OC',4200,1000,'instructeur','Pilot 168','VRW 4-way',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-05-20','BigAir Rochefort','F-GHVO','travail_aerien','OA',4000,900,'instructeur','Pilot 168','PAC 5',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-05-15','Gap-Tallard','F-GXBA','competition','OC',4200,800,'parachutiste','Pilot 168','VRW 8-way',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-05-14','Gap-Tallard','F-GXBA','competition','OC',4200,800,'parachutiste','Pilot 168','VRW 8-way',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-05-13','Gap-Tallard','F-GXBA','entrainement','OC',4200,800,'parachutiste','Pilot 168','VRW 8-way prep',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-04-28','BigAir Rochefort','F-GHVO','travail_aerien','OC',4000,900,'instructeur','Pilot 168','PAC 2',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-04-20','Niort-Marais Poitevin','F-GKPA','entrainement','OC',2700,800,'parachutiste','Pilot 168','Freefly',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-04-19','Niort-Marais Poitevin','F-GKPA','entrainement','OC',2700,800,'parachutiste','Pilot 168','Freefly',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-04-10','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,1000,'instructeur','Pilot 168','PAC 4',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-03-30','BigAir Rochefort','F-GHVO','travail_aerien','OC',4000,900,'instructeur','Pilot 168','PAC 1',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-03-22','La Ferté-Gaucher','F-GMLF','entrainement','OC',4200,800,'parachutiste','Pilot 168','Précision atterrissage',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-03-21','La Ferté-Gaucher','F-GMLF','entrainement','OC',4200,800,'parachutiste','Pilot 168','Précision atterrissage',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2026-02-28','BigAir Rochefort','F-GHVO','travail_aerien','OC',4000,900,'instructeur','Pilot 168','PAC 6',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-12-14','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,1000,'instructeur','Pilot 168','PAC moniteur',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-11-22','Saintes-Coudre','F-GPCA','entrainement','OC',3800,900,'parachutiste','Pilot 168','Freefly HD',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-11-08','Saintes-Coudre','F-GPCA','entrainement','OC',3800,900,'parachutiste','Pilot 168','Freefly HD',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-10-18','BigAir Rochefort','F-GHVO','travail_aerien','OA',4000,1000,'instructeur','Pilot 168','PAC 2',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-09-27','Gap-Tallard','F-GXBA','competition','OC',4200,800,'parachutiste','Pilot 168','CF 4-way',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-09-26','Gap-Tallard','F-GXBA','competition','OC',4200,800,'parachutiste','Pilot 168','CF 4-way',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-09-25','Gap-Tallard','F-GXBA','entrainement','OC',4200,800,'parachutiste','Pilot 168','CF 4-way prep',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-08-15','Skydive Empuriabrava','EC-MBA','entrainement','OC',4200,700,'parachutiste','Pilot 168','Big way 20-way',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-08-14','Skydive Empuriabrava','EC-MBA','entrainement','OC',4200,700,'parachutiste','Pilot 168','Big way 20-way',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-07-20','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,1000,'instructeur','Pilot 168','PAC 7',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-06-14','La Ferté-Gaucher','F-GMLF','competition','OC',4200,800,'parachutiste','Pilot 168','VRW 4-way',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-05-10','BigAir Rochefort','F-GHVO','travail_aerien','OA',4000,900,'instructeur','Pilot 168','PAC 3',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-04-19','Niort-Marais Poitevin','F-GKPA','entrainement','OC',2700,800,'parachutiste','Pilot 168','Tracking',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-03-08','BigAir Rochefort','F-GHVO','travail_aerien','OC',4000,1000,'instructeur','Pilot 168','PAC 1',v_nicolas,'valide','Nicolas GIRARD',now()),
    (v_maxime,'2025-02-15','BigAir Rochefort','F-GHVO','entrainement','OC',4200,900,'instructeur','Pilot 168','Formation moniteur',v_nicolas,'valide','Nicolas GIRARD',now());

  -- 3. Sauts de Nicolas GIRARD — 30 sauts récents
  INSERT INTO public.sauts (parachutiste_id, date_saut, lieu, aeronef_immat, nature_saut, categorie, hauteur_m, hauteur_ouverture, fonction, voilure_principale, programme, moniteur_id, statut, valide_par, valide_le) VALUES
    (v_nicolas,'2026-06-03','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,800,'instructeur','Sabre2 150','PAC 6',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-06-03','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,800,'instructeur','Sabre2 150','PAC 7',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-05-30','BigAir Rochefort','F-GHVO','travail_aerien','OA',4000,800,'instructeur','Sabre2 150','PAC 3',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-05-25','CEP de Cahors','F-GCAH','competition','OC',4500,700,'parachutiste','Sabre2 150','CF 4-way',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-05-24','CEP de Cahors','F-GCAH','competition','OC',4500,700,'parachutiste','Sabre2 150','CF 4-way',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-05-23','CEP de Cahors','F-GCAH','competition','OC',4500,700,'parachutiste','Sabre2 150','CF 4-way prep',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-05-18','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,800,'instructeur','Sabre2 150','PAC 4',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-05-10','Skydive Empuriabrava','EC-MBA','entrainement','OC',4200,700,'parachutiste','Sabre2 150','Freefly tracking',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-05-09','Skydive Empuriabrava','EC-MBA','entrainement','OC',4200,700,'parachutiste','Sabre2 150','Freefly tracking',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-05-08','Skydive Empuriabrava','EC-MBA','entrainement','OC',4200,700,'parachutiste','Sabre2 150','Big way 20-way',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-04-26','BigAir Rochefort','F-GHVO','travail_aerien','OC',4000,800,'instructeur','Sabre2 150','PAC 2',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-04-20','BigAir Rochefort','F-GHVO','travail_aerien','OA',4200,800,'instructeur','Sabre2 150','PAC 5',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-04-12','Royan Atlantique','F-GRYA','entrainement','OC',4000,800,'parachutiste','Sabre2 150','Swooping',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-04-11','Royan Atlantique','F-GRYA','entrainement','OC',4000,800,'parachutiste','Sabre2 150','Swooping',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2026-03-29','BigAir Rochefort','F-GHVO','travail_aerien','OC',4000,800,'instructeur','Sabre2 150','PAC 1',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-12-20','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,800,'instructeur','Sabre2 150','PAC 8',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-11-15','Saintes-Coudre','F-GPCA','entrainement','OC',3800,800,'parachutiste','Sabre2 150','Wingsuit tracking',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-10-25','BigAir Rochefort','F-GHVO','travail_aerien','OA',4000,800,'instructeur','Sabre2 150','PAC 4',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-10-11','CEP de Cahors','F-GCAH','competition','OC',4500,700,'parachutiste','Sabre2 150','CF 8-way',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-10-10','CEP de Cahors','F-GCAH','competition','OC',4500,700,'parachutiste','Sabre2 150','CF 8-way',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-09-06','Skydive Empuriabrava','EC-MBA','entrainement','OC',4200,700,'parachutiste','Sabre2 150','Big way 40-way',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-09-05','Skydive Empuriabrava','EC-MBA','entrainement','OC',4200,700,'parachutiste','Sabre2 150','Big way 40-way',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-08-22','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,800,'instructeur','Sabre2 150','PAC 5',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-07-12','Royan Atlantique','F-GRYA','entrainement','OC',4000,800,'parachutiste','Sabre2 150','Swooping comp',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-06-28','BigAir Rochefort','F-GHVO','travail_aerien','OA',4000,800,'instructeur','Sabre2 150','PAC 2',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-05-17','La Ferté-Gaucher','F-GMLF','competition','OC',4200,700,'parachutiste','Sabre2 150','CF 4-way',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-04-05','BigAir Rochefort','F-GHVO','travail_aerien','OC',4200,800,'instructeur','Sabre2 150','PAC 6',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-03-22','CEP de Cahors','F-GCAH','entrainement','OC',4500,700,'parachutiste','Sabre2 150','CF training',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-02-08','BigAir Rochefort','F-GHVO','travail_aerien','OC',4000,800,'instructeur','Sabre2 150','PAC 3',v_maxime,'valide','Maxime LEROY',now()),
    (v_nicolas,'2025-01-18','BigAir Rochefort','F-GHVO','entrainement','OC',4200,800,'instructeur','Sabre2 150','Formation senior',v_maxime,'valide','Maxime LEROY',now());

END $$;
