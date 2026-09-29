-- Le tableau de bord affichait UN BANDEAU D'AVIONNAGE PAR CENTRE : deux
-- affiliations donnaient deux bandeaux, cinq en donnaient cinq — tous
-- identiques, tous vides, et la licence numérique passait sous la ligne de
-- flottaison.
--
-- Le défaut n'est pas cosmétique, il est de conception : ON NE SAUTE PAS SUR
-- CINQ DROP ZONES LE MÊME JOUR. Afficher les cinq, c'est afficher quatre fois
-- rien.
--
-- Cette fonction rend une ligne par centre où la personne est licenciée
-- active, avec de quoi décider LEQUEL montrer, et les trie déjà : d'abord là
-- où elle est engagée dans la file, puis là où un avion vole. L'écran n'a plus
-- à deviner — il prend la première.
-- CORRECTIF DE LA MÊME JOURNÉE. La première version rendait TOUTES les DZ où
-- la personne est licenciée active, sans regarder si le centre a SOUSCRIT le
-- module Avionnage : une DZ qui ne l'a jamais acheté voyait donc son bandeau
-- s'afficher et faisait clignoter la pastille de la barre mobile. Je ne l'avais
-- pas vu parce que mes deux DZ d'essai avaient toutes deux le module.
--
-- `centres.avionnage_actif` n'est PAS la souscription : c'est l'interrupteur du
-- jour, « la file est ouverte ». Les deux étaient confondus.
--
-- La présence entre aussi dans le tri : on saute là où l'on est.
drop function if exists mon_avionnage_du_jour(uuid);

create function mon_avionnage_du_jour(p_user_id uuid)
returns table (
  centre_id uuid,
  centre_nom text,
  ouvert boolean,
  je_suis_present boolean,
  avions_programmes int,
  avions_a_venir int,
  ma_position int,
  total_attente int,
  suis_je_place boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with mes_dz as (
    select lc.centre_id, c.nom, coalesce(c.avionnage_actif, false) as actif
      from licencies_centres lc
      join centres c on c.id = lc.centre_id
     where lc.parachutiste_id = p_user_id
       and lc.statut = 'actif'
       -- LE MODULE D'ABORD. Un centre qui n'a pas souscrit l'avionnage ne doit
       -- jamais apparaître, ni en bloc, ni en pastille.
       and centre_module_actif(lc.centre_id, 'avionnage')
  ),
  presence as (
    select dp.dz_id from dz_presences dp
     where dp.user_id = p_user_id and dp.date_presence = current_date
  ),
  rotations_jour as (
    select r.centre_id,
           count(*)::int as total,
           count(*) filter (where r.heure_decollage is null and r.statut <> 'annulee')::int as a_venir
      from rotations r
      join mes_dz d on d.centre_id = r.centre_id
     where r.date_jour = current_date and r.statut <> 'annulee'
     group by r.centre_id
  ),
  file_jour as (
    select f.centre_id,
           count(*)::int as total_attente,
           max(case when f.parachutiste_id = p_user_id then f.rang end) as ma_position,
           bool_or(f.parachutiste_id = p_user_id and f.statut = 'placee') as place
      from (
        select f2.*, row_number() over (partition by f2.centre_id order by f2.demande_le)::int as rang
          from file_avionnage f2
         where f2.date_jour = current_date and f2.statut in ('attente','placee')
      ) f
      join mes_dz d on d.centre_id = f.centre_id
     group by f.centre_id
  )
  select d.centre_id, d.nom, d.actif,
         exists (select 1 from presence pr where pr.dz_id = d.centre_id),
         coalesce(r.total, 0), coalesce(r.a_venir, 0),
         f.ma_position, coalesce(f.total_attente, 0), coalesce(f.place, false)
    from mes_dz d
    left join rotations_jour r on r.centre_id = d.centre_id
    left join file_jour f on f.centre_id = d.centre_id
   order by
     -- L'ORDRE EST LA RÈGLE DE CHOIX.
     (f.ma_position is not null) desc,
     exists (select 1 from presence pr where pr.dz_id = d.centre_id) desc,
     coalesce(r.a_venir, 0) desc,
     coalesce(r.total, 0) desc,
     d.actif desc,
     d.nom;
$$;

comment on function mon_avionnage_du_jour(uuid) is
  'Les DZ du parachutiste QUI ONT SOUSCRIT l''avionnage, triées : là où il est '
  'en file, puis là où il est présent, puis là où un avion vole. Le tableau de '
  'bord n''affiche que la première.';

grant execute on function mon_avionnage_du_jour(uuid) to authenticated;
