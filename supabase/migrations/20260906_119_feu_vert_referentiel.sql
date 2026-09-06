-- ════════════════════════════════════════════════════════════════════════════
-- FEU VERT · P2 — Le référentiel de règles comme DONNÉE, versionnée.
--
-- Principe P2 (« ParaPass n'a pas d'avis ») rendu matériel : aucune règle
-- n'existe dans le code TypeScript. Le code lit cette table. Chaque ligne
-- porte le texte fédéral qui la fonde, et c'est ce texte que le système cite
-- quand il refuse.
--
-- ÉTAT DES LIEUX (06/09/2026) qui a conduit à ce schéma :
--   regles_aptitude existe (7 codes × 3 centres, sévérité paramétrable) mais
--   n'a ni version, ni source, ni notion de levée, ni ligne fédérale — chaque
--   centre porte sa copie. Les deux modèles diffèrent sur le fond (par centre
--   sans version ↔ fédéral versionné avec surcharge). On ne les fait pas
--   cohabiter : ce référentiel remplace l'ancien, et get_aptitude_du_jour
--   migrera dessus en P3. Deux référentiels côte à côte, c'est de la logique
--   dupliquée — ce que P7 interdit.
--
-- IMMUABILITÉ : une règle n'est JAMAIS modifiée. On insère une nouvelle
-- version et on désactive l'ancienne. Un trigger refuse toute autre écriture
-- que la bascule d'`actif`.
--
-- SURCHARGE PAR CENTRE : une ligne avec centre_id renseigné MASQUE la ligne
-- fédérale du même code pour ce centre. Désactiver une règle fédérale « chez
-- soi » = insérer sa copie avec actif = false. La ligne fédérale, elle, n'est
-- jamais touchée par un centre.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Le référentiel ──────────────────────────────────────────────────────
create table if not exists regles_securite (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  version             int  not null default 1,
  libelle             text not null,
  -- Le texte fédéral. NOT NULL et non vide : une règle sans source est un
  -- avis, et ParaPass n'en a pas.
  source_texte        text not null check (length(trim(source_texte)) > 0),
  gravite             text not null check (gravite in ('bloquant','vigilance')),
  levable             boolean not null default false,
  habilitation_levee  text not null default 'aucun'
                        check (habilitation_levee in ('DT','moniteur','plieur','aucun')),
  effet_levee         text,
  duree_levee         text check (duree_levee in ('une_rotation','la_journee','jusqu_a_regularisation')),
  portee              text not null default 'individu'
                        check (portee in ('individu','rotation','centre')),
  actif               boolean not null default true,
  -- NULL = règle fédérale, applicable à tous les centres.
  centre_id           uuid references centres(id) on delete cascade,
  cree_le             timestamptz not null default now(),
  -- Cohérence : non levable ⇒ pas d'habilitation ni de durée.
  constraint regles_securite_levee_coherente check (
    (levable and habilitation_levee <> 'aucun' and duree_levee is not null)
    or (not levable and habilitation_levee = 'aucun' and duree_levee is null)
  )
);

-- (code, version, centre) unique — « nulls not distinct » pour que deux lignes
-- fédérales de même code/version ne puissent pas coexister.
create unique index if not exists regles_securite_code_version_centre
  on regles_securite (code, version, centre_id) nulls not distinct;

create index if not exists regles_securite_actives
  on regles_securite (code, centre_id) where actif;

comment on table regles_securite is
  'Feu Vert — référentiel des règles de sécurité. Donnée versionnée, jamais modifiée : on insère une version, on désactive l''ancienne. centre_id nul = règle fédérale.';

