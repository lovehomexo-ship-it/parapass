-- ═══════════════════════════════════════════════════════════════════════════
-- DÉMO QUOTIDIENNE — la journée de démonstration se redéploie seule, chaque
-- matin, et se coupe depuis les Paramètres du centre.
--
-- • centres.demo_quotidienne : le réglage. Activé ici pour les centres qui ont
--   utilisé le générateur ces sept derniers jours (BigAir, Royan), sans
--   identifiant écrit en dur.
-- • regler_demo_quotidienne(centre, actif) : ce qu'appelle l'interrupteur.
--   Activer régénère la journée tout de suite ; désactiver RETIRE toute la
--   démonstration — « repartir de zéro ». Réservé aux administrateurs.
-- • demo_quotidienne_balayage() : la tâche planifiée. Elle rejoue
--   generer_demo_dz pour chaque centre concerné, avec les droits d'un de ses
--   administrateurs (les fonctions de démo vérifient toutes auth.uid() : on ne
--   les affaiblit pas, on leur présente qui agit). Un centre en échec n'arrête
--   pas les autres. Jamais exposée aux utilisateurs.
-- • Tous les jours à 9 h UTC (10 h l'hiver, 11 h l'été à Paris) : assez tard
--   pour qu'une « matinée déjà jouée » existe, assez tôt pour la journée.
-- • demo_rotations_vivantes resserre la matinée jouée dans le temps écoulé
--   depuis 9 h, heure de Paris : jamais un décollage avant le lever du soleil.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.centres add column if not exists demo_quotidienne boolean not null default false;
comment on column public.centres.demo_quotidienne is
  'Régénère chaque matin la journée de démonstration (tâche demo-quotidienne).';

update public.centres c set demo_quotidienne = true
 where exists (select 1 from public.rotations r
                where r.centre_id = c.id and r.demo and r.date_jour >= current_date - 7);

