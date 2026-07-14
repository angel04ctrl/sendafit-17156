-- Sprint 7.3.1 - Reparacion segura de workouts legacy ai_coach.
-- Ejecutar en Supabase SQL Editor solo despues de revisar:
-- docs/sprint-7-3-1-ai-legacy-workouts-diagnostic.sql
--
-- Seguridad:
-- - No borra workouts.
-- - No borra workout_exercises.
-- - No toca workout_sessions.
-- - No toca workout_session_sets.
-- - Solo actua sobre el usuario/workouts afectados por Sprint 7.3.1.
-- - Aborta si algun ejercicio no resuelve de forma deterministica.

BEGIN;

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

CREATE TEMP TABLE s731_affected_workouts(workout_id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO s731_affected_workouts(workout_id)
VALUES
  ('1a90e294-4a48-4212-b23e-f98ae7ed196f'::uuid),
  ('33b70282-f335-4697-875f-0aa913a80371'::uuid),
  ('3989326e-50e3-40a5-b4bf-e0a18ad9387e'::uuid),
  ('4c6361bf-9850-4583-a525-2eaec0ff6fc5'::uuid),
  ('e4d783c1-741d-4e47-973f-381a2b25da9c'::uuid),
  ('e95937fd-3ba7-4727-aad5-a9adc5e5168d'::uuid),
  ('ebf54b33-a83b-49ea-a9ba-e626baff6bdb'::uuid);

CREATE TEMP TABLE s731_manual_mapping(legacy_name text PRIMARY KEY, exercise_id text NOT NULL) ON COMMIT DROP;
INSERT INTO s731_manual_mapping(legacy_name, exercise_id)
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
  ('Peso Muerto Convencional (Deadlift con Barra)', '37');

CREATE TEMP TABLE s731_target_workout_exercises ON COMMIT DROP AS
SELECT
  we.id AS workout_exercise_id,
  we.workout_id,
  we.name,
  we.exercise_id,
  we.rest_seconds,
  we.target_rir,
  we.order_index,
  pg_temp.s731_norm(we.name) AS normalized_name
FROM s731_affected_workouts aw
JOIN public.workouts w ON w.id = aw.workout_id
JOIN public.workout_exercises we ON we.workout_id = w.id
WHERE w.user_id = '96ff31bf-46d9-43d3-bf73-8f8e9c0f693f'::uuid
  AND w.plan_source = 'ai_coach'
  AND w.is_protected = true
  AND (
    we.exercise_id IS NULL
    OR we.rest_seconds IS NULL
    OR we.target_rir IS NULL
    OR we.order_index IS NULL
  );

CREATE TEMP TABLE s731_candidate_matches ON COMMIT DROP AS
SELECT
  te.workout_exercise_id,
  e.id AS exercise_id,
  e.nombre,
  'exact_match'::text AS match_source,
  1 AS priority
FROM s731_target_workout_exercises te
JOIN public.exercises e ON pg_temp.s731_norm(e.nombre) = te.normalized_name

UNION ALL
SELECT
  te.workout_exercise_id,
  e.id AS exercise_id,
  e.nombre,
  'alias_match'::text AS match_source,
  2 AS priority
FROM s731_target_workout_exercises te
JOIN public.exercises e ON true
JOIN LATERAL unnest(COALESCE(e.aliases, '{}'::text[])) AS alias(alias_name) ON true
WHERE pg_temp.s731_norm(alias.alias_name) = te.normalized_name

UNION ALL
SELECT
  te.workout_exercise_id,
  e.id AS exercise_id,
  e.nombre,
  'manual_mapping'::text AS match_source,
  3 AS priority
FROM s731_target_workout_exercises te
JOIN s731_manual_mapping mm ON pg_temp.s731_norm(mm.legacy_name) = te.normalized_name
JOIN public.exercises e ON e.id = mm.exercise_id;

CREATE TEMP TABLE s731_resolution ON COMMIT DROP AS
WITH match_counts AS (
  SELECT
    te.workout_exercise_id,
    te.workout_id,
    te.name,
    COUNT(DISTINCT cm.exercise_id) AS distinct_match_count,
    MIN(cm.exercise_id) FILTER (WHERE cm.exercise_id IS NOT NULL) AS resolved_exercise_id,
    MIN(cm.priority) FILTER (WHERE cm.exercise_id IS NOT NULL) AS selected_priority
  FROM s731_target_workout_exercises te
  LEFT JOIN s731_candidate_matches cm ON cm.workout_exercise_id = te.workout_exercise_id
  GROUP BY te.workout_exercise_id, te.workout_id, te.name
)
SELECT
  mc.*,
  CASE
    WHEN mc.distinct_match_count = 0 THEN 'no_match'
    WHEN mc.distinct_match_count > 1 THEN 'ambiguous_match'
    WHEN mc.selected_priority = 1 THEN 'exact_match'
    WHEN mc.selected_priority = 2 THEN 'alias_match'
    WHEN mc.selected_priority = 3 THEN 'manual_mapping'
    ELSE 'ambiguous_match'
  END AS status
FROM match_counts mc;

DO $$
DECLARE
  unresolved_count integer;
  ambiguous_count integer;
BEGIN
  SELECT COUNT(*) INTO unresolved_count
  FROM s731_resolution
  WHERE status = 'no_match';

  SELECT COUNT(*) INTO ambiguous_count
  FROM s731_resolution
  WHERE status = 'ambiguous_match';

  IF unresolved_count > 0 OR ambiguous_count > 0 THEN
    RAISE EXCEPTION
      'Sprint 7.3.1 repair aborted: unresolved=%, ambiguous=%. Run diagnostic SQL and review mappings.',
      unresolved_count,
      ambiguous_count;
  END IF;
END $$;

-- Resolver exercise_id solo donde falta.
UPDATE public.workout_exercises we
SET exercise_id = r.resolved_exercise_id
FROM s731_resolution r
JOIN public.workouts w ON w.id = r.workout_id
WHERE we.id = r.workout_exercise_id
  AND we.exercise_id IS NULL
  AND w.user_id = '96ff31bf-46d9-43d3-bf73-8f8e9c0f693f'::uuid
  AND w.plan_source = 'ai_coach'
  AND w.is_protected = true;

-- Llenar order_index con orden estable por created_at/id dentro de cada workout.
WITH ordered AS (
  SELECT
    we.id,
    row_number() OVER (
      PARTITION BY we.workout_id
      ORDER BY we.created_at, we.id
    )::integer AS next_order_index
  FROM s731_affected_workouts aw
  JOIN public.workouts w ON w.id = aw.workout_id
  JOIN public.workout_exercises we ON we.workout_id = w.id
  WHERE w.user_id = '96ff31bf-46d9-43d3-bf73-8f8e9c0f693f'::uuid
    AND w.plan_source = 'ai_coach'
    AND w.is_protected = true
)
UPDATE public.workout_exercises we
SET order_index = ordered.next_order_index
FROM ordered
WHERE we.id = ordered.id
  AND we.order_index IS NULL;

-- Llenar descanso/RIR desde metadata del ejercicio y fallbacks seguros.
UPDATE public.workout_exercises we
SET
  rest_seconds = COALESCE(
    we.rest_seconds,
    e.descanso_segundos_max,
    e.descanso_segundos_min,
    CASE
      WHEN lower(COALESCE(e.tipo_entrenamiento, '')) LIKE '%cardio%' THEN 60
      WHEN lower(COALESCE(e.tipo_entrenamiento, '')) LIKE '%fuerza%' THEN 90
      ELSE 60
    END
  ),
  target_rir = CASE
    WHEN lower(COALESCE(e.tipo_entrenamiento, '')) LIKE '%cardio%' THEN NULL
    ELSE COALESCE(we.target_rir, e.rir_recomendado, 2)
  END
FROM s731_affected_workouts aw
JOIN public.workouts w ON w.id = aw.workout_id
JOIN public.exercises e ON true
WHERE we.workout_id = w.id
  AND e.id = we.exercise_id
  AND w.user_id = '96ff31bf-46d9-43d3-bf73-8f8e9c0f693f'::uuid
  AND w.plan_source = 'ai_coach'
  AND w.is_protected = true
  AND (we.rest_seconds IS NULL OR we.target_rir IS NULL);

-- Reporte final de la reparacion.
SELECT
  r.status AS resolution_status,
  COUNT(*) AS workout_exercises_count
FROM s731_resolution r
GROUP BY r.status
ORDER BY r.status;

SELECT
  w.id AS workout_id,
  COUNT(DISTINCT ws.id) AS sessions_untouched,
  COUNT(DISTINCT wss.id) AS sets_untouched
FROM s731_affected_workouts aw
JOIN public.workouts w ON w.id = aw.workout_id
LEFT JOIN public.workout_sessions ws ON ws.workout_id = w.id
LEFT JOIN public.workout_session_sets wss ON wss.session_id = ws.id
GROUP BY w.id
ORDER BY w.id;

COMMIT;
