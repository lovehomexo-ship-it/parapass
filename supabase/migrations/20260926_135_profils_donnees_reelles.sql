-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILS À DONNÉES RÉELLES — ne jamais peupler.
--
-- POURQUOI CETTE COLONNE EXISTE : la migration précédente a rendu le centre
-- de démonstration crédible en écrivant des sauts d'historique, des brevets
-- et des qualifications sur TOUS les licenciés actifs de BigAir. Elle a donc
-- écrit sur un profil réel, à jour, qui n'avait rien demandé — 501 sauts
-- inventés, un brevet D et un BPJEPS posés sur quelqu'un qui a 24 sauts.
--
-- Le tort a été réparé à l'identique (24 sauts, aucun brevet, aucune
-- qualification). Cette colonne existe pour que la faute ne soit pas
-- rejouable : tout script de peuplement doit filtrer dessus.
--
-- CE QUE CE N'EST PAS : un verrou. Le DT peut toujours éditer la fiche d'un
-- licencié depuis l'application, et c'est normal — poser un trigger qui
-- refuse toute écriture casserait une fonction légitime pour corriger une
-- erreur de script. Le garde-fou est à l'endroit du risque : les scripts.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

alter table profiles add column if not exists donnees_reelles boolean not null default false;

comment on column profiles.donnees_reelles is
  'Ce profil porte des donnees REELLES. Aucun script de peuplement ou de demonstration ne doit y ecrire : ni sauts d''historique, ni brevets, ni qualifications.';

update profiles set donnees_reelles = true where nom ilike 'PUYBAREAU';

commit;
-- APPLIQUÉE LE 26/09/2026.
