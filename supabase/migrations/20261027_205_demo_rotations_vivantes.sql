-- ═══════════════════════════════════════════════════════════════════════════
-- DÉMO : UNE JOURNÉE D'AVIONNAGE VIVANTE.
--
-- La démo ne créait que trois planches à venir (embarquement, préparation,
-- préparation). La frise « La journée en rotations » ne montrait donc jamais
-- un avion en vol ni un largage : la moitié de ce qu'elle sait dire.
--
-- demo_rotations_vivantes ajoute, AVANT ces trois planches, la matinée déjà
-- jouée :
--   • un avion clôturé  (décollé il y a 2 h 40, largué, clôturé) ;
--   • un avion largué   (décollé il y a 40 min, largage il y a 20 min) ;
--   • un avion en vol   (décollé il y a 12 min).
-- puis renumérote les planches de démo dans l'ordre des heures, et recale les
-- planches à venir en HEURE DE PARIS (now()::time donnait l'heure UTC : une
-- planche « dans 25 min » s'affichait en retard d'une heure en hiver).
--
-- AUCUNE de ces planches ne reçoit embarquement_valide_le : une planche
-- validée ne se supprime plus, et ne se rouvre plus une fois l'avion parti —
-- « Retirer la démo » échouerait. La phase se lit de toute façon dans les
-- heures de décollage, de largage et de clôture.
--
-- demo_sauts_du_jour ne crée plus de sauts que pour les avions CLÔTURÉS : des
-- sauts inscrits au carnet pour une planche qui n'a pas encore décollé
-- contredisaient la frise.
-- ═══════════════════════════════════════════════════════════════════════════

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
begin
  if not exists (select 1 from admin_centres ac
                 where ac.profile_id = auth.uid() and ac.centre_id = p_centre_id) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;
  if not centre_module_actif(p_centre_id, 'avionnage') then return 0; end if;
  -- Trop tôt dans la journée, la matinée « déjà jouée » tomberait la veille.
  if v_ici::time < time '04:00' then return 0; end if;

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

  -- Les nouvelles planches prennent d'abord des numéros provisoires hors de
  -- portée ; la renumérotation finale les remet dans l'ordre des heures.
  for k in 1..3 loop
    insert into rotations (centre_id, date_jour, numero, aeronef_id, pilote, altitude_largage_m,
                           heure_prevue, heure_decollage, heure_largage, cloturee_le,
                           statut, largueur_id, demo)
    values (p_centre_id, current_date, 2000 + k, v_av,
            (array['J. MOREAU', 'C. LEROY', 'J. MOREAU'])[k], 4000,
            (v_ici - make_interval(mins => v_plan[k][1]))::time,
            now() - make_interval(mins => v_plan[k][2]),
            case when v_plan[k][3] is not null then now() - make_interval(mins => v_plan[k][3]) end,
            case when v_plan[k][4] is not null then now() - make_interval(mins => v_plan[k][4]) end,
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

-- Des sauts au carnet pour les seuls avions clôturés.
create or replace function public.demo_sauts_du_jour(p_centre_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_n int;
begin
  insert into sauts (parachutiste_id, date_saut, lieu, centre_id, aeronef_immat,
                     nature_saut, categorie, hauteur_m, hauteur_ouverture, fonction,
                     statut, is_tunnel, moniteur_nom_libre, place_rotation_id,
                     observations, demo)
  select pr.parachutiste_id, current_date, c.nom, p_centre_id,
         coalesce(a.immatriculation, 'F-DEMO'),
         case pr.type_saut when 'tandem' then 'tandem'
                           when 'pac'    then 'pac'
                           else 'entrainement' end,
         'OA',
         coalesce(pr.altitude_largage_m, r.altitude_largage_m, 4000),
         case when pr.type_saut = 'pac' then 1500 else 1200 end,
         'largueur',
         case when (pr.rang_sortie % 5) < 2 then 'en_attente' else 'valide' end,
         false, 'Moniteur de démonstration', pr.id,
         '[DÉMO] Saut de démonstration', true
    from places_rotation pr
    join rotations r on r.id = pr.rotation_id
    join centres c   on c.id = p_centre_id
    left join aeronefs a on a.id = r.aeronef_id
   where r.centre_id = p_centre_id
     and r.demo
     and r.date_jour = current_date
     and (r.cloturee_le is not null or r.statut = 'terminee')
     and pr.parachutiste_id is not null
     and not exists (select 1 from sauts s where s.place_rotation_id = pr.id);
  get diagnostics v_n = row_count;
  return v_n;
end
$function$;

-- Le générateur de journée appelle la matinée jouée APRÈS les planches à venir
-- (elle y prend ses sauteurs et son largueur) et AVANT les sauts du jour.
create or replace function public.generer_demo_dz(p_centre_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_res jsonb := '{}'::jsonb;
  v_pliage jsonb := '{}'::jsonb;
  v_demandes jsonb;
  v_equipe jsonb;
  v_materiel jsonb := '{}'::jsonb;
  v_sauts int := 0;
  v_tandem int := 0;
  v_vols int := 0;
  v_ignores text[] := '{}';
begin
  if not exists (select 1 from admin_centres ac
                 where ac.centre_id = p_centre_id and ac.profile_id = auth.uid()) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;

  perform retirer_demo_dz(p_centre_id);

  -- L'ENCADREMENT D'ABORD : les regles de securite lisent les qualifications
  -- (largueur, tandem, referent mineurs). Composer des planches avant de savoir
  -- qui encadre donnerait des verdicts faux.
  v_equipe := demo_equipe_encadrante(p_centre_id);

  if centre_module_actif(p_centre_id, 'avionnage') then
    v_res   := generer_demo_avionnage(p_centre_id);
    v_vols  := demo_rotations_vivantes(p_centre_id);
    v_sauts := demo_sauts_du_jour(p_centre_id);
  else
    perform demo_briefing_du_jour(p_centre_id);
    v_res := jsonb_build_object('dossiers', demo_dossiers_a_jour(p_centre_id));
    v_ignores := array_append(v_ignores, 'Avionnage');
  end if;

  if centre_module_actif(p_centre_id, 'pliage') then
    v_pliage := generer_demo_pliage(p_centre_id);
  else
    v_ignores := array_append(v_ignores, 'Pliage');
  end if;

  if centre_module_actif(p_centre_id, 'tandem') then
    v_tandem := demo_reservations_tandem(p_centre_id);
  else
    v_ignores := array_append(v_ignores, 'Tandem');
  end if;

  v_demandes := demo_demandes_en_attente(p_centre_id);
  perform demo_messages_du_jour(p_centre_id);

  -- APRES les presences, qu'elle modifie : une partie du monde saute avec le
  -- materiel du centre, et le parc doit le dire. Sans module de pliage, le
  -- pret reste vrai : le centre prete des sacs qu'il n'a pas plies lui-meme.
  v_materiel := demo_materiel_dz_du_jour(p_centre_id);

  update dz_briefings set demo = true
   where dz_id = p_centre_id and date_briefing = current_date and not demo;
  update dz_presences set demo = true
   where dz_id = p_centre_id and date_presence = current_date and not demo;

  return v_res || jsonb_build_object(
    'sauts', v_sauts, 'tandem', v_tandem, 'avions_partis', v_vols,
    'pliages', coalesce((v_pliage->>'pliages')::int, 0),
    'sacs', coalesce((v_pliage->>'sacs')::int, 0),
    'adhesions', coalesce((v_demandes->>'adhesions')::int, 0),
    'carnets', coalesce((v_demandes->>'carnets')::int, 0),
    'qualifications', coalesce((v_equipe->>'qualifications')::int, 0),
    'delegations', coalesce((v_equipe->>'delegations')::int, 0),
    'materiel_prete', coalesce((v_materiel->>'materiel_prete')::int, 0),
    'sacs_a_plier', coalesce((v_materiel->>'sacs_a_plier')::int, 0),
    'arrivees_tardives', coalesce((v_materiel->>'arrivees_tardives')::int, 0),
    'modules_non_souscrits', to_jsonb(v_ignores),
    'presents', (select count(*) from dz_presences
                  where dz_id = p_centre_id and date_presence = current_date));
end $function$;
