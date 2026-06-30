-- Migration 096 : Soufflerie via catégorie = 'soufflerie' + flag is_tunnel

-- Flag principal — toute logique d'exclusion se base sur ce booléen
ALTER TABLE sauts
  ADD COLUMN IF NOT EXISTS is_tunnel         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tunnel_name       text,
  ADD COLUMN IF NOT EXISTS tunnel_flight_minutes integer,
  ADD COLUMN IF NOT EXISTS tunnel_flight_count   integer,
  ADD COLUMN IF NOT EXISTS tunnel_coach          text,
  ADD COLUMN IF NOT EXISTS tunnel_discipline     text;

-- Index pour exclure efficacement les tunnels des compteurs
CREATE INDEX IF NOT EXISTS idx_sauts_is_tunnel ON sauts (is_tunnel);

-- Backfill : si des lignes ont déjà categorie = 'soufflerie' (migration précédente)
UPDATE sauts SET is_tunnel = true WHERE categorie = 'soufflerie';

COMMENT ON COLUMN sauts.is_tunnel           IS 'true = session soufflerie, exclue de tous les compteurs de sauts';
COMMENT ON COLUMN sauts.tunnel_name         IS 'Soufflerie: nom du centre (Weembi, iFLY…)';
COMMENT ON COLUMN sauts.tunnel_flight_minutes IS 'Soufflerie: durée de vol en minutes';
COMMENT ON COLUMN sauts.tunnel_flight_count   IS 'Soufflerie: nombre de rotations/vols';
COMMENT ON COLUMN sauts.tunnel_coach          IS 'Soufflerie: coach / encadrant';
COMMENT ON COLUMN sauts.tunnel_discipline     IS 'Soufflerie: discipline (VR, freefly, dynamique…)';
