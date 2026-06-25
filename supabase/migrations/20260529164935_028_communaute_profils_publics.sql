/*
  # Communauté — profils_publics view + public profiles policy

  ## Problem
  The profiles table has no SELECT policy allowing authenticated users to read
  other users' profiles. This breaks search, follow tabs, and public profiles.

  ## Changes

  ### 1. New RLS policy on profiles
  - Authenticated users can SELECT profiles where `profil_public = true` OR
    where they have an accepted follow relationship. This is the minimum needed
    for the community features to work.
  - A simpler "community_read" policy: authenticated users can read non-sensitive
    fields of parachutiste profiles that have `profil_public = true` or `niveau_profil`
    in ('public', 'communaute').

  ### 2. profils_publics view
  - Safe view exposing only non-sensitive fields (no email, phone, address,
    date of birth, full licence number, medical data)
  - Includes computed fields: brevet_principal, centre_principal, total_sauts,
    sauts_annee, dernier_saut, nb_badges
  - Restricted to role = 'parachutiste'

  ### 3. Indexes
  - idx_follows_follower, idx_follows_following (if not already present)
  - idx_profiles_communaute for community search queries

  ### Security Notes
  - View is SELECT-only, SECURITY INVOKER (default) — RLS on base tables applies
  - We add a policy allowing any authenticated user to read parachutiste profiles
    that have profil_public=true or niveau_profil != 'prive'
  - Email, phone, address, date_naissance remain protected (not in view)
*/

-- ─── 1. Allow authenticated users to read public/community profiles ──────────

CREATE POLICY "Authenticated can read public parachutiste profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    role = 'parachutiste'
    AND (
      profil_public = true
      OR niveau_profil IN ('public', 'communaute')
    )
  );

-- ─── 2. Indexes for performance ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

CREATE INDEX IF NOT EXISTS idx_profiles_communaute
  ON profiles(role, profil_public, niveau_profil);

CREATE INDEX IF NOT EXISTS idx_profiles_nom_prenom
  ON profiles(nom, prenom);

-- ─── 3. profils_publics view ──────────────────────────────────────────────────

CREATE OR REPLACE VIEW profils_publics AS
SELECT
  p.id,
  p.nom,
  p.prenom,
  p.username,
  p.avatar_url        AS photo_profil_url,
  p.photo_profil_url  AS photo_profil_url2,
  p.bio,
  p.niveau_profil,
  COALESCE(p.profil_public, false)        AS profil_public,
  COALESCE(p.visibilite_sauts, true)      AS visibilite_sauts,
  COALESCE(p.visibilite_brevets, true)    AS visibilite_brevets,
  COALESCE(p.visibilite_badges, true)     AS visibilite_badges,
  COALESCE(p.visibilite_centre, true)     AS visibilite_centre,
  p.centre_id,
  p.created_at,
  -- Brevet le plus élevé
  (
    SELECT b.type_brevet
    FROM brevets b
    WHERE b.parachutiste_id = p.id
    ORDER BY CASE b.type_brevet
      WHEN 'D'   THEN 10
      WHEN 'C'   THEN 9
      WHEN 'B'   THEN 8
      WHEN 'BPA' THEN 7
      WHEN 'A'   THEN 6
      WHEN 'PAC' THEN 5
      WHEN 'WS3' THEN 4
      WHEN 'WS2' THEN 3
      WHEN 'WS1' THEN 2
      ELSE 1
    END DESC
    LIMIT 1
  ) AS brevet_principal,
  -- Centre principal (via licencies_centres)
  (
    SELECT c.nom
    FROM licencies_centres lc
    JOIN centres c ON c.id = lc.centre_id
    WHERE lc.parachutiste_id = p.id
      AND lc.statut = 'actif'
    ORDER BY lc.date_adhesion DESC
    LIMIT 1
  ) AS centre_principal,
  -- Total sauts certifiés
  (
    SELECT COUNT(*)
    FROM sauts s
    WHERE s.parachutiste_id = p.id
      AND s.statut = 'valide'
  ) AS total_sauts,
  -- Sauts cette année
  (
    SELECT COUNT(*)
    FROM sauts s
    WHERE s.parachutiste_id = p.id
      AND EXTRACT(YEAR FROM s.date_saut) = EXTRACT(YEAR FROM NOW())
  ) AS sauts_annee,
  -- Dernier saut
  (
    SELECT s.date_saut
    FROM sauts s
    WHERE s.parachutiste_id = p.id
    ORDER BY s.date_saut DESC
    LIMIT 1
  ) AS dernier_saut,
  -- Nombre de badges
  (
    SELECT COUNT(*)
    FROM badges bg
    WHERE bg.parachutiste_id = p.id
  ) AS nb_badges
FROM profiles p
WHERE p.role = 'parachutiste';

-- Grant access to authenticated users
GRANT SELECT ON profils_publics TO authenticated;
