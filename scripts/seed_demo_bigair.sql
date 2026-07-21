-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DÉMO — BigAir Rochefort : une DZ vivante « aujourd'hui »
-- ═══════════════════════════════════════════════════════════════════════════
-- REJOUABLE et IDEMPOTENT : chaque bloc nettoie l'activité du jour qu'il gère
-- puis la recrée, datée de current_date. Relancer avant chaque démo.
--   psql "$SUPABASE_DB_URL" -f scripts/seed_demo_bigair.sql
--   (ou SQL Editor Supabase)
--
-- PÉRIMÈTRE STRICT : centre BigAir (a0eebc99-…) et ses comptes FICTIFS de seed
-- (uuid d0d00001-* et 11111111-*). Les comptes « réels » (Florian, Sophie,
-- Thomas, Kévin, …) ne voient ni leurs licences ni leurs sauts modifiés —
-- seule leur présence du jour est déclarée.
--
-- RETOUR À NEUTRE : scripts/reset_demo_bigair.sql supprime l'activité du jour.

do $$
declare
  dz constant uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';       -- BigAir Rochefort
  dt constant uuid := '00a08887-084d-44d5-b7c5-b7d57a7f2319';       -- BigAir Admin (publie)
  thomas constant uuid := 'f0822f3b-54a1-45d8-a273-9b6cdd5e1e39';   -- BEES1 + DSS valides
  kevin  constant uuid := 'a73d3889-18b4-441e-bda5-20ca0cd9942e';   -- BEES1 expirée (démontre « ne compte pas »)
  nicolas constant uuid := 'd0d00001-0000-0000-0000-000000000010';  -- 3e moniteur (BEES1 seedée ici)
  -- comptes fictifs dont on peut rafraîchir les documents
  fictifs constant uuid[] := array[
    'd0d00001-0000-0000-0000-000000000003','d0d00001-0000-0000-0000-000000000004',
    'd0d00001-0000-0000-0000-000000000005','d0d00001-0000-0000-0000-000000000006',
    'd0d00001-0000-0000-0000-000000000007','d0d00001-0000-0000-0000-000000000008',
    'd0d00001-0000-0000-0000-000000000009','d0d00001-0000-0000-0000-000000000010',
    '11111111-1111-1111-1111-111111111101','11111111-1111-1111-1111-111111111102',
    '11111111-1111-1111-1111-111111111104']::uuid[];
  -- présents du jour (~12, moniteurs inclus pour la cohérence encadrement)
  presents uuid[];
  circuit uuid;
  briefing uuid;
  claire constant uuid := 'd0d00001-0000-0000-0000-000000000003';   -- élève en progression Brevet A
  hugo   constant uuid := 'd0d00001-0000-0000-0000-000000000006';   -- élève déclaré prêt
  brevet_a uuid; q record; i int;
