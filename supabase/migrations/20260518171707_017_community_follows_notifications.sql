/*
  # Community System — Follows & Notifications

  ## Summary
  Implements the social/community layer of ParaPass:
  a follower system between parachutists and an in-app
  notification table with realtime capability.

  ## New Tables

  ### follows
  - follower_id / following_id (FK → profiles)
  - statut (text: pending | accepted | blocked)
  - UNIQUE (follower_id, following_id)

  ### notifications
  - user_id (FK → profiles) — recipient
  - type, titre, message, data jsonb, lue boolean

  ## Profiles additions
  - username, username_modifie, profil_public
  - visibilite_* toggles, niveau_profil
  - photo_profil_url, bio
*/

-- ─── follows ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own follows"
  ON follows FOR SELECT
  TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

CREATE POLICY "Users can create follows"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can update follows they are involved in"
  ON follows FOR UPDATE
  TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid())
  WITH CHECK (follower_id = auth.uid() OR following_id = auth.uid());

CREATE POLICY "Users can delete their own follows"
  ON follows FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

-- ─── notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT '',
  titre text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  data jsonb DEFAULT '{}',
  lue boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(user_id) WHERE lue = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── profiles additions ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
    ALTER TABLE profiles ADD COLUMN username text UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username_modifie') THEN
    ALTER TABLE profiles ADD COLUMN username_modifie boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profil_public') THEN
    ALTER TABLE profiles ADD COLUMN profil_public boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visibilite_sauts') THEN
    ALTER TABLE profiles ADD COLUMN visibilite_sauts boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visibilite_brevets') THEN
    ALTER TABLE profiles ADD COLUMN visibilite_brevets boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visibilite_badges') THEN
    ALTER TABLE profiles ADD COLUMN visibilite_badges boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visibilite_centre') THEN
    ALTER TABLE profiles ADD COLUMN visibilite_centre boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visibilite_activite') THEN
    ALTER TABLE profiles ADD COLUMN visibilite_activite boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'niveau_profil') THEN
    ALTER TABLE profiles ADD COLUMN niveau_profil text NOT NULL DEFAULT 'public';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'photo_profil_url') THEN
    ALTER TABLE profiles ADD COLUMN photo_profil_url text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
    ALTER TABLE profiles ADD COLUMN bio text;
  END IF;
END $$;

-- Full-text search index on name + licence
CREATE INDEX IF NOT EXISTS profiles_search_idx ON profiles USING gin(
  to_tsvector('french', coalesce(nom, '') || ' ' || coalesce(prenom, '') || ' ' || coalesce(numero_licence, ''))
);
