-- Appliquée en base : capacite_ne_compte_plus_deux_fois_le_moniteur
--
-- LE MONITEUR ÉTAIT COMPTÉ DEUX FOIS. Le déclencheur faisait « une ligne + une
-- de plus dès qu'un moniteur est désigné ». Or un moniteur PAC a presque
-- toujours SA PROPRE LIGNE sur la planche. Effet observé sur 9 personnes dans
-- un 10 places : l'écran affichait « 1 place libre » et la base refusait le
-- dixième en annonçant « ferait 11 ». Le siège existait, personne ne pouvait
-- s'y asseoir. On compte désormais comme l'écran (siegesOccupes).
create or replace function places_rotation_capacite()
returns trigger language plpgsql as $$
declare
  v_places int; v_occupes int; v_immat text;
begin
  select a.places, a.immatriculation into v_places, v_immat
  from rotations r join aeronefs a on a.id = r.aeronef_id
  where r.id = new.rotation_id;

  if v_places is null then return new; end if;

  with lignes as (
    select parachutiste_id, moniteur_id
    from places_rotation
    where rotation_id = new.rotation_id and id is distinct from new.id
    union all
    select new.parachutiste_id, new.moniteur_id
  )
  select count(*)
       + (select count(distinct l.moniteur_id) from lignes l
          where l.moniteur_id is not null
            and l.moniteur_id not in (select l2.parachutiste_id from lignes l2
                                      where l2.parachutiste_id is not null))
    into v_occupes
  from lignes;

  if v_occupes > v_places then
    raise exception
      'Rotation complete : % sieges parachutistes dans le % (pilote non compris), cette inscription ferait %.',
      v_places, coalesce(v_immat, 'l''aeronef'), v_occupes
      using errcode = '23514',
            hint = 'Creez la rotation suivante, laissez la personne en file d''avionnage, ou corrigez le nombre de places de cet aeronef dans la flotte.';
  end if;
  return new;
end $$;
