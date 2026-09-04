-- ════════════════════════════════════════════════════════════════════════════
-- AVIONNAGE — les fonctions. Toute écriture dans la file passe par ici.
--
-- Pourquoi des RPC plutôt qu'une policy INSERT : les règles d'entrée en file
-- ne s'expriment pas en RLS. « Le module est-il ouvert ? », « la personne
-- est-elle licenciée active ICI ? », « est-elle déjà en file ? » — trois
-- questions dont une policy ne peut pas rendre le motif du refus. Un
-- parachutiste à qui l'on répond « violation de politique » ne sait pas quoi
-- faire ; ces fonctions lui disent quoi faire.
--
-- PRINCIPE DU PROJET, respecté ici : l'application n'interdit jamais un saut.
-- L'aptitude (licence, médical, briefing) est AFFICHÉE à la DZ au moment de
-- placer quelqu'un, elle n'empêche pas de se mettre en file. C'est le chef
-- d'avionnage qui décide, pas la base.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Rejoindre la file ───────────────────────────────────────────────────────
create or replace function rejoindre_file_avionnage(
  p_centre_id uuid,
  p_type_saut text default 'solo',
  p_commentaire text default null
) returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_position int;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour rejoindre la file.' using errcode = '42501';
  end if;

  if not exists (select 1 from centres c
                 where c.id = p_centre_id and c.avionnage_actif) then
    raise exception 'L''avionnage n''est pas ouvert sur ce centre aujourd''hui.'
      using errcode = '42501',
            hint = 'Le centre ouvre la file depuis l''onglet Rotations.';
  end if;

  if not exists (select 1 from licencies_centres lc
                 where lc.parachutiste_id = v_uid and lc.centre_id = p_centre_id
                   and lc.statut = 'actif') then
    raise exception 'Vous n''êtes pas licencié actif de ce centre.' using errcode = '42501';
  end if;

  -- Déjà en file : on ne crée pas de doublon, on renvoie la demande existante.
  -- L'index unique partiel le garantirait, mais un message clair vaut mieux
  -- qu'une violation de contrainte remontée jusqu'à l'écran.
  select id into v_id from file_avionnage
  where centre_id = p_centre_id and date_jour = current_date
    and parachutiste_id = v_uid and statut = 'attente';

  if v_id is null then
    insert into file_avionnage (centre_id, parachutiste_id, type_saut, commentaire)
    values (p_centre_id, v_uid, coalesce(p_type_saut, 'solo'), nullif(trim(p_commentaire), ''))
    returning id into v_id;
  end if;

  -- La position se compte à l'ordre d'arrivée, sur les seules demandes actives.
  select count(*) into v_position
  from file_avionnage f
  where f.centre_id = p_centre_id and f.date_jour = current_date
    and f.statut = 'attente'
    and f.demande_le <= (select demande_le from file_avionnage where id = v_id);

  return jsonb_build_object('id', v_id, 'position', v_position);
end $$;

comment on function rejoindre_file_avionnage(uuid, text, text) is
  'Met le licencié appelant en file d''avionnage du jour. Idempotente : réappelée, elle renvoie la demande existante au lieu d''en créer une seconde.';

