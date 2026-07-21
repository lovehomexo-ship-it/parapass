-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DÉMO — SkyDive Atlantique (centre de démonstration)
-- ═══════════════════════════════════════════════════════════════════════════
-- Objectif : une DZ vivante et bien tenue pour les démos DT.
-- REJOUABLE : chaque bloc supprime puis recrée ses données. Toutes les
-- suppressions sont bornées au centre de démo et à ses 12 licenciés fictifs
-- dédiés (uuid 'de000001-0000-0000-0000-0000001000xx') — AUCUNE donnée d'un
-- autre centre ou d'un utilisateur réel n'est touchée.
--
-- Relancer avant chaque démo :
--   psql "$SUPABASE_DB_URL" -f scripts/seed_demo_dz.sql
--   (ou copier/coller dans le SQL Editor Supabase)
-- Les dates sont RELATIVES (current_date) : l'état reste idéal quel que soit
-- le jour où on rejoue le script.

do $$
declare
  dz constant uuid := 'de000001-0000-0000-0000-000000000010';   -- SkyDive Atlantique
  dt constant uuid := 'b19835ae-21b4-493a-bcda-544b85939659';   -- Admin SKYDIVE (publie le briefing)
  u  uuid[];
  circuit_mg uuid;
  briefing uuid;
  i int;
