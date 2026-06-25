
-- Fix: allow admin_centre to validate sauts of their licenciés.
-- The existing UPDATE policy only allows 'moniteur' and 'admin' roles,
-- silently blocking every validation attempt by admin_centre users.

-- Drop the old policy and replace with one that includes admin_centre
DROP POLICY IF EXISTS "Moniteurs can update sauts for validation" ON public.sauts;

CREATE POLICY "Moniteurs and admins can update sauts for validation"
ON public.sauts FOR UPDATE
TO authenticated
USING (
  -- Moniteur who owns the saut record
  moniteur_id = auth.uid()
  -- Global roles
  OR get_my_role() = ANY (ARRAY['moniteur', 'admin'])
  -- admin_centre: can only update sauts of their own licenciés
  OR (
    get_my_role() = 'admin_centre'
    AND is_my_licencie(parachutiste_id)
  )
)
WITH CHECK (
  moniteur_id = auth.uid()
  OR get_my_role() = ANY (ARRAY['moniteur', 'admin'])
  OR (
    get_my_role() = 'admin_centre'
    AND is_my_licencie(parachutiste_id)
  )
);
