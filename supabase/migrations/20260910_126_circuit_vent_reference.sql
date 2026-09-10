-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUIT — vent de référence.
--
-- « Main droite » s'utilise par vent d'est, « main gauche » par vent d'ouest.
-- Cette condition d'emploi vivait dans la tête du DT ; elle vit désormais
-- avec le circuit.
--
-- CE QUE CETTE COLONNE N'EST PAS : le vent du jour. Le vent du jour est UNE
-- mesure, portée par le briefing (dz_briefings.vent_direction_deg). C'est lui
-- qui décide du circuit, jamais l'inverse. Un circuit qui imposerait son vent
-- ferait publier une direction que personne n'a observée.
--
-- Nullable : les circuits existants n'en déclarent pas, et une valeur inventée
-- vaudrait moins que pas de valeur du tout.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

alter table dz_circuits
  add column if not exists vent_reference_deg integer;

alter table dz_circuits
  drop constraint if exists dz_circuits_vent_reference_deg_check;
alter table dz_circuits
  add constraint dz_circuits_vent_reference_deg_check
  check (vent_reference_deg is null or vent_reference_deg between 0 and 359);

comment on column dz_circuits.vent_reference_deg is
  'Vent (d''où il vient, °) pour lequel ce circuit est prévu. Condition d''emploi, PAS le vent du jour — celui-ci vit dans dz_briefings.';

commit;

-- APPLIQUÉE LE 10/09/2026 après validation.
