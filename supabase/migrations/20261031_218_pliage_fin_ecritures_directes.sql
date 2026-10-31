-- Appliquée APRÈS la mise en ligne de l'écran qui passe par les fonctions de
-- la migration 217 : retirer ces droits plus tôt aurait cassé l'application
-- encore en service.
-- ── Les écritures directes ne passent plus ─────────────────────────────────
-- Tout passe par les fonctions ci-dessus, qui contrôlent et tracent. (L'auto-
-- pliage d'un parachute PERSONNEL garde sa règle propre, sur son matériel.)
drop policy if exists pliages_insert_licencie on public.pliages;
drop policy if exists sacs_plieur_update_etat on public.sacs_parachute;
drop policy if exists sacs_porteur_update_etat on public.sacs_parachute;
