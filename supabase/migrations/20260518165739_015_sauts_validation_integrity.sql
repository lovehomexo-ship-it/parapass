/*
  # Champs d'intégrité cryptographique pour les sauts

  1. Modifications table "sauts"
     - validation_hash : SHA-256 de toutes les données au moment de la validation
     - validation_timestamp : horodatage UTC exact de la validation
     - validation_ip_hash : hash de l'IP du validateur (jamais l'IP en clair — RGPD)
     - validation_session_id : identifiant de session
     - certificat_url : URL du certificat PDF généré automatiquement

  2. Ces champs sont écrits une seule fois lors de la validation
     et ne doivent jamais être modifiés après.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='validation_hash') THEN
    ALTER TABLE sauts ADD COLUMN validation_hash text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='validation_timestamp') THEN
    ALTER TABLE sauts ADD COLUMN validation_timestamp timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='validation_ip_hash') THEN
    ALTER TABLE sauts ADD COLUMN validation_ip_hash text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='validation_session_id') THEN
    ALTER TABLE sauts ADD COLUMN validation_session_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sauts' AND column_name='certificat_url') THEN
    ALTER TABLE sauts ADD COLUMN certificat_url text;
  END IF;
END $$;
