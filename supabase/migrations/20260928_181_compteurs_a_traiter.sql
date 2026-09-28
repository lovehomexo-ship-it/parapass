-- « Ce qui attend une décision de la DZ » était compté à trois endroits, avec
-- trois requêtes écrites séparément — et une règle P11.1 recopiée à la main :
-- « les dossiers de démonstration n'encombrent pas la file d'un centre ».
--
-- Cette règle était écrite à l'envers. Elle excluait les profils `est_demo`
-- PARTOUT, y compris sur un centre de démonstration où TOUS les licenciés le
-- sont. Sur Royan, une demande de démonstration ne pouvait donc jamais
-- s'afficher ni être comptée. L'intention est « pas de démo chez un centre de
-- PRODUCTION » : c'est le centre qui décide, pas le dossier.
--
-- Une seule fonction porte la règle ; le compteur du menu ET l'écran des
-- attestations l'appellent au lieu de la réécrire. Les deux l'avaient écrite
-- chacun de son côté, et ils avaient fini par diverger : la pastille annonçait
-- deux attestations, l'écran n'en montrait aucune.
create or replace function centre_montre_les_demos(p_centre_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select c.is_demo from centres c where c.id = p_centre_id), false);
$$;

comment on function centre_montre_les_demos(uuid) is
  'Un centre de démonstration montre ses dossiers de démonstration ; un centre '
  'de production ne voit jamais les siens (P11.1). Règle unique, partagée par '
  'compteurs_a_traiter et l''écran des attestations.';

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
                   where s.centre_id = p_centre_id and s.statut = 'en_attente')
  ) end;
$$;

comment on function compteurs_a_traiter(uuid) is
  'Ce qui attend une décision de la DZ : adhésions, attestations de carnet, sauts. '
  'Une seule définition pour la pastille du menu et pour les écrans.';

grant execute on function centre_montre_les_demos(uuid) to authenticated;
grant execute on function compteurs_a_traiter(uuid) to authenticated;
