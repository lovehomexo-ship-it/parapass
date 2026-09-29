-- QUI EST SUR LE TERRAIN AUJOURD'HUI ? Aucun écran ne répondait à cette
-- question. La donnée existait — `dz_presences`, alimentée par le check-in que
-- le parachutiste fait lui-même — mais elle n'était lue que de biais : par
-- l'encadrement pour compter des têtes, par l'avionnage pour composer des
-- rotations. Nulle part une liste nominative, datée, qu'un DT puisse ouvrir.
--
-- Une seule définition, ici. Et elle prend une DATE : « qui était là samedi
-- dernier » est une question aussi légitime que « qui est là maintenant » —
-- pour un compte rendu, une déclaration, ou après un incident.
create or replace function presents_du_jour(p_centre_id uuid, p_date date default current_date)
returns table (
  user_id uuid, prenom text, nom text, photo_profil_url text, brevet text,
  heure_debut time, heure_fin time, statut text,
  materiel_type text, voile text, surface_ft2 numeric,
  checked_in_at timestamptz, position_file int, embarque boolean,
  sauts_du_jour int, demo boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with autorise as (
    select (is_dz_admin(p_centre_id) or is_moniteur_dz(p_centre_id)) as ok
  ),
  file as (
    select f.parachutiste_id, f.statut,
           row_number() over (order by f.demande_le)::int as rang
      from file_avionnage f
     where f.centre_id = p_centre_id and f.date_jour = p_date
       and f.statut in ('attente','placee')
  )
  select dp.user_id, p.prenom, p.nom, p.photo_profil_url,
         (select b.type_brevet from brevets b
           where b.parachutiste_id = dp.user_id
           order by case b.type_brevet
                      when 'D' then 5 when 'C' then 4 when 'BPA' then 3
                      when 'B' then 2 when 'A' then 1 else 0 end desc
           limit 1),
         dp.heure_debut, dp.heure_fin, dp.statut, dp.materiel_type,
         coalesce(m.modele, dp.voile_perso_libre, dp.voile_location_ref, s.nom_court),
         coalesce(m.taille_voile_ft2::numeric, s.taille_voile_ft2::numeric),
         dp.checked_in_at,
         f.rang,
         coalesce(f.statut = 'placee', false),
         (select count(*)::int from sauts sa
           where sa.parachutiste_id = dp.user_id and sa.centre_id = p_centre_id
             and sa.date_saut = p_date),
         dp.demo
    from dz_presences dp
    join profiles p on p.id = dp.user_id
    left join materiels m on m.id = dp.voile_perso_ref
    left join sacs_parachute s on s.id = dp.sac_ref
    left join file f on f.parachutiste_id = dp.user_id
   where dp.dz_id = p_centre_id
     and dp.date_presence = p_date
     and (select ok from autorise)
   order by dp.statut, p.nom, p.prenom;
$$;

comment on function presents_du_jour(uuid, date) is
  'Qui est déclaré présent sur cette DZ à cette date : identité, brevet, '
  'matériel déclaré, position en file, sauts du jour. Réservé au staff.';

grant execute on function presents_du_jour(uuid, date) to authenticated;

-- Les présences de démonstration étaient toutes identiques : 09:00 → 18:00,
-- tout le monde présent, personne reparti. Une liste où vingt lignes portent la
-- même heure ne ressemble pas à une journée de DZ, et ne permet pas de vérifier
-- que l'écran trie et distingue quoi que ce soit.
create or replace function demo_declarer_voiles(p_centre_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  with gens as (
    select m.parachutiste_id, m.id as voile_id,
           row_number() over (order by p.nom, p.prenom) as rang
      from materiels m
      join profiles p on p.id = m.parachutiste_id
      join licencies_centres lc on lc.parachutiste_id = p.id and lc.centre_id = p_centre_id
     where m.type = 'parachute_principal' and m.statut = 'actif'
       and m.taille_voile_ft2 is not null and not p.donnees_reelles and lc.statut = 'actif'
  )
  insert into dz_presences (dz_id, user_id, date_presence, heure_debut, heure_fin,
                            materiel_type, voile_perso_ref, statut, demo, checked_in_at)
  select p_centre_id, g.parachutiste_id, current_date,
         -- Arrivées échelonnées, plafonnées à 11:30 : une DZ ne se remplit pas
         -- d'un coup. Déterministe, pour qu'une capture reste comparable.
         least(time '11:30', time '08:00' + (g.rang * interval '10 minutes')),
         time '18:00',
         'perso', g.voile_id,
         -- Un sur sept est reparti : la liste doit distinguer les deux états.
         case when g.rang % 7 = 0 then 'parti' else 'present' end,
         true,
         (current_date + least(time '11:30', time '08:00' + (g.rang * interval '10 minutes')))::timestamptz
  from gens g
  on conflict (dz_id, user_id, date_presence) do update
    set materiel_type = 'perso',
        voile_perso_ref = excluded.voile_perso_ref,
        heure_debut = excluded.heure_debut,
        statut = excluded.statut,
        demo = true,
        voile_perso_libre = null,
        voile_location_ref = null;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