begin
  -- les 12 licenciés fictifs dédiés à la démo (noms d'emprunt, comptes de seed)
  select array_agg(id order by id) into u from profiles
   where id::text like 'de000001-0000-0000-0000-0000001000%'
     and id::text <= 'de000001-0000-0000-0000-000000100012';
  if array_length(u,1) is distinct from 12 then
    raise exception 'Licenciés de démo introuvables (%). Seed annulé.', coalesce(array_length(u,1),0);
  end if;

  -- ── Membres : seuls les 12 fictifs dédiés restent actifs ─────────────────
  -- (les comptes de test partagés avec d'autres centres sont détachés de la
  --  DZ démo — leurs licences, qui appartiennent à d'autres jeux de données,
  --  ne sont PAS modifiées)
  update licencies_centres set statut = 'inactif'
   where centre_id = dz and parachutiste_id <> all(u);
  update licencies_centres set statut = 'actif'
   where centre_id = dz and parachutiste_id = any(u);

  -- ── Modules : tout actif, Studio démontrable ─────────────────────────────
  insert into centre_modules (centre_id, module_id, active)
  select dz, m, true from unnest(array['pliage','finances','tandem','studio']) m
  on conflict (centre_id, module_id) do update set active = true;

  -- ── Licences & certificats : majoritairement à jour, 2 échéances proches ─
  delete from licences where parachutiste_id = any(u);
  delete from certificats_medicaux where parachutiste_id = any(u);
  for i in 1..12 loop
    insert into licences (parachutiste_id, numero_licence, date_delivrance, date_expiration, organisme, statut, type_licence)
    values (u[i], 'DEMO-'||to_char(current_date,'YYYY')||'-'||lpad(i::text,3,'0'),
            current_date - 200,
            case when i = 11 then current_date + 21 else current_date + 240 end,  -- n°11 : licence à échéance proche
            'FFP', 'actif', 'lp');
    insert into certificats_medicaux (parachutiste_id, medecin, date_visite, date_expiration, type)
    values (u[i], 'Dr Exemple',
            current_date - 180,
            case when i = 12 then current_date + 12 else current_date + 185 end,  -- n°12 : médical à échéance proche
            'aptitude_totale');
  end loop;

  -- ── Scène briefing : fond neutre + circuits tracés main ──────────────────
  insert into dz_settings (dz_id, sock_x, sock_y, image_fond_largeur, image_fond_hauteur, no_fly_zones, obstacles)
  values (dz, 62, 28, 1000, 600, '[]'::jsonb,
          '[{"nom":"Hangar","points":[[14,18],[22,18],[22,26],[14,26]]}]'::jsonb)
  on conflict (dz_id) do update
    set sock_x = excluded.sock_x, sock_y = excluded.sock_y,
        image_fond_largeur = excluded.image_fond_largeur, image_fond_hauteur = excluded.image_fond_hauteur,
        no_fly_zones = excluded.no_fly_zones, obstacles = excluded.obstacles, updated_at = now();

  delete from dz_briefings where dz_id = dz;   -- avant les circuits (FK)
  delete from dz_circuits where dz_id = dz;
  insert into dz_circuits (dz_id, nom, sens, trace, lz_x, lz_y, zone_evolution, altitude_debut_m, actif)
  values
    (dz, 'Main gauche — vent d''ouest', 'main_gauche',
     '[[48,34],[33,20],[28,30],[32,35]]'::jsonb, 32.5, 34.5,
     '[[50,38],[46,46],[62,60],[66,50],[50,38]]'::jsonb, 300, true)
  returning id into circuit_mg;
  insert into dz_circuits (dz_id, nom, sens, trace, lz_x, lz_y, zone_evolution, altitude_debut_m, actif)
  values
    (dz, 'Main droite — vent d''est', 'main_droite',
     '[[20,36],[36,22],[40,32],[35,36]]'::jsonb, 34.5, 35.5,
     '[[50,38],[46,46],[62,60],[66,50],[50,38]]'::jsonb, 300, true);

  -- ── Historique : 3 briefings archivés + celui du jour publié ─────────────
  for i in 1..3 loop
    insert into dz_briefings (dz_id, date_briefing, vent_direction_deg, vent_vitesse_kt, consignes, circuit_id, published_at, published_by, created_at)
    values (dz, current_date - i, 230 + i*10, 8 + i, 'Conditions calmes, circuit habituel.',
            circuit_mg, (current_date - i) + time '07:45', dt, (current_date - i) + time '07:40');
  end loop;
  insert into dz_briefings (dz_id, date_briefing, vent_direction_deg, vent_vitesse_kt, consignes, circuit_id, published_at, published_by, created_at)
  values (dz, current_date, 250, 12,
          'Vent d''ouest établi 12 kt, rafales 18 kt en fin d''après-midi. Circuit main gauche. Attention au hangar en finale — dernier virage au-dessus de 100 m.',
          circuit_mg, current_date + time '07:45', dt, current_date + time '07:40')
  returning id into briefing;

  -- ── Acquittements : 8 sur 12 (suivi en direct démontrable) ───────────────
  insert into briefing_acknowledgements (briefing_id, user_id, acknowledged_at)
  select briefing, u[g], current_date + time '08:05' + (g || ' minutes')::interval
  from generate_series(1, 8) g;

  -- ── Présences du jour : 10 déclarés, matériel varié ──────────────────────
  delete from dz_presences where dz_id = dz;
  for i in 1..10 loop
    insert into dz_presences (dz_id, user_id, date_presence, heure_debut, heure_fin, materiel_type,
                              voile_perso_libre, voile_location_ref, statut, checked_in_at)
    values (dz, u[i], current_date, time '09:00', time '18:00',
            case when i % 3 = 0 then 'location' else 'perso' end,
            case when i % 3 <> 0 then (array['Sabre2 150','Safire 3 169','Pilot 168','Crossfire 129'])[1 + i % 4] end,
            case when i % 3 = 0 then 'LOC-' || i end,
            'present', current_date + time '08:50' + (i || ' minutes')::interval);
  end loop;

  -- ── Encadrement : qualifs valides + brevets, séances vertes / une orange ─
  delete from moniteurs_qualifications where centre_id = dz;
  insert into moniteurs_qualifications (user_id, centre_id, qualification_code, numero, date_obtention, date_expiration, actif)
  values
    (u[1], dz, 'BEES1', 'DEMO-BEES1-1', current_date - 900, current_date + 400, true),
    (u[1], dz, 'DSS',   'DEMO-DSS-1',   current_date - 500, current_date + 400, true),
    (u[2], dz, 'BEES1', 'DEMO-BEES1-2', current_date - 700, current_date + 300, true);
  delete from brevets where parachutiste_id = any(u);
  insert into brevets (parachutiste_id, type_brevet, date_obtention, centre_delivrance)
  values (u[4], 'C', current_date - 600, 'SkyDive Atlantique'),
         (u[5], 'D', current_date - 800, 'SkyDive Atlantique');

  delete from seances_jour where dz_id = dz;
  insert into seances_jour (dz_id, date_seance, type_seance, ouverte, created_by)
  values (dz, current_date, 'ecole', true, dt),      -- verte : BEES1 + DSS présents
         (dz, current_date, 'autonome', true, dt),   -- verte : brevets C/D + DSS présents
         (dz, current_date, 'tandem', true, dt);     -- orange : aucune qualif TANDEM → détection démontrée

  -- ── Sauts récents : stats vivantes ───────────────────────────────────────
  delete from sauts where parachutiste_id = any(u);
  insert into sauts (parachutiste_id, date_saut, lieu, nature_saut, categorie, hauteur_m, fonction, statut, parachute)
  select u[1 + (n % 8)], current_date - (n % 10), 'SkyDive Atlantique', 'entrainement',
         case when n % 2 = 0 then 'OA' else 'OC' end, 4000, 'parachutiste', 'valide', 'Sabre2 150'
  from generate_series(1, 32) n;

  raise notice 'Seed démo SkyDive Atlantique terminé.';
end $$;
