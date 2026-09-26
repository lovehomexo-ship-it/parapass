-- ═══════════════════════════════════════════════════════════════════════════
-- AVIONNAGE 3/4 — le chef avion, et l'altitude par sauteur.
--
-- CHEF AVION ≠ LARGUEUR. Le largueur dirige le largage ; le chef avion est le
-- responsable du stick à bord. Sur les manifests professionnels, l'absence de
-- chef avion est une erreur de stick au même titre qu'une qualification
-- manquante. Ce sont deux rôles, deux colonnes.
--
-- ALTITUDE PAR SAUTEUR — elle vivait sur la rotation, donc unique pour tout
-- l'avion. Or un tandem ne sort pas à la même hauteur qu'un wingsuit : un
-- seul chiffre pour dix personnes était faux dès qu'un avion mélangeait les
-- disciplines. NULL = « celle de l'avion », pas « zéro ».
-- ═══════════════════════════════════════════════════════════════════════════
begin;

alter table rotations
  add column if not exists chef_avion_id uuid references profiles(id) on delete set null;
alter table places_rotation
  add column if not exists altitude_largage_m integer;

alter table places_rotation
  drop constraint if exists places_rotation_altitude_check;
alter table places_rotation
  add constraint places_rotation_altitude_check
  check (altitude_largage_m is null or altitude_largage_m between 300 and 8000);

comment on column rotations.chef_avion_id is
  'Responsable du stick a bord. DISTINCT du largueur (rotations.largueur_id).';
comment on column places_rotation.altitude_largage_m is
  'Altitude de largage de CE sauteur. NULL = celle de l''avion, jamais zero.';

-- Le chef avion est quelqu'un qui EST DANS L'AVION. Désigner un absent
-- produirait un responsable qui n'y est pas — pire que pas de responsable.
create or replace function rotations_chef_avion_a_bord()
returns trigger language plpgsql as $$
begin
  if new.chef_avion_id is null then return new; end if;
  if not exists (select 1 from places_rotation pr
                 where pr.rotation_id = new.id and pr.parachutiste_id = new.chef_avion_id) then
    raise exception 'Le chef avion doit etre a bord de cet avion.'
      using errcode = '23514', hint = 'Designez-le parmi les personnes de la planche.';
  end if;
  return new;
end $$;

drop trigger if exists trg_rotations_chef_avion_a_bord on rotations;
create trigger trg_rotations_chef_avion_a_bord
  before insert or update of chef_avion_id on rotations
  for each row execute function rotations_chef_avion_a_bord();

commit;
