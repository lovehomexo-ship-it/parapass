
-- Allow admin_centre to update the role of their own licenciés.
-- Needed so BigAir Admin can promote a parachutiste to moniteur_delegue.

-- 1. Policy: admin_centre can update role of their licenciés
CREATE POLICY "admin_centre can update licencie role"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  get_my_role() = 'admin_centre'
  AND is_my_licencie(id)
)
WITH CHECK (
  get_my_role() = 'admin_centre'
  AND is_my_licencie(id)
);

-- 2. Allow admin_centre to insert delegations (acting as dt_id = themselves).
--    The existing "DT can create delegations" policy requires dt_id = auth.uid(),
--    which already works — admin_centre just sets themselves as dt.
--    No additional policy needed for INSERT.

-- 3. Allow admin_centre to update (revoke) delegations they created.
CREATE POLICY "admin_centre can update own delegations"
ON public.delegations_validation FOR UPDATE
TO authenticated
USING (
  dt_id = auth.uid()
  OR (
    get_my_role() = 'admin_centre'
    AND is_my_licencie(moniteur_id)
  )
)
WITH CHECK (
  dt_id = auth.uid()
  OR (
    get_my_role() = 'admin_centre'
    AND is_my_licencie(moniteur_id)
  )
);

-- 4. Enable realtime on profiles so role changes propagate live
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
