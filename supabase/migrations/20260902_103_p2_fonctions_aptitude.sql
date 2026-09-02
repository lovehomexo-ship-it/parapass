-- ═══════════════════════════════════════════════════════════════════════════
-- P2 — Fonctions de l'aptitude du jour.
--
-- get_aptitude_du_jour : une ligne par PRÉSENT, statut consolidé vert/orange/
--   rouge, motifs en clair, date du dernier saut et jours d'inactivité.
--   Fonction plutôt que vue : elle prend le centre et la date en paramètres, et
--   sa garde d'accès empêche un centre de lire les données d'un autre.
--   left join lateral (et non cross join) : un présent SANS motif — le cas
--   normal, statut vert — doit apparaître dans le résultat.
--
-- statut_echeance_a_date : statut_echeance() compare en dur à current_date, ce
--   qui fausserait la consultation d'une journée passée (et la clôture en P4).
--   Même règle, simplement évaluée au bon jour. La fonction partagée n'est PAS
--   modifiée : get_regulatory_snapshot et get_conformite_licencies en dépendent.
--
-- poser_derogation : la décision du DT, nommée, datée, signée. Motif obligatoire,
--   valable la journée seulement, nom du signataire FIGÉ à l'écriture.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.statut_echeance_a_date(
  p_exp date, p_date date, p_seuil integer default 30
) returns text language sql immutable as $$
  select case
    when p_exp is null then 'inconnu'
    when (p_exp - p_date) < 0 then 'expire'
    when (p_exp - p_date) <= p_seuil then 'bientot'
    else 'ok'
  end;
$$;

