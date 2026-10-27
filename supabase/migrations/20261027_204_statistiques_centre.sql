-- ═══════════════════════════════════════════════════════════════════════════
-- STATISTIQUES DU CENTRE — un seul calcul, côté base.
--
-- L'onglet Statistiques comptait côté navigateur :
--   • les sauts de ses MEMBRES, où qu'ils aient sauté — un licencié de BigAir
--     en stage à Royan gonflait les chiffres de BigAir ;
--   • le top 5 en rapatriant chaque ligne de saut, coupée par l'API à 1 000
--     lignes : au-delà, le classement était faux sans rien dire.
--
-- Ici, un saut compte pour le centre où il a eu lieu (sauts.centre_id), et
-- tout est agrégé en base. Sont comptés les sauts VALIDÉS et HISTORIQUES (le
-- carnet importé) ; les sauts EN ATTENTE sont rendus à part : ils ont eu lieu,
-- mais personne ne les a encore signés.
--
-- Lecture seule, réservée aux administrateurs du centre.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.statistiques_centre(p_centre_id uuid, p_debut date, p_fin date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_duree int := greatest(1, p_fin - p_debut + 1);
  v_prec_debut date := p_debut - v_duree;
  v_prec_fin date := p_debut - 1;
  v_pas text := case when v_duree <= 62 then 'week' else 'month' end;
  v_res jsonb;
begin
  if not exists (select 1 from admin_centres ac
                 where ac.profile_id = auth.uid() and ac.centre_id = p_centre_id) then
    raise exception 'Réservé aux administrateurs de ce centre.' using errcode = '42501';
  end if;
  if p_fin < p_debut then
    raise exception 'Période invalide.' using errcode = '22023';
  end if;

  with s as (
    select sa.parachutiste_id, sa.date_saut, sa.nature_saut, sa.statut
    from sauts sa
    where sa.centre_id = p_centre_id
      and sa.date_saut between v_prec_debut and p_fin
      and coalesce(sa.is_tunnel, false) = false
  ),
  faits as (select * from s where statut in ('valide', 'historique')),
  cur as (select * from faits where date_saut between p_debut and p_fin),
  prec as (select * from faits where date_saut between v_prec_debut and v_prec_fin),
  -- Remplissage des avions clôturés : sièges occupés (le moniteur accompagnant
  -- sans place propre compte, comme siegesOccupes côté application) sur la
  -- capacité de l'appareil.
  rot as (
    select r.id, a.places as capacite,
           (select count(*) from places_rotation p where p.rotation_id = r.id)
           + (select count(distinct p.moniteur_id) from places_rotation p
               where p.rotation_id = r.id and p.moniteur_id is not null
                 and p.moniteur_id not in (select p2.parachutiste_id from places_rotation p2
                                            where p2.rotation_id = r.id and p2.parachutiste_id is not null)) as occupes
    from rotations r left join aeronefs a on a.id = r.aeronef_id
    where r.centre_id = p_centre_id and r.date_jour between p_debut and p_fin
      and (r.cloturee_le is not null or r.statut = 'terminee')
  ),
  buckets as (
    select g::date as debut
    from generate_series(date_trunc(v_pas, p_debut::timestamp), p_fin::timestamp, ('1 ' || v_pas)::interval) g
  )
  select jsonb_build_object(
    'periode', jsonb_build_object('debut', p_debut, 'fin', p_fin, 'pas', v_pas),
    'sauts', (select count(*) from cur),
    'sauts_prec', (select count(*) from prec),
    'actifs', (select count(distinct parachutiste_id) from cur),
    'actifs_prec', (select count(distinct parachutiste_id) from prec),
    'tandems', (select count(*) from cur where nature_saut = 'tandem'),
    'en_attente', (select count(*) from s where statut = 'en_attente' and date_saut between p_debut and p_fin),
    'licencies', (select count(*) from licencies_centres lc where lc.centre_id = p_centre_id and lc.statut = 'actif'),
    'rotations', (select count(*) from rot),
    'remplissage', (select case when sum(capacite) filter (where capacite > 0) > 0
                               then round(100.0 * sum(occupes) filter (where capacite > 0)
                                          / sum(capacite) filter (where capacite > 0))
                          end from rot),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
                  'debut', b.debut,
                  'sauts', (select count(*) from cur c where date_trunc(v_pas, c.date_saut::timestamp)::date = b.debut),
                  'tandems', (select count(*) from cur c where c.nature_saut = 'tandem'
                                and date_trunc(v_pas, c.date_saut::timestamp)::date = b.debut))
                order by b.debut), '[]'::jsonb) from buckets b),
    'par_nature', (select coalesce(jsonb_agg(jsonb_build_object('nature', nature, 'n', n) order by n desc), '[]'::jsonb)
                   from (select coalesce(nature_saut, 'non renseigné') nature, count(*) n from cur group by 1) x),
    'par_jour', (select coalesce(jsonb_agg(jsonb_build_object('jour', j, 'n', n) order by j), '[]'::jsonb)
                 from (select extract(isodow from date_saut)::int j, count(*) n from cur group by 1) x),
    'par_brevet', (select coalesce(jsonb_agg(jsonb_build_object('brevet', brevet, 'n', n) order by brevet), '[]'::jsonb)
                   from (select coalesce(p.type_brevet_principal, 'sans brevet') brevet, count(*) n
                         from licencies_centres lc join profiles p on p.id = lc.parachutiste_id
                         where lc.centre_id = p_centre_id and lc.statut = 'actif' group by 1) x),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'prenom', p.prenom, 'nom', p.nom,
                                                        'photo', p.photo_profil_url, 'n', t.n) order by t.n desc, p.nom), '[]'::jsonb)
            from (select parachutiste_id id, count(*) n from cur group by 1 order by 2 desc limit 10) t
            join profiles p on p.id = t.id)
  ) into v_res;

  return v_res;
end $$;

revoke all on function public.statistiques_centre(uuid, date, date) from public, anon;
grant execute on function public.statistiques_centre(uuid, date, date) to authenticated;
