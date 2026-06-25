CREATE TABLE IF NOT EXISTS validations_pliage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sac_id UUID REFERENCES sacs_parachute(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  plieur_id UUID REFERENCES profiles(id),
  type_pliage TEXT DEFAULT 'non_renseigne',
  plieur_nom_libre TEXT,
  valide_par_plieur BOOLEAN DEFAULT false,
  date_pliage TIMESTAMPTZ,
  tarif_pliage DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sauts ADD COLUMN IF NOT EXISTS type_pliage TEXT DEFAULT 'non_renseigne';
