/*
  # Tampon DZ - Tampon officiel numérique

  Ajoute les champs tampon officiel à la table `centres`
  et les champs de validation horodatée à la table `licences`.

  1. Table `centres` — nouveaux champs tampon
    - tampon_logo_url (text) — URL du logo DZ uploadé
    - tampon_svg_url (text) — URL du tampon SVG généré
    - tampon_couleur_primaire (text, default '#1a2744')
    - tampon_couleur_texte (text, default '#FFFFFF')
    - tampon_nom_officiel (text) — nom affiché dans le tampon
    - tampon_numero_agrement (text) — ex: "FFP-0916"

  2. Table `licences` — champs snapshot validation
    - tampon_snapshot_url (text) — archive immuable du tampon au moment de la validation
    - tampon_timestamp (timestamptz) — horodatage certifié
    - tampon_validateur_nom (text) — nom DT / moniteur
    - tampon_hash (text) — hash SHA-256 pour intégrité

  3. Notes
    - Tous les champs sont nullable / ont des defaults sûrs
    - RLS déjà activé sur ces tables
*/

DO $$
BEGIN
  -- centres: tampon fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centres' AND column_name='tampon_logo_url') THEN
    ALTER TABLE centres ADD COLUMN tampon_logo_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centres' AND column_name='tampon_svg_url') THEN
    ALTER TABLE centres ADD COLUMN tampon_svg_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centres' AND column_name='tampon_couleur_primaire') THEN
    ALTER TABLE centres ADD COLUMN tampon_couleur_primaire text NOT NULL DEFAULT '#1a2744';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centres' AND column_name='tampon_couleur_texte') THEN
    ALTER TABLE centres ADD COLUMN tampon_couleur_texte text NOT NULL DEFAULT '#FFFFFF';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centres' AND column_name='tampon_nom_officiel') THEN
    ALTER TABLE centres ADD COLUMN tampon_nom_officiel text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centres' AND column_name='tampon_numero_agrement') THEN
    ALTER TABLE centres ADD COLUMN tampon_numero_agrement text;
  END IF;

  -- licences: validation snapshot fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='tampon_snapshot_url') THEN
    ALTER TABLE licences ADD COLUMN tampon_snapshot_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='tampon_timestamp') THEN
    ALTER TABLE licences ADD COLUMN tampon_timestamp timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='tampon_validateur_nom') THEN
    ALTER TABLE licences ADD COLUMN tampon_validateur_nom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licences' AND column_name='tampon_hash') THEN
    ALTER TABLE licences ADD COLUMN tampon_hash text;
  END IF;
END $$;