-- ── Quitter la file ─────────────────────────────────────────────────────────
create or replace function quitter_file_avionnage(p_centre_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_n int;
begin
  -- On marque « retirée » plutôt que de supprimer : la DZ doit pouvoir
  -- constater qu'une personne s'est décommandée, pas voir une ligne
  -- disparaître sans trace un jour de forte affluence.
  update file_avionnage
     set statut = 'retiree', retiree_le = now()
   where centre_id = p_centre_id and date_jour = current_date
     and parachutiste_id = auth.uid() and statut = 'attente';
  get diagnostics v_n = row_count;
  return jsonb_build_object('retirees', v_n);
end $$;

-- ── La file, vue par la DZ : avec l'aptitude, sans la recalculer ────────────
create or replace function get_file_avionnage(
  p_centre_id uuid, p_date date default current_date
) returns table (
  id uuid, parachutiste_id uuid, prenom text, nom text,
  type_saut text, commentaire text, groupe_id uuid,
  demande_le timestamptz, position_file int,
  statut_aptitude text, motifs_bloquants int,
  present boolean
)
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not exists (select 1 from admin_centres a
                 where a.profile_id = auth.uid() and a.centre_id = p_centre_id) then
    raise exception 'Réservé au centre concerné' using errcode = '42501';
  end if;

  return query
  with apt as (
    -- Source unique de l'aptitude : la même fonction que « Sur le terrain ».
    -- Un second calcul ici finirait par contredire le tableau, et le chef
    -- d'avionnage lirait deux vérités différentes sur la même personne.
    select a.parachutiste_id as uid, a.statut,
           (select count(*) from jsonb_array_elements(a.motifs) m
             where m->>'severite' = 'blocage'
               and coalesce((m->>'levee')::boolean, false) = false)::int as bloquants
    from get_aptitude_du_jour(p_centre_id, p_date) a
  )
  select f.id, f.parachutiste_id, p.prenom, p.nom,
         f.type_saut, f.commentaire, f.groupe_id, f.demande_le,
         row_number() over (order by f.demande_le)::int,
         coalesce(apt.statut, 'inconnu'),
         coalesce(apt.bloquants, 0),
         exists (select 1 from dz_presences dp
                  where dp.dz_id = p_centre_id and dp.user_id = f.parachutiste_id
                    and dp.date_presence = p_date)
  from file_avionnage f
  join profiles p on p.id = f.parachutiste_id
  left join apt on apt.uid = f.parachutiste_id
  where f.centre_id = p_centre_id and f.date_jour = p_date and f.statut = 'attente'
  order by f.demande_le;
end $$;

comment on function get_file_avionnage(uuid, date) is
  'File du jour pour la DZ, enrichie de l''aptitude issue de get_aptitude_du_jour — pas d''un second calcul. « inconnu » quand l''aptitude est indisponible : un document absent n''est pas un document conforme.';

-- ── Placer quelqu'un de la file dans une rotation ───────────────────────────
create or replace function placer_depuis_file(p_file_id uuid, p_rotation_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_f file_avionnage;
  v_centre uuid;
  v_place uuid;
begin
  select * into v_f from file_avionnage where id = p_file_id for update;
  if v_f.id is null then
    raise exception 'Demande introuvable — elle a peut-être été retirée.' using errcode = 'P0002';
  end if;
  if v_f.statut <> 'attente' then
    raise exception 'Cette demande n''est plus en attente (statut : %).', v_f.statut
      using errcode = '23514';
  end if;

  select centre_id into v_centre from rotations where id = p_rotation_id;
  if not exists (select 1 from admin_centres a
                 where a.profile_id = auth.uid() and a.centre_id = v_centre) then
    raise exception 'Réservé au centre concerné' using errcode = '42501';
  end if;
  -- Une file de centre A ne se déverse pas dans une rotation de centre B.
  if v_centre is distinct from v_f.centre_id then
    raise exception 'Cette rotation n''appartient pas au même centre que la demande.'
      using errcode = '23514';
  end if;

  -- Le plafond de capacité et l'unicité sont portés par la BASE (migration
  -- 117) : si ça ne passe pas, l'exception remonte telle quelle, avec son
  -- message et son hint. On ne la rattrape pas pour la reformuler moins bien.
  -- Les types de la file sont un SOUS-ENSEMBLE de ceux de places_rotation
  -- (celle-ci accepte en plus 'tandem', qui ne passe jamais par la file :
  -- un passager tandem est réservé, il ne se met pas en file lui-même).
  -- Aucune conversion n'est donc nécessaire.
  insert into places_rotation (rotation_id, parachutiste_id, type_saut)
  values (p_rotation_id, v_f.parachutiste_id, v_f.type_saut)
  returning id into v_place;

  update file_avionnage
     set statut = 'placee', placee_le = now(), place_rotation_id = v_place
   where id = p_file_id;

  return jsonb_build_object('place_id', v_place);
end $$;

-- ── Remettre en file (la DZ retire quelqu'un d'une rotation) ────────────────
create or replace function retirer_de_rotation(p_place_id uuid, p_remettre_en_file boolean default true)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_centre uuid; v_para uuid; v_type text; v_remise boolean := false;
begin
  select r.centre_id, pr.parachutiste_id, pr.type_saut
    into v_centre, v_para, v_type
  from places_rotation pr join rotations r on r.id = pr.rotation_id
  where pr.id = p_place_id;

  if v_centre is null then
    raise exception 'Place introuvable' using errcode = 'P0002';
  end if;
  if not exists (select 1 from admin_centres a
                 where a.profile_id = auth.uid() and a.centre_id = v_centre) then
    raise exception 'Réservé au centre concerné' using errcode = '42501';
  end if;

  -- La demande d'origine redevient active plutôt que d'en créer une nouvelle :
  -- la personne retrouve SA place dans l'ordre d'arrivée, elle ne repart pas
  -- en queue de file parce que la DZ a changé d'avis.
  if p_remettre_en_file and v_para is not null then
    update file_avionnage
       set statut = 'attente', placee_le = null, place_rotation_id = null
     where place_rotation_id = p_place_id and statut = 'placee';
    get diagnostics v_remise = row_count;
  end if;

  delete from places_rotation where id = p_place_id;
  return jsonb_build_object('remise_en_file', v_remise);
end $$;

comment on function retirer_de_rotation(uuid, boolean) is
  'Retire une place et rend à la personne SA position d''origine dans la file : elle ne repart pas en queue parce que la DZ a réorganisé.';

commit;
