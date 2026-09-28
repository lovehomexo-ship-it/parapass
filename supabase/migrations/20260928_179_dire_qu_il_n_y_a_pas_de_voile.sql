-- « voile enregistrée (rien de déclaré aujourd'hui) » s'affichait sous VOI-001
-- alors que le parachutiste n'a AUCUNE voile active.
--
-- Le repli cherche `materiels` en statut 'actif'. Florian PUYBAREAU a retiré sa
-- voile de son matériel — l'écran la passe en 'hors_service' et cesse de
-- l'afficher — donc la requête ne rend rien, la surface est nulle… et le libellé
-- annonce quand même « voile enregistrée ». Le verdict était juste (indisponible,
-- P1 : donnée absente = gris, jamais vert), le motif mentait.
--
-- On compte les voiles actives AVANT de conclure, et on nomme les deux
-- situations séparément : aucune voile, ou une voile sans surface saisie.
-- Même traitement quand la présence du jour désigne une voile devenue hors
-- service : la ligne reste, la voile n'est plus en état de voler.
create or replace function dt48_surface_du_jour(p_parachutiste_id uuid, p_centre_id uuid)
returns table (surface numeric, origine text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_decl record; v_s numeric; v_actives int; v_statut text;
begin
  select pr.surface_voile_ft2 into v_s
    from places_rotation pr
    join rotations r on r.id = pr.rotation_id
   where pr.parachutiste_id = p_parachutiste_id
     and r.centre_id = p_centre_id and r.date_jour = current_date
     and pr.surface_voile_ft2 is not null
   order by r.numero desc limit 1;
  if v_s is not null then
    return query select v_s, 'declaree a l''avionnage'::text;
    return;
  end if;

  select f.surface_voile_ft2 into v_s
    from file_avionnage f
   where f.parachutiste_id = p_parachutiste_id and f.centre_id = p_centre_id
     and f.date_jour = current_date and f.surface_voile_ft2 is not null
   limit 1;
  if v_s is not null then
    return query select v_s, 'declaree en file'::text;
    return;
  end if;

  select d.materiel_type, d.voile_perso_ref, d.voile_perso_libre,
         d.voile_location_ref, d.sac_ref
    into v_decl
    from dz_presences d
   where d.user_id = p_parachutiste_id and d.dz_id = p_centre_id
     and d.date_presence = current_date
   limit 1;

  if v_decl is null then
    select count(*) into v_actives
      from materiels m
     where m.parachutiste_id = p_parachutiste_id
       and m.type = 'parachute_principal' and m.statut = 'actif';

    if v_actives = 0 then
      return query select null::numeric,
        'aucune voile principale active dans le materiel personnel, et rien de declare aujourd''hui'::text;
      return;
    end if;

    select m.taille_voile_ft2 into v_s from materiels m
     where m.parachutiste_id = p_parachutiste_id and m.type = 'parachute_principal'
       and m.statut = 'actif' and m.taille_voile_ft2 is not null
     order by m.created_at desc limit 1;

    if v_s is null then
      return query select null::numeric,
        'voile enregistree mais sans surface saisie, et rien de declare aujourd''hui'::text;
    else
      return query select v_s, 'voile enregistree (rien de declare aujourd''hui)'::text;
    end if;
    return;
  end if;

  if v_decl.sac_ref is not null then
    select s.taille_voile_ft2 into v_s from sacs_parachute s where s.id = v_decl.sac_ref;
    if v_s is null then
      return query select null::numeric,
        ('sac « ' || coalesce((select nom_court from sacs_parachute where id = v_decl.sac_ref), '?')
         || ' » : surface absente de l''inventaire')::text;
    else
      return query select v_s, ('sac « '
        || coalesce((select nom_court from sacs_parachute where id = v_decl.sac_ref), '?') || ' »')::text;
    end if;
  elsif v_decl.voile_perso_ref is not null then
    select m.taille_voile_ft2, m.statut into v_s, v_statut
      from materiels m where m.id = v_decl.voile_perso_ref;
    if v_statut is distinct from 'actif' then
      return query select null::numeric,
        'la voile declaree ce jour n''est plus active dans le materiel personnel'::text;
    elsif v_s is null then
      return query select null::numeric,
        'voile declaree ce jour, sans surface saisie'::text;
    else
      return query select v_s, 'voile declaree ce jour'::text;
    end if;
  else
    return query select null::numeric,
      (case when v_decl.materiel_type = 'location'
            then 'location « ' || coalesce(v_decl.voile_location_ref, '?')
                 || ' » non rattachee au parc : surface inconnue'
            else 'voile « ' || coalesce(v_decl.voile_perso_libre, '?')
                 || ' » en texte libre : surface inconnue' end)::text;
  end if;
end
$$;
