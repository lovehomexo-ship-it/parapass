-- Appliquée en base : acquitter_une_regle_levable, verdicts_lisent_les_acquittements,
--   retirer_les_anciennes_signatures_de_verdict, acquittement_respecte_l_habilitation
--
-- LE MÉCANISME EXISTAIT, IL N'ÉTAIT BRANCHÉ NULLE PART.
--
-- Le référentiel déclare depuis le début, pour chaque règle : `levable`, PAR QUI
-- (`habilitation_levee`), AVEC QUEL EFFET (`effet_levee`), POUR COMBIEN DE TEMPS
-- (`duree_levee`). La table `derogations` était là, vide. Et
-- `verdict_conformite` ne l'a jamais lue.
--
-- Conséquence à l'écran : le casque d'un non-breveté et la vérification du
-- principal restaient en alerte toute la journée, sans aucun moyen de dire
-- « c'est constaté ». La planche criait en permanence — et une planche qui crie
-- toujours n'alerte plus de rien.
--
-- CE QUI NE S'ACQUITTE PAS RESTE INACQUITTABLE : licence, médical, pliage du
-- secours, mineur, qualifications, DT 48. `levable = false`, la base refuse.
--
-- LA PORTÉE EST CELLE DU RÉFÉRENTIEL. `une_rotation` ne vaut que pour la
-- planche visée — d'où `derogations.rotation_id`. Une levée accordée sur
-- l'avion n°1 ne suit pas la personne dans l'avion n°2.
--
-- L'HABILITATION AUSSI : DT -> administrateur du centre, moniteur -> encadrant,
-- plieur -> plieur habilité ou le DT qui atteste à sa place. Une habilitation
-- qui ne conditionne rien n'est pas une habilitation.
--
-- UN PIÈGE AU PASSAGE : ajouter un paramètre à défaut ne REMPLACE pas une
-- fonction, il la SURCHARGE. Les anciennes signatures à quatre arguments
-- rendaient tout appel ambigu (« function ... is not unique ») et l'écran
-- remontait l'erreur au premier acquittement. Elles sont retirées.
--
-- Corps complets en base : `acquitter_regle`, `retirer_acquittement`,
-- `verdict_conformite`, `verdicts_du_jour`, `acquittements_du_jour`.
alter table derogations add column if not exists rotation_id uuid
  references rotations(id) on delete cascade;

comment on column derogations.rotation_id is
  'Planche visee quand la regle se leve « une_rotation ». NULL = la levee vaut pour la journee entiere.';

create index if not exists derogations_lecture_idx
  on derogations (centre_id, parachutiste_id, date_validite);
