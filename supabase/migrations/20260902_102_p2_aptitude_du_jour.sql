-- ═══════════════════════════════════════════════════════════════════════════
-- P2 — APTITUDE DU JOUR (tables, règles par défaut, RLS)
--
-- Doctrine : l'application n'interdit JAMAIS un saut. Elle informe, elle trace,
-- le DT décide. Un blocage se lève par une décision nommée, datée et signée.
--
-- Aucun calcul dupliqué : la date du dernier saut et les échéances réutilisent
-- les définitions de get_regulatory_snapshot (is_tunnel = false,
-- licences.statut = 'actif', même seuil compliance_rules.alerte_j30).
-- Migration idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.regles_aptitude (
  id          uuid primary key default gen_random_uuid(),
  centre_id   uuid not null references public.centres(id) on delete cascade,
  code        text not null,
  libelle     text not null,
  categorie   text not null check (categorie in
                ('administratif','activite_recente','materiel','briefing','encadrement')),
  severite    text not null check (severite in ('info','vigilance','blocage')),
  parametres  jsonb not null default '{}'::jsonb,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (centre_id, code)
);
create index if not exists idx_regles_aptitude_centre on public.regles_aptitude(centre_id) where actif;

create table if not exists public.derogations (
  id              uuid primary key default gen_random_uuid(),
  centre_id       uuid not null references public.centres(id) on delete cascade,
  parachutiste_id uuid not null references public.profiles(id) on delete cascade,
  regle_code      text not null,
  date_validite   date not null default current_date,   -- la journée SEULEMENT
  motif           text not null,
  signataire_id   uuid not null references public.profiles(id),
  signataire_nom  text not null,                         -- figé : lisible six mois plus tard
  created_at      timestamptz not null default now()
);
create index if not exists idx_derogations_jour
  on public.derogations(centre_id, date_validite, parachutiste_id);

alter table public.regles_aptitude enable row level security;
alter table public.derogations enable row level security;

drop policy if exists regles_aptitude_centre_all on public.regles_aptitude;
create policy regles_aptitude_centre_all on public.regles_aptitude for all
  using (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()))
  with check (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()));

drop policy if exists derogations_centre_all on public.derogations;
create policy derogations_centre_all on public.derogations for all
  using (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()))
  with check (centre_id in (select centre_id from admin_centres where profile_id = auth.uid()));

-- Transparence : le parachutiste voit les dérogations qui le concernent.
drop policy if exists derogations_lecture_interesse on public.derogations;
create policy derogations_lecture_interesse on public.derogations for select
  using (parachutiste_id = auth.uid());

-- Règles livrées par défaut. Celles marquées "inerte" existent mais ne
-- produisent aucun motif tant que le module correspondant n'est pas branché.
insert into public.regles_aptitude (centre_id, code, libelle, categorie, severite, parametres)
select c.id, r.code, r.libelle, r.categorie, r.severite, r.parametres
from public.centres c
cross join (values
  ('licence_ffp',       'Licence FFP expirée ou absente',         'administratif',    'blocage',   '{}'::jsonb),
  ('certificat_medical','Certificat médical expiré ou absent',    'administratif',    'blocage',   '{}'::jsonb),
  ('assurance',         'Assurance individuelle absente',         'administratif',    'vigilance', '{"inerte": true}'::jsonb),
  ('briefing_jour',     'Briefing du jour non acquitté',          'briefing',         'vigilance', '{}'::jsonb),
  ('inactivite',        'Reprise après interruption',             'activite_recente', 'vigilance',
     '{"conseil_jours": 90, "moniteur_jours": 180, "reprise_jours": 365}'::jsonb),
  ('qualification',     'Qualification requise pour l''activité', 'encadrement',      'vigilance', '{"inerte": true}'::jsonb),
  ('materiel_echeance', 'Échéance matériel dépassée',             'materiel',         'vigilance', '{"inerte": true}'::jsonb)
) as r(code, libelle, categorie, severite, parametres)
on conflict (centre_id, code) do nothing;
