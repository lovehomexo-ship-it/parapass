-- ACADÉMIE — questions servies au niveau du parachutiste, et validées par un
-- moniteur avant diffusion.
--
-- Le schéma quiz existait HORS MIGRATION : rien dans supabase/migrations ne
-- créait ces tables. Ce fichier les rattrape en même temps qu'il les enrichit.
--
-- Trois défauts constatés avant d'écrire une ligne :
--   1. Un élève SANS brevet recevait TOUTES les questions jusqu'au niveau D.
--      Le client faisait `indexOf(null) → length - 1` : donnée absente = le
--      plus permissif. C'est l'inverse de P1, et l'inverse du besoin.
--   2. Le niveau était lu sur `profiles.type_brevet_principal`, le champ texte
--      déclaré obsolète dans src/lib/brevets.ts.
--   3. Seul `profiles.role = 'admin'` — l'administrateur global ParaPass —
--      pouvait valider une question. Aucun moniteur, aucun DT : le garde-fou
--      de relecture n'existait donc pas.

alter table quiz_questions add column if not exists centre_id  uuid references centres(id) on delete cascade;
alter table quiz_questions add column if not exists valide_par uuid references profiles(id);
alter table quiz_questions add column if not exists valide_le  timestamptz;

comment on column quiz_questions.centre_id is
  'NULL = banque commune ParaPass, visible par tous. Sinon : question propre à ce centre.';
comment on column quiz_questions.valide_par is
  'Qui a validé la question. Une question de sécurité diffusée sans relecture humaine est un risque, pas une fonctionnalité.';

create index if not exists quiz_questions_centre_idx on quiz_questions (centre_id);
create index if not exists quiz_questions_service_idx on quiz_questions (statut, niveau_brevet_mini);

-- La contrainte n'admettait que 'brouillon' et 'validee' : il manquait l'état
-- intermédiaire, celui où une question ATTEND une relecture. Sans lui, une
-- question nouvelle était soit invisible et oubliée, soit diffusée.
alter table quiz_questions drop constraint if exists quiz_questions_statut_check;
alter table quiz_questions add constraint quiz_questions_statut_check
  check (statut = any (array['brouillon','en_attente_validation','validee','refusee']));

comment on column quiz_questions.statut is
  'brouillon → en_attente_validation → validee ou refusee. Seule « validee » est servie aux parachutistes.';

-- Le lien vers le QCM officiel de la FFP : paramétrable, jamais codé en dur.
-- Une adresse fédérale change ; cela ne doit pas demander un déploiement.
create table if not exists academie_parametres (
  cle     text primary key,
  valeur  text not null,
  libelle text,
  maj_le  timestamptz not null default now()
);

insert into academie_parametres (cle, valeur, libelle) values
  ('qcm_officiel_url', 'https://ffp.asso.fr/qcm/', 'Plateforme de QCM officielle de la FFP'),
  ('mention_entrainement',
   'Questions d''entraînement — elles ne remplacent ni la formation ni le QCM officiel de la FFP. En cas de doute, réfère-toi à ton moniteur.',
   'Mention affichée sur chaque session de quiz')
on conflict (cle) do nothing;

alter table academie_parametres enable row level security;
drop policy if exists academie_parametres_lecture on academie_parametres;
create policy academie_parametres_lecture on academie_parametres
  for select to authenticated, anon using (true);
drop policy if exists academie_parametres_admin on academie_parametres;
create policy academie_parametres_admin on academie_parametres
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
