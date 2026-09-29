-- DEUX DÉFAUTS TROUVÉS EN TESTANT LE CAS « MODULE NON SOUSCRIT ».
--
-- 1. On pouvait se mettre en file d'une DZ où l'on n'a pas mis les pieds. La
--    fonction vérifiait le module, l'ouverture de la file et la licence — pas
--    la présence. Le chef d'avionnage composait donc ses rotations avec des
--    gens absents. Le préalable n'est pas une contrainte : déclarer sa présence
--    est UN TAP, depuis la barre du bas, et le message le dit.
--
-- 2. `rejoindre_file_avionnage` existait en DEUX exemplaires — 3 et 4
--    arguments. L'ancienne signature ne connaît pas la surface de voilure : un
--    appel qui l'atteindrait inscrirait quelqu'un SANS sa surface, et la règle
--    DT 48 ne pourrait plus se prononcer sur lui. C'est le piège déjà rencontré
--    sur ce projet — ajouter un paramètre par défaut crée une SURCHARGE, pas un
--    remplacement. La surcharge morte est supprimée.
drop function if exists rejoindre_file_avionnage(uuid, text, text);
drop function if exists rejoindre_file_avionnage(uuid, text, text, numeric);

create function rejoindre_file_avionnage(
  p_centre_id uuid,
  p_type_saut text default 'solo',
  p_commentaire text default null,
  p_surface_voile_ft2 numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_position int;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour rejoindre la file.' using errcode = '42501';
  end if;
  if not centre_module_actif(p_centre_id, 'avionnage') then
    raise exception 'L''avionnage n''est pas proposé par ce centre.' using errcode = '42501';
  end if;
  if not exists (select 1 from centres c where c.id = p_centre_id and c.avionnage_actif) then
    raise exception 'L''avionnage n''est pas ouvert sur ce centre aujourd''hui.'
      using errcode = '42501', hint = 'Le centre ouvre la file depuis l''onglet Rotations.';
  end if;
  if not exists (select 1 from licencies_centres lc
                 where lc.parachutiste_id = v_uid and lc.centre_id = p_centre_id
                   and lc.statut = 'actif') then
    raise exception 'Vous n''êtes pas licencié actif de ce centre.' using errcode = '42501';
  end if;
  -- LA PRÉSENCE. On ne compose pas une rotation avec quelqu'un qui n'est pas
  -- sur le terrain ; et la déclarer est un tap.
  if not exists (select 1 from dz_presences dp
                 where dp.dz_id = p_centre_id and dp.user_id = v_uid
                   and dp.date_presence = current_date) then
    raise exception 'Déclarez d''abord votre présence sur la DZ.'
      using errcode = '42501', hint = 'Bouton Présence, en bas de l''écran.';
  end if;

  select id into v_id from file_avionnage
  where centre_id = p_centre_id and date_jour = current_date
    and parachutiste_id = v_uid and statut = 'attente';

  if v_id is null then
    insert into file_avionnage (centre_id, parachutiste_id, type_saut, commentaire, surface_voile_ft2)
    values (p_centre_id, v_uid, coalesce(p_type_saut, 'solo'), nullif(trim(p_commentaire), ''),
            p_surface_voile_ft2)
    returning id into v_id;
  else
    update file_avionnage
       set type_saut = coalesce(p_type_saut, type_saut),
           commentaire = coalesce(nullif(trim(p_commentaire), ''), commentaire),
           surface_voile_ft2 = coalesce(p_surface_voile_ft2, surface_voile_ft2)
     where id = v_id;
  end if;

  select count(*) into v_position
  from file_avionnage f
  where f.centre_id = p_centre_id and f.date_jour = current_date and f.statut = 'attente'
    and f.demande_le <= (select demande_le from file_avionnage where id = v_id);

  return jsonb_build_object('id', v_id, 'position', v_position);
end
$$;

grant execute on function rejoindre_file_avionnage(uuid, text, text, numeric) to authenticated;
