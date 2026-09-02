-- ═══════════════════════════════════════════════════════════════════════════
-- FUSION des tables jumelles d'affiliation licencié <-> centre.
--
-- Constat (docs/cartographie-centre.md, P0) : deux tables décrivaient la même
-- relation.
--   * licencies_centres  (66 lignes, 38 références) — lue par la DZ, porte les
--     colonnes carnet_*, moniteur_assigne_id, notes.
--   * centres_licencies  (2 lignes, 3 références)   — écrite par le Passeport.
-- Le Passeport écrivait donc dans une table que la DZ ne lisait JAMAIS : une
-- adhésion déclarée par un licencié n'apparaissait jamais chez son centre, et
-- un retrait le laissait visible côté DZ.
--
-- licencies_centres devient l'unique source. Migration idempotente.
-- L'ancienne table est CONSERVÉE : elle ne sera retirée qu'une fois le
-- déploiement vérifié en production (le code déployé la référence encore
-- jusqu'au déploiement de ce commit).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.licencies_centres
  add column if not exists numero_adhesion text;

update public.licencies_centres lc
set numero_adhesion = cl.numero_adhesion
from public.centres_licencies cl
where lc.parachutiste_id = cl.parachutiste_id
  and lc.centre_id = cl.centre_id
  and cl.numero_adhesion is not null
  and lc.numero_adhesion is null;

insert into public.licencies_centres
  (parachutiste_id, centre_id, statut, date_adhesion, numero_adhesion)
select cl.parachutiste_id, cl.centre_id,
       case when cl.statut in ('en_attente','actif','inactif') then cl.statut else 'actif' end,
       cl.date_adhesion, cl.numero_adhesion
from public.centres_licencies cl
on conflict (parachutiste_id, centre_id) do nothing;

-- Écriture par le LICENCIÉ, via une fonction contrôlée.
-- Nécessaire car AUCUNE policy UPDATE n'autorise le parachutiste sur cette
-- table — et il ne doit pas pouvoir toucher carnet_*, notes ni
-- moniteur_assigne_id, qui appartiennent à la DZ.
create or replace function public.upsert_adhesion_licencie(
  p_centre_id uuid,
  p_date_adhesion date default null,
  p_statut text default 'actif',
  p_numero_adhesion text default null
) returns public.licencies_centres
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.licencies_centres;
begin
  if v_uid is null then
    raise exception 'Non authentifié.' using errcode = '28000';
  end if;
  if p_statut not in ('en_attente','actif','inactif') then
    raise exception 'Statut invalide : %', p_statut using errcode = '22023';
  end if;

  insert into public.licencies_centres
    (parachutiste_id, centre_id, statut, date_adhesion, numero_adhesion)
  values (v_uid, p_centre_id, p_statut, p_date_adhesion, p_numero_adhesion)
  on conflict (parachutiste_id, centre_id) do update
    set statut          = excluded.statut,
        date_adhesion   = excluded.date_adhesion,
        numero_adhesion = excluded.numero_adhesion
  returning * into v_row;

  return v_row;
end;
$$;

-- « Quitter le centre » DÉSACTIVE, ne supprime pas : les 66 lignes portent
-- toutes un carnet_statut qu'une suppression détruirait.
create or replace function public.quitter_centre_licencie(p_centre_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Non authentifié.' using errcode = '28000';
  end if;
  update public.licencies_centres
     set statut = 'inactif'
   where parachutiste_id = v_uid and centre_id = p_centre_id;
end;
$$;

revoke all on function public.upsert_adhesion_licencie(uuid, date, text, text) from public, anon;
revoke all on function public.quitter_centre_licencie(uuid) from public, anon;
grant execute on function public.upsert_adhesion_licencie(uuid, date, text, text) to authenticated;
grant execute on function public.quitter_centre_licencie(uuid) to authenticated;
