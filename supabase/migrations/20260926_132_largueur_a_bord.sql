-- ═══════════════════════════════════════════════════════════════════════════
-- LE LARGUEUR EST À BORD — il rejoint la liste des personnes de l'avion.
--
-- CE QUI N'ALLAIT PAS : le largueur se choisissait dans un menu déroulant, à
-- part. Il en résultait un homme invisible — le seul de l'avion dont on ne
-- voyait ni la masse, ni le feu. Or il PÈSE (l'avion se charge par les kilos)
-- et il doit être en règle. Le détacher de la liste, c'était le retirer des
-- deux vérifications qui comptent.
--
-- Il occupe donc une place, comme tout le monde, avec un type qui dit ce
-- qu'il fait : il ne saute pas, il largue.
--
-- Et quand on le retire de l'avion, la désignation tombe avec lui : un
-- largueur désigné mais débarqué serait un mensonge tranquille.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

alter table places_rotation drop constraint if exists places_rotation_type_saut_check;
alter table places_rotation add constraint places_rotation_type_saut_check
  check (type_saut = any (array['ecole','accompagne','solo','groupe','tandem',
                                'wingsuit','video','largueur']));

comment on column places_rotation.type_saut is
  'Ce que fait la personne a bord. « largueur » = membre d''equipage : il occupe une place et pese, il ne saute pas.';

-- Débarquer quelqu'un lui retire ses rôles. AVANT décollage seulement : après,
-- un autre trigger interdit déjà de défaire le largueur, et l'histoire d'un
-- avion parti ne se réécrit pas.
create or replace function places_rotation_liberer_roles()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.parachutiste_id is null then return old; end if;
  update rotations r
     set largueur_id   = case when r.largueur_id   = old.parachutiste_id then null else r.largueur_id end,
         chef_avion_id = case when r.chef_avion_id = old.parachutiste_id then null else r.chef_avion_id end
   where r.id = old.rotation_id
     and r.heure_decollage is null
     and (r.largueur_id = old.parachutiste_id or r.chef_avion_id = old.parachutiste_id);
  return old;
end $$;

drop trigger if exists trg_places_rotation_liberer_roles on places_rotation;
create trigger trg_places_rotation_liberer_roles
  before delete on places_rotation
  for each row execute function places_rotation_liberer_roles();

commit;

-- APPLIQUEE LE 26/09/2026. Cascade prouvee en base : supprimer la place du
-- largueur libere rotations.largueur_id (avion non decolle).
