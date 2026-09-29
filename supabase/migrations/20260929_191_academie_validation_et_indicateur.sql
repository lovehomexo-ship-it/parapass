-- La validation n'était possible que pour `profiles.role = 'admin'` :
-- l'administrateur global de ParaPass. Aucun DT, aucun moniteur agréé ne
-- pouvait relire une question — le garde-fou n'existait donc pas.
--
-- Désormais : le staff d'un centre gère et valide les questions DE SON CENTRE ;
-- la banque commune reste à l'administrateur ParaPass. Un parachutiste ne lit
-- que ce que `academie_questions` lui sert.

drop policy if exists qq_read_validees on quiz_questions;
drop policy if exists qq_admin_all on quiz_questions;
drop policy if exists qq_lecture_validees on quiz_questions;
drop policy if exists qq_staff_centre on quiz_questions;
drop policy if exists qq_admin_banque on quiz_questions;

-- Lecture : les questions validées. Le tri par NIVEAU se fait dans
-- `academie_questions` ; la politique garantit seulement qu'une question non
-- validée ne sort jamais, quel que soit l'appel.
create policy qq_lecture_validees on quiz_questions
  for select to authenticated
  using (statut = 'validee'
         and (centre_id is null
              or exists (select 1 from licencies_centres lc
                          where lc.parachutiste_id = auth.uid()
                            and lc.centre_id = quiz_questions.centre_id
                            and lc.statut = 'actif')));

-- Le staff du centre : lecture, écriture et validation de SES questions.
-- Il ne peut pas s'approprier une question de la banque commune : la clause
-- USING porte sur l'ancienne ligne, dont le centre_id est nul.
create policy qq_staff_centre on quiz_questions
  for all to authenticated
  using (centre_id is not null
         and (is_dz_admin(centre_id) or is_moniteur_dz(centre_id)))
  with check (centre_id is not null
              and (is_dz_admin(centre_id) or is_moniteur_dz(centre_id)));

create policy qq_admin_banque on quiz_questions
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Valider est un ACTE : on trace qui et quand, sans que l'écran ait à y penser.
create or replace function quiz_question_trace_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut = 'validee' and coalesce(old.statut, '') is distinct from 'validee' then
    new.valide_par := coalesce(new.valide_par, auth.uid());
    new.valide_le  := coalesce(new.valide_le, now());
    new.date_revision := now();
  elsif new.statut is distinct from 'validee' then
    -- Une question retirée de la diffusion perd sa signature : elle devra être
    -- relue de nouveau.
    new.valide_par := null;
    new.valide_le  := null;
  end if;
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_quiz_question_validation on quiz_questions;
create trigger trg_quiz_question_validation
  before insert or update on quiz_questions
  for each row execute function quiz_question_trace_validation();

-- La file de relecture d'un centre.
create or replace function academie_questions_a_valider(p_centre_id uuid)
returns setof quiz_questions
language sql
stable
security definer
set search_path = public
as $$
  select q.* from quiz_questions q
   where q.statut <> 'validee'
     and (is_dz_admin(p_centre_id) or is_moniteur_dz(p_centre_id))
     and (q.centre_id = p_centre_id or q.centre_id is null)
   order by q.niveau_brevet_mini nulls first, q.theme;
$$;

-- Ce que le DT peut voir des scores d'entraînement de ses licenciés.
--
-- C'est un INDICATEUR PÉDAGOGIQUE, pas une note : il sert à repérer un thème
-- où plusieurs élèves se trompent, donc à cibler un briefing. Il ne vaut ni
-- validation de brevet, ni jugement sur une personne. Trois garde-fous sont
-- écrits dans la requête elle-même : agrégation par thème sur 90 jours et
-- jamais réponse par réponse — on ne rejoue pas la session de quelqu'un ; un
-- minimum de 3 réponses, sinon rien — un score sur une question ne dit rien et
-- stigmatise pour rien ; et l'accès réservé au staff du centre.
create or replace function academie_scores_du_centre(p_centre_id uuid)
returns table (
  user_id uuid, prenom text, nom text, theme text,
  reponses int, reussites int, taux numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, p.prenom, p.nom, q.theme,
         count(*)::int,
         count(*) filter (where a.est_correcte)::int,
         round(100.0 * count(*) filter (where a.est_correcte) / count(*), 0)
    from quiz_attempts a
    join quiz_questions q on q.id = a.question_id
    join profiles p on p.id = a.user_id
   where (is_dz_admin(p_centre_id) or is_moniteur_dz(p_centre_id))
     and a.created_at > now() - interval '90 days'
     and exists (select 1 from licencies_centres lc
                  where lc.parachutiste_id = a.user_id
                    and lc.centre_id = p_centre_id
                    and lc.statut = 'actif')
   group by a.user_id, p.prenom, p.nom, q.theme
  having count(*) >= 3
   order by p.nom, q.theme;
$$;

grant execute on function academie_questions_a_valider(uuid) to authenticated;
grant execute on function academie_scores_du_centre(uuid) to authenticated;
