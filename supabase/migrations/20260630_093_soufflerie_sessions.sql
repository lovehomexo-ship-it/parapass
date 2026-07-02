-- Migration 093 : Sessions soufflerie

CREATE TABLE soufflerie_sessions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  duree_min    integer NOT NULL CHECK (duree_min > 0),
  tunnel       text NOT NULL,
  type_vol     text NOT NULL CHECK (type_vol IN ('solo','coaching','formation','competition')),
  disciplines  text[] DEFAULT '{}',
  instructeur  text,
  notes        text,
  note_globale smallint CHECK (note_globale BETWEEN 1 AND 5),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE soufflerie_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON soufflerie_sessions FOR ALL
  USING (auth.uid() = user_id);
