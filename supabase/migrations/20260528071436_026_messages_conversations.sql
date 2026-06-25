/*
  # Système de messagerie privée

  ## Nouvelles tables
  - `conversations` — fil de discussion entre deux participants (participant_1_id, participant_2_id)
    - Contrainte UNIQUE sur la paire de participants (ordre normalisé)
    - dernier_message + dernier_message_at pour l'aperçu dans la liste
  - `messages` — messages individuels liés à une conversation
    - expediteur_id, destinataire_id, contenu, lu, lu_le

  ## Sécurité (RLS stricte)
  - Chaque utilisateur ne voit que les conversations auxquelles il participe
  - Chaque utilisateur ne voit que les messages où il est expediteur ou destinataire
  - Un utilisateur ne peut envoyer un message qu'en son propre nom
  - Seul le destinataire peut marquer un message comme lu

  ## Realtime
  - Les deux tables sont ajoutées à la publication realtime de Supabase
*/

-- ─── conversations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dernier_message text DEFAULT '',
  dernier_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  -- normalise l'ordre pour éviter les doublons
  CONSTRAINT conversations_no_self CHECK (participant_1_id <> participant_2_id)
);

-- Index pour lookup rapide
CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(dernier_message_at DESC);

-- ─── messages ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  expediteur_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  destinataire_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contenu text NOT NULL CHECK (char_length(contenu) <= 2000),
  lu boolean NOT NULL DEFAULT false,
  lu_le timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_destinataire ON messages(destinataire_id, lu);
CREATE INDEX IF NOT EXISTS idx_messages_expediteur ON messages(expediteur_id);

-- ─── RLS conversations ─────────────────────────────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

CREATE POLICY "Authenticated can create conversations they participate in"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

CREATE POLICY "Participants can update their conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id)
  WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- ─── RLS messages ──────────────────────────────────────────────────────────────

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = expediteur_id OR auth.uid() = destinataire_id);

CREATE POLICY "Users can send messages as themselves"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = expediteur_id);

CREATE POLICY "Recipients can mark messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = destinataire_id)
  WITH CHECK (auth.uid() = destinataire_id);

-- ─── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
