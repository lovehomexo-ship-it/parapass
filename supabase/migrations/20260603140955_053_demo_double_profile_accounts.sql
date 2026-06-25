/*
  # Demo Double-Profile Accounts (final)

  Two fully-populated demo accounts:
  1. demo.parachutiste@parapass.fr — Lucas Bernard, parachutiste, Brevet B, 50 sauts
  2. demo.centre@parapass.fr — Admin SkyDive Atlantique, 25 licenciés, 3 moniteurs
*/

-- ─── Auth: parachutiste demo ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo.parachutiste@parapass.fr') THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token)
    VALUES ('de000001-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','demo.parachutiste@parapass.fr',crypt('DemoPass2026!', gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"nom":"Bernard","prenom":"Lucas","role":"parachutiste"}'::jsonb,false,'');
  ELSE
    UPDATE auth.users SET encrypted_password=crypt('DemoPass2026!',gen_salt('bf')), email_confirmed_at=COALESCE(email_confirmed_at,now()), updated_at=now() WHERE email='demo.parachutiste@parapass.fr';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo.centre@parapass.fr') THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token)
    VALUES ('de000001-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','demo.centre@parapass.fr',crypt('DemoPass2026!',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"nom":"Demo","prenom":"Centre","role":"admin_centre"}'::jsonb,false,'');
  ELSE
    UPDATE auth.users SET encrypted_password=crypt('DemoPass2026!',gen_salt('bf')), email_confirmed_at=COALESCE(email_confirmed_at,now()), updated_at=now() WHERE email='demo.centre@parapass.fr';
  END IF;
END $$;

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
VALUES
  ('de000001-0000-0000-0000-000000000001','de000001-0000-0000-0000-000000000001','demo.parachutiste@parapass.fr','email',jsonb_build_object('sub','de000001-0000-0000-0000-000000000001','email','demo.parachutiste@parapass.fr'),now(),now(),now()),
  ('de000001-0000-0000-0000-000000000002','de000001-0000-0000-0000-000000000002','demo.centre@parapass.fr','email',jsonb_build_object('sub','de000001-0000-0000-0000-000000000002','email','demo.centre@parapass.fr'),now(),now(),now())
ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO centres (id, nom, ville, adresse, code_postal, email, telephone, statut, plan, dt_nom, dt_prenom, tampon_nom_officiel, tampon_couleur_primaire, tampon_couleur_texte, numero_agrement_ffp)
VALUES ('de000001-0000-0000-0000-000000000010','SkyDive Atlantique','La Rochelle','17 Route de l''Aérodrome','17000','contact@skydive-atlantique.fr','05 46 00 00 00','actif','centre_premium','Moreau','Jean-Pierre','SKYDIVE ATLANTIQUE','#1D4ED8','#ffffff','FFP-17-0042')
ON CONFLICT (id) DO UPDATE SET nom=EXCLUDED.nom, ville=EXCLUDED.ville, statut=EXCLUDED.statut, plan=EXCLUDED.plan;

INSERT INTO profiles (id, email, nom, prenom, role, numero_licence, centre_id, type_pratiquant, date_naissance, lieu_naissance, nationalite, type_brevet_principal, date_ouverture_carnet, ecole_ouverture_nom, partage_carte_centre, ville, adresse, code_postal, telephone)
VALUES ('de000001-0000-0000-0000-000000000001','demo.parachutiste@parapass.fr','BERNARD','Lucas','parachutiste','FFP-2024-09821','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','amateur','1995-04-12','Bordeaux','Française','B','2020-03-15','BigAir Rochefort',true,'Bordeaux','4 Allée des Pins','33000','06 12 34 56 78')
ON CONFLICT (id) DO UPDATE SET nom=EXCLUDED.nom, prenom=EXCLUDED.prenom, numero_licence=EXCLUDED.numero_licence, date_naissance=EXCLUDED.date_naissance, type_brevet_principal=EXCLUDED.type_brevet_principal, centre_id=EXCLUDED.centre_id, email=EXCLUDED.email;

INSERT INTO profiles (id, email, nom, prenom, role, admin_centre_id, type_pratiquant, nationalite, partage_carte_centre)
VALUES ('de000001-0000-0000-0000-000000000002','demo.centre@parapass.fr','Demo','Centre','admin_centre','de000001-0000-0000-0000-000000000010','professionnel','Française',false)
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, admin_centre_id=EXCLUDED.admin_centre_id, email=EXCLUDED.email;

INSERT INTO licences (id, parachutiste_id, numero_licence, date_delivrance, date_expiration, organisme, statut, assurance_individuelle, assurance_rc, nom_club, code_club, tampon_statut, tampon_valide_par, tampon_date_validation)
VALUES ('de000001-0000-0000-0000-000000000020','de000001-0000-0000-0000-000000000001','FFP-2024-09821','2024-01-15','2026-12-31','FFP','actif',true,true,'BigAir Rochefort','0916','valide','Jean Dupuis','2024-03-20')
ON CONFLICT (id) DO UPDATE SET numero_licence=EXCLUDED.numero_licence, date_expiration=EXCLUDED.date_expiration, statut=EXCLUDED.statut;

INSERT INTO certificats_medicaux (id, parachutiste_id, medecin, date_visite, date_expiration, type)
VALUES ('de000001-0000-0000-0000-000000000021','de000001-0000-0000-0000-000000000001','Dr. Lefebvre','2025-06-30','2027-06-30','aptitude_totale')
ON CONFLICT (id) DO UPDATE SET date_expiration=EXCLUDED.date_expiration;

INSERT INTO brevets (id, parachutiste_id, type_brevet, numero_brevet, date_obtention, centre_delivrance)
VALUES ('de000001-0000-0000-0000-000000000022','de000001-0000-0000-0000-000000000001','B','B-2022-04521','2022-07-10','BigAir Rochefort')
ON CONFLICT (id) DO NOTHING;

INSERT INTO licencies_centres (id, parachutiste_id, centre_id, statut, date_adhesion)
VALUES ('de000001-0000-0000-0000-000000000023','de000001-0000-0000-0000-000000000001','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','actif','2023-01-10')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  dzs     TEXT[] := ARRAY['BigAir Rochefort','BigAir Rochefort','Gap-Tallard','Spa Francorchamps','Dunkeswell','BigAir Rochefort','Gap-Tallard','Dunkeswell','Spa Francorchamps','BigAir Rochefort'];
  natures TEXT[] := ARRAY['entrainement','entrainement','competition','manifestation','entrainement','entrainement','competition','entrainement','manifestation','entrainement'];
  cats    TEXT[] := ARRAY['OA','OC','OA','OC','OA','OA','OC','OA','OC','OA'];
  hts     INT[]  := ARRAY[4000,3800,4200,4000,3600,4000,4200,3800,4000,4200];
  i INT;
BEGIN
  FOR i IN 1..50 LOOP
    INSERT INTO sauts (id, parachutiste_id, date_saut, lieu, nature_saut, categorie, hauteur_m, fonction, statut, valide_par, valide_le, voilure_principale, aeronef_immat)
    VALUES (('de000001-0000-0000-0000-'||LPAD((300000+i)::text,12,'0'))::uuid,'de000001-0000-0000-0000-000000000001',CURRENT_DATE-((100-i*2)||' days')::interval,dzs[((i-1)%10)+1],natures[((i-1)%10)+1],cats[((i-1)%10)+1],hts[((i-1)%10)+1],'parachutiste','valide','Jean Dupuis',(CURRENT_DATE-((100-i*2)||' days')::interval)::timestamp,'Sabre2 170','F-HBGP')
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

INSERT INTO qr_tokens (id, parachutiste_id, token, created_at)
VALUES ('de000001-0000-0000-0000-000000000024','de000001-0000-0000-0000-000000000001','demo-para-qr-token-lucas-bernard-2026',now())
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  noms    TEXT[] := ARRAY['ROUSSEAU','GIRARD','KLEIN'];
  prenoms TEXT[] := ARRAY['Antoine','Sophie','Marc'];
  brev_n  TEXT[] := ARRAY['FFP-MON-0441','FFP-MON-0512','FFP-MON-0389'];
  mon_id UUID; i INT;
BEGIN
  FOR i IN 1..3 LOOP
    mon_id := ('de000001-0000-0000-0000-00000000004'||i)::uuid;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=mon_id) THEN
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token)
      VALUES (mon_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','moniteur'||i||'.skydive@parapass.fr',crypt('DemoPass2026!',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('nom',noms[i],'prenom',prenoms[i],'role','moniteur'),false,'');
    END IF;
    INSERT INTO profiles (id, email, nom, prenom, role, centre_id, type_pratiquant, nationalite, numero_brevet_moniteur, type_brevet_moniteur, moniteur_valide_par_dt)
    VALUES (mon_id,'moniteur'||i||'.skydive@parapass.fr',noms[i],prenoms[i],'moniteur','de000001-0000-0000-0000-000000000010','professionnel','Française',brev_n[i],'BEES',true)
    ON CONFLICT (id) DO UPDATE SET numero_brevet_moniteur=EXCLUDED.numero_brevet_moniteur, type_brevet_moniteur=EXCLUDED.type_brevet_moniteur, centre_id=EXCLUDED.centre_id;
    INSERT INTO delegations_validation (id, centre_id, dt_id, moniteur_id, actif, date_delegation)
    VALUES (('de000001-0000-0000-0000-00000000005'||i)::uuid,'de000001-0000-0000-0000-000000000010','de000001-0000-0000-0000-000000000002',mon_id,true,CURRENT_DATE-'30 days'::interval)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

DO $$
DECLARE
  noms    TEXT[] := ARRAY['MARTIN','DUBOIS','THOMAS','ROBERT','RICHARD','PETIT','DURAND','LEROY','MOREAU','SIMON','LAURENT','LEFEBVRE','MICHEL','GARCIA','DAVID','BERTRAND','ROUX','VINCENT','FOURNIER','MOREL','ANDRE','MERCIER','DUPONT','BONNET','HENRY'];
  prenoms TEXT[] := ARRAY['Antoine','Lucie','Maxime','Claire','Thomas','Julie','Nicolas','Emma','Pierre','Lea','Hugo','Alice','Romain','Charlotte','Julien','Sophie','Alexis','Marine','Baptiste','Camille','Ines','Pauline','Florian','Theo','Manon'];
  statuts TEXT[] := ARRAY['actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','actif','en_attente','en_attente','en_attente'];
  lic_id UUID; i INT;
BEGIN
  FOR i IN 1..25 LOOP
    lic_id := ('de000001-0000-0000-0000-'||LPAD((100000+i)::text,12,'0'))::uuid;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=lic_id) THEN
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token)
      VALUES (lic_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',lower(prenoms[i])||'.'||lower(noms[i])||i||'@demo-skydive.fr',crypt('DemoPass2026!',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('nom',noms[i],'prenom',prenoms[i],'role','parachutiste'),false,'');
    END IF;
    INSERT INTO profiles (id, email, nom, prenom, role, centre_id, type_pratiquant, nationalite, numero_licence, partage_carte_centre)
    VALUES (lic_id,lower(prenoms[i])||'.'||lower(noms[i])||i||'@demo-skydive.fr',noms[i],prenoms[i],'parachutiste','de000001-0000-0000-0000-000000000010','amateur','Française','FFP-2024-'||LPAD((9000+i)::text,5,'0'),true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO licencies_centres (id, parachutiste_id, centre_id, statut, date_adhesion)
    VALUES (('de000001-0000-0000-0000-'||LPAD((200000+i)::text,12,'0'))::uuid,lic_id,'de000001-0000-0000-0000-000000000010',statuts[i],CURRENT_DATE-((365-i*10)||' days')::interval)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- type_saut is text[] — pass array literal
DO $$
DECLARE
  titres TEXT[] := ARRAY['Matin — Initiation PAC','Après-midi — Loisir','Matin — Compétition FS','Journée complète','Matin — Loisir','Soirée découverte','Week-end spécial'];
  tsaut  TEXT[];
  i INT;
BEGIN
  FOR i IN 1..7 LOOP
    tsaut := CASE WHEN i%3=0 THEN ARRAY['formation'] ELSE ARRAY['loisir'] END;
    INSERT INTO creneaux_dz (id, centre_id, date, heure_debut, heure_fin, statut, titre, nb_places_total, nb_places_restantes, avion, altitude_prevue, type_saut)
    VALUES (('de000001-0000-0000-0000-'||LPAD((600000+i)::text,12,'0'))::uuid,'de000001-0000-0000-0000-000000000010',CURRENT_DATE+i,'09:00','17:00','ouvert',titres[i],12,12-(i%5),'Pilatus Porter',4000,tsaut)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

DO $$
DECLARE i INT; para_id UUID;
BEGIN
  FOR i IN 1..8 LOOP
    para_id := ('de000001-0000-0000-0000-'||LPAD((100000+i)::text,12,'0'))::uuid;
    INSERT INTO sauts (id, parachutiste_id, date_saut, lieu, nature_saut, categorie, hauteur_m, fonction, statut, valide_par, valide_le, moniteur_id)
    VALUES (('de000001-0000-0000-0000-'||LPAD((700000+i)::text,12,'0'))::uuid,para_id,CURRENT_DATE-((7-i)||' days')::interval,'SkyDive Atlantique','entrainement','OA',4000,'parachutiste','valide','Antoine Rousseau',(CURRENT_DATE-((7-i)||' days')::interval)::timestamp,'de000001-0000-0000-0000-000000000041')
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

INSERT INTO alertes (id, parachutiste_id, type, titre, message, urgence, lue)
VALUES
  ('de000001-0000-0000-0000-000000000080','de000001-0000-0000-0000-000000100001','licence_expire','Licence expire bientôt','La licence de Antoine MARTIN expire dans 15 jours.','attention',false),
  ('de000001-0000-0000-0000-000000000081','de000001-0000-0000-0000-000000100002','certificat_medical','Certificat médical expiré','Le certificat médical de Lucie DUBOIS a expiré.','critique',false)
ON CONFLICT (id) DO NOTHING;
