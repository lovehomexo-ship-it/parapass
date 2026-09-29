-- Le nombre de personnes sur le terrain rejoint les compteurs du centre. Ce
-- n'est PAS « ce qui attend une décision » — personne n'a rien à valider — mais
-- c'est le chiffre qu'on regarde en premier le matin, et il doit se lire sans
-- ouvrir un écran.
create or replace function compteurs_a_traiter(p_centre_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with acces as (select (is_dz_admin(p_centre_id) or is_moniteur_dz(p_centre_id)) as ok),
       centre as (select centre_montre_les_demos(p_centre_id) as demo)
  select case when not (select ok from acces) then '{}'::jsonb else jsonb_build_object(
    'adhesions', (select count(*) from licencies_centres lc join profiles p on p.id = lc.parachutiste_id
                   where lc.centre_id = p_centre_id and lc.statut = 'en_attente'
                     and ((select demo from centre) or not p.est_demo)),
    'carnets',   (select count(*) from licencies_centres lc join profiles p on p.id = lc.parachutiste_id
                   where lc.centre_id = p_centre_id and lc.statut = 'actif'
                     and lc.carnet_statut = 'en_attente'
                     and ((select demo from centre) or not p.est_demo)),
    'sauts',     (select count(*) from sauts s
                   where s.centre_id = p_centre_id and s.statut = 'en_attente'),
    'brevets',   (select count(*) from progression_epreuves pe
                   where pe.statut = 'pret'
                     and exists (select 1 from licencies_centres lc
                                  where lc.parachutiste_id = pe.user_id
                                    and lc.centre_id = p_centre_id
                                    and lc.statut = 'actif')),
    'questions', (select count(*) from quiz_questions q
                   where q.centre_id = p_centre_id and q.statut <> 'validee'),
    -- Les repartis ne comptent pas : on veut les têtes présentes maintenant.
    'presents',  (select count(*) from dz_presences dp
                   where dp.dz_id = p_centre_id and dp.date_presence = current_date
                     and dp.statut <> 'parti')
  ) end;
$$;
