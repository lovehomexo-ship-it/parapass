-- ════════════════════════════════════════════════════════════════════════════
-- FEU VERT — Le verdict de PLUSIEURS personnes en un appel.
--
-- CONSTAT (06/09/2026, capture de l'écran Avionnage) : sur 7 personnes à
-- bord, une seule portait un badge. Deux causes, toutes deux graves :
--
--   1. L'écran lisait get_aptitude_du_jour, qui ne rend QUE les présents
--      déclarés. 5 des 7 ne l'étaient pas → aucune aptitude → aucun badge.
--      L'ABSENCE DE BADGE SE LISAIT COMME « TOUT VA BIEN ». C'est exactement
--      ce que P1 interdit : une donnée absente doit crier, pas se taire.
--
--   2. get_aptitude_du_jour est l'ANCIEN moteur (regles_aptitude, 7 règles,
--      pas de gris). Feu Vert dit « gris » là où lui dit « vert ». Deux
--      moteurs se contredisaient sur le même écran — ce que P7 interdit.
--
-- Cette fonction ferme les deux : elle rend un verdict Feu Vert pour une
-- LISTE de personnes, présentes ou non. Une personne dont on ne sait rien
-- n'est pas absente du résultat : elle est GRISE.
--
-- Le client passe les ids dont il a besoin (les gens à bord, la file, la
-- recherche) : borné et explicite, plutôt que « tous les licenciés » qui
-- ferait 25 × 14 lectures pour en afficher 7.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create or replace function verdicts_du_jour(
  p_centre_id uuid,
  p_ids uuid[],
  p_date date default current_date,
  p_type_saut text default 'solo'
) returns table (
  parachutiste_id uuid, verdict text,
  nb_bloquants int, nb_vigilances int, nb_gris int,
  codes_gris text, codes_rouges text
)
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not exists (select 1 from admin_centres a
                 where a.profile_id = auth.uid() and a.centre_id = p_centre_id) then
    raise exception 'Réservé au centre concerné' using errcode = '42501';
  end if;

  return query
  select i.id, v.verdict, v.nb_bloquants, v.nb_vigilances, v.nb_gris, v.codes_gris, v.codes_rouges
  from unnest(coalesce(p_ids, '{}'::uuid[])) as i(id)
  cross join lateral verdict_conformite(i.id, p_centre_id, p_date, p_type_saut) v;
end $$;

comment on function verdicts_du_jour(uuid, uuid[], date, text) is
  'Feu Vert — verdict d''une liste de personnes, présentes ou non. Une personne dont on ne sait rien est GRISE, jamais absente du résultat.';

commit;
