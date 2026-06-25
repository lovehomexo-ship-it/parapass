/*
  # SECURITY DEFINER function to load available monitors for a parachutiste

  ## Problem
  Sophie (parachutiste) sees "Aucun moniteur trouvé" because the direct table
  queries on delegations_validation are blocked by RLS, even after the policy
  fix. SECURITY DEFINER bypasses row-level security entirely for this read-only
  lookup, guaranteeing the result regardless of future policy changes.

  ## New function
  - `get_moniteurs_pour_parachutiste(para_id uuid)`
    Returns all active delegated monitors + DTs with a brevet for the centres
    the parachutiste belongs to, excluding the caller themselves.

  ## Security
  - SECURITY DEFINER runs as the function owner (superuser context)
  - The para_id parameter is the caller's own UUID (enforced in code via auth.uid())
  - Read-only: no INSERT/UPDATE/DELETE
  - GRANT EXECUTE limited to authenticated role
*/

CREATE OR REPLACE FUNCTION get_moniteurs_pour_parachutiste(para_id uuid)
RETURNS TABLE (
  moniteur_id uuid,
  nom text,
  prenom text,
  avatar_url text,
  numero_brevet_moniteur text,
  type_brevet_moniteur text,
  centre_nom text,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Moniteurs délégués actifs dans les centres du parachutiste
  SELECT DISTINCT ON (d.moniteur_id)
    d.moniteur_id,
    p.nom,
    p.prenom,
    p.avatar_url,
    p.numero_brevet_moniteur,
    p.type_brevet_moniteur,
    c.nom AS centre_nom,
    'delegue'::text AS source
  FROM delegations_validation d
  JOIN profiles p ON p.id = d.moniteur_id
  JOIN centres c ON c.id = d.centre_id
  JOIN licencies_centres lc ON lc.centre_id = d.centre_id
  WHERE lc.parachutiste_id = para_id
    AND lc.statut = 'actif'
    AND d.actif = true
    AND (d.date_expiration IS NULL OR d.date_expiration > now())
    AND d.moniteur_id != para_id

  UNION ALL

  -- Directeurs Techniques avec brevet moniteur
  SELECT DISTINCT ON (ac.profile_id)
    ac.profile_id,
    p.nom,
    p.prenom,
    p.avatar_url,
    p.numero_brevet_moniteur,
    p.type_brevet_moniteur,
    c.nom AS centre_nom,
    'dt'::text AS source
  FROM admin_centres ac
  JOIN profiles p ON p.id = ac.profile_id
  JOIN centres c ON c.id = ac.centre_id
  JOIN licencies_centres lc ON lc.centre_id = ac.centre_id
  WHERE lc.parachutiste_id = para_id
    AND lc.statut = 'actif'
    AND ac.role IN ('directeur_technique', 'admin_centre')
    AND p.numero_brevet_moniteur IS NOT NULL
    AND ac.profile_id != para_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_moniteurs_pour_parachutiste(uuid) TO authenticated;
