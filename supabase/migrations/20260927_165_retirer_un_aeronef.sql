-- Appliquée en base : retirer_aeronef_de_la_flotte + royan_flotte_a_l_echelle_du_centre
--
-- ON NE POUVAIT PAS RETIRER UN AÉRONEF. La flotte s'ajoutait et se corrigeait,
-- jamais elle ne se vidait : une immatriculation saisie de travers, un avion
-- vendu, un essai — tout restait, et polluait le choix à chaque planche.
--
-- SUPPRIMER N'EST PAS TOUJOURS POSSIBLE, ET C'EST TANT MIEUX. Un aéronef cité
-- par une rotation porte une trace : la planche du 12 mars dit quel avion a
-- largué. L'effacer réécrirait l'histoire. Il est alors DÉSACTIVÉ — il quitte
-- les listes et les nouvelles planches, les rotations passées le nomment
-- toujours. Il n'est vraiment supprimé que s'il n'a jamais servi.
create or replace function retirer_aeronef(p_aeronef_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_centre uuid; v_immat text; v_rotations int;
begin
  select a.centre_id, a.immatriculation into v_centre, v_immat
    from aeronefs a where a.id = p_aeronef_id;
  if v_centre is null then
    raise exception 'Aéronef introuvable' using errcode = 'P0002';
  end if;

  if not exists (select 1 from admin_centres ac
                 where ac.profile_id = auth.uid() and ac.centre_id = v_centre) then
    raise exception 'Réservé à l''administrateur de ce centre.' using errcode = '42501';
  end if;

  select count(*) into v_rotations from rotations r where r.aeronef_id = p_aeronef_id;

  if v_rotations = 0 then
    delete from aeronefs where id = p_aeronef_id;
    return jsonb_build_object('action', 'supprime', 'immatriculation', v_immat);
  end if;

  update aeronefs set actif = false where id = p_aeronef_id;
  return jsonb_build_object('action', 'desactive', 'immatriculation', v_immat,
                            'rotations', v_rotations);
end $$;

revoke all on function retirer_aeronef(uuid) from public;
grant execute on function retirer_aeronef(uuid) to authenticated;

-- UNE FLOTTE À L'ÉCHELLE DU CENTRE. Royan avait un Cessna Caravan à 17 places,
-- et le générateur de démo choisit le PLUS GRAND avion : toutes les planches
-- s'ouvraient dessus, et neuf personnes dans dix-sept sièges donnaient une
-- journée à moitié vide. Royan vole désormais au Pilatus PC-6 (10 places) avec
-- un Cessna 206 en appoint — configuration courante d'une école de cette
-- taille, et une planche de neuf s'y lit « 9/10 ».
