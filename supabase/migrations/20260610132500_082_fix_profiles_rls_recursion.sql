
-- Fix infinite recursion (42P17) caused by:
--   "Moniteur_delegue can read profiles" policy → inline SELECT on delegations_validation
--   → triggers "Admin can view all delegations" policy → SELECT on profiles → loop

-- Step 1: Drop the broken policy
DROP POLICY IF EXISTS "Moniteur_delegue can read profiles in delegated centre" ON profiles;

-- Step 2: SECURITY DEFINER function to fetch DT IDs from delegations_validation
--         without triggering delegations_validation RLS (which reads profiles)
CREATE OR REPLACE FUNCTION get_my_delegation_dt_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT dv.dt_id
  FROM delegations_validation dv
  WHERE dv.moniteur_id = auth.uid()
    AND dv.actif = true;
$$;

-- Step 3: Recreate the policy using only SECURITY DEFINER helpers (no direct table access)
CREATE POLICY "Moniteur_delegue can read profiles in delegated centre"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'moniteur_delegue'
    AND (
      has_delegation_for_licencie(id)
      OR id = ANY(SELECT get_my_delegation_dt_ids())
    )
  );
