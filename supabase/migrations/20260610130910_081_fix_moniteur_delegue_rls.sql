-- Fix validation circuit for moniteur_delegue role
-- Bugs: Kevin (moniteur_delegue) can't read licencies_centres, sauts, or profiles of his centre

-- ── Helper functions ──────────────────────────────────────────────────────────

-- Returns true if the current user has an active delegation in the given centre
CREATE OR REPLACE FUNCTION has_active_delegation_in_centre(c_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM delegations_validation dv
    WHERE dv.moniteur_id = auth.uid()
      AND dv.centre_id = c_id
      AND dv.actif = true
      AND (dv.date_expiration IS NULL OR dv.date_expiration > now())
  );
$$;

-- Returns true if the current user has an active delegation in a centre where para_id is an active licencie
CREATE OR REPLACE FUNCTION has_delegation_for_licencie(para_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM delegations_validation dv
    JOIN licencies_centres lc ON lc.centre_id = dv.centre_id
    WHERE dv.moniteur_id = auth.uid()
      AND dv.actif = true
      AND (dv.date_expiration IS NULL OR dv.date_expiration > now())
      AND lc.parachutiste_id = para_id
      AND lc.statut = 'actif'
  );
$$;

-- ── licencies_centres: let moniteur_delegue read licencies of their centre ────

CREATE POLICY "Moniteur_delegue can read licencies of delegated centre"
  ON licencies_centres FOR SELECT
  TO authenticated
  USING (has_active_delegation_in_centre(centre_id));

-- ── sauts SELECT: let moniteur_delegue read sauts of their centre's licencies ─

CREATE POLICY "Moniteur_delegue can read sauts of delegated centre"
  ON sauts FOR SELECT
  TO authenticated
  USING (has_delegation_for_licencie(parachutiste_id));

-- ── sauts UPDATE: let moniteur_delegue validate sauts of their centre ─────────

CREATE POLICY "Moniteur_delegue can validate sauts of delegated centre"
  ON sauts FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'moniteur_delegue'
    AND has_delegation_for_licencie(parachutiste_id)
  )
  WITH CHECK (
    get_my_role() = 'moniteur_delegue'
    AND has_delegation_for_licencie(parachutiste_id)
  );

-- ── profiles SELECT: let moniteur_delegue read licencies + DT profiles ────────

CREATE POLICY "Moniteur_delegue can read profiles in delegated centre"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'moniteur_delegue'
    AND (
      -- Licencies of their centre
      has_delegation_for_licencie(id)
      OR
      -- DT of their delegation
      id IN (
        SELECT dv.dt_id FROM delegations_validation dv
        WHERE dv.moniteur_id = auth.uid()
          AND dv.actif = true
      )
    )
  );
