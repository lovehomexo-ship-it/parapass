/*
  # Vérifier et corriger les orphelins dans jump_progression

  Supprime les lignes dont jump_id ne référence pas un saut existant,
  puis recharge le schéma.
*/

-- Supprimer les orphelins (jump_id sans saut correspondant)
DELETE FROM jump_progression
WHERE jump_id NOT IN (SELECT id FROM sauts);

-- Vérification : compte final pour Sophie
-- SELECT COUNT(*) FROM jump_progression
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sophie.martin@parapass.fr');

NOTIFY pgrst, 'reload schema';
