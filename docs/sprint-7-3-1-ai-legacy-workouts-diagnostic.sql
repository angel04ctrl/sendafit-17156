-- Sprint 7.3.1 - Diagnostico de workouts legacy ai_coach posteriores a 7.3.
-- No modifica datos.
-- Ejecutar en Supabase SQL Editor. Devuelve dos result sets:
-- 1) resumen por workout afectado
-- 2) detalle por workout_exercise y resolucion deterministica

CREATE OR REPLACE FUNCTION pg_temp.s731_norm(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(
    regexp_replace(
      translate(
        lower(coalesce(value, '')),
        'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
        'aaaaaeeeeiiiiooooouuuunaaaaaeeeeiiiiooooouuuun'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  )
$$;

WITH affected_workouts(workout_id) AS (
  VALUES
    ('1a90e294-4a48-4212-b23e-f98ae7ed196f'::uuid),
    ('33b70282-f335-4697-875f-0aa913a80371'::uuid),
    ('3989326e-50e3-40a5-b4bf-e0a18ad9387e'::uuid),
    ('4c6361bf-9850-4583-a525-2eaec0ff6fc5'::uuid),
    ('e4d783c1-741d-4e47-973f-381a2b25da9c'::uuid),
    ('e95937fd-3ba7-4727-aad5-a9adc5e5168d'::uuid),
    ('ebf54b33-a83b-49ea-a9ba-e626baff6bdb'::uuid)
),
summary AS (
  SELECT
    w.id AS workout_id,
    w.user_id,
    w.scheduled_date,
    w.weekday,
    w.tipo,
    w.plan_source,
    w.is_protected,
    w.completed,
    w.description,
    COUNT(DISTINCT we.id) AS workout_exercises_count,
    COUNT(DISTINCT we.id) FILTER (WHERE we.exercise_id IS NULL) AS exercise_id_null_count,
    COUNT(DISTINCT we.id) FILTER (WHERE we.rest_seconds IS NULL) AS rest_seconds_null_count,
    COUNT(DISTINCT we.id) FILTER (WHERE we.target_rir IS NULL) AS target_rir_null_count,
    COUNT(DISTINCT we.id) FILTER (WHERE we.order_index IS NULL) AS order_index_null_count,
    COUNT(DISTINCT ws.id) AS workout_sessions_count,
    COUNT(DISTINCT ws.id) FILTER (WHERE ws.status = 'active') AS active_sessions_count,
    COUNT(DISTINCT ws.id) FILTER (WHERE ws.status = 'completed') AS completed_sessions_count,
    COUNT(DISTINCT wss.id) AS workout_session_sets_count,
    (
      COUNT(DISTINCT ws.id) > 0
      OR COUNT(DISTINCT wss.id) > 0
      OR COALESCE(w.completed, false) = true
    ) AS has_real_history,
    string_agg(DISTINCT we.name, ' | ' ORDER BY we.name) FILTER (
      WHERE we.exercise_id IS NULL
         OR we.rest_seconds IS NULL
         OR we.target_rir IS NULL
         OR we.order_index IS NULL
    ) AS affected_exercise_names
  FROM affected_workouts aw
  JOIN public.workouts w ON w.id = aw.workout_id
  LEFT JOIN public.workout_exercises we ON we.workout_id = w.id
  LEFT JOIN public.workout_sessions ws ON ws.workout_id = w.id
  LEFT JOIN public.workout_session_sets wss ON wss.session_id = ws.id
  WHERE w.user_id = '96ff31bf-46d9-43d3-bf73-8f8e9c0f693f'::uuid
    AND w.plan_source = 'ai_coach'
  GROUP BY w.id
)
SELECT *
FROM summary
ORDER BY scheduled_date, workout_id;

WITH affected_workouts(workout_id) AS (
  VALUES
    ('1a90e294-4a48-4212-b23e-f98ae7ed196f'::uuid),
    ('33b70282-f335-4697-875f-0aa913a80371'::uuid),
    ('3989326e-50e3-40a5-b4bf-e0a18ad9387e'::uuid),
    ('4c6361bf-9850-4583-a525-2eaec0ff6fc5'::uuid),
    ('e4d783c1-741d-4e47-973f-381a2b25da9c'::uuid),
    ('e95937fd-3ba7-4727-aad5-a9adc5e5168d'::uuid),
    ('ebf54b33-a83b-49ea-a9ba-e626baff6bdb'::uuid)
),
manual_mapping(legacy_name, exercise_id) AS (
  VALUES
    ('Press de Banca (Bench Press con Barra)', '31'),
    ('Press Inclinado con Barra', '32'),
    ('Press Militar con Barra (de pie o sentado)', '34'),
    ('Elevaciones Laterales en Polea', '51'),
    ('Curl de Bíceps con Barra (EZ o Recta)', '45'),
    ('Crunch en Polea (Cable Crunch)', '53'),
    ('Hip Thrust con Barra', '41'),
    ('Puente de Gluteo (Glute Bridge)', '17'),
    ('Sentadilla con Barra (Back Squat)', '38'),
    ('Peso Muerto Rumano (RDL) (con Mancuernas)', '16'),
    ('Sprints (Carreras de velocidad)', '72'),
    ('Saltar la Cuerda (Jump Rope)', '73'),
    ('Rotaciones Rusas con Polea (Russian Twist Cable)', '54'),
    ('Fondos en Banco para Tríceps (Bench Dips)', '46'),
    ('Remo con Barra (Bent-Over Barbell Row)', '35'),
    ('Dominadas / Pull-ups', '36'),
    ('Peso Muerto Convencional (Deadlift con Barra)', '37')
),
target_exercises AS (
  SELECT
    we.id AS workout_exercise_id,
    we.workout_id,
    we.name,
    we.exercise_id,
    we.rest_seconds,
    we.target_rir,
    we.order_index,
    pg_temp.s731_norm(we.name) AS normalized_name
  FROM affected_workouts aw
  JOIN public.workouts w ON w.id = aw.workout_id
  JOIN public.workout_exercises we ON we.workout_id = w.id
  WHERE w.user_id = '96ff31bf-46d9-43d3-bf73-8f8e9c0f693f'::uuid
    AND w.plan_source = 'ai_coach'
    AND (
      we.exercise_id IS NULL
      OR we.rest_seconds IS NULL
      OR we.target_rir IS NULL
      OR we.order_index IS NULL
    )
),
exact_matches AS (
  SELECT te.workout_exercise_id, e.id, e.nombre, 'exact_match' AS match_source
  FROM target_exercises te
  JOIN public.exercises e ON pg_temp.s731_norm(e.nombre) = te.normalized_name
),
alias_matches AS (
  SELECT te.workout_exercise_id, e.id, e.nombre, 'alias_match' AS match_source
  FROM target_exercises te
  JOIN public.exercises e ON true
  JOIN LATERAL unnest(COALESCE(e.aliases, '{}'::text[])) AS alias(alias_name) ON true
  WHERE pg_temp.s731_norm(alias.alias_name) = te.normalized_name
),
manual_matches AS (
  SELECT te.workout_exercise_id, e.id, e.nombre, 'manual_mapping' AS match_source
  FROM target_exercises te
  JOIN manual_mapping mm ON pg_temp.s731_norm(mm.legacy_name) = te.normalized_name
  JOIN public.exercises e ON e.id = mm.exercise_id
),
all_matches AS (
  SELECT * FROM exact_matches
  UNION ALL
  SELECT * FROM alias_matches
  UNION ALL
  SELECT * FROM manual_matches
),
match_summary AS (
  SELECT
    te.workout_exercise_id,
    COUNT(DISTINCT am.id) AS matches_found,
    COUNT(DISTINCT am.id) FILTER (WHERE am.match_source = 'exact_match') AS exact_match_count,
    COUNT(DISTINCT am.id) FILTER (WHERE am.match_source = 'alias_match') AS alias_match_count,
    COUNT(DISTINCT am.id) FILTER (WHERE am.match_source = 'manual_mapping') AS manual_mapping_count,
    string_agg(DISTINCT am.id || ':' || am.nombre || ' [' || am.match_source || ']', ' | ' ORDER BY am.id || ':' || am.nombre || ' [' || am.match_source || ']') AS possible_matches
  FROM target_exercises te
  LEFT JOIN all_matches am ON am.workout_exercise_id = te.workout_exercise_id
  GROUP BY te.workout_exercise_id
)
SELECT
  te.workout_exercise_id,
  te.workout_id,
  te.name,
  te.exercise_id,
  te.rest_seconds,
  te.target_rir,
  te.order_index,
  te.normalized_name,
  COALESCE(ms.possible_matches, '') AS possible_match,
  COALESCE(ms.matches_found, 0) AS matches_found,
  CASE
    WHEN COALESCE(ms.matches_found, 0) = 0 THEN 'no_match'
    WHEN COALESCE(ms.matches_found, 0) > 1 THEN 'ambiguous_match'
    WHEN COALESCE(ms.exact_match_count, 0) = 1 THEN 'exact_match'
    WHEN COALESCE(ms.alias_match_count, 0) = 1 THEN 'alias_match'
    WHEN COALESCE(ms.manual_mapping_count, 0) = 1 THEN 'manual_mapping'
    ELSE 'ambiguous_match'
  END AS status
FROM target_exercises te
LEFT JOIN match_summary ms ON ms.workout_exercise_id = te.workout_exercise_id
ORDER BY te.workout_id, te.workout_exercise_id;
