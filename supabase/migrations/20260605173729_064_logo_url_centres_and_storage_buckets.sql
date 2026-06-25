
-- Add logo_url to centres
ALTER TABLE centres ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Set BigAir's logo to the public asset
UPDATE centres SET logo_url = '/big-air-logo.png'
WHERE nom ILIKE '%bigair%' OR nom ILIKE '%big air%' OR nom ILIKE '%big''air%';

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profile-photos', 'profile-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('signatures',     'signatures',     true, 2097152, ARRAY['image/png','image/jpeg']),
  ('centre-logos',   'centre-logos',   true, 5242880, ARRAY['image/jpeg','image/png','image/svg+xml','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Profile photos policies
DROP POLICY IF EXISTS "profile-photos public read"   ON storage.objects;
DROP POLICY IF EXISTS "profile-photos auth insert"   ON storage.objects;
DROP POLICY IF EXISTS "profile-photos auth update"   ON storage.objects;
DROP POLICY IF EXISTS "signatures public read"        ON storage.objects;
DROP POLICY IF EXISTS "signatures auth insert"        ON storage.objects;
DROP POLICY IF EXISTS "signatures auth update"        ON storage.objects;
DROP POLICY IF EXISTS "centre-logos public read"      ON storage.objects;
DROP POLICY IF EXISTS "centre-logos auth insert"      ON storage.objects;
DROP POLICY IF EXISTS "centre-logos auth update"      ON storage.objects;

CREATE POLICY "profile-photos public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'profile-photos');
CREATE POLICY "profile-photos auth insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos');
CREATE POLICY "profile-photos auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos');

CREATE POLICY "signatures public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'signatures');
CREATE POLICY "signatures auth insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures');
CREATE POLICY "signatures auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures');

CREATE POLICY "centre-logos public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'centre-logos');
CREATE POLICY "centre-logos auth insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'centre-logos');
CREATE POLICY "centre-logos auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'centre-logos');
