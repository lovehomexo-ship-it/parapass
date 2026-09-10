-- ═══════════════════════════════════════════════════════════════════════════
-- AVIONNAGE — journée de démonstration.
--
-- Un module d'avionnage vide ne se montre pas : une planche sans avion et une
-- file sans personne ne disent rien de ce que fait le produit. Ces deux RPC
-- remplissent la journée d'avions et de places, puis les retirent.
--
-- CE QUI REND CETTE DÉMO SÛRE :
--   • une COLONNE marqueur, pas une convention de nommage. Le retrait vise
--     `demo = true` et rien d'autre. Une planche réelle ne peut pas être prise
--     pour une planche de démo, quel que soit son nom, son pilote, son heure.
--   • aucun saut n'est créé : la démo ne laisse pas de trace dans un carnet.
--   • réservée à l'administrateur DU centre visé, module Avionnage souscrit.
--   • idempotente : générer deux fois ne double rien, ça repart de zéro.
--
-- CE QU'ELLE FAIT AVEC DE VRAIES PERSONNES : elle place les licenciés actifs
-- du centre dans les avions. C'est ce qui rend l'écran crédible — des noms
-- qu'on reconnaît. Conséquence à connaître : ces personnes verront « vous êtes
-- manifesté » sur leur téléphone tant que la démo est active. Sur un centre de
-- production, retirer la démo après la présentation n'est pas une politesse.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

alter table rotations       add column if not exists demo boolean not null default false;
alter table file_avionnage  add column if not exists demo boolean not null default false;

comment on column rotations.demo is
  'Planche de démonstration. Seule cible de retirer_demo_avionnage — jamais une planche réelle.';
comment on column file_avionnage.demo is
  'Ligne de file de démonstration. Seule cible de retirer_demo_avionnage.';

