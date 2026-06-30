-- Migration 092 : Modules optionnels par centre
-- Tables : centre_modules (actifs) + module_waitlist (roadmap)

-- ── Modules actifs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS centre_modules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id     uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  module_id     text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  activated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_id, module_id)
);

ALTER TABLE centre_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "centre_modules_select" ON centre_modules
  FOR SELECT USING (
    centre_id IN (
      SELECT centre_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "centre_modules_insert" ON centre_modules
  FOR INSERT WITH CHECK (
    centre_id IN (
      SELECT centre_id FROM profiles WHERE id = auth.uid()
        AND role IN ('admin_centre', 'admin')
    )
  );

CREATE POLICY "centre_modules_update" ON centre_modules
  FOR UPDATE USING (
    centre_id IN (
      SELECT centre_id FROM profiles WHERE id = auth.uid()
        AND role IN ('admin_centre', 'admin')
    )
  );

CREATE POLICY "centre_modules_delete" ON centre_modules
  FOR DELETE USING (
    centre_id IN (
      SELECT centre_id FROM profiles WHERE id = auth.uid()
        AND role IN ('admin_centre', 'admin')
    )
  );

-- ── Liste d'attente roadmap ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id  uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  module_id  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_id, module_id)
);

ALTER TABLE module_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_waitlist_select" ON module_waitlist
  FOR SELECT USING (
    centre_id IN (
      SELECT centre_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "module_waitlist_insert" ON module_waitlist
  FOR INSERT WITH CHECK (
    centre_id IN (
      SELECT centre_id FROM profiles WHERE id = auth.uid()
        AND role IN ('admin_centre', 'admin')
    )
  );

CREATE POLICY "module_waitlist_delete" ON module_waitlist
  FOR DELETE USING (
    centre_id IN (
      SELECT centre_id FROM profiles WHERE id = auth.uid()
        AND role IN ('admin_centre', 'admin')
    )
  );
