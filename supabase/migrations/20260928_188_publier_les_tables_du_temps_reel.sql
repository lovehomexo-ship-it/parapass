-- CORRECTIF D'UNE AFFIRMATION FAUSSE DE MA PART.
--
-- J'ai abonné le tableau de bord aux changements de `licencies_centres` et de
-- `progression_epreuves`, et annoncé que les pastilles se mettaient à jour en
-- direct. Elles ne le faisaient pas : un abonnement `postgres_changes` ne
-- reçoit QUE les tables inscrites à la publication `supabase_realtime`. Seules
-- `conversations, messages, profiles, sauts` y étaient.
--
-- Ce que j'avais pris pour du temps réel était le rechargement déclenché par le
-- bouton de démonstration lui-même. Mesure : une déclaration « prêt » insérée
-- directement en base n'a pas fait bouger la pastille Academy.
--
-- `dz_presences` était dans le même cas : `useEncadrement` s'y abonne depuis
-- longtemps et ne recevait rien non plus.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='licencies_centres') then
    alter publication supabase_realtime add table public.licencies_centres;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='progression_epreuves') then
    alter publication supabase_realtime add table public.progression_epreuves;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='dz_presences') then
    alter publication supabase_realtime add table public.dz_presences;
  end if;
end $$;
