-- La liste d'attente des modules à venir n'existait pas en base : la partie
-- « module_waitlist » de la migration 092 n'a jamais été appliquée. L'écran
-- Modules la lisait (404 à chaque ouverture) et « Me prévenir » échouait sans
-- rien dire. Les droits passent par admin_centres, comme le reste de l'espace DZ.

create table if not exists public.module_waitlist (
  id         uuid primary key default gen_random_uuid(),
  centre_id  uuid not null references public.centres(id) on delete cascade,
  module_id  text not null,
  created_at timestamptz not null default now(),
  unique (centre_id, module_id)
);

alter table public.module_waitlist enable row level security;

drop policy if exists module_waitlist_select on public.module_waitlist;
create policy module_waitlist_select on public.module_waitlist
  for select to authenticated using (
    exists (select 1 from public.admin_centres ac
             where ac.profile_id = auth.uid() and ac.centre_id = module_waitlist.centre_id));

drop policy if exists module_waitlist_insert on public.module_waitlist;
create policy module_waitlist_insert on public.module_waitlist
  for insert to authenticated with check (
    exists (select 1 from public.admin_centres ac
             where ac.profile_id = auth.uid() and ac.centre_id = module_waitlist.centre_id));

drop policy if exists module_waitlist_delete on public.module_waitlist;
create policy module_waitlist_delete on public.module_waitlist
  for delete to authenticated using (
    exists (select 1 from public.admin_centres ac
             where ac.profile_id = auth.uid() and ac.centre_id = module_waitlist.centre_id));

-- L'upsert de l'écran (on conflict centre_id, module_id) a besoin du droit de
-- mise à jour pour la branche « déjà inscrit ».
drop policy if exists module_waitlist_update on public.module_waitlist;
create policy module_waitlist_update on public.module_waitlist
  for update to authenticated using (
    exists (select 1 from public.admin_centres ac
             where ac.profile_id = auth.uid() and ac.centre_id = module_waitlist.centre_id));

grant select, insert, update, delete on public.module_waitlist to authenticated;