-- ── 2 · Immuabilité : seul `actif` peut changer ─────────────────────────────
create or replace function regles_securite_immuable()
returns trigger language plpgsql as $$
begin
  if (old.code, old.version, old.libelle, old.source_texte, old.gravite, old.levable,
      old.habilitation_levee, old.effet_levee, old.duree_levee, old.portee, old.centre_id, old.cree_le)
     is distinct from
     (new.code, new.version, new.libelle, new.source_texte, new.gravite, new.levable,
      new.habilitation_levee, new.effet_levee, new.duree_levee, new.portee, new.centre_id, new.cree_le)
  then
    raise exception
      'Une règle ne se modifie pas : insérez une nouvelle version (code %, version %) et désactivez celle-ci.',
      old.code, old.version + 1
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_regles_securite_immuable on regles_securite;
create trigger trg_regles_securite_immuable
  before update on regles_securite
  for each row execute function regles_securite_immuable();

create or replace function regles_securite_pas_de_suppression()
returns trigger language plpgsql as $$
begin
  raise exception 'Une règle ne se supprime pas : désactivez-la (actif = false).' using errcode = '23514';
end $$;

drop trigger if exists trg_regles_securite_pas_de_suppression on regles_securite;
create trigger trg_regles_securite_pas_de_suppression
  before delete on regles_securite
  for each row execute function regles_securite_pas_de_suppression();

-- ── 3 · Résolution : les règles EN VIGUEUR pour un centre ───────────────────
-- Pour chaque code : la dernière version DU CENTRE si le centre en a une
-- (même inactive — c'est ainsi qu'il masque la fédérale), sinon la dernière
-- version fédérale. Ne rend que les règles actives au terme de la résolution.
-- C'est LA fonction que lira le moteur (P3) et l'écran d'administration.
create or replace function regles_en_vigueur(p_centre_id uuid)
returns setof regles_securite
language sql stable as $$
  with candidates as (
    select r.*,
           row_number() over (
             partition by r.code
             order by (r.centre_id is not null) desc, r.version desc
           ) as rang
    from regles_securite r
    where r.centre_id is null or r.centre_id = p_centre_id
  )
  select id, code, version, libelle, source_texte, gravite, levable, habilitation_levee,
         effet_levee, duree_levee, portee, actif, centre_id, cree_le
  from candidates
  where rang = 1 and actif
  order by gravite desc, code
$$;

comment on function regles_en_vigueur(uuid) is
  'Feu Vert — règles applicables à un centre : surcharge centre sinon fédérale, dernière version, actives seulement.';

-- ── 4 · Bascule par un centre : masquer ou rétablir une règle chez soi ──────
-- Le centre n'écrit JAMAIS sur une ligne fédérale. Il insère sa copie avec
-- l'état voulu, ou bascule `actif` sur SA copie existante.
create or replace function basculer_regle_centre(p_centre_id uuid, p_code text, p_actif boolean)
returns regles_securite
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_ref regles_securite;
  v_mine regles_securite;
begin
  if not exists (select 1 from admin_centres a
                 where a.profile_id = auth.uid() and a.centre_id = p_centre_id) then
    raise exception 'Réservé au centre concerné' using errcode = '42501';
  end if;

  select * into v_mine from regles_securite
  where code = p_code and centre_id = p_centre_id
  order by version desc limit 1;

  if v_mine.id is not null then
    update regles_securite set actif = p_actif where id = v_mine.id returning * into v_mine;
    return v_mine;
  end if;

  select * into v_ref from regles_securite
  where code = p_code and centre_id is null
  order by version desc limit 1;
  if v_ref.id is null then
    raise exception 'Règle % inconnue.', p_code using errcode = 'P0002';
  end if;

  insert into regles_securite (code, version, libelle, source_texte, gravite, levable,
      habilitation_levee, effet_levee, duree_levee, portee, actif, centre_id)
  values (v_ref.code, v_ref.version, v_ref.libelle, v_ref.source_texte, v_ref.gravite, v_ref.levable,
      v_ref.habilitation_levee, v_ref.effet_levee, v_ref.duree_levee, v_ref.portee, p_actif, p_centre_id)
  returning * into v_mine;
  return v_mine;
end $$;