begin
  presents := array[thomas, kevin, nicolas,
    'd0d00001-0000-0000-0000-000000000003','d0d00001-0000-0000-0000-000000000004',
    'd0d00001-0000-0000-0000-000000000005','d0d00001-0000-0000-0000-000000000006',
    'd0d00001-0000-0000-0000-000000000007','d0d00001-0000-0000-0000-000000000008',
    'd0d00001-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111102',
    '11111111-1111-1111-1111-111111111104']::uuid[];

  -- ── Documents des comptes fictifs : majorité à jour, 2 échéances proches ─
  -- (jamais les comptes réels)
  delete from licences where parachutiste_id = any(fictifs);
  delete from certificats_medicaux where parachutiste_id = any(fictifs);
  for i in 1..array_length(fictifs,1) loop
    insert into licences (parachutiste_id, numero_licence, date_delivrance, date_expiration, organisme, statut, type_licence)
    values (fictifs[i], 'FFP-'||to_char(current_date,'YYYY')||'-1'||lpad(i::text,2,'0'),
            current_date - 190,
            case when fictifs[i] = 'd0d00001-0000-0000-0000-000000000009' then current_date + 20   -- Chloé : licence J-20
                 else current_date + 235 end,
            'FFP', 'actif', 'lp');
    insert into certificats_medicaux (parachutiste_id, medecin, date_visite, date_expiration, type)
    values (fictifs[i], 'Dr Charrier', current_date - 170,
            case when fictifs[i] = 'd0d00001-0000-0000-0000-000000000008' then current_date + 12   -- Maxime : médical J-12
                 else current_date + 190 end,
            'aptitude_totale');
  end loop;
  -- le numéro affiché sur le profil suit la licence active
  update profiles p set numero_licence = l.numero_licence
  from licences l where l.parachutiste_id = p.id and p.id = any(fictifs) and l.statut = 'actif';

  -- ── 3e moniteur qualifié : Nicolas GIRARD (BEES1 valide) ─────────────────
  insert into moniteurs_qualifications (user_id, centre_id, qualification_code, numero, date_obtention, date_expiration, actif)
  select nicolas, dz, 'BEES1', 'DEMO-BEES1-NG', current_date - 800, current_date + 380, true
  where not exists (select 1 from moniteurs_qualifications
                    where user_id = nicolas and centre_id = dz and qualification_code = 'BEES1');

  -- ── Briefing du jour publié (archive des jours passés conservée) ─────────
  select id into circuit from dz_circuits where dz_id = dz and sens = 'main_gauche' and actif limit 1;
  if circuit is null then raise exception 'Aucun circuit main gauche actif pour BigAir'; end if;
  delete from dz_briefings where dz_id = dz and date_briefing = current_date;
  insert into dz_briefings (dz_id, date_briefing, vent_direction_deg, vent_vitesse_kt, consignes, circuit_id, published_at, published_by, created_at)
  values (dz, current_date, 270, 12,
          'Vent d''ouest 12 kt, stable. Circuit main gauche. Séparation 300 m en dessous de 1000 m — priorité aux élèves en finale.',
          circuit, current_date + time '07:50', dt, current_date + time '07:45')
  returning id into briefing;
  -- acquittements échelonnés ce matin : 8 des 12 présents (pastilles orange pour le reste)
  insert into briefing_acknowledgements (briefing_id, user_id, acknowledged_at)
  select briefing, presents[g], current_date + time '08:10' + (g * interval '7 minutes')
  from generate_series(1, 8) g;

  -- ── Présences du jour : arrivées échelonnées, matériel varié ─────────────
  delete from dz_presences where dz_id = dz and date_presence = current_date;
  for i in 1..array_length(presents,1) loop
    insert into dz_presences (dz_id, user_id, date_presence, heure_debut, heure_fin, materiel_type,
                              voile_perso_libre, voile_location_ref, statut, checked_in_at)
    values (dz, presents[i], current_date,
            time '08:30' + ((i % 4) * interval '30 minutes'),
            time '17:00' + ((i % 3) * interval '45 minutes'),
            case when i % 4 = 0 then 'location' else 'perso' end,
            case when i % 4 <> 0 then (array['Sabre2 150','Safire 3 169','Pilot 168','Crossfire 129','Spectre 135'])[1 + i % 5] end,
            case when i % 4 = 0 then 'LOC-0' || i end,
            'present', current_date + time '08:20' + (i * interval '6 minutes'));
  end loop;

  -- ── Séances du jour : école & autonome au vert, tandem en manque ─────────
  delete from seances_jour where dz_id = dz and date_seance = current_date;
  insert into seances_jour (dz_id, date_seance, type_seance, ouverte, created_by)
  values (dz, current_date, 'ecole', true, dt),      -- vert : Thomas (BEES1+DSS), Nicolas (BEES1)
         (dz, current_date, 'autonome', true, dt),   -- vert : Lucas MOREAU (brevets C/D) + DSS présent
         (dz, current_date, 'tandem', true, dt);     -- orange : aucune qualif TANDEM → détection visible

  -- ── Sauts récents des comptes fictifs (stats vivantes) ───────────────────
  delete from sauts where parachutiste_id = any(fictifs)
    and lieu = 'BigAir Rochefort' and date_saut >= current_date - 14 and observations = 'Saut démo';
  insert into sauts (parachutiste_id, date_saut, lieu, nature_saut, categorie, hauteur_m, fonction, statut, parachute, observations)
  select fictifs[1 + (n % 8)], current_date - (n % 7), 'BigAir Rochefort', 'entrainement',
         case when n % 2 = 0 then 'OA' else 'OC' end, 4000, 'parachutiste', 'valide', 'Sabre2 150', 'Saut démo'
  from generate_series(1, 28) n;

  -- ── Académie : scores de quiz crédibles sur 5 licenciés fictifs ──────────
  -- session_id est un uuid : préfixe réservé de111111-… pour un nettoyage sûr
  delete from quiz_attempts where session_id::text like 'de111111-%';
  delete from quiz_xp where raison = 'seed-demo';
  i := 0;
  for q in select id from quiz_questions limit 10 loop
    i := i + 1;
    insert into quiz_attempts (user_id, question_id, mode, session_id, reponse_donnee, est_correcte, temps_reponse_ms, xp_gagnes, created_at)
    select fictifs[1 + (g % 5)], q.id, 'entrainement',
           ('de111111-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, '0',
           (g + i) % 3 <> 0, 4000 + g * 500, case when (g + i) % 3 <> 0 then 10 else 0 end,
           current_date - (g % 6) + time '19:00'
    from generate_series(1, 5) g;
  end loop;
  insert into quiz_xp (user_id, xp, raison, created_at)
  select fictifs[g], 40 + g * 35, 'seed-demo', current_date - 1 from generate_series(1, 5) g;

  -- ── Progression Brevet A : Claire avancée, Hugo déclaré prêt ─────────────
  select id into brevet_a from brevets_referentiel where code = 'A' limit 1;
  if brevet_a is not null then
    insert into progression_epreuves (user_id, epreuve_id, centre_id, statut)
    select u.uid, e.id, dz, 'a_faire'
    from epreuves e cross join (values (claire), (hugo)) u(uid)
    where e.brevet_id = brevet_a
    on conflict (user_id, epreuve_id) do nothing;
    -- Claire : 2 premières épreuves validées par Thomas (signé, horodaté)
    update progression_epreuves pe set statut = 'validee', valide_par = thomas, valide_at = now(), note = 'Validé en séance (démo)'
    from (select id from epreuves where brevet_id = brevet_a order by ordre limit 2) sel
    where pe.epreuve_id = sel.id and pe.user_id = claire and pe.statut <> 'validee';
    -- Hugo : déclaré prêt sur la 1re épreuve → alimente la file de validation
    update progression_epreuves pe set statut = 'pret', declare_pret_at = now()
    from (select id from epreuves where brevet_id = brevet_a order by ordre limit 1) sel
    where pe.epreuve_id = sel.id and pe.user_id = hugo and pe.statut = 'a_faire';
  end if;

  raise notice 'Seed démo BigAir terminé.';
end $$;