create or replace function public.demo_rotations_vivantes(p_centre_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_av uuid; v_larg uuid; v_cap int;
  v_ids uuid[]; v_n int; v_base int;
  v_rot uuid; v_nb int; k int; i int; v_cree int := 0;
  v_ici timestamp := now() at time zone 'Europe/Paris';
  -- décalages en minutes : prévu, décollage, largage, clôture (null = pas encore)
  v_plan int[][] := array[[165, 160, 140, 120], [45, 40, 20, null], [18, 12, null, null]];
  v_statut_place text;
  -- Minutes écoulées depuis 9 h, heure de Paris : la matinée jouée tient dans
  -- la journée de saut, jamais avant le lever du soleil.
  v_dispo numeric := extract(epoch from ((now() at time zone 'Europe/Paris')::time - time '09:00')) / 60;
  v_f numeric;
begin
  if not exists (select 1 from admin_centres ac
                 where ac.profile_id = auth.uid() and ac.centre_id = p_centre_id) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;
  if not centre_module_actif(p_centre_id, 'avionnage') then return 0; end if;
  -- Généré tôt (la démo quotidienne passe le matin), on resserre la matinée
  -- jouée dans le temps écoulé depuis 9 h ; avant 9 h 30, on n'en invente pas.
  v_f := least(1.0, v_dispo / 175.0);

  select r.aeronef_id, r.largueur_id into v_av, v_larg
    from rotations r
   where r.centre_id = p_centre_id and r.date_jour = current_date and r.demo
     and r.largueur_id is not null
   order by r.numero limit 1;
  -- Sans largueur qualifié, aucun avion ne peut décoller : on n'en invente pas.
  if v_larg is null then return 0; end if;
  select a.places into v_cap from aeronefs a where a.id = v_av;

  -- Les sauteurs : ceux de la démo du jour (planches et file), hors largueur,
  -- élèves et tandems — un élève ne saute pas seul, un tandem sans passager
  -- n'existe pas.
  select array_agg(id order by ordre) into v_ids from (
    select distinct on (x.id) x.id, x.ordre from (
      select pr.parachutiste_id id, pr.rang_sortie ordre
        from places_rotation pr join rotations r on r.id = pr.rotation_id
       where r.centre_id = p_centre_id and r.date_jour = current_date and r.demo
         and pr.parachutiste_id is not null and pr.type_saut in ('solo', 'groupe', 'accompagne')
      union all
      select f.parachutiste_id, 50 from file_avionnage f
       where f.centre_id = p_centre_id and f.date_jour = current_date and f.demo
         and f.parachutiste_id is not null and f.type_saut in ('solo', 'groupe', 'accompagne')
    ) x where x.id is distinct from v_larg
    order by x.id, x.ordre
  ) y;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n < 3 then return 0; end if;
  v_nb := least(v_n, greatest(2, coalesce(v_cap, 8) - 2));
  if v_dispo < 30 then v_n := 0; end if;

  -- Les nouvelles planches prennent d'abord des numéros provisoires hors de
  -- portée ; la renumérotation finale les remet dans l'ordre des heures.
  for k in 1..(case when v_n >= 3 then 3 else 0 end) loop
    insert into rotations (centre_id, date_jour, numero, aeronef_id, pilote, altitude_largage_m,
                           heure_prevue, heure_decollage, heure_largage, cloturee_le,
                           statut, largueur_id, demo)
    values (p_centre_id, current_date, 2000 + k, v_av,
            (array['J. MOREAU', 'C. LEROY', 'J. MOREAU'])[k], 4000,
            (v_ici - make_interval(mins => greatest(3, round(v_plan[k][1] * v_f)::int)))::time,
            now() - make_interval(mins => greatest(2, round(v_plan[k][2] * v_f)::int)),
            case when v_plan[k][3] is not null then now() - make_interval(mins => greatest(1, round(v_plan[k][3] * v_f)::int)) end,
            case when v_plan[k][4] is not null then now() - make_interval(mins => greatest(0, round(v_plan[k][4] * v_f)::int)) end,
            case when v_plan[k][4] is not null then 'terminee' else 'en_vol' end,
            v_larg, true)
    returning id into v_rot;

    v_statut_place := case k when 1 then 'pose' when 2 then 'largue' else 'embarque' end;
    insert into places_rotation (rotation_id, parachutiste_id, type_saut, rang_sortie, statut)
    values (v_rot, v_larg, 'largueur', 99, v_statut_place);
    -- Un glissement d'un cran par avion : les mêmes têtes ne font pas les
    -- trois rotations, mais certaines enchaînent, comme un vrai samedi.
    for i in 0..v_nb - 1 loop
      insert into places_rotation (rotation_id, parachutiste_id, type_saut, rang_sortie, statut)
      values (v_rot, v_ids[1 + ((i + (k - 1) * 2) % v_n)], 'solo', i + 1, v_statut_place);
    end loop;
    v_cree := v_cree + 1;
  end loop;

  -- Les planches à venir, recalées en heure de Paris.
  update rotations r set heure_prevue = (v_ici + make_interval(mins => x.decal))::time
    from (select id, (array[12, 50, 90, 130, 170])[least(5, row_number() over (order by numero))::int] decal
            from rotations
           where centre_id = p_centre_id and date_jour = current_date and demo
             and heure_decollage is null and numero < 2000) x
   where r.id = x.id;

  -- Renumérotation dans l'ordre des heures, à la suite des planches réelles.
  select coalesce(max(numero), 0) into v_base from rotations
   where centre_id = p_centre_id and date_jour = current_date and not demo;
  update rotations set numero = numero + 10000
   where centre_id = p_centre_id and date_jour = current_date and demo;
  update rotations r set numero = v_base + x.rang
    from (select id, row_number() over (order by heure_prevue, numero) rang
            from rotations where centre_id = p_centre_id and date_jour = current_date and demo) x
   where r.id = x.id;

  return v_cree;
end $$;

revoke all on function public.demo_rotations_vivantes(uuid) from public, anon;
grant execute on function public.demo_rotations_vivantes(uuid) to authenticated;

create or replace function public.regler_demo_quotidienne(p_centre_id uuid, p_actif boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_res jsonb;
begin
  if not exists (select 1 from admin_centres ac
                 where ac.profile_id = auth.uid() and ac.centre_id = p_centre_id) then
    raise exception 'Réservé aux administrateurs de ce centre.' using errcode = '42501';
  end if;
  update centres set demo_quotidienne = p_actif where id = p_centre_id;
  -- Activer : la journée apparaît tout de suite, sans attendre demain matin.
  -- Désactiver : tout ce que la démonstration a créé disparaît.
  v_res := case when p_actif then generer_demo_dz(p_centre_id) else retirer_demo_dz(p_centre_id) end;
  return jsonb_build_object('demo_quotidienne', p_actif) || coalesce(v_res, '{}'::jsonb);
end $$;

revoke all on function public.regler_demo_quotidienne(uuid, boolean) from public, anon;
grant execute on function public.regler_demo_quotidienne(uuid, boolean) to authenticated;

create or replace function public.demo_quotidienne_balayage()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare c record; v_admin uuid; v_ok int := 0;
begin
  for c in select id, nom from centres where demo_quotidienne loop
    select ac.profile_id into v_admin
      from admin_centres ac join profiles p on p.id = ac.profile_id
     where ac.centre_id = c.id
     order by p.compte_interne desc nulls last, ac.profile_id
     limit 1;
    if v_admin is null then
      raise warning 'Démo quotidienne — % : aucun administrateur, ignoré.', c.nom;
      continue;
    end if;
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    begin
      perform generer_demo_dz(c.id);
      v_ok := v_ok + 1;
    exception when others then
      raise warning 'Démo quotidienne — % : %', c.nom, sqlerrm;
    end;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  return v_ok;
end $$;

revoke all on function public.demo_quotidienne_balayage() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'demo-quotidienne';
select cron.schedule('demo-quotidienne', '0 9 * * *', 'select public.demo_quotidienne_balayage()');
