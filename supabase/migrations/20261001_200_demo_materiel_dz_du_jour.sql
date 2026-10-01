-- ═══════════════════════════════════════════════════════════════════════════
-- LA DÉMONSTRATION NE PRÊTAIT AUCUN MATÉRIEL.
--
-- Les vingt présents déclaraient tous une voile personnelle. Une DZ ne
-- fonctionne pas ainsi : une partie du monde saute avec le matériel du centre,
-- et c'est précisément ce matériel-là que le centre doit suivre — il est à
-- lui, il en répond, et il doit savoir le soir lequel n'est pas rentré.
--
-- Cette fonction prête donc des sacs du centre à une partie des présents, et
-- met à jour l'état du sac dans la même écriture. L'état du sac et la présence
-- disent la même chose parce qu'ils sont posés ENSEMBLE : un sac « pris » sans
-- porteur, ou un porteur « location » sans sac, serait un registre qui ment.
--
-- Deux sacs rentrent en cours de journée et passent « à plier » : c'est l'état
-- qui coûte cher à oublier, donc celui qu'une démonstration doit montrer.
--
-- Enfin deux arrivées tardives (14:10 et 15:40). Une DZ ne se remplit pas le
-- matin et ne bouge plus : la liste doit prouver qu'elle suit la journée.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.demo_materiel_dz_du_jour(p_centre_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pretes int := 0;
  v_a_plier int := 0;
  v_tardifs int := 0;
begin
  -- Repartir d'une ardoise propre : la démonstration est rejouable.
  update sacs_parachute set etat_journee = 'libre'
   where centre_id = p_centre_id and etat_journee is distinct from 'libre';

  -- UN PRÉSENT SUR TROIS prend un sac du centre. Appariement déterministe
  -- (rang contre rang) : rejouer la démonstration donne la même journée.
  with presents as (
    select dp.id, row_number() over (order by p.nom, p.prenom) as rang
      from dz_presences dp
      join profiles p on p.id = dp.user_id
     where dp.dz_id = p_centre_id and dp.date_presence = current_date
       and dp.statut = 'present'
  ),
  cibles as (
    select id, row_number() over (order by rang) as n
      from presents where rang % 3 = 0
  ),
  sacs as (
    select id, row_number() over (order by nom_court) as n
      from sacs_parachute
     where centre_id = p_centre_id and statut = 'en_service'
  ),
  paires as (
    select c.id as presence_id, s.id as sac_id from cibles c join sacs s on s.n = c.n
  ),
  maj_presence as (
    update dz_presences dp
       set materiel_type = 'location', sac_ref = pr.sac_id,
           voile_perso_ref = null, voile_perso_libre = null
      from paires pr
     where dp.id = pr.presence_id
     returning 1
  )
  update sacs_parachute s set etat_journee = 'pris'
    from paires pr where s.id = pr.sac_id;
  get diagnostics v_pretes = row_count;

  -- RENTRÉS EN COURS DE JOURNÉE, EN ATTENTE DE PLIAGE. Deux sacs libres du
  -- centre, les premiers par nom : déterministe, et visible dans la liste.
  with a_plier as (
    select id from sacs_parachute
     where centre_id = p_centre_id and statut = 'en_service' and etat_journee = 'libre'
     order by nom_court limit 2
  )
  update sacs_parachute s set etat_journee = 'a_plier'
    from a_plier a where s.id = a.id;
  get diagnostics v_a_plier = row_count;

  -- ARRIVÉES TARDIVES. Les deux derniers présents par ordre alphabétique
  -- arrivent l'après-midi : la journée continue de bouger après le café.
  with tardifs as (
    select dp.id, row_number() over (order by p.nom desc, p.prenom desc) as rang
      from dz_presences dp
      join profiles p on p.id = dp.user_id
     where dp.dz_id = p_centre_id and dp.date_presence = current_date
       and dp.statut = 'present'
  )
  update dz_presences dp
     set heure_debut = case t.rang when 1 then time '15:40' else time '14:10' end,
         checked_in_at = (current_date
            + case t.rang when 1 then time '15:40' else time '14:10' end)::timestamptz
    from tardifs t
   where dp.id = t.id and t.rang <= 2;
  get diagnostics v_tardifs = row_count;

  return jsonb_build_object('materiel_prete', v_pretes,
                            'sacs_a_plier', v_a_plier,
                            'arrivees_tardives', v_tardifs);
end $$;

grant execute on function public.demo_materiel_dz_du_jour(uuid) to authenticated;
