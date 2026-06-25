/*
  # Fix brevets type constraint + insert demo data
  Updates the brevets check constraint to include all valid types,
  then inserts full demo session for BigAir Rochefort.
*/

-- Fix brevets constraint
ALTER TABLE brevets DROP CONSTRAINT IF EXISTS brevets_type_brevet_check;
ALTER TABLE brevets ADD CONSTRAINT brevets_type_brevet_check
  CHECK (type_brevet = ANY (ARRAY[
    'A','B','BPA','C','D','PAC','tandem','wingsuit','voile_contact','BASE','indoor',
    'B1','B2','B3','Bi4','B4','Bi5','B5','VH','WS1','WS2','WS3'
  ]));

-- ─── auth.users ───────────────────────────────────────────────────────────────

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous)
VALUES
  ('d0d00001-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','sophie.martin.demo@parapass.fr', '$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'2 years',       now(),'{}','{}',false,false,false),
  ('d0d00001-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','thomas.bernard.demo@parapass.fr','$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'3 years',       now(),'{}','{}',false,false,false),
  ('d0d00001-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','claire.dubois.demo@parapass.fr', '$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'1 year',        now(),'{}','{}',false,false,false),
  ('d0d00001-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','lucas.moreau.demo@parapass.fr',  '$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'4 years',       now(),'{}','{}',false,false,false),
  ('d0d00001-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','amelie.leroy.demo@parapass.fr',  '$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'18 months',     now(),'{}','{}',false,false,false),
  ('d0d00001-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','hugo.simon.demo@parapass.fr',    '$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'6 months',      now(),'{}','{}',false,false,false),
  ('d0d00001-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000000','emma.petit.demo@parapass.fr',    '$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'5 years',       now(),'{}','{}',false,false,false),
  ('d0d00001-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000000','maxime.roux.demo@parapass.fr',   '$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'27 months',     now(),'{}','{}',false,false,false),
  ('d0d00001-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000000','chloe.fournier.demo@parapass.fr','$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'8 months',      now(),'{}','{}',false,false,false),
  ('d0d00001-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000000','nicolas.girard.demo@parapass.fr','$2a$06$YdahGGUhP80QMdAh/wi5jOMkmtq.faQgzePBzNmbq2w.3kj9toSGi',now(),'authenticated','authenticated',now()-interval'7 years',       now(),'{}','{}',false,false,false)
ON CONFLICT (id) DO NOTHING;

-- ─── centre ───────────────────────────────────────────────────────────────────

UPDATE centres SET
  nom='BigAir Rochefort', numero_agrement_ffp='FFP-0917', siret='49234567800012',
  adresse='Aérodrome de Rochefort-Saint-Agnant, RD 137E3', ville='Rochefort', code_postal='17300',
  telephone='05 46 99 12 34', email='contact@bigair-rochefort.fr', site_web='https://bigair-rochefort.fr',
  latitude=45.8878, longitude=-0.9731,
  dt_nom='PUYBAREAU', dt_prenom='Florian', dt_licence_numero='BEES-1-15-0917', dt_licence_type='BEES',
  statut='actif', plan='centre', slug='bigair-rochefort',
  description='Centre de parachutisme FFP agréé depuis 2008. Situé sur l''aérodrome de Rochefort-Saint-Agnant, BigAir accueille débutants et confirmés toute l''année.'
WHERE id='a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

UPDATE profiles SET role='admin_centre', nom='PUYBAREAU', prenom='Florian', admin_centre_id='a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
WHERE id='44189402-3ea4-48e4-8d57-48564f8216b1';

INSERT INTO admin_centres (centre_id, profile_id, role)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','44189402-3ea4-48e4-8d57-48564f8216b1','admin')
ON CONFLICT (centre_id, profile_id) DO UPDATE SET role='admin';

-- ─── profiles ────────────────────────────────────────────────────────────────

INSERT INTO profiles (id, email, nom, prenom, numero_licence, role, centre_id, nationalite, created_at)
VALUES
  ('d0d00001-0000-0000-0000-000000000001','sophie.martin.demo@parapass.fr', 'MARTIN',  'Sophie', 'FFP-45621-0917','parachutiste','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'2 years'),
  ('d0d00001-0000-0000-0000-000000000002','thomas.bernard.demo@parapass.fr','BERNARD', 'Thomas', 'FFP-38291-0917','parachutiste','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'3 years'),
  ('d0d00001-0000-0000-0000-000000000003','claire.dubois.demo@parapass.fr', 'DUBOIS',  'Claire', 'FFP-29301-0917','parachutiste','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'1 year'),
  ('d0d00001-0000-0000-0000-000000000004','lucas.moreau.demo@parapass.fr',  'MOREAU',  'Lucas',  'FFP-51847-0917','parachutiste','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'4 years'),
  ('d0d00001-0000-0000-0000-000000000005','amelie.leroy.demo@parapass.fr',  'LEROY',   'Amélie', 'FFP-67234-0917','parachutiste','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'18 months'),
  ('d0d00001-0000-0000-0000-000000000006','hugo.simon.demo@parapass.fr',    'SIMON',   'Hugo',   'FFP-44129-0917','parachutiste','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'6 months'),
  ('d0d00001-0000-0000-0000-000000000007','emma.petit.demo@parapass.fr',    'PETIT',   'Emma',   'FFP-33918-0917','parachutiste','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'5 years'),
  ('d0d00001-0000-0000-0000-000000000008','maxime.roux.demo@parapass.fr',   'ROUX',    'Maxime', 'FFP-71203-0917','parachutiste','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'27 months'),
  ('d0d00001-0000-0000-0000-000000000009','chloe.fournier.demo@parapass.fr','FOURNIER','Chloé',  'FFP-28476-0917','parachutiste','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'8 months'),
  ('d0d00001-0000-0000-0000-000000000010','nicolas.girard.demo@parapass.fr','GIRARD',  'Nicolas','FFP-59034-0917','moniteur',    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','Française',now()-interval'7 years')
ON CONFLICT (id) DO UPDATE SET nom=EXCLUDED.nom, prenom=EXCLUDED.prenom, centre_id=EXCLUDED.centre_id;

INSERT INTO admin_centres (centre_id, profile_id, role)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','d0d00001-0000-0000-0000-000000000010','moniteur')
ON CONFLICT (centre_id, profile_id) DO UPDATE SET role='moniteur';

-- ─── licencies_centres ────────────────────────────────────────────────────────

INSERT INTO licencies_centres (parachutiste_id, centre_id, statut, date_adhesion, moniteur_assigne_id)
VALUES
  ('d0d00001-0000-0000-0000-000000000001','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2024-01-15','d0d00001-0000-0000-0000-000000000010'),
  ('d0d00001-0000-0000-0000-000000000002','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2023-03-20','d0d00001-0000-0000-0000-000000000010'),
  ('d0d00001-0000-0000-0000-000000000003','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2025-02-10','d0d00001-0000-0000-0000-000000000010'),
  ('d0d00001-0000-0000-0000-000000000004','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2022-06-05',null),
  ('d0d00001-0000-0000-0000-000000000005','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2024-09-12','d0d00001-0000-0000-0000-000000000010'),
  ('d0d00001-0000-0000-0000-000000000006','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2025-11-01','d0d00001-0000-0000-0000-000000000010'),
  ('d0d00001-0000-0000-0000-000000000007','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2021-04-18',null),
  ('d0d00001-0000-0000-0000-000000000008','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2023-12-03','d0d00001-0000-0000-0000-000000000010'),
  ('d0d00001-0000-0000-0000-000000000009','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2025-08-22','d0d00001-0000-0000-0000-000000000010'),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2023-05-10','d0d00001-0000-0000-0000-000000000010'),
  ('51935ed6-993d-4533-b006-5fd3dafd642c','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2024-07-14','d0d00001-0000-0000-0000-000000000010'),
  ('d646d3e5-333d-44d6-b6d4-6d1f7715863a','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','en_attente',null,null)
ON CONFLICT (parachutiste_id, centre_id) DO UPDATE SET statut=EXCLUDED.statut, date_adhesion=EXCLUDED.date_adhesion;

-- ─── brevets ─────────────────────────────────────────────────────────────────

INSERT INTO brevets (parachutiste_id, type_brevet, date_obtention, centre_delivrance, numero_brevet)
VALUES
  ('d0d00001-0000-0000-0000-000000000001','BPA','2022-06-10','BigAir Rochefort','BPA-2022-0917-001'),
  ('d0d00001-0000-0000-0000-000000000001','A',  '2022-09-15','BigAir Rochefort','A-2022-0917-001'),
  ('d0d00001-0000-0000-0000-000000000001','B',  '2023-04-20','BigAir Rochefort','B-2023-0917-001'),
  ('d0d00001-0000-0000-0000-000000000002','BPA','2021-05-12','BigAir Rochefort','BPA-2021-0917-002'),
  ('d0d00001-0000-0000-0000-000000000002','A',  '2021-08-18','BigAir Rochefort','A-2021-0917-002'),
  ('d0d00001-0000-0000-0000-000000000002','B',  '2022-03-10','BigAir Rochefort','B-2022-0917-002'),
  ('d0d00001-0000-0000-0000-000000000002','C',  '2023-07-25','BigAir Rochefort','C-2023-0917-002'),
  ('d0d00001-0000-0000-0000-000000000003','BPA','2025-03-05','BigAir Rochefort','BPA-2025-0917-003'),
  ('d0d00001-0000-0000-0000-000000000004','BPA','2020-04-10','BigAir Rochefort','BPA-2020-0917-004'),
  ('d0d00001-0000-0000-0000-000000000004','A',  '2020-07-22','BigAir Rochefort','A-2020-0917-004'),
  ('d0d00001-0000-0000-0000-000000000004','B',  '2021-02-14','BigAir Rochefort','B-2021-0917-004'),
  ('d0d00001-0000-0000-0000-000000000004','C',  '2022-05-08','BigAir Rochefort','C-2022-0917-004'),
  ('d0d00001-0000-0000-0000-000000000004','D',  '2023-09-30','BigAir Rochefort','D-2023-0917-004'),
  ('d0d00001-0000-0000-0000-000000000004','WS1','2024-04-12','BigAir Rochefort','WS1-2024-0917-004'),
  ('d0d00001-0000-0000-0000-000000000005','BPA','2024-05-20','BigAir Rochefort','BPA-2024-0917-005'),
  ('d0d00001-0000-0000-0000-000000000005','A',  '2024-10-14','BigAir Rochefort','A-2024-0917-005'),
  ('d0d00001-0000-0000-0000-000000000007','BPA','2019-06-01','BigAir Rochefort','BPA-2019-0917-007'),
  ('d0d00001-0000-0000-0000-000000000007','A',  '2019-09-15','BigAir Rochefort','A-2019-0917-007'),
  ('d0d00001-0000-0000-0000-000000000007','B',  '2020-06-20','BigAir Rochefort','B-2020-0917-007'),
  ('d0d00001-0000-0000-0000-000000000007','B2', '2021-08-10','BigAir Rochefort','B2-2021-0917-007'),
  ('d0d00001-0000-0000-0000-000000000008','BPA','2023-04-08','BigAir Rochefort','BPA-2023-0917-008'),
  ('d0d00001-0000-0000-0000-000000000008','A',  '2023-10-19','BigAir Rochefort','A-2023-0917-008'),
  ('d0d00001-0000-0000-0000-000000000010','BPA','2017-05-10','BigAir Rochefort','BPA-2017-0917-010'),
  ('d0d00001-0000-0000-0000-000000000010','A',  '2017-08-15','BigAir Rochefort','A-2017-0917-010'),
  ('d0d00001-0000-0000-0000-000000000010','B',  '2018-04-22','BigAir Rochefort','B-2018-0917-010'),
  ('d0d00001-0000-0000-0000-000000000010','C',  '2019-06-30','BigAir Rochefort','C-2019-0917-010'),
  ('d0d00001-0000-0000-0000-000000000010','D',  '2020-09-10','BigAir Rochefort','D-2020-0917-010')
ON CONFLICT DO NOTHING;

-- ─── sauts ───────────────────────────────────────────────────────────────────

INSERT INTO sauts (parachutiste_id, date_saut, lieu, aeronef_immat, nature_saut, categorie, hauteur_m, fonction, statut, moniteur_id, valide_par, valide_le, programme)
VALUES
  ('d0d00001-0000-0000-0000-000000000001',now()::date-3, 'BigAir Rochefort','F-GPAB','entrainement','OC',4000,'parachutiste','valide',    'd0d00001-0000-0000-0000-000000000010','d0d00001-0000-0000-0000-000000000010',now()-interval'3 days', 'Entraînement vol relatif'),
  ('d0d00001-0000-0000-0000-000000000001',now()::date-10,'BigAir Rochefort','F-GPAB','entrainement','OC',3500,'parachutiste','valide',    'd0d00001-0000-0000-0000-000000000010','d0d00001-0000-0000-0000-000000000010',now()-interval'10 days',null),
  ('d0d00001-0000-0000-0000-000000000001',now()::date,   'BigAir Rochefort','F-GPAB','entrainement','OC',4000,'parachutiste','en_attente',null,null,null,null),
  ('d0d00001-0000-0000-0000-000000000002',now()::date-1, 'BigAir Rochefort','F-GPAC','competition', 'OC',4000,'parachutiste','valide',    'd0d00001-0000-0000-0000-000000000010','d0d00001-0000-0000-0000-000000000010',now()-interval'1 day',  'VR 4-way'),
  ('d0d00001-0000-0000-0000-000000000002',now()::date,   'BigAir Rochefort','F-GPAD','competition', 'OC',4000,'parachutiste','en_attente',null,null,null,null),
  ('d0d00001-0000-0000-0000-000000000003',now()::date-5, 'BigAir Rochefort','F-GPAB','entrainement','OA',4000,'eleve',       'valide',    'd0d00001-0000-0000-0000-000000000010','d0d00001-0000-0000-0000-000000000010',now()-interval'5 days', 'PAC niveau 3'),
  ('d0d00001-0000-0000-0000-000000000003',now()::date-2, 'BigAir Rochefort','F-GPAB','entrainement','OA',4000,'eleve',       'valide',    'd0d00001-0000-0000-0000-000000000010','d0d00001-0000-0000-0000-000000000010',now()-interval'2 days', 'PAC niveau 4'),
  ('d0d00001-0000-0000-0000-000000000003',now()::date,   'BigAir Rochefort','F-GPAB','entrainement','OA',4000,'eleve',       'en_attente',null,null,null,null),
  ('d0d00001-0000-0000-0000-000000000004',now()::date-2, 'BigAir Rochefort','F-GPAC','entrainement','OC',4200,'parachutiste','valide',    'd0d00001-0000-0000-0000-000000000010','d0d00001-0000-0000-0000-000000000010',now()-interval'2 days', 'Wingsuit'),
  ('d0d00001-0000-0000-0000-000000000004',now()::date,   'BigAir Rochefort','F-GPAC','entrainement','OC',4200,'parachutiste','en_attente',null,null,null,null),
  ('d0d00001-0000-0000-0000-000000000005',now()::date-7, 'BigAir Rochefort','F-GPAB','entrainement','OC',4000,'parachutiste','valide',    'd0d00001-0000-0000-0000-000000000010','d0d00001-0000-0000-0000-000000000010',now()-interval'7 days', null),
  ('d0d00001-0000-0000-0000-000000000006',now()::date-1, 'BigAir Rochefort','F-GPAB','entrainement','OA',4000,'eleve',       'en_attente',null,null,null,null),
  ('d0d00001-0000-0000-0000-000000000007',now()::date-4, 'BigAir Rochefort','F-GPAD','entrainement','OC',4000,'parachutiste','valide',    'd0d00001-0000-0000-0000-000000000010','d0d00001-0000-0000-0000-000000000010',now()-interval'4 days', 'VR 2-way'),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',now()::date,  'BigAir Rochefort','F-GPAC','entrainement','OC',3800,'parachutiste','en_attente',null,null,null,null)
ON CONFLICT DO NOTHING;

-- ─── licences ─────────────────────────────────────────────────────────────────

INSERT INTO licences (parachutiste_id, numero_licence, date_delivrance, date_expiration, organisme, statut, code_club, nom_club, assurance_individuelle, assurance_rc, tampon_statut)
VALUES
  ('d0d00001-0000-0000-0000-000000000001','FFP-45621-0917','2025-01-01','2025-12-31','FFP','actif', '0917','BigAir Rochefort',true,true,'en_attente'),
  ('d0d00001-0000-0000-0000-000000000002','FFP-38291-0917','2025-01-01','2025-12-31','FFP','actif', '0917','BigAir Rochefort',true,true,'en_attente'),
  ('d0d00001-0000-0000-0000-000000000003','FFP-29301-0917','2025-01-01','2025-12-31','FFP','actif', '0917','BigAir Rochefort',true,true,'en_attente'),
  ('d0d00001-0000-0000-0000-000000000004','FFP-51847-0917','2025-01-01','2025-12-31','FFP','actif', '0917','BigAir Rochefort',true,true,'en_attente'),
  ('d0d00001-0000-0000-0000-000000000005','FFP-67234-0917','2025-01-01','2025-12-31','FFP','actif', '0917','BigAir Rochefort',true,true,'en_attente'),
  ('d0d00001-0000-0000-0000-000000000006','FFP-44129-0917','2025-01-01','2025-12-31','FFP','actif', '0917','BigAir Rochefort',true,true,'en_attente'),
  ('d0d00001-0000-0000-0000-000000000007','FFP-33918-0917','2024-01-01','2024-12-31','FFP','expire','0917','BigAir Rochefort',true,true,'en_attente'),
  ('d0d00001-0000-0000-0000-000000000008','FFP-71203-0917','2025-01-01','2025-12-31','FFP','actif', '0917','BigAir Rochefort',true,true,'en_attente'),
  ('d0d00001-0000-0000-0000-000000000009','FFP-28476-0917','2025-01-01',(now()+interval'20 days')::date,'FFP','actif','0917','BigAir Rochefort',true,true,'en_attente'),
  ('d0d00001-0000-0000-0000-000000000010','FFP-59034-0917','2025-01-01','2025-12-31','FFP','actif', '0917','BigAir Rochefort',true,true,'valide')
ON CONFLICT DO NOTHING;

-- ─── certificats médicaux ─────────────────────────────────────────────────────

INSERT INTO certificats_medicaux (parachutiste_id, medecin, date_visite, date_expiration, type)
VALUES
  ('d0d00001-0000-0000-0000-000000000001','Dr. Rousseau', '2025-02-15','2026-02-15','aptitude_totale'),
  ('d0d00001-0000-0000-0000-000000000002','Dr. Lecomte',  '2025-03-10','2026-03-10','aptitude_totale'),
  ('d0d00001-0000-0000-0000-000000000003','Dr. Blanchard','2025-04-01','2026-04-01','aptitude_totale'),
  ('d0d00001-0000-0000-0000-000000000004','Dr. Rousseau', '2025-01-20','2026-01-20','aptitude_totale'),
  ('d0d00001-0000-0000-0000-000000000005','Dr. Martin',   '2024-04-15','2025-04-15','aptitude_totale'),
  ('d0d00001-0000-0000-0000-000000000006','Dr. Lecomte',  '2025-05-10','2026-05-10','aptitude_totale'),
  ('d0d00001-0000-0000-0000-000000000007','Dr. Blanchard','2023-06-20','2024-06-20','aptitude_totale'),
  ('d0d00001-0000-0000-0000-000000000008','Dr. Rousseau', '2025-03-28','2026-03-28','aptitude_totale'),
  ('d0d00001-0000-0000-0000-000000000009','Dr. Martin',   '2025-06-01',(now()+interval'15 days')::date,'aptitude_totale'),
  ('d0d00001-0000-0000-0000-000000000010','Dr. Rousseau', '2025-01-10','2026-01-10','aptitude_totale')
ON CONFLICT DO NOTHING;

-- ─── badges ───────────────────────────────────────────────────────────────────

INSERT INTO badges (parachutiste_id, type_badge, date_obtention, notifie)
VALUES
  ('d0d00001-0000-0000-0000-000000000001','premier_saut','2022-06-10',true),
  ('d0d00001-0000-0000-0000-000000000001','centenaire',  '2024-03-05',true),
  ('d0d00001-0000-0000-0000-000000000002','premier_saut','2021-05-12',true),
  ('d0d00001-0000-0000-0000-000000000002','veteran',     '2024-02-08',true),
  ('d0d00001-0000-0000-0000-000000000004','maitre',      '2024-11-20',true),
  ('d0d00001-0000-0000-0000-000000000004','aile',        '2024-04-12',true),
  ('d0d00001-0000-0000-0000-000000000007','globetrotter','2022-07-01',true)
ON CONFLICT DO NOTHING;

-- ─── notifications ────────────────────────────────────────────────────────────

INSERT INTO notifications (user_id, type, titre, message, data, lue)
VALUES
  ('44189402-3ea4-48e4-8d57-48564f8216b1','demande_adhesion', 'Nouvelle demande d''adhésion','PUYBAREAU Florian souhaite rejoindre BigAir Rochefort','{"para_id":"d646d3e5-333d-44d6-b6d4-6d1f7715863a"}',false),
  ('44189402-3ea4-48e4-8d57-48564f8216b1','saut_en_attente',  'Sauts en attente',           '5 sauts attendent votre validation aujourd''hui','{}',false),
  ('44189402-3ea4-48e4-8d57-48564f8216b1','licence_expiration','Licence expirée',            'PETIT Emma — licence FFP expirée depuis le 31/12/2024','{}',false),
  ('44189402-3ea4-48e4-8d57-48564f8216b1','certificat_expire','Certificat médical expiré',  'LEROY Amélie — certificat médical expiré le 15/04/2025','{}',false),
  ('44189402-3ea4-48e4-8d57-48564f8216b1','licence_expiration','Licence expire bientôt',    'FOURNIER Chloé — licence expire dans 20 jours','{}',true),
  ('44189402-3ea4-48e4-8d57-48564f8216b1','saut_valide',      'Sauts validés',              'GIRARD Nicolas a validé 3 sauts aujourd''hui','{}',true)
ON CONFLICT DO NOTHING;
