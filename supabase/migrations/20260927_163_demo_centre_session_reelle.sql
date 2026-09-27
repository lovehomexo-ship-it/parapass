-- Appliquée en base : royan_mot_de_passe_et_demo_reelle
--
-- LA DÉMONSTRATION CENTRE OUVRE DÉSORMAIS UNE SESSION RÉELLE SUR ROYAN.
--
-- Choix assumé du propriétaire : ce que le centre modifie doit se voir aussitôt
-- dans la démonstration, sans second jeu de données à tenir à jour.
--
-- LA CONTREPARTIE, ÉCRITE ICI POUR QU'ELLE NE SE DÉCOUVRE PAS PLUS TARD : le
-- bouton est public, donc un visiteur agit SOUS L'IDENTITÉ de l'administrateur
-- de Royan. Il peut valider un saut, clore une rotation, changer un réglage —
-- et cela reste.
--
-- Ce qui rend le compromis tenable : Royan ne contient AUCUNE donnée réelle.
-- Le centre porte `is_demo`, aucun de ses licenciés ne porte `donnees_reelles`,
-- et les deux profils réels de la base (PUYBAREAU, MARTIN) n'y ont ni compte
-- d'encadrement ni matériel. Rien de personnel n'est donc exposé.
--
-- Le compte doit rester un administrateur ORDINAIRE : `is_demo` déclencherait
-- les politiques `no_demo_*` et plus rien ne serait enregistré — exactement
-- l'inverse de ce qui est recherché.
update profiles set is_demo = false, est_demo = false
where email = 'royan.admin@parapass.fr';

-- Le mot de passe du compte est fixé en base (migration
-- `royan_mot_de_passe_et_demo_reelle`) et non recopié dans le dépôt.
