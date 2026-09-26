-- ═══════════════════════════════════════════════════════════════════════════
-- PLACE — la radio.
--
-- Qui, dans cet avion, emporte une radio ? La question se pose surtout pour
-- les élèves : quelqu'un les guide au sol.
--
-- C'EST UN FAIT, PAS UNE RÈGLE. ParaPass ne connaît aucun texte fédéral
-- fixant l'obligation ni son seuil, et P2 interdit d'en inventer un : chaque
-- règle porte la référence qui la fonde, ou n'existe pas. L'écran constate
-- donc, et signale l'absence en progression — sans jamais dire « obligatoire ».
--
-- Le jour où la fédération fixe un seuil, il viendra du référentiel Feu Vert
-- avec sa référence, comme toutes les autres règles.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

alter table places_rotation add column if not exists radio boolean not null default false;

comment on column places_rotation.radio is
  'Cette personne emporte une radio. FAIT constate par la DZ, pas une regle : aucune reference federale ne la fonde dans ParaPass.';

commit;
-- APPLIQUEE LE 26/09/2026.
