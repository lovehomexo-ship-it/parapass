-- Appliquée en base : derogations_lisibles_par_qui_de_droit
--
-- `derogations` avait RLS active et AUCUNE POLITIQUE : personne ne pouvait la
-- lire. Les verdicts s'en sortaient parce qu'ils passent par des fonctions
-- SECURITY DEFINER, mais toute lecture directe rendait zéro ligne — en silence,
-- la pire façon d'échouer. Une levée qu'on ne peut pas relire n'a aucune valeur
-- de preuve.
drop policy if exists derogations_lecture_centre on derogations;
create policy derogations_lecture_centre on derogations for select to authenticated
  using (exists (select 1 from admin_centres a
                 where a.profile_id = auth.uid() and a.centre_id = derogations.centre_id)
         or parachutiste_id = auth.uid());

-- L'écriture reste réservée aux fonctions : `acquitter_regle` vérifie
-- l'habilitation déclarée au référentiel, ce qu'une politique ne saurait pas
-- faire. Aucune politique d'insertion n'est posée, volontairement.
comment on table derogations is
  'Levees de regles constatees par l''encadrement. Ecriture UNIQUEMENT via acquitter_regle(), qui controle l''habilitation declaree au referentiel. Lecture par le centre et par la personne concernee.';
