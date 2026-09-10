-- ═══════════════════════════════════════════════════════════════════════════
-- SAUT — le TYPE de sortie d'avion.
--
-- ATTENTION À NE PAS CONFONDRE avec la colonne sortie_avion, qui existe déjà :
-- celle-là note la QUALITÉ du geste (à retravailler / correct / bon) et nourrit
-- la progression. Elle ne dit pas ce qui a été fait, seulement si c'était bien
-- fait. « Flottante » et « bon » répondent à deux questions différentes ; les
-- mettre dans la même colonne aurait cassé la progression, qui lit la première.
--
-- Champ LIBRE, volontairement. Le vocabulaire des sorties varie d'un centre à
-- l'autre et d'une discipline à l'autre. L'écran propose des puces courantes ;
-- il n'impose aucune liste fermée, parce qu'une liste fausse coûte plus cher
-- qu'un champ libre.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

alter table sauts add column if not exists type_sortie_avion text;

comment on column sauts.type_sortie_avion is
  'Type de sortie d''avion (flottante, plongée, tenue…). Texte libre. NE PAS confondre avec sortie_avion, qui en note la qualité.';

commit;
