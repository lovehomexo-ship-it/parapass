-- CE QUE LE SAUTEUR EMPORTE — déclaré par lui en se disant présent, en un
-- toucher par objet, et repris la fois suivante. Il apparaît tout seul sur la
-- planche d'avionnage : la DZ n'a plus à le demander.
alter table public.dz_presences
  add column if not exists equipements text[] not null default '{}';

alter table public.dz_presences drop constraint if exists dz_presences_equipements_connus;
alter table public.dz_presences add constraint dz_presences_equipements_connus
  check (equipements <@ array['casque', 'altimetre', 'audible', 'camera']::text[]);
