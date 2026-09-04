-- ════════════════════════════════════════════════════════════════════════════
-- AVIONNAGE — la file du jour, et les deux garde-fous qui manquaient.
--
-- CONSTAT MESURÉ AVANT ÉCRITURE (03/09/2026)
--   0 rotation, 0 place, 1 aéronef pour trois centres : le module n'a jamais
--   servi. Et il ne pouvait pas servir en l'état :
--
--   a) AUCUNE contrainte d'unicité (rotation_id, parachutiste_id)
--      → la même personne pouvait être embarquée deux fois sur le même largage.
--        Sur un manifest, c'est une personne qu'on croit à bord et qui ne l'est
--        pas, ou l'inverse.
--   b) aeronefs.places existe, RIEN ne le vérifie
--      → on pouvait charger 20 personnes dans un Cessna 4 places. Un manifest
--        faux n'est pas un défaut d'ergonomie.
--   c) AUCUNE policy INSERT pour un parachutiste sur places_rotation
--      → l'inscription autonome était littéralement impossible : la RLS la
--        refusait. C'est la moitié manquante du module.
--   d) places_rotation.statut ∈ inscrit/embarqué/largué/posé/sorti
--      → aucun état « en attente ». La file n'existait pas.
--
-- CHOIX D'ARCHITECTURE
--   La file est une TABLE À PART, pas un statut de places_rotation. Une place
--   appartient à une rotation ; or on se met en file AVANT de savoir dans quel
--   avion on partira. Les confondre obligerait à créer des places fantômes
--   rattachées à une rotation arbitraire, et une rotation annulée disperserait
--   toute la file. Ici, la file survit à l'annulation d'un largage.
--
--   Suit la leçon licencies_centres/centres_licencies : on n'invente pas un
--   jumeau. file_avionnage ne duplique aucune colonne de places_rotation ; elle
--   pointe vers la place le jour où elle en obtient une.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Le module s'ouvre et se ferme par la DZ ─────────────────────────────
-- Tant que c'est faux, aucun parachutiste ne voit la file ni ne peut s'y
-- inscrire. Par défaut FAUX : un centre n'hérite pas d'une fonctionnalité
-- qu'il n'a pas demandée, et surtout pas d'une file que personne ne surveille.
alter table centres
  add column if not exists avionnage_actif boolean not null default false;

comment on column centres.avionnage_actif is
  'Ouvre la file d''avionnage aux licenciés du centre. Faux par défaut : une file que personne ne relève est pire que pas de file.';

-- ── 2 · Une personne, une place, une fois ───────────────────────────────────
-- Les places tandem n'ont pas de parachutiste_id (elles portent un
-- tandem_booking_id) : l'index partiel les laisse tranquilles.
create unique index if not exists places_rotation_une_fois_par_rotation
  on places_rotation (rotation_id, parachutiste_id)
  where parachutiste_id is not null;

-- ── 3 · La capacité de l'aéronef est une limite, pas une indication ─────────
-- Un moniteur qui accompagne occupe un siège : il compte. Une rotation sans
-- aéronef n'a pas de capacité connue — on ne bloque pas, on ne peut pas
-- inventer un plafond.
create or replace function places_rotation_capacite()
returns trigger language plpgsql as $$
declare
  v_places int;
  v_occupes int;
  v_immat text;
begin
  select a.places, a.immatriculation into v_places, v_immat
  from rotations r join aeronefs a on a.id = r.aeronef_id
  where r.id = new.rotation_id;

  if v_places is null then return new; end if;  -- pas d'aéronef : rien à plafonner

  select count(*) + count(*) filter (where moniteur_id is not null)
    into v_occupes
  from places_rotation
  where rotation_id = new.rotation_id and id is distinct from new.id;

  -- La place en cours compte pour 1, plus 1 si elle embarque un moniteur.
  v_occupes := v_occupes + 1 + (case when new.moniteur_id is not null then 1 else 0 end);

  if v_occupes > v_places then
    raise exception
      'Rotation complète : % places dans le %, cette inscription ferait %.',
      v_places, coalesce(v_immat, 'l''aéronef'), v_occupes
      using errcode = '23514',
            hint = 'Créez la rotation suivante, ou laissez la personne en file d''avionnage.';
  end if;
  return new;
