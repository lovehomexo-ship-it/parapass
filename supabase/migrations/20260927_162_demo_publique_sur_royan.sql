-- Appliquée en base : compte_demo_public_royan, auth_colonnes_nulles_bloquent_la_connexion,
--                     royan_journee_credible, royan_numero_licence_denormalise
--
-- LE BOUTON « EXPLORER EN TANT QUE CENTRE » OUVRAIT UNE DZ VIDE.
-- Il ouvre une VRAIE session, pas une maquette — mais sur SkyDive Atlantique :
-- un centre qui existe en base et ne contient rien. Zéro présent, aucun
-- briefing, météo indisponible. Un visiteur y voyait un produit incapable.
-- Il ouvre désormais Royan Océan Parachutisme.
--
-- DEUX COMPTES DISTINCTS, ET C'EST VOULU :
--   • `demo.centre@parapass.fr`, PUBLIC, porte `is_demo` : `is_demo_user()`
--     renvoie vrai et les politiques `no_demo_*` lui refusent toute écriture.
--     N'importe qui peut l'ouvrir, personne ne peut abîmer Royan ;
--   • `royan.admin@parapass.fr` est un admin ORDINAIRE, qui valide, clôture,
--     signe. C'est le compte d'essai, pas la vitrine.
update profiles set is_demo = false, est_demo = false
where email = 'royan.admin@parapass.fr';

-- UNE CONNEXION QUI ÉCHOUE SANS RIEN EXPLIQUER.
-- GoTrue lit ces colonnes comme des chaînes : une valeur NULL le fait échouer
-- avec « converting NULL to string is unsupported ». Le compte paraît pourtant
-- parfait — mot de passe bon, e-mail confirmé, identité présente. C'est ce qui
-- bloquait le compte de démonstration. On normalise sur TOUS les comptes : le
-- même piège attend le prochain créé à la main.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where confirmation_token is null or recovery_token is null
   or email_change is null or email_change_token_new is null
   or email_change_token_current is null or phone_change is null
   or phone_change_token is null or reauthentication_token is null;

-- UNE JOURNÉE CRÉDIBLE — NI TOUTE VERTE, NI TOUTE ROUGE.
-- Le tableau affichait « 2 / 24 présents prêts ». Le coupable n'était pas une
-- règle trop sévère : c'était BRF-001, briefing non acquitté, pour 22
-- personnes. Sur une vraie DZ on l'acquitte en arrivant. Corps complet en base
-- (migration `royan_journee_credible`). Restent volontairement en alerte : la
-- voile de Rémi sous le minimum DT 48, un certificat médical périmé, une
-- reprise après 200 jours, trois retardataires du briefing, un sac au
-- repliage du secours.
