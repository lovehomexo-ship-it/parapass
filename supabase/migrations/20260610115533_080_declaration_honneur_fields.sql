-- Profiles: track declaration sur l'honneur
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS declaration_honneur_faite BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS declaration_honneur_nb INTEGER,
  ADD COLUMN IF NOT EXISTS declaration_honneur_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declaration_honneur_methode TEXT;

-- Sauts: track declared jump count for declaration_honneur rows
ALTER TABLE sauts
  ADD COLUMN IF NOT EXISTS nb_sauts_declares INTEGER;

-- Extend the statut check constraint to include 'declaration_honneur'
ALTER TABLE sauts DROP CONSTRAINT IF EXISTS sauts_statut_check;
ALTER TABLE sauts ADD CONSTRAINT sauts_statut_check
  CHECK (statut IN ('en_attente', 'valide', 'refuse', 'historique', 'declaration_honneur'));
