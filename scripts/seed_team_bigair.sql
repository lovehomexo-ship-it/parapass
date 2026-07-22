-- ═══════════════════════════════════════════════════════════════════════════
-- ÉQUIPE DE DÉMO — BigAir Rochefort (a0eebc99-…)
-- ═══════════════════════════════════════════════════════════════════════════
-- 8 moniteurs/plieurs fictifs COHÉRENTS (rôle = qualification), traçables par
-- l'email @demo-bigair.fr et les UUID de111111-0000-0000-0000-0000000001XX.
-- IDEMPOTENT : réexécutable sans doublon (upsert profils, delete+insert du staff).
-- Cantonné à BigAir. Ne touche AUCUN autre centre ni compte réel.
--   psql "$SUPABASE_DB_URL" -f scripts/seed_team_bigair.sql   (ou SQL Editor)

do $$
declare
  dz constant uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  soon constant date := current_date + 30;   -- « expire bientôt » (< seuil 60 j)
  valide constant date := current_date + 500;
  hab constant date := current_date - 200;    -- date d'obtention passée
  -- (uuid, prénom, nom, rôle, n° licence)
  membres constant text[][] := array[
    array['de111111-0000-0000-0000-000000000101','Marc','FONTAINE','moniteur_delegue','FFP-2015-11001'],
    array['de111111-0000-0000-0000-000000000102','Julien','MERCIER','moniteur_delegue','FFP-2017-11002'],
    array['de111111-0000-0000-0000-000000000103','Camille','ROUSSEL','moniteur_delegue','FFP-2016-11003'],
    array['de111111-0000-0000-0000-000000000104','Antoine','BERGER','parachutiste','FFP-2018-11004'],
    array['de111111-0000-0000-0000-000000000105','Sophie','DELMAS','moniteur','FFP-2014-11005'],
    array['de111111-0000-0000-0000-000000000106','Paul','GIRAUD','parachutiste','FFP-2013-11006'],
    array['de111111-0000-0000-0000-000000000107','Lea','BONNET','parachutiste','FFP-2019-11007'],
    array['de111111-0000-0000-0000-000000000108','Hugo','MARCHAND','moniteur','FFP-2016-11008']
  ];
  uids constant uuid[] := array[
    'de111111-0000-0000-0000-000000000101','de111111-0000-0000-0000-000000000102',
    'de111111-0000-0000-0000-000000000103','de111111-0000-0000-0000-000000000104',
    'de111111-0000-0000-0000-000000000105','de111111-0000-0000-0000-000000000106',
    'de111111-0000-0000-0000-000000000107','de111111-0000-0000-0000-000000000108']::uuid[];
  m text[];
  uid uuid;
  dt uuid;
begin
  select profile_id into dt from admin_centres where centre_id=dz and role='admin' order by created_at limit 1;

  -- ── Comptes auth + profils + rattachement licencié ──
  foreach m slice 1 in array membres loop
    uid := m[1]::uuid;
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
            lower(m[3])||'.'||lower(m[2])||'@demo-bigair.fr',
            extensions.crypt('DemoBigAir2026!', extensions.gen_salt('bf')),
            now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"demo":true}'::jsonb)
    on conflict (id) do nothing;

    insert into profiles (id, email, prenom, nom, role, centre_id, numero_licence, type_pratiquant)
    values (uid, lower(m[3])||'.'||lower(m[2])||'@demo-bigair.fr', m[2], m[3], m[4], dz, m[5], 'moniteur')
    on conflict (id) do update set prenom=excluded.prenom, nom=excluded.nom, role=excluded.role,
      centre_id=excluded.centre_id, numero_licence=excluded.numero_licence;

    -- rattachement aux licenciés du centre (les moniteurs font partie de la DZ)
    if not exists (select 1 from licencies_centres where parachutiste_id=uid and centre_id=dz) then
      insert into licencies_centres (parachutiste_id, centre_id, statut, date_adhesion)
      values (uid, dz, 'actif', current_date - 300);
    else
      update licencies_centres set statut='actif' where parachutiste_id=uid and centre_id=dz;
    end if;
  end loop;

  -- ── Table rase du staff de démo (idempotence) ──
  delete from moniteurs_qualifications where centre_id=dz and user_id = any(uids);
  delete from delegations_validation where centre_id=dz and moniteur_id = any(uids);
  delete from plieurs_valides where centre_id=dz and plieur_id = any(uids);
  delete from brevets where parachutiste_id = any(uids);

  -- ── Qualifications (rôle = qualif) ──
  insert into moniteurs_qualifications (user_id, centre_id, qualification_code, numero, date_obtention, date_expiration, actif) values
    -- 2 BEES, dont Marc = DSS
    ('de111111-0000-0000-0000-000000000101'::uuid, dz, 'BEES1', 'BEES1-11001', hab, valide, true),
    ('de111111-0000-0000-0000-000000000101'::uuid, dz, 'DSS',   'DSS-11001',   hab, valide, true),
    ('de111111-0000-0000-0000-000000000102'::uuid, dz, 'BEES1', 'BEES1-11002', hab, valide, true),
    -- DEJEPS
    ('de111111-0000-0000-0000-000000000103'::uuid, dz, 'DEJEPS','DEJEPS-11003', hab, valide, true),
    -- Moniteur fédéral (bénévole)
    ('de111111-0000-0000-0000-000000000105'::uuid, dz, 'MONITEUR_FEDERAL','MF-11005', hab, valide, true),
    -- Qualif proche de l'expiration → alerte « à renouveler »
    ('de111111-0000-0000-0000-000000000108'::uuid, dz, 'BEES1', 'BEES1-11008', hab, soon, true);

  -- ── Brevet C (Antoine) — encadrement en vol / tandem-autonome ──
  insert into brevets (parachutiste_id, type_brevet, date_obtention, centre_delivrance)
  values ('de111111-0000-0000-0000-000000000104'::uuid, 'C', current_date - 400, 'BigAir Rochefort');

  -- ── Plieurs habilités (Paul, Léa) → module pliage ──
  insert into plieurs_valides (centre_id, plieur_id, validateur_id, actif, date_habilitation, date_expiration, numero_qualif) values
    (dz, 'de111111-0000-0000-0000-000000000106'::uuid, dt, true, hab, valide, 'PL-11006'),
    (dz, 'de111111-0000-0000-0000-000000000107'::uuid, dt, true, hab, soon,   'PL-11007');   -- Léa : habilitation proche expiration

  -- ── Délégations de validation → 3 moniteurs diplômés seulement ──
  insert into delegations_validation (centre_id, dt_id, moniteur_id, actif, date_delegation, date_expiration) values
    (dz, dt, 'de111111-0000-0000-0000-000000000101'::uuid, true, current_date - 250, valide),
    (dz, dt, 'de111111-0000-0000-0000-000000000102'::uuid, true, current_date - 200, valide),
    (dz, dt, 'de111111-0000-0000-0000-000000000103'::uuid, true, current_date - 150, valide)
  on conflict (centre_id, moniteur_id) do update set actif=true, date_expiration=excluded.date_expiration;

  raise notice 'Équipe de démo BigAir créée (8 membres).';
end $$;
