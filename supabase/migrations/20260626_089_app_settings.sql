-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 089 : Table app_settings + fonction set_maintenance_mode
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_settings (
  key   text NOT NULL PRIMARY KEY,
  value text NOT NULL
);

-- Seed
INSERT INTO public.app_settings (key, value)
VALUES ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- RLS : lecture publique, aucune écriture directe côté client
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_public_read" ON public.app_settings;
CREATE POLICY "app_settings_public_read" ON public.app_settings
  FOR SELECT USING (true);

-- Fonction SECURITY DEFINER : valide le secret côté serveur avant d'écrire
CREATE OR REPLACE FUNCTION public.set_maintenance_mode(p_secret text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_secret <> 'FP@ParaPass2026' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_value NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'Invalid value — must be true or false';
  END IF;
  UPDATE public.app_settings SET value = p_value WHERE key = 'maintenance_mode';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_maintenance_mode(text, text) TO anon, authenticated;
