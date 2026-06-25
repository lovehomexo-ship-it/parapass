ALTER TABLE sacs_parachute ENABLE ROW LEVEL SECURITY;
ALTER TABLE validations_pliage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sac_all_own" ON sacs_parachute FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "sac_select_centre_admin" ON sacs_parachute FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_centres ac
      WHERE ac.profile_id = auth.uid()
        AND ac.centre_id = sacs_parachute.centre_id
    )
  );

CREATE POLICY "sac_insert_centre_admin" ON sacs_parachute FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_centres ac
      WHERE ac.profile_id = auth.uid()
        AND ac.centre_id = sacs_parachute.centre_id
    )
  );

CREATE POLICY "sac_select_public" ON sacs_parachute FOR SELECT
  USING (actif = true);

CREATE POLICY "pliage_select_own" ON validations_pliage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pliage_select_centre_admin" ON validations_pliage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sacs_parachute sp
      JOIN admin_centres ac ON ac.centre_id = sp.centre_id
      WHERE sp.id = validations_pliage.sac_id
        AND ac.profile_id = auth.uid()
    )
  );

CREATE POLICY "pliage_insert_all" ON validations_pliage FOR INSERT
  WITH CHECK (true);
