-- Migration 095 : Champs soufflerie dans la table sauts
-- Nature 'soufflerie' stockée dans la même table, jamais comptée comme saut.

ALTER TABLE sauts
  ADD COLUMN IF NOT EXISTS tunnel_flight_minutes integer,
  ADD COLUMN IF NOT EXISTS tunnel_flight_count   integer,
  ADD COLUMN IF NOT EXISTS tunnel_coach          text,
  ADD COLUMN IF NOT EXISTS tunnel_discipline     text;

-- Index pour exclure facilement les souffleries des compteurs
CREATE INDEX IF NOT EXISTS idx_sauts_nature ON sauts (nature_saut);

COMMENT ON COLUMN sauts.tunnel_flight_minutes IS 'Soufflerie: durée de vol en minutes';
COMMENT ON COLUMN sauts.tunnel_flight_count   IS 'Soufflerie: nombre de rotations/vols';
COMMENT ON COLUMN sauts.tunnel_coach          IS 'Soufflerie: coach / encadrant';
COMMENT ON COLUMN sauts.tunnel_discipline     IS 'Soufflerie: discipline (VR, freefly, dynamique…)';
