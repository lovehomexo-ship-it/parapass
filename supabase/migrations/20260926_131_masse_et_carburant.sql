-- ═══════════════════════════════════════════════════════════════════════════
-- AVIONNAGE 4/4 — la masse embarquée et le carburant.
--
-- Un manifest professionnel affiche « 875 kg, 10/10 pax, 9 voiles · 320 L ·
-- 2588 kg ». Nous comptions des SIÈGES. Or un avion se remplit par la masse
-- avant de se remplir par les places : dix personnes légères passent là où
-- huit lourdes ne passent pas.
--
-- SUR P5 — AUCUNE DONNÉE DE SANTÉ. La masse d'un sauteur n'est pas une donnée
-- de santé : elle ne porte ni diagnostic, ni motif, ni aptitude. C'est une
-- donnée OPÉRATIONNELLE de chargement, celle que tout manifest inscrit sur la
-- feuille de l'avion. Elle est nullable, saisie par le centre, et n'entre dans
-- AUCUNE règle de conformité. Si elle devait un jour conditionner un verdict,
-- il faudrait s'arrêter et en reparler.
--
-- Masse à vide + carburant + sauteurs = masse au décollage. On stocke les
-- trois séparément : un total stocké se serait désynchronisé au premier
-- sauteur retiré.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

alter table profiles        add column if not exists masse_kg numeric(5,1);
alter table aeronefs        add column if not exists masse_a_vide_kg numeric(7,1);
alter table aeronefs        add column if not exists masse_max_kg numeric(7,1);
alter table rotations       add column if not exists carburant_litres integer;
-- Le tandem n'a pas de profil : sa masse se saisit sur la place.
alter table places_rotation add column if not exists masse_kg numeric(5,1);

alter table profiles drop constraint if exists profiles_masse_check;
alter table profiles add constraint profiles_masse_check
  check (masse_kg is null or masse_kg between 20 and 250);
alter table places_rotation drop constraint if exists places_rotation_masse_check;
alter table places_rotation add constraint places_rotation_masse_check
  check (masse_kg is null or masse_kg between 20 and 250);
alter table rotations drop constraint if exists rotations_carburant_check;
alter table rotations add constraint rotations_carburant_check
  check (carburant_litres is null or carburant_litres between 0 and 5000);

comment on column profiles.masse_kg is
  'Masse operationnelle pour le chargement de l''aeronef. PAS une donnee de sante : aucun diagnostic, aucun motif, aucune regle de conformite ne la lit.';
comment on column aeronefs.masse_max_kg is
  'Masse maximale au decollage. Sert a dire quand l''avion est plein en masse, pas seulement en sieges.';

commit;

-- APPLIQUEE LE 26/09/2026 apres validation (demande masse au check-in).
