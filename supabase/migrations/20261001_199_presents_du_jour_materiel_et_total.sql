drop function if exists public.presents_du_jour(uuid, date);

create or replace function public.presents_du_jour(
  p_centre_id uuid,
  p_date date default current_date
)
returns table(
  user_id uuid, prenom text, nom text, photo_profil_url text, brevet text,
  qualifications text[], encadrant boolean,
  heure_debut time, heure_fin time, statut text, materiel_type text,
  voile text, surface_ft2 numeric, sac_nom text, sac_statut text,
  checked_in_at timestamptz,
  position_file integer, embarque boolean, sauts_du_jour integer,
  total_sauts integer, demo boolean
)
language sql stable security definer set search_path = public
as $$
  with autorise as (
    select (is_dz_admin(p_centre_id) or is_moniteur_dz(p_centre_id)) as ok
  ),
  file as (
    select f.parachutiste_id, f.statut,
           row_number() over (order by f.demande_le)::int as rang
      from file_avionnage f
     where f.centre_id = p_centre_id and f.date_jour = p_date
       and f.statut in ('attente','placee')
  )
  select dp.user_id, p.prenom, p.nom, p.photo_profil_url,
         (select b.type_brevet from brevets b
           where b.parachutiste_id = dp.user_id
           order by case b.type_brevet
                      when 'D' then 5 when 'C' then 4 when 'BPA' then 3
                      when 'B' then 2 when 'A' then 1 else 0 end desc
           limit 1),
         coalesce((select array_agg(coalesce(qr.libelle, mq.qualification_code)
                                    order by qr.libelle nulls last, mq.qualification_code)
                     from moniteurs_qualifications mq
                     left join qualifications_ref qr on qr.code = mq.qualification_code
                    where mq.user_id = dp.user_id and mq.centre_id = p_centre_id
                      and mq.actif
                      and (mq.date_expiration is null or mq.date_expiration >= p_date)),
                  '{}'),
         exists (select 1 from moniteurs_qualifications mq
                  where mq.user_id = dp.user_id and mq.centre_id = p_centre_id and mq.actif),
         dp.heure_debut, dp.heure_fin, dp.statut, dp.materiel_type,
         coalesce(m.modele, dp.voile_perso_libre, dp.voile_location_ref, s.nom_court),
         coalesce(m.taille_voile_ft2::numeric, s.taille_voile_ft2::numeric),
         -- LE SAC DE LA DZ, NOMMÉ. « location » dit qu'il est prêté ; il ne dit
         -- pas lequel. Un sac en moins au soir se retrouve par son nom, pas par
         -- le mot « location ».
         s.nom_court, s.statut,
         dp.checked_in_at, f.rang,
         coalesce(f.statut = 'placee', false),
         (select count(*)::int from sauts sa
           where sa.parachutiste_id = dp.user_id and sa.centre_id = p_centre_id
             and sa.date_saut = p_date),
         (select count(*)::int from sauts sa where sa.parachutiste_id = dp.user_id),
         dp.demo
    from dz_presences dp
    join profiles p on p.id = dp.user_id
    left join materiels m on m.id = dp.voile_perso_ref
    left join sacs_parachute s on s.id = dp.sac_ref
    left join file f on f.parachutiste_id = dp.user_id
   where dp.dz_id = p_centre_id
     and dp.date_presence = p_date
     and (select ok from autorise)
   order by dp.statut, p.nom, p.prenom;
$$;

grant execute on function public.presents_du_jour(uuid, date) to authenticated;
