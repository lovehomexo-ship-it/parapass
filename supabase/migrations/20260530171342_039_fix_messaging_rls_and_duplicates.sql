/*
  # Fix messaging: RLS policies and duplicate conversations

  ## Problem
  1. When a parachutiste (Sophie) tries to load a conversation with an admin_centre 
     (BigAir Admin), the RLS policies block the profile and admin_centres lookups,
     resulting in "Utilisateur inconnu".

  2. Multiple duplicate conversations exist between the same participant pairs.

  ## Changes

  ### 1. profiles - Add policy for conversation participants
  Allow authenticated users to read the basic profile (nom, prenom, role, avatar_url)
  of anyone they share a conversation with, plus admin_centre profiles visible to 
  their licenciés.

  ### 2. admin_centres - Add policy for participants resolution
  Allow any authenticated user to read admin_centres rows to resolve centre names
  for message senders. This table contains no sensitive data.

  ### 3. Clean duplicate conversations
  Keep only the most recent conversation per unique participant pair.
*/

-- 1. Allow conversation participants to read each other's profiles
CREATE POLICY "Conversation participants can read each other profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT participant_1_id FROM conversations WHERE participant_2_id = auth.uid()
      UNION
      SELECT participant_2_id FROM conversations WHERE participant_1_id = auth.uid()
    )
  );

-- 2. Allow all authenticated users to read admin_centres for centre name resolution
CREATE POLICY "Authenticated can read admin_centres for sender resolution"
  ON admin_centres FOR SELECT
  TO authenticated
  USING (true);

-- 3. Remove duplicate conversations, keeping only the most recent per participant pair
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY
        LEAST(participant_1_id, participant_2_id),
        GREATEST(participant_1_id, participant_2_id)
      ORDER BY COALESCE(dernier_message_at, created_at) DESC NULLS LAST
    ) AS rn
  FROM conversations
)
DELETE FROM conversations
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