-- ── Retrait ────────────────────────────────────────────────────────────────
create or replace function retirer_demo_avionnage(p_centre_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_places int; v_rot int; v_file int;
begin
  if not exists (select 1 from admin_centres ac
                 where ac.profile_id = auth.uid() and ac.centre_id = p_centre_id) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;

  delete from places_rotation pr
   using rotations r
   where pr.rotation_id = r.id and r.centre_id = p_centre_id and r.demo;
  get diagnostics v_places = row_count;

  delete from file_avionnage f where f.centre_id = p_centre_id and f.demo;
  get diagnostics v_file = row_count;

  delete from rotations r where r.centre_id = p_centre_id and r.demo;
  get diagnostics v_rot = row_count;

  return jsonb_build_object('planches', v_rot, 'places', v_places, 'file', v_file);
end $$;

-- ── Génération ─────────────────────────────────────────────────────────────
create or replace function generer_demo_avionnage(p_centre_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_aeronef uuid; v_places_avion int; v_largueur uuid; v_base int;
  v_gens uuid[]; v_n int; v_i int := 1;
  v_rot uuid; v_places int := 0; v_file int := 0;
  v_types text[] := array['solo','groupe','wingsuit','video','ecole','accompagne'];
begin
  if not exists (select 1 from admin_centres ac
                 where ac.profile_id = auth.uid() and ac.centre_id = p_centre_id) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;
  if not centre_module_actif(p_centre_id, 'avionnage') then
    raise exception 'Le module Avionnage n''est pas souscrit pour ce centre.' using errcode = '42501';
  end if;

  -- On repart de zéro : deux clics ne font pas huit avions.
  perform retirer_demo_avionnage(p_centre_id);

  select a.id, a.places into v_aeronef, v_places_avion
  from aeronefs a where a.centre_id = p_centre_id and a.actif
  order by a.places desc nulls last limit 1;
  if v_aeronef is null then
    raise exception 'Aucun aeronef actif sur ce centre.'
      using errcode = 'P0002', hint = 'Ajoutez un avion dans Materiel avant de lancer la demo.';
  end if;

  -- Un largueur RÉELLEMENT qualifié, ou aucun : la démo ne contourne pas la
  -- règle qu'elle sert à montrer.
  select lc.parachutiste_id into v_largueur
  from licencies_centres lc
  join qualifications q on q.parachutiste_id = lc.parachutiste_id and q.type = 'largueur'
   and (q.date_expiration is null or q.date_expiration >= current_date)
  where lc.centre_id = p_centre_id and lc.statut = 'actif'
  limit 1;

  -- Les gens : licenciés actifs, pas déjà embarqués aujourd'hui, jamais le
  -- largueur (il dirige le largage, il ne saute pas ici).
  select array_agg(x.parachutiste_id) into v_gens from (
    select lc.parachutiste_id
    from licencies_centres lc
    join profiles p on p.id = lc.parachutiste_id
    where lc.centre_id = p_centre_id and lc.statut = 'actif'
      and lc.parachutiste_id is distinct from v_largueur
      and not exists (
        select 1 from places_rotation pr join rotations r on r.id = pr.rotation_id
        where pr.parachutiste_id = lc.parachutiste_id
          and r.centre_id = p_centre_id and r.date_jour = current_date)
    order by p.nom, p.prenom
    limit 24
  ) x;
  v_n := coalesce(array_length(v_gens, 1), 0);
  if v_n < 4 then
    raise exception 'Pas assez de licencies actifs disponibles (%) pour une demo.', v_n
      using errcode = 'P0002';
  end if;

  select coalesce(max(r.numero), 0) into v_base
  from rotations r where r.centre_id = p_centre_id and r.date_jour = current_date;

  -- ── Avion 1 — PARTI il y a 35 min. Montre une planche close et son largueur.
  insert into rotations (centre_id, date_jour, numero, aeronef_id, pilote,
                         altitude_largage_m, heure_prevue, heure_decollage, statut, largueur_id, demo)
  values (p_centre_id, current_date, v_base + 1, v_aeronef, 'J. MOREAU', 4000,
          (now() - interval '35 minutes')::time, 
          case when v_largueur is not null then now() - interval '35 minutes' end,
          case when v_largueur is not null then 'en_vol' else 'preparation' end,
          v_largueur, true)
  returning id into v_rot;
  for i in 1..least(6, v_n) loop
    insert into places_rotation (rotation_id, parachutiste_id, type_saut, rang_sortie, statut)
    values (v_rot, v_gens[v_i], v_types[1 + (v_i % array_length(v_types,1))], i,
            case when v_largueur is not null then 'largue' else 'inscrit' end);
    v_i := v_i + 1; v_places := v_places + 1;
  end loop;

  -- ── Avion 2 — EMBARQUEMENT, décollage dans 10 min. L'avion « chaud ».
  insert into rotations (centre_id, date_jour, numero, aeronef_id, pilote,
                         altitude_largage_m, heure_prevue, statut, largueur_id, demo)
  values (p_centre_id, current_date, v_base + 2, v_aeronef, 'J. MOREAU', 4000,
          (now() + interval '10 minutes')::time, 'embarquement', v_largueur, true)
  returning id into v_rot;
  for i in 1..least(5, v_n - v_i + 1) loop
    insert into places_rotation (rotation_id, parachutiste_id, type_saut, rang_sortie, statut)
    values (v_rot, v_gens[v_i], v_types[1 + (v_i % array_length(v_types,1))], i, 'inscrit');
    v_i := v_i + 1; v_places := v_places + 1;
  end loop;

  -- ── Avion 3 — dans 45 min, à moitié rempli.
  insert into rotations (centre_id, date_jour, numero, aeronef_id, pilote,
                         altitude_largage_m, heure_prevue, statut, demo)
  values (p_centre_id, current_date, v_base + 3, v_aeronef, 'C. LEROY', 4000,
          (now() + interval '45 minutes')::time, 'preparation', true)
  returning id into v_rot;
  for i in 1..least(3, v_n - v_i + 1) loop
    insert into places_rotation (rotation_id, parachutiste_id, type_saut, rang_sortie, statut)
    values (v_rot, v_gens[v_i], v_types[1 + (v_i % array_length(v_types,1))], i, 'inscrit');
    v_i := v_i + 1; v_places := v_places + 1;
  end loop;

  -- ── Avion 4 — dans 1 h 20, VIDE et SANS largueur : l'écran doit montrer
  -- l'avion qui ne peut pas partir autant que celui qui roule.
  insert into rotations (centre_id, date_jour, numero, aeronef_id, pilote,
                         altitude_largage_m, heure_prevue, statut, demo)
  values (p_centre_id, current_date, v_base + 4, v_aeronef, null, 4000,
          (now() + interval '80 minutes')::time, 'preparation', true);

  -- ── La file d'attente — le reste des gens, échelonnés dans le temps.
  while v_i <= v_n and v_file < 6 loop
    insert into file_avionnage (centre_id, date_jour, parachutiste_id, type_saut,
                                statut, demande_le, commentaire, demo)
    values (p_centre_id, current_date, v_gens[v_i],
            v_types[1 + (v_i % 5)],  -- 'tandem' n'est pas un type de file
            'attente', now() - (v_file * interval '4 minutes'),
            case when v_file = 0 then 'départ groupe à 4' end, true);
    v_i := v_i + 1; v_file := v_file + 1;
  end loop;

  -- La file ouverte, sinon les licenciés ne verraient rien depuis leur téléphone.
  update centres set avionnage_actif = true where id = p_centre_id and not avionnage_actif;

  return jsonb_build_object('planches', 4, 'places', v_places, 'file', v_file,
                            'largueur_designe', v_largueur is not null);
end $$;

comment on function generer_demo_avionnage(uuid) is
  'Avionnage — remplit la journee de 4 planches de demonstration et d''une file. Idempotente. Ne cree aucun saut.';

revoke all on function generer_demo_avionnage(uuid) from public;
revoke all on function retirer_demo_avionnage(uuid) from public;
grant execute on function generer_demo_avionnage(uuid) to authenticated;
grant execute on function retirer_demo_avionnage(uuid) to authenticated;

commit;

-- APPLIQUÉE LE 10/09/2026 après validation.
