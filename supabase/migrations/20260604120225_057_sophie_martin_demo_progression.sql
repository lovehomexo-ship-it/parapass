/*
  # Demo progression data for Sophie Martin

  ## Purpose
  Inserts realistic jump_progression records for Sophie Martin's 5 most recent
  validated jumps so the "Ma Progression" page shows real charts during FFP demos.

  ## Notes
  - Uses WHERE NOT EXISTS to avoid duplicates on re-run
  - Sophie Martin user_id: e2ee4fe9-c532-44a1-80a6-be27e8d8ddba
*/

INSERT INTO jump_progression (
  jump_id,
  user_id,
  note_globale,
  note_tete,
  note_bassin,
  note_jambes,
  note_bras,
  note_ouverture_voile,
  note_atterrissage,
  note_mental
)
SELECT
  s.id,
  s.parachutiste_id,
  vals.note_globale,
  vals.note_tete,
  vals.note_bassin,
  vals.note_jambes,
  vals.note_bras,
  vals.note_ouverture_voile,
  vals.note_atterrissage,
  vals.note_mental
FROM (
  SELECT id, parachutiste_id,
         ROW_NUMBER() OVER (ORDER BY date_saut DESC) AS rn
  FROM sauts
  WHERE parachutiste_id = 'e2ee4fe9-c532-44a1-80a6-be27e8d8ddba'
  LIMIT 5
) s
JOIN (VALUES
  (1, 4, 4, 3, 4, 4, 5, 4, 4),
  (2, 3, 3, 3, 3, 3, 4, 3, 4),
  (3, 4, 4, 4, 4, 3, 4, 5, 5),
  (4, 5, 5, 4, 5, 5, 5, 5, 5),
  (5, 3, 3, 2, 3, 3, 3, 4, 3)
) AS vals(rn, note_globale, note_tete, note_bassin, note_jambes, note_bras, note_ouverture_voile, note_atterrissage, note_mental)
ON s.rn = vals.rn
WHERE NOT EXISTS (
  SELECT 1 FROM jump_progression jp WHERE jp.jump_id = s.id
);
