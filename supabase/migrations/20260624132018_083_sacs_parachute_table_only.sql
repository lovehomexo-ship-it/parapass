CREATE TABLE IF NOT EXISTS sacs_parachute (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  centre_id UUID REFERENCES centres(id),
  qr_code_token TEXT UNIQUE NOT NULL,
  marque TEXT,
  modele TEXT,
  numero_serie TEXT,
  est_plieur_qualifie BOOLEAN DEFAULT false,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