-- ── 5 · RLS ─────────────────────────────────────────────────────────────────
alter table regles_securite enable row level security;

-- Lecture : les règles fédérales pour tout utilisateur connecté (le refus
-- cite le texte, le parachutiste doit pouvoir le lire), et celles de son centre.
drop policy if exists regles_securite_lecture on regles_securite;
create policy regles_securite_lecture on regles_securite
  for select using (
    centre_id is null
    or centre_id in (select centre_id from admin_centres where profile_id = auth.uid())
    or centre_id in (select centre_id from licencies_centres
                     where parachutiste_id = auth.uid() and statut = 'actif')
  );

-- Écriture : uniquement via basculer_regle_centre (security definer).
-- Aucune policy INSERT/UPDATE/DELETE : l'API directe ne passe pas.

-- ── 6 · Les options du centre, et LA contrainte ─────────────────────────────
create table if not exists centres_options (
  centre_id         uuid primary key references centres(id) on delete cascade,
  feu_vert_actif    boolean not null default false,
  feu_vert_bloquant boolean not null default false,
  module_avionnage  boolean not null default false,
  active_le         timestamptz,
  active_par        uuid references profiles(id),
  -- P7 : le régime est un réglage. Et le régime bloquant n'a de sens que si
  -- ParaPass tient les rotations. EN BASE, pas dans un formulaire.
  constraint centres_options_bloquant_exige_avionnage
    check (not feu_vert_bloquant or module_avionnage)
);

comment on constraint centres_options_bloquant_exige_avionnage on centres_options is
  'Feu Vert — le régime bloquant exige le module Avionnage : un rouge ne peut être refusé que si ParaPass tient la liste de rotation.';

-- Distinct de centres.avionnage_actif, qui est l''OUVERTURE DU JOUR de la
-- file (le matin, par le chef d''avionnage). module_avionnage est la
-- SOUSCRIPTION du centre. Deux questions, deux colonnes.
comment on column centres_options.module_avionnage is
  'Souscription au module Avionnage. Ne pas confondre avec centres.avionnage_actif (ouverture de la file du jour).';

alter table centres_options enable row level security;
drop policy if exists centres_options_centre on centres_options;
create policy centres_options_centre on centres_options
  for all
  using (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()))
  with check (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()));

-- Journalisation de tout changement d''option : le journal_securite n''existe
-- pas encore (P4). Le trigger sera posé dans la migration P4, sur cette table,
-- avec le type d''événement regime_modifie. Noté ici pour ne pas l''oublier.

-- ── 7 · Le seed fédéral : treize règles, chacune avec sa source ─────────────
-- Libellés à la forme négative : c''est ce que voit le DT.
-- Décision du 06/09/2026 : les fondamentaux sont BLOQUANTS, pour peser face
-- aux assureurs (licence, certificat, qualifications, encadrement, mineur).
insert into regles_securite
  (code, version, libelle, source_texte, gravite, levable, habilitation_levee, effet_levee, duree_levee, portee)
