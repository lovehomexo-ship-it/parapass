-- Appliquée en base : feu_vert_separe_le_dossier_de_l_embarquement
--                   + regles_en_vigueur_ne_fige_plus_ses_colonnes
--
-- FEU VERT RÉPONDAIT À DEUX QUESTIONS À LA FOIS, DONC À AUCUNE.
--
-- « Cette personne est-elle en règle ? » et « peut-elle sauter maintenant ? »
-- ne sont pas la même question. La seconde dépend du jour : briefing acquitté,
-- vent face au brevet, vérification du principal. Hors d'une planche ces faits
-- N'EXISTENT PAS, et le moteur — fidèle à P1 — les rend « indisponible ».
--
-- Conséquence : tant qu'un licencié n'est pas avionné, son verdict est GRIS.
-- Sur une liste, tous les feux sont donc éteints en permanence. Un voyant
-- toujours gris ne vaut pas mieux qu'un voyant absent : il coûte la place et
-- l'attention.
--
-- ON SÉPARE LES DEUX MOMENTS. Aucune règle ne disparaît, aucune ne change de
-- gravité — on dit seulement QUAND chacune peut être répondue. La planche
-- continue de toutes les évaluer.
alter table regles_securite
  add column if not exists moment text not null default 'dossier'
  check (moment in ('dossier','embarquement'));

comment on column regles_securite.moment is
  'Quand la regle peut etre repondue. `dossier` : n''importe quel jour, sur pieces. `embarquement` : seulement au pied de l''avion. Ce n''est pas la regle, c''est le moment ou elle devient evaluable.';

update regles_securite set moment = 'embarquement'
 where code in ('BRF-001','BRV-001','MAT-003','ENC-001','EQP-001');
update regles_securite set moment = 'dossier'
 where code in ('LIC-001','MED-001','MIN-001','MAT-001','MAT-002',
                'QUA-001','QUA-002','VOI-001','REP-001');

-- UN PIÈGE QUE LA MIGRATION PRÉCÉDENTE A DÉCLENCHÉ. `regles_en_vigueur` promet
-- `setof regles_securite` mais énumérait ses colonnes une par une : ajouter une
-- colonne à la table la casse instantanément (« returns too few columns »), et
-- avec elle TOUT Feu Vert, puisque chaque verdict passe par là. Une fonction qui
-- promet le type d'une table doit suivre cette table.
create or replace function regles_en_vigueur(p_centre_id uuid)
returns setof regles_securite language sql stable as $function$
  with candidates as (
    select r.*, row_number() over (
      partition by r.code order by (r.centre_id is not null) desc, r.version desc) as rang
    from regles_securite r
    where r.centre_id is null or r.centre_id = p_centre_id
  )
  select c.id, c.code, c.version, c.libelle, c.source_texte, c.gravite, c.levable,
         c.habilitation_levee, c.effet_levee, c.duree_levee, c.portee, c.actif,
         c.centre_id, c.cree_le, c.moment
  from candidates c where c.rang = 1 and c.actif
  order by c.gravite desc, c.code
$function$;

-- Corps complets en base : `verdict_dossier`, `verdicts_dossier`.