create or replace function public.get_aptitude_du_jour(
  p_centre_id uuid, p_date date default current_date
) returns table (
  parachutiste_id uuid, nom text, prenom text, photo_profil_url text,
  statut text, motifs jsonb, dernier_saut date, jours_inactivite integer,
  nb_blocages integer, nb_vigilances integer
) language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_seuil int := coalesce((select value_int from compliance_rules where rule_key='alerte_j30'),30);
begin
  if not exists (select 1 from admin_centres a where a.profile_id=auth.uid() and a.centre_id=p_centre_id) then
    raise exception 'Accès refusé à l''aptitude du jour de ce centre' using errcode='42501';
  end if;
  return query
  with regles as (
    select r.code,r.libelle,r.categorie,r.severite,r.parametres from regles_aptitude r
    where r.centre_id=p_centre_id and r.actif
      and coalesce((r.parametres->>'inerte')::boolean,false)=false),
  presents as (select distinct pr.user_id as uid from dz_presences pr
    where pr.dz_id=p_centre_id and pr.date_presence=p_date),
  base as (select pe.uid,p.nom,p.prenom,p.photo_profil_url,
      (select max(l.date_expiration)::date from licences l where l.parachutiste_id=pe.uid and l.statut='actif') as licence_exp,
      (select max(c.date_expiration)::date from certificats_medicaux c where c.parachutiste_id=pe.uid) as medical_exp,
      (select max(s.date_saut)::date from sauts s where s.parachutiste_id=pe.uid and s.is_tunnel=false) as dernier_saut
    from presents pe join profiles p on p.id=pe.uid),
  briefing as (select b.id from dz_briefings b where b.dz_id=p_centre_id and b.date_briefing=p_date
    and b.published_at is not null order by b.published_at desc limit 1),
  derog as (select d.parachutiste_id as uid,d.regle_code from derogations d
    where d.centre_id=p_centre_id and d.date_validite=p_date),
  evalue as (
    select b.uid,b.nom,b.prenom,b.photo_profil_url,b.dernier_saut,
      case when b.dernier_saut is null then null else (p_date-b.dernier_saut)::int end as jours_inact,
      m.code,m.libelle,m.categorie,m.severite,m.detail,
      coalesce(exists (select 1 from derog dg where dg.uid=b.uid and dg.regle_code=m.code),false) as levee
    from base b
    left join lateral (
      select r.code,r.libelle,r.categorie,r.severite,
             case when b.licence_exp is null then 'aucune licence enregistrée'
                  else 'expirée le '||to_char(b.licence_exp,'DD/MM/YYYY') end as detail
      from regles r where r.code='licence_ffp'
        and statut_echeance_a_date(b.licence_exp,p_date,v_seuil) in ('expire','inconnu')
      union all
      select r.code,r.libelle,r.categorie,r.severite,
             case when b.medical_exp is null then 'aucun certificat enregistré'
                  else 'expiré le '||to_char(b.medical_exp,'DD/MM/YYYY') end
      from regles r where r.code='certificat_medical'
        and statut_echeance_a_date(b.medical_exp,p_date,v_seuil) in ('expire','inconnu')
      union all
      select r.code,r.libelle,r.categorie,r.severite,'briefing du jour non acquitté'
      from regles r where r.code='briefing_jour' and exists (select 1 from briefing)
        and not exists (select 1 from briefing_acknowledgements ba
                        where ba.briefing_id=(select id from briefing) and ba.user_id=b.uid)
      union all
      select r.code,r.libelle,r.categorie,
        case when b.dernier_saut is null then 'vigilance'
             when (p_date-b.dernier_saut)>=(r.parametres->>'reprise_jours')::int then 'blocage'
             else 'vigilance' end,
        case when b.dernier_saut is null then 'aucun saut enregistré'
             when (p_date-b.dernier_saut)>=(r.parametres->>'reprise_jours')::int
               then 'inactivité '||(p_date-b.dernier_saut)||' jours — reprise complète'
             when (p_date-b.dernier_saut)>=(r.parametres->>'moniteur_jours')::int
               then 'inactivité '||(p_date-b.dernier_saut)||' jours — reprise avec moniteur'
             else 'inactivité '||(p_date-b.dernier_saut)||' jours — saut d''accompagnement conseillé' end
      from regles r where r.code='inactivite'
        and (b.dernier_saut is null or (p_date-b.dernier_saut)>=(r.parametres->>'conseil_jours')::int)
    ) m on true)
  select e.uid,e.nom,e.prenom,e.photo_profil_url,
    case when count(*) filter (where e.severite='blocage' and not e.levee)>0 then 'rouge'
         when count(*) filter (where e.severite='vigilance' and not e.levee)>0 then 'orange'
         else 'vert' end,
    coalesce(jsonb_agg(jsonb_build_object('code',e.code,'libelle',e.libelle,'severite',e.severite,
      'categorie',e.categorie,'detail',e.detail,'levee',e.levee)
      order by (e.severite='blocage') desc,e.code) filter (where e.code is not null),'[]'::jsonb),
    e.dernier_saut,e.jours_inact,
    count(*) filter (where e.severite='blocage' and not e.levee)::int,
    count(*) filter (where e.severite='vigilance' and not e.levee)::int
  from evalue e
  group by e.uid,e.nom,e.prenom,e.photo_profil_url,e.dernier_saut,e.jours_inact
  order by (count(*) filter (where e.severite='blocage' and not e.levee)) desc,
           (count(*) filter (where e.severite='vigilance' and not e.levee)) desc, e.nom;
end $$;

create or replace function public.poser_derogation(
  p_centre_id uuid, p_parachutiste_id uuid, p_regle_code text, p_motif text
) returns public.derogations
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.derogations; v_nom text;
begin
  if not exists (select 1 from admin_centres a where a.profile_id=auth.uid() and a.centre_id=p_centre_id) then
    raise exception 'Seul un responsable du centre peut lever une règle' using errcode='42501';
  end if;
  if coalesce(trim(p_motif),'') = '' then
    raise exception 'Un motif est obligatoire pour lever une règle' using errcode='22023';
  end if;
  select coalesce(prenom||' ','')||nom into v_nom from profiles where id = auth.uid();
  insert into public.derogations
    (centre_id, parachutiste_id, regle_code, date_validite, motif, signataire_id, signataire_nom)
  values (p_centre_id, p_parachutiste_id, p_regle_code, current_date, trim(p_motif), auth.uid(), coalesce(v_nom,'—'))
  returning * into v_row;
  return v_row;
end $$;

revoke all on function public.get_aptitude_du_jour(uuid,date) from public, anon;
revoke all on function public.poser_derogation(uuid,uuid,text,text) from public, anon;
grant execute on function public.get_aptitude_du_jour(uuid,date) to authenticated;
grant execute on function public.poser_derogation(uuid,uuid,text,text) to authenticated;
