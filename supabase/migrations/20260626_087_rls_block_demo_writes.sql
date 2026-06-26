-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 087 : Bloquer les écritures des comptes démo au niveau RLS
--
-- Utilise des RESTRICTIVE policies (PostgreSQL 15+) qui s'appliquent même si
-- une politique permissive autorise l'accès. Le résultat final est AND-é avec
-- les politiques permissives existantes.
-- ─────────────────────────────────────────────────────────────────────────────

-- Fonction : true si l'utilisateur courant est un compte démo
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_demo FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- ── sauts ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "no_demo_insert_sauts"  ON public.sauts;
DROP POLICY IF EXISTS "no_demo_update_sauts"  ON public.sauts;
DROP POLICY IF EXISTS "no_demo_delete_sauts"  ON public.sauts;

CREATE POLICY "no_demo_insert_sauts" ON public.sauts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user());

CREATE POLICY "no_demo_update_sauts" ON public.sauts
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user());

CREATE POLICY "no_demo_delete_sauts" ON public.sauts
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user());

-- ── profiles ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "no_demo_update_profiles"  ON public.profiles;

CREATE POLICY "no_demo_update_profiles" ON public.profiles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user());

-- ── materiels ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "no_demo_insert_materiels"  ON public.materiels;
DROP POLICY IF EXISTS "no_demo_update_materiels"  ON public.materiels;
DROP POLICY IF EXISTS "no_demo_delete_materiels"  ON public.materiels;

CREATE POLICY "no_demo_insert_materiels" ON public.materiels
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user());

CREATE POLICY "no_demo_update_materiels" ON public.materiels
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user());

CREATE POLICY "no_demo_delete_materiels" ON public.materiels
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user());

-- ── maintenances ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "no_demo_insert_maintenances"  ON public.maintenances;
DROP POLICY IF EXISTS "no_demo_update_maintenances"  ON public.maintenances;
DROP POLICY IF EXISTS "no_demo_delete_maintenances"  ON public.maintenances;

CREATE POLICY "no_demo_insert_maintenances" ON public.maintenances
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user());

CREATE POLICY "no_demo_update_maintenances" ON public.maintenances
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user());

CREATE POLICY "no_demo_delete_maintenances" ON public.maintenances
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user());

-- ── licences ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "no_demo_insert_licences"  ON public.licences;
DROP POLICY IF EXISTS "no_demo_update_licences"  ON public.licences;
DROP POLICY IF EXISTS "no_demo_delete_licences"  ON public.licences;

CREATE POLICY "no_demo_insert_licences" ON public.licences
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user());

CREATE POLICY "no_demo_update_licences" ON public.licences
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user());

CREATE POLICY "no_demo_delete_licences" ON public.licences
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user());

-- ── certificats_medicaux ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "no_demo_insert_certificats"  ON public.certificats_medicaux;
DROP POLICY IF EXISTS "no_demo_update_certificats"  ON public.certificats_medicaux;
DROP POLICY IF EXISTS "no_demo_delete_certificats"  ON public.certificats_medicaux;

CREATE POLICY "no_demo_insert_certificats" ON public.certificats_medicaux
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user());

CREATE POLICY "no_demo_update_certificats" ON public.certificats_medicaux
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user());

CREATE POLICY "no_demo_delete_certificats" ON public.certificats_medicaux
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user());

-- ── brevets ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "no_demo_insert_brevets"  ON public.brevets;
DROP POLICY IF EXISTS "no_demo_update_brevets"  ON public.brevets;
DROP POLICY IF EXISTS "no_demo_delete_brevets"  ON public.brevets;

CREATE POLICY "no_demo_insert_brevets" ON public.brevets
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user());

CREATE POLICY "no_demo_update_brevets" ON public.brevets
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user());

CREATE POLICY "no_demo_delete_brevets" ON public.brevets
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user());

-- ── modules_brevets ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "no_demo_upsert_modules"  ON public.modules_brevets;

CREATE POLICY "no_demo_upsert_modules" ON public.modules_brevets
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user());

CREATE POLICY "no_demo_update_modules" ON public.modules_brevets
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user());
