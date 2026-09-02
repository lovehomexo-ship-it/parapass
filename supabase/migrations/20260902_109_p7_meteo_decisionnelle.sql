-- ═══════════════════════════════════════════════════════════════════════════
-- P7 — MÉTÉO DÉCISIONNELLE (seuils par public).
--
-- Constat : meteo_seuils portait UN seul jeu de valeurs pour tout le centre, et
-- n'a jamais été renseignée (0 ligne). Le feu vert était donc en dur, identique
-- pour un élève en progression et un confirmé — alors que c'est précisément la
-- distinction qu'un directeur technique fait toute la journée.
--
-- Les deux paramètres qui font réellement fermer une DZ manquaient : le PLAFOND
-- et la VISIBILITÉ. Ajoutés, ainsi que l'écart vent sol / vent en altitude — un
-- fort cisaillement change la donne même par vent sol modéré.
--
-- Valeurs par défaut : usages courants en France, à ajuster par chaque centre.
-- Elles ne prétendent pas se substituer au référentiel fédéral.
--
-- La DÉCISION du jour (ouvert / sous réserve / fermé) n'a pas de table dédiée :
-- elle s'écrit au journal de bord (P4, type 'decision_meteo') AVEC les
-- conditions du moment. « Pourquoi a-t-on fermé ce jour-là » a donc une réponse
-- six mois plus tard, dans un registre en ajout seul.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.meteo_seuils_public (
  id                     uuid primary key default gen_random_uuid(),
  centre_id              uuid not null references public.centres(id) on delete cascade,
  public_cible           text not null check (public_cible in
                           ('eleve','brevete_ab','confirme','tandem','wingsuit')),
  ordre                  int  not null default 0,
  vent_vigilance_kt      int  not null,
  vent_max_kt            int  not null,
  rafales_vigilance_kt   int  not null,
  rafales_max_kt         int  not null,
  vent_altitude_max_kt   int,
  ecart_sol_alt_max_kt   int,
  plafond_min_m          int,
  visibilite_min_km      numeric(4,1),
  actif                  boolean not null default true,
  updated_at             timestamptz not null default now(),
  unique (centre_id, public_cible)
);

alter table public.meteo_seuils_public enable row level security;

drop policy if exists meteo_seuils_public_centre on public.meteo_seuils_public;
create policy meteo_seuils_public_centre on public.meteo_seuils_public for all
  using (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()))
  with check (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()));

-- Lecture ouverte aux licenciés du centre : le briefing les concerne.
drop policy if exists meteo_seuils_public_lecture on public.meteo_seuils_public;
create policy meteo_seuils_public_lecture on public.meteo_seuils_public for select
  using (centre_id in (select centre_id from licencies_centres
                        where parachutiste_id = auth.uid() and statut = 'actif'));

insert into public.meteo_seuils_public
  (centre_id, public_cible, ordre, vent_vigilance_kt, vent_max_kt,
   rafales_vigilance_kt, rafales_max_kt, vent_altitude_max_kt,
   ecart_sol_alt_max_kt, plafond_min_m, visibilite_min_km)
select c.id, s.public_cible, s.ordre, s.vv, s.vm, s.rv, s.rm, s.va, s.ec, s.pl, s.vi
from public.centres c
cross join (values
  -- public        ordre  ventVig ventMax rafVig rafMax  ventAlt  écart  plafond  visib
  ('eleve',        1,     12,     15,     15,    18,     35,      25,    1200,    5.0),
  ('brevete_ab',   2,     16,     20,     20,    25,     45,      30,    1000,    5.0),
  ('confirme',     3,     20,     25,     26,    32,     55,      35,     900,    3.0),
  ('tandem',       4,     16,     20,     20,    25,     45,      30,    1500,    5.0),
  ('wingsuit',     5,     20,     25,     26,    32,     55,      35,    1500,    8.0)
) as s(public_cible, ordre, vv, vm, rv, rm, va, ec, pl, vi)
on conflict (centre_id, public_cible) do nothing;

alter table public.centres add column if not exists code_oaci text;
comment on column public.centres.code_oaci is
  'Code OACI de l''aérodrome de rattachement (ex. LFDN), pour consulter le '
  'METAR/TAF officiel. Source aéronautique, distincte de la prévision.';