end $$;

drop trigger if exists trg_places_rotation_capacite on places_rotation;
create trigger trg_places_rotation_capacite
  before insert or update of moniteur_id, rotation_id on places_rotation
  for each row execute function places_rotation_capacite();

-- ── 4 · La file du jour ─────────────────────────────────────────────────────
create table if not exists file_avionnage (
  id                uuid primary key default gen_random_uuid(),
  centre_id         uuid not null references centres(id) on delete cascade,
  date_jour         date not null default current_date,
  parachutiste_id   uuid not null references profiles(id) on delete cascade,
  type_saut         text not null default 'solo'
                      check (type_saut in ('ecole','accompagne','solo','groupe','wingsuit','video')),
  -- Sauter avec quelqu'un : le même groupe_id demande à partir ensemble.
  -- La DZ reste libre de séparer — c'est un souhait, pas une contrainte.
  groupe_id         uuid,
  commentaire       text,
  statut            text not null default 'attente'
                      check (statut in ('attente','placee','retiree')),
  -- Renseignée quand la DZ tire la personne de la file vers une rotation.
  place_rotation_id uuid references places_rotation(id) on delete set null,
  demande_le        timestamptz not null default now(),
  placee_le         timestamptz,
  retiree_le        timestamptz
);

comment on table file_avionnage is
  'File d''avionnage du jour. Le parachutiste s''y met ; la DZ répartit dans les rotations. Séparée de places_rotation : on se met en file avant de savoir dans quel avion on part.';

-- Une seule demande ACTIVE par personne et par jour. Les entrées retirées ou
-- déjà placées ne bloquent pas une nouvelle inscription : quelqu'un qui a
-- sauté peut se remettre en file pour la rotation suivante.
create unique index if not exists file_avionnage_une_demande_active
  on file_avionnage (centre_id, date_jour, parachutiste_id)
  where statut = 'attente';

create index if not exists file_avionnage_du_jour
  on file_avionnage (centre_id, date_jour, statut, demande_le);

-- ── 5 · RLS ─────────────────────────────────────────────────────────────────
alter table file_avionnage enable row level security;

-- Le centre voit et gère toute sa file.
drop policy if exists file_avionnage_centre on file_avionnage;
create policy file_avionnage_centre on file_avionnage
  for all
  using (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()))
  with check (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()));

-- Le parachutiste voit TOUTE la file de son centre : savoir combien de monde
-- attend devant soi est l'essentiel de l'information. Il ne voit que la file,
-- pas les motifs d'aptitude des autres.
drop policy if exists file_avionnage_lecture_licencie on file_avionnage;
create policy file_avionnage_lecture_licencie on file_avionnage
  for select
  using (centre_id in (
    select centre_id from licencies_centres
    where parachutiste_id = auth.uid() and statut = 'actif'));

-- L'écriture passe par les RPC ci-dessous, jamais en direct : c'est là que
-- vivent les vérifications (module ouvert, licencié actif, pas de doublon).

-- Et il manquait à un parachutiste le droit de LIRE sa propre place — la
-- policy places_lecture_interesse existait déjà ; on ajoute la lecture des
-- aéronefs, sans quoi le sauteur ne peut pas savoir dans quel avion il part.
drop policy if exists aeronefs_lecture_licencie on aeronefs;
create policy aeronefs_lecture_licencie on aeronefs
  for select
  using (centre_id in (
    select centre_id from licencies_centres
    where parachutiste_id = auth.uid() and statut = 'actif'));

commit;

-- ── APPLIQUÉE LE 04/09/2026, vérifiée après coup ────────────────────────────
--   file_avionnage : 12 colonnes, RLS active, 2 policies
--   places_rotation_une_fois_par_rotation : en place
--   trg_places_rotation_capacite : en place
--   centres.avionnage_actif : défaut false
