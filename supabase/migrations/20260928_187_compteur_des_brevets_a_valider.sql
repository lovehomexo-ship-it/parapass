-- Un élève qui se déclare prêt pour une épreuve de brevet n'était signalé nulle
-- part dans le menu : « File de validation (1) » s'affiche DANS l'Académie, à
-- condition d'y entrer. Le DT devait donc ouvrir l'écran pour savoir qu'il
-- avait quelque chose à y faire.
--
-- Le compte suit la même règle que la file elle-même : les licenciés ACTIFS du
-- centre, quel que soit le centre_id figé au moment de la déclaration — une
-- progression appartient au parachutiste, pas à une DZ.
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
                                    and lc.statut = 'actif'))
  ) end;
$$;

comment on function compteurs_a_traiter(uuid) is
  'Ce qui attend une décision de la DZ : adhésions, attestations de carnet, '
  'sauts, épreuves de brevet. Une seule définition pour la pastille du menu '
  'et pour les écrans.';
