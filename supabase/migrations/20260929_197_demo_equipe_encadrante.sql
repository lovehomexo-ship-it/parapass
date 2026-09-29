-- L'équipe de démonstration de Royan tenait en quatre plieurs : aucun moniteur,
-- aucun largueur, aucune délégation de validation. L'écran « Mon équipe » était
-- donc vide de ce qui fait justement une équipe — et une capture d'écran d'un
-- centre sans encadrant ne tient pas debout.
--
-- Les qualifications sont attribuées PAR RANG D'EXPÉRIENCE, pas au hasard : le
-- DEJEPS au plus ancien, les brevets d'État aux brevetés D, les qualifications
-- de discipline ensuite. Un moniteur tandem avec 180 sauts se verrait tout de
-- suite, et c'est exactement ce qu'un directeur technique regarderait d'abord.
--
-- Déterministe : même rang, même qualification à chaque régénération. Une
-- capture reste comparable d'un jour à l'autre.
create or replace function demo_equipe_encadrante(p_centre_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dt uuid;
  v_qualifs int;
  v_delegations int;
begin
  select ac.profile_id into v_dt
    from admin_centres ac join profiles p on p.id = ac.profile_id
   where ac.centre_id = p_centre_id
   order by (select count(*) from sauts s where s.parachutiste_id = p.id) desc
   limit 1;

  -- On repart de zéro pour les profils fictifs du centre : jamais pour un
  -- dossier réel, qui porte de vraies qualifications.
  delete from moniteurs_qualifications mq using profiles p
   where p.id = mq.user_id and mq.centre_id = p_centre_id and not p.donnees_reelles;
  delete from delegations_validation dv using profiles p
   where p.id = dv.moniteur_id and dv.centre_id = p_centre_id and not p.donnees_reelles;

  with cadres as (
    select p.id,
           row_number() over (
             order by (select count(*) from sauts s where s.parachutiste_id = p.id) desc, p.nom
           ) as rang
      from profiles p
      join licencies_centres lc on lc.parachutiste_id = p.id and lc.centre_id = p_centre_id
     where lc.statut = 'actif' and not p.donnees_reelles
       and exists (select 1 from brevets b where b.parachutiste_id = p.id
                    and b.type_brevet in ('C','D'))
  ),
  attributions as (
    select c.id, c.rang, q.code, q.anciennete,
           row_number() over (order by c.rang, q.code) as numero_ordre
      from cadres c
      cross join lateral (
        values
          -- rang 1 : le directeur technique.
          (1, 'DEJEPS', 9), (1, 'DSS', 7), (1, 'LARGUEUR', 6),
          -- rangs 2 à 4 : l'encadrement permanent.
          (2, 'BPJEPS', 6), (2, 'TANDEM', 5),
          (3, 'BEES1', 8),  (3, 'MONITEUR_REFERENT_MINEURS', 3),
          (4, 'BPJEPS', 5), (4, 'INITIATEUR_VR', 4), (4, 'LARGUEUR', 3),
          -- rangs 5 à 10 : moniteurs fédéraux et qualifications de discipline.
          (5, 'MONITEUR_FEDERAL', 4), (5, 'VIDEO', 2),
          (6, 'MONITEUR_FEDERAL', 3), (6, 'WINGSUIT', 2),
          (7, 'TANDEM', 3), (8, 'VIDEO', 2), (9, 'LARGUEUR', 2), (10, 'DSS', 2)
      ) as q(pour_rang, code, anciennete)
     where q.pour_rang = c.rang
  )
  insert into moniteurs_qualifications (user_id, centre_id, qualification_code, numero, date_obtention, date_expiration, actif)
  select a.id, p_centre_id, a.code,
         -- Un numéro COURT : il s'affiche sur la carte, à côté du libellé.
         -- « DEMO-MONITEUR_REFERENT_MINEURS-03 » débordait de la pastille.
         'ROP-' || to_char(current_date - (a.anciennete * interval '1 year'), 'YYYY')
                || '-' || lpad(a.numero_ordre::text, 3, '0'),
         (current_date - (a.anciennete * interval '1 year'))::date,
         -- Les diplômes d'État ne portent pas d'échéance ici ; les
         -- qualifications de discipline en portent une, pour que l'écran de
         -- veille ait quelque chose à surveiller.
         case when a.code in ('TANDEM','LARGUEUR','VIDEO','WINGSUIT')
              then (current_date + interval '14 months')::date end,
         true
    from attributions a;
  get diagnostics v_qualifs = row_count;

  -- Le DT délègue la validation aux moniteurs des rangs 2 à 5. Une délégation
  -- est un ACTE nominatif : elle porte sa date et son motif.
  if v_dt is not null then
    with cadres as (
      select p.id,
             row_number() over (
               order by (select count(*) from sauts s where s.parachutiste_id = p.id) desc, p.nom
             ) as rang
        from profiles p
        join licencies_centres lc on lc.parachutiste_id = p.id and lc.centre_id = p_centre_id
       where lc.statut = 'actif' and not p.donnees_reelles
         and exists (select 1 from brevets b where b.parachutiste_id = p.id
                      and b.type_brevet in ('C','D'))
    )
    insert into delegations_validation (centre_id, dt_id, moniteur_id, actif, date_delegation, note)
    select p_centre_id, v_dt, c.id, true, current_date - interval '6 months',
           'Délégation de validation des sauts et des épreuves de brevet.'
      from cadres c where c.rang between 2 and 5 and c.id <> v_dt;
    get diagnostics v_delegations = row_count;

    update profiles set role = 'moniteur_delegue'
     where id in (select moniteur_id from delegations_validation
                   where centre_id = p_centre_id and actif)
       and role = 'parachutiste' and not donnees_reelles;
  end if;

  return jsonb_build_object('qualifications', v_qualifs, 'delegations', coalesce(v_delegations, 0));
end
$$;

grant execute on function demo_equipe_encadrante(uuid) to authenticated;

-- L'ENCADREMENT SE GÉNÈRE EN PREMIER : les règles de sécurité lisent les
-- qualifications (largueur, tandem, référent mineurs). Composer des planches
-- avant de savoir qui encadre donnerait des verdicts faux.
create or replace function generer_demo_dz(p_centre_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb := '{}'::jsonb;
  v_pliage jsonb := '{}'::jsonb;
  v_demandes jsonb;
  v_equipe jsonb;
  v_sauts int := 0;
  v_tandem int := 0;
  v_ignores text[] := '{}';
begin
  if not exists (select 1 from admin_centres ac
                 where ac.centre_id = p_centre_id and ac.profile_id = auth.uid()) then
    raise exception 'Reserve a l''administrateur de ce centre.' using errcode = '42501';
  end if;

  perform retirer_demo_dz(p_centre_id);

  v_equipe := demo_equipe_encadrante(p_centre_id);

  if centre_module_actif(p_centre_id, 'avionnage') then
    v_res   := generer_demo_avionnage(p_centre_id);
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

  update dz_briefings set demo = true
   where dz_id = p_centre_id and date_briefing = current_date and not demo;
  update dz_presences set demo = true
   where dz_id = p_centre_id and date_presence = current_date and not demo;

  return v_res || jsonb_build_object(
    'sauts', v_sauts, 'tandem', v_tandem,
    'pliages', coalesce((v_pliage->>'pliages')::int, 0),
    'sacs', coalesce((v_pliage->>'sacs')::int, 0),
    'adhesions', coalesce((v_demandes->>'adhesions')::int, 0),
    'carnets', coalesce((v_demandes->>'carnets')::int, 0),
    'qualifications', coalesce((v_equipe->>'qualifications')::int, 0),
    'delegations', coalesce((v_equipe->>'delegations')::int, 0),
    'modules_non_souscrits', to_jsonb(v_ignores),
    'presents', (select count(*) from dz_presences
                  where dz_id = p_centre_id and date_presence = current_date));
end $$;
