-- L'échelle de l'Académie, une seule fois, côté base.
--
-- Elle reprend l'ordre du référentiel : PAC 1 à 4, puis A, B, les
-- qualifications qui suivent le B, puis BPA (pivot), C et D. Un code inconnu
-- vaut 0 : la question est servie à tout le monde, comme celles sans niveau.
create or replace function academie_rang_niveau(p_code text)
returns int
language sql
immutable
as $$
  select case p_code
    when 'PAC1' then 1 when 'PAC2' then 2 when 'PAC3' then 3 when 'PAC4' then 4
    when 'A' then 5
    when 'B' then 6
    -- Les qualifications s'ouvrent après le B : même rang que lui.
    when 'B1' then 6 when 'B2' then 6 when 'B3' then 6 when 'B4' then 6 when 'B5' then 6
    when 'Bi4' then 6 when 'Bi5' then 6
    when 'BPA' then 7
    when 'C' then 8
    when 'D' then 9
    else 0
  end;
$$;

-- Le niveau ATTEINT par un parachutiste : le plus haut de ce qu'il détient,
-- brevets portés sur sa licence ET paliers PAC délivrés.
--
-- Défaut 1, jamais 9 : quelqu'un dont on ne sait rien est un débutant, pas un
-- breveté D. C'est le défaut exact que corrige cette fonction.
create or replace function academie_niveau_atteint(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    1,
    coalesce((select max(academie_rang_niveau(b.type_brevet))
                from brevets b where b.parachutiste_id = p_user_id), 0),
    coalesce((select max(academie_rang_niveau(br.code))
                from validations_brevet vb
                join brevets_referentiel br on br.id = vb.brevet_id
               where vb.user_id = p_user_id), 0)
  );
$$;

comment on function academie_niveau_atteint(uuid) is
  'Le niveau réellement atteint : brevets détenus et paliers PAC délivrés. '
  'Défaut 1 (débutant), jamais le plus haut — une donnée absente ne donne pas '
  'accès aux questions expertes.';

-- Les questions qu'on sert à cette personne : validées, de son niveau ou en
-- dessous, de la banque commune ou d'un centre où elle est licenciée active.
create or replace function academie_questions(p_user_id uuid, p_theme text default null)
returns setof quiz_questions
language sql
stable
security definer
set search_path = public
as $$
  select q.*
    from quiz_questions q
   where q.statut = 'validee'
     and academie_rang_niveau(q.niveau_brevet_mini) <= academie_niveau_atteint(p_user_id)
     and (q.centre_id is null
          or exists (select 1 from licencies_centres lc
                      where lc.parachutiste_id = p_user_id
                        and lc.centre_id = q.centre_id
                        and lc.statut = 'actif'))
     and (p_theme is null or q.theme = p_theme);
$$;

comment on function academie_questions(uuid, text) is
  'LA définition de ce qu''un parachutiste voit. Les écrans ne composent plus '
  'le filtre : ils appellent cette fonction.';

grant execute on function academie_rang_niveau(text) to authenticated;
grant execute on function academie_niveau_atteint(uuid) to authenticated;
grant execute on function academie_questions(uuid, text) to authenticated;
