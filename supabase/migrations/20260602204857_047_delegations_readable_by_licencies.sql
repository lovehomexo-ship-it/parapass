/*
  # Allow licenciés to read active delegations of their centres

  ## Problem
  Sophie (parachutiste) sees "Aucun moniteur trouvé" in the "Ajouter un saut"
  form because the RLS on delegations_validation has no policy allowing
  parachutistes to read delegations — only admins, DTs, and the moniteur
  themselves could read them.

  ## Change
  Add a SELECT policy so that any active licencié of a centre can read
  the active delegations for that centre. This is required for the saut
  submission form to show the list of available validators.

  ## Security
  - Read-only (SELECT only)
  - Scoped to the user's own centres via licencies_centres
  - Only active licenciés (statut = 'actif') get access
*/

CREATE POLICY "Licencies can view active delegations of their centres"
  ON delegations_validation
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM licencies_centres lc
      WHERE lc.parachutiste_id = auth.uid()
        AND lc.centre_id = delegations_validation.centre_id
        AND lc.statut = 'actif'
    )
  );
