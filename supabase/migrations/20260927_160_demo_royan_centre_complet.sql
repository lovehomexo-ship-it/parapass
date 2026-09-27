-- ═══════════════════════════════════════════════════════════════════════════
-- ROYAN OCÉAN PARACHUTISME — SECOND CENTRE DE DÉMONSTRATION
--
-- Appliquée en base sous la forme de huit migrations successives :
--   comptes_demo_royan, royan_identite_flotte_parc, royan_licencies,
--   royan_historique_sauts, royan_modules_qualifs_zone_tandem,
--   royan_academie_progression, royan_parc_permanent_et_plieurs,
--   reparer_generer_demo_journee, demo_pliage_sacs_avec_surface.
--
-- POURQUOI UN SECOND CENTRE. Une seule DZ ne montre jamais le cas qui casse :
-- deux centres qui partagent des licenciés, et une validation qui doit rester
-- chez celui où le saut a eu lieu. Six profils de BigAir sont donc adhérents
-- des deux clubs — les MÊMES profils, pas des homonymes.
--
-- CE QUE CE FICHIER NE CONTIENT PAS. Le corps complet du peuplement (≈ 5 900
-- sauts, 20 licenciés, flotte, parc, zone, tandem, académie, journal) vit dans
-- l'historique de migrations Supabase, sous les noms ci-dessus. Il n'est pas
-- recopié ici pour une raison précise : il crée des comptes
-- d'authentification avec un mot de passe, et un dépôt Git n'est pas l'endroit
-- où écrit un mot de passe. Les identifiants se lisent dans Supabase, ou se
-- redéfinissent depuis l'écran de connexion.
--
-- CE FICHIER NE FAIT QUE MARQUER LE CENTRE ET SES GARDE-FOUS.
-- ═══════════════════════════════════════════════════════════════════════════

-- Le centre est une DÉMONSTRATION et le dit : `is_demo` l'exclut des
-- statistiques de conformité, comme SkyDive Atlantique.
update centres set is_demo = true
where id = '1d92899c-1d37-49c9-a64d-5dd2999ddd7b';

-- Son agrément était recopié de BigAir (FFP-0917). Deux centres ne portent
-- jamais le même numéro ; celui-ci est explicitement fictif.
update centres set numero_agrement_ffp = 'DEMO-FFP-1760'
where id = '1d92899c-1d37-49c9-a64d-5dd2999ddd7b'
  and numero_agrement_ffp = 'FFP-0917';

-- SUR LE LOGO. Royan Océan Parachutisme est une VRAIE école. Reprendre sa
-- marque dans une démonstration ferait croire qu'elle est cliente de ParaPass.
-- L'emblème posé en base est dessiné pour l'occasion, neutre, et se remplace
-- en un clic par le vrai le jour où l'école y consent.
