-- Démo : numérotation robuste quand la démo est générée tard le soir.
-- Les heures « à venir » plafonnent à 23 h 45 et l'ordre ne dépend plus de
-- l'heure prévue (qui passait minuit) mais des décollages, puis de l'ordre de
-- création des planches.

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
  -- Plafonné à 23 h 45 : généré tard le soir, « dans 50 min » tombait après
  -- minuit (00 h 15) et la planche passait devant celles de la matinée.
  update rotations r set heure_prevue = least(v_ici + make_interval(mins => x.decal), date_trunc('day', v_ici) + interval '23 hours 45 minutes')::time
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
    -- Les avions partis d'abord, dans l'ordre de leur décollage ; puis les
    -- planches à venir dans l'ordre où le générateur les a créées.
    from (select id, row_number() over (order by (heure_decollage is null), heure_decollage, numero) rang
            from rotations where centre_id = p_centre_id and date_jour = current_date and demo) x
   where r.id = x.id;

  return v_cree;
end $$;

revoke all on function public.demo_rotations_vivantes(uuid) from public, anon;
grant execute on function public.demo_rotations_vivantes(uuid) to authenticated;