values
  ('LIC-001', 1, 'Licence FFP expirée ou absente',
   'Règlement fédéral relatif aux modalités de délivrance des licences, 18/11/2023',
   'bloquant', false, 'aucun', null, null, 'individu'),

  ('MED-001', 1, 'Certificat médical de non contre-indication expiré ou absent',
   'Règlement médical fédéral · formulaire CACI FFP',
   'bloquant', false, 'aucun', null, null, 'individu'),

  ('BRF-001', 1, 'Briefing du jour non acquitté',
   'Règle du centre',
   'bloquant', true, 'DT', 'Le DT atteste avoir briefé la personne oralement avant l''embarquement.', 'une_rotation', 'individu'),

  ('REP-001', 1, 'Reprise après interruption de pratique',
   'DT49 — Directive technique n°49, encadrement et progression',
   'vigilance', true, 'moniteur', 'Saut encadré obligatoire.', 'la_journee', 'individu'),

  ('MAT-001', 1, 'Parachute de secours hors périodicité de pliage',
   'DT50 — Maintenance et pliage des parachutes sportifs',
   'bloquant', false, 'aucun', null, null, 'individu'),

  ('MAT-002', 1, 'Pliage du principal non tracé',
   'DT53 — Directive technique n°53, traçabilité du pliage',
   'vigilance', true, 'plieur', 'Le plieur ou le DT atteste du pliage.', 'la_journee', 'individu'),

  ('MAT-003', 1, 'Vérification du principal non effectuée',
   'DT54 — Directive technique n°54, vérification du matériel',
   'vigilance', true, 'DT', 'Vérification effectuée devant le DT.', 'la_journee', 'individu'),

  ('VOI-001', 1, 'Voile non adaptée à l''expérience',
   'DT48 — Utilisation des voiles',
   'vigilance', true, 'DT', 'Motif obligatoire : le DT justifie l''adéquation voile / expérience.', 'jusqu_a_regularisation', 'individu'),

  ('QUA-001', 1, 'Qualification wingsuit requise et absente',
   'DT59 — Directive technique n°59, wingsuit',
   'bloquant', false, 'aucun', null, null, 'individu'),

  ('QUA-002', 1, 'Qualification requise pour l''emport d''appareil de prise de vue',
   'DT52 — Directive technique n°52, vidéo et prise de vue',
   'bloquant', false, 'aucun', null, null, 'individu'),

  ('EQP-001', 1, 'Casque obligatoire pour non-breveté',
   'DT51 — Directive technique n°51, équipement',
   'vigilance', true, 'DT', 'Le DT constate le port du casque à l''embarquement.', 'une_rotation', 'individu'),

  ('ENC-001', 1, 'Encadrement de la séance non couvert',
   'DT49 — Directive technique n°49, encadrement et progression',
   'bloquant', true, 'DT', 'Sous condition : le DT désigne nommément l''encadrant présent et sa qualification.', 'une_rotation', 'rotation'),

  ('MIN-001', 1, 'Âge ou autorisation parentale manquante pour un mineur',
   'DT49 — Directive technique n°49, encadrement et progression',
   'bloquant', false, 'aucun', null, null, 'individu')
on conflict do nothing;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- DÉMONSTRATIONS À JOUER APRÈS APPLICATION (critères d''acceptation)
--
-- a) La contrainte bloquant/avionnage est EN BASE — cet INSERT doit échouer :
--
--   insert into centres_options (centre_id, feu_vert_bloquant, module_avionnage)
--   values ((select id from centres limit 1), true, false);
--   → ERROR 23514 violates check constraint "centres_options_bloquant_exige_avionnage"
--
-- b) Une règle ne se modifie pas — cet UPDATE doit échouer :
--
--   update regles_securite set libelle = 'x' where code = 'LIC-001';
--   → ERROR 23514 Une règle ne se modifie pas : insérez une nouvelle version…
--
-- c) La QUATORZIÈME règle ne demande AUCUNE modification de code. Un INSERT,
--    et elle apparaît dans regles_en_vigueur(), donc dans l''écran
--    d''administration et dans le moteur (P3). Candidate — SOURCE À CONFIRMER
--    par le DT avant seed :
--
--   insert into regles_securite
--     (code, version, libelle, source_texte, gravite, levable, habilitation_levee, effet_levee, duree_levee, portee)
--   values ('BRV-001', 1, 'Type de saut non couvert par le brevet détenu',
--     'DT49 — Directive technique n°49, encadrement et progression (grille des brevets A/B/C/D)',
--     'bloquant', true, 'DT', 'Saut encadré par un moniteur qualifié pour la progression concernée.', 'une_rotation', 'individu');
--
-- d) Chaque règle du seed porte une source non vide — c''est une contrainte
--    CHECK, pas une bonne intention :
--
--   select count(*) from regles_securite where length(trim(source_texte)) = 0;  → 0
-- ════════════════════════════════════════════════════════════════════════════
