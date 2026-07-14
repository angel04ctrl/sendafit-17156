-- Sprint 7.3 - Validacion final de integracion, identidad y prescripcion del planner.
-- Ejecutar en Supabase SQL Editor despues de aplicar la migracion 20260705010000.
-- Resultado esperado para cierre: 0 filas critical.

WITH workout_scope AS (
  SELECT
    w.id AS workout_id,
    w.user_id,
    w.plan_id,
    w.plan_source,
    w.is_protected,
    w.tipo,
    w.completed,
    w.scheduled_date,
    w.weekday,
    w.created_at
  FROM public.workouts w
),
workout_exercise_scope AS (
  SELECT
    w.user_id,
    w.workout_id,
    w.plan_source,
    w.is_protected,
    w.tipo,
    we.id AS workout_exercise_id,
    we.exercise_id,
    we.name,
    we.rest_seconds,
    we.target_rir,
    we.order_index,
    e.id AS catalog_exercise_id,
    e.nombre AS catalog_name,
    e.tipo_entrenamiento,
    e.estado_calidad
  FROM workout_scope w
  JOIN public.workout_exercises we ON we.workout_id = w.workout_id
  LEFT JOIN public.exercises e ON e.id = we.exercise_id
),
session_scope AS (
  SELECT
    s.id AS session_id,
    s.user_id,
    s.workout_id,
    w.workout_id AS matched_workout_id
  FROM public.workout_sessions s
  LEFT JOIN workout_scope w ON w.workout_id = s.workout_id
),
set_scope AS (
  SELECT
    ss.id AS set_id,
    ss.session_id,
    ss.workout_exercise_id,
    s.session_id AS matched_session_id,
    we.workout_exercise_id AS matched_workout_exercise_id
  FROM public.workout_session_sets ss
  LEFT JOIN session_scope s ON s.session_id = ss.session_id
  LEFT JOIN workout_exercise_scope we ON we.workout_exercise_id = ss.workout_exercise_id
)
SELECT 'critical' AS severity, 'invalid_plan_source' AS check_name,
       user_id, workout_id, NULL::text AS exercise_id, plan_source AS details
FROM workout_scope
WHERE plan_source NOT IN ('planner', 'predesigned', 'ai_coach', 'manual', 'personalized', 'legacy_unknown')

UNION ALL
SELECT 'critical', 'protected_source_not_protected',
       user_id, workout_id, NULL::text, plan_source
FROM workout_scope
WHERE plan_source IN ('ai_coach', 'manual', 'personalized', 'legacy_unknown')
  AND is_protected IS DISTINCT FROM true

UNION ALL
SELECT 'critical', 'replaceable_source_marked_protected',
       user_id, workout_id, NULL::text, plan_source
FROM workout_scope
WHERE plan_source IN ('planner', 'predesigned')
  AND tipo = 'automatico'
  AND completed IS DISTINCT FROM true
  AND is_protected IS DISTINCT FROM false

UNION ALL
SELECT 'critical', 'planner_workout_exercise_missing_exercise_id',
       user_id, workout_id, exercise_id, name
FROM workout_exercise_scope
WHERE plan_source IN ('planner', 'predesigned', 'ai_coach')
  AND exercise_id IS NULL

UNION ALL
SELECT 'critical', 'workout_exercise_catalog_reference_missing',
       user_id, workout_id, exercise_id, name
FROM workout_exercise_scope
WHERE exercise_id IS NOT NULL
  AND catalog_exercise_id IS NULL

UNION ALL
SELECT 'critical', 'strength_prescription_missing_rest_or_rir',
       user_id, workout_id, exercise_id, CONCAT(name, ' rest=', rest_seconds, ' rir=', target_rir)
FROM workout_exercise_scope
WHERE plan_source IN ('planner', 'predesigned', 'ai_coach')
  AND lower(COALESCE(tipo_entrenamiento, '')) NOT LIKE '%cardio%'
  AND (rest_seconds IS NULL OR target_rir IS NULL)

UNION ALL
SELECT 'critical', 'cardio_prescription_has_target_rir',
       user_id, workout_id, exercise_id, CONCAT(name, ' rir=', target_rir)
FROM workout_exercise_scope
WHERE plan_source IN ('planner', 'predesigned', 'ai_coach')
  AND lower(COALESCE(tipo_entrenamiento, '')) LIKE '%cardio%'
  AND target_rir IS NOT NULL

UNION ALL
SELECT 'critical', 'invalid_exercise_order',
       user_id, workout_id, exercise_id, CONCAT(name, ' order=', order_index)
FROM workout_exercise_scope
WHERE plan_source IN ('planner', 'predesigned', 'ai_coach')
  AND (order_index IS NULL OR order_index < 1)

UNION ALL
SELECT 'critical', 'orphan_workout_session',
       user_id, workout_id, NULL::text, session_id::text
FROM session_scope
WHERE matched_workout_id IS NULL

UNION ALL
SELECT 'critical', 'orphan_workout_session_set',
       NULL::uuid, NULL::uuid, workout_exercise_id::text, CONCAT('set=', set_id, ', session=', session_id)
FROM set_scope
WHERE matched_session_id IS NULL
   OR (workout_exercise_id IS NOT NULL AND matched_workout_exercise_id IS NULL)

UNION ALL
SELECT 'warning', 'legacy_unknown_workout_protected',
       user_id, workout_id, NULL::text, scheduled_date::text
FROM workout_scope
WHERE plan_source = 'legacy_unknown'

UNION ALL
SELECT 'warning', 'historical_prescription_missing',
       user_id, workout_id, exercise_id, name
FROM workout_exercise_scope
WHERE plan_source NOT IN ('planner', 'predesigned', 'ai_coach')
  AND (rest_seconds IS NULL OR order_index IS NULL)

UNION ALL
SELECT 'info', 'plan_source_counts',
       NULL::uuid, NULL::uuid, NULL::text, CONCAT(plan_source, '=', COUNT(*))
FROM workout_scope
GROUP BY plan_source

ORDER BY severity, check_name, user_id, workout_id;
