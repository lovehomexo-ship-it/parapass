-- Add 'historique' status for OCR-imported jumps
ALTER TABLE public.sauts DROP CONSTRAINT IF EXISTS sauts_statut_check;
ALTER TABLE public.sauts ADD CONSTRAINT sauts_statut_check
  CHECK (statut = ANY (ARRAY['en_attente'::text, 'valide'::text, 'refuse'::text, 'historique'::text]));

-- Add source tracking and free-text moniteur name for OCR imports
ALTER TABLE public.sauts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manuel';
ALTER TABLE public.sauts ADD COLUMN IF NOT EXISTS moniteur_nom_libre TEXT;
