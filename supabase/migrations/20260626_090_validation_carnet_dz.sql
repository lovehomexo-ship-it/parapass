-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 090 : Validation carnet côté DZ
-- Ajoute les colonnes carnet_* à licencies_centres
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.licencies_centres
  ADD COLUMN IF NOT EXISTS carnet_statut     text NOT NULL DEFAULT 'en_attente'
    CHECK (carnet_statut IN ('en_attente', 'valide', 'refuse')),
  ADD COLUMN IF NOT EXISTS carnet_valide_par    text,
  ADD COLUMN IF NOT EXISTS carnet_date_validation date,
  ADD COLUMN IF NOT EXISTS carnet_signature_url  text,
  ADD COLUMN IF NOT EXISTS carnet_tampon_url     text,
  ADD COLUMN IF NOT EXISTS carnet_motif_refus    text;

-- Index utile pour les queries DZ
CREATE INDEX IF NOT EXISTS idx_licencies_centres_carnet_statut
  ON public.licencies_centres (centre_id, carnet_statut);

-- ─── RLS : admin_centre peut mettre à jour les carnets de son centre ─────────

-- Politique UPDATE pour admin_centre
DROP POLICY IF EXISTS "admin_centre_update_carnet" ON public.licencies_centres;
CREATE POLICY "admin_centre_update_carnet"
  ON public.licencies_centres
  FOR UPDATE
  USING (
    centre_id IN (
      SELECT centre_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    centre_id IN (
      SELECT centre_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Politique SELECT pour parachutiste (ses propres lignes)
DROP POLICY IF EXISTS "parachutiste_read_own_licencies" ON public.licencies_centres;
CREATE POLICY "parachutiste_read_own_licencies"
  ON public.licencies_centres
  FOR SELECT
  USING (parachutiste_id = auth.uid());

-- Politique SELECT pour admin_centre (toutes les lignes de son centre)
DROP POLICY IF EXISTS "admin_centre_read_licencies" ON public.licencies_centres;
CREATE POLICY "admin_centre_read_licencies"
  ON public.licencies_centres
  FOR SELECT
  USING (
    centre_id IN (
      SELECT centre_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ─── Autoriser lecture profils admin_centre pour envoi notification ───────────
-- Le parachutiste doit pouvoir trouver l'admin de son centre pour lui notifier
DROP POLICY IF EXISTS "read_centre_admin_profile" ON public.profiles;
CREATE POLICY "read_centre_admin_profile"
  ON public.profiles
  FOR SELECT
  USING (
    role = 'admin_centre'
    OR id = auth.uid()
    OR is_demo = true
  );
