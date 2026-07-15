-- Sprint 11 - Validacion de analisis de maquinas IA integrado al entrenamiento.
-- Ejecutar en Supabase SQL Editor despues de aplicar 20260715010000
-- y desplegar analyze-machine.
-- Resultado esperado para cierre: 0 filas critical.

WITH scan_scope AS (
  SELECT
    id AS scan_id,
    user_id,
    machine_name,
    confidence_score,
    uncertainty_reason,
    setup_steps,
    execution_steps,
    common_mistakes,
    safety_warnings,
    recommended_sets,
    recommended_reps,
    recommended_rest_seconds,
    possible_exercises,
    not_sure_fallback,
    posture_tips,
    created_at
  FROM public.machine_scan_history
  WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
),
favorite_scope AS (
  SELECT
    id AS favorite_id,
    user_id,
    machine_scan_id,
    machine_name,
    exercise_name,
    exercise_id,
    confidence_score,
    created_at
  FROM public.machine_exercise_favorites
  WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
),
machine_added_workout_exercises AS (
  SELECT
    we.id AS workout_exercise_id,
    w.user_id,
    we.workout_id,
    we.name,
    we.exercise_id,
    we.sets,
    we.reps,
    we.rest_seconds,
    we.notes,
    we.created_at
  FROM public.workout_exercises we
  JOIN public.workouts w ON w.id = we.workout_id
  WHERE we.created_at >= CURRENT_DATE - INTERVAL '14 days'
    AND COALESCE(we.notes, '') ILIKE '%escaneo IA%'
)
SELECT 'critical' AS severity, 'scan_missing_confidence' AS check_name,
       user_id, scan_id, NULL::uuid AS related_id,
       CONCAT('machine=', machine_name, ', confidence=', confidence_score) AS details
FROM scan_scope
WHERE confidence_score IS NULL
   OR confidence_score < 0
   OR confidence_score > 1

UNION ALL
SELECT 'critical', 'scan_missing_structured_contract',
       user_id, scan_id, NULL::uuid,
       machine_name
FROM scan_scope
WHERE COALESCE(cardinality(setup_steps), 0) = 0
   OR COALESCE(cardinality(execution_steps), 0) = 0
   OR COALESCE(cardinality(common_mistakes), 0) = 0
   OR COALESCE(cardinality(safety_warnings), 0) = 0
   OR possible_exercises IS NULL
   OR possible_exercises = '[]'::jsonb

UNION ALL
SELECT 'critical', 'scan_missing_prescription',
       user_id, scan_id, NULL::uuid,
       CONCAT('sets=', recommended_sets, ', reps=', recommended_reps, ', rest=', recommended_rest_seconds)
FROM scan_scope
WHERE recommended_sets IS NULL
   OR recommended_reps IS NULL
   OR recommended_rest_seconds IS NULL

UNION ALL
SELECT 'critical', 'low_confidence_missing_fallback',
       user_id, scan_id, NULL::uuid,
       CONCAT('confidence=', confidence_score, ', reason=', uncertainty_reason)
FROM scan_scope
WHERE confidence_score < 0.7
  AND (uncertainty_reason IS NULL OR not_sure_fallback IS NULL)

UNION ALL
SELECT 'critical', 'scan_missing_safety_disclaimer',
       user_id, scan_id, NULL::uuid,
       safety_warnings::text
FROM scan_scope
WHERE lower(array_to_string(safety_warnings, ' ')) NOT LIKE '%dolor%'
   OR lower(array_to_string(safety_warnings, ' ')) NOT LIKE '%verifica%'

UNION ALL
SELECT 'critical', 'machine_added_without_prescription',
       user_id, NULL::uuid, workout_exercise_id,
       CONCAT(name, ' sets=', sets, ', reps=', reps, ', rest=', rest_seconds)
FROM machine_added_workout_exercises
WHERE sets IS NULL
   OR reps IS NULL
   OR rest_seconds IS NULL

UNION ALL
SELECT 'warning', 'favorite_without_catalog_link',
       user_id, machine_scan_id, favorite_id,
       CONCAT(machine_name, ' -> ', exercise_name)
FROM favorite_scope
WHERE exercise_id IS NULL

UNION ALL
SELECT 'info', 'machine_scan_count',
       NULL::uuid, NULL::uuid, NULL::uuid,
       COUNT(*)::text
FROM scan_scope

UNION ALL
SELECT 'info', 'machine_favorite_count',
       NULL::uuid, NULL::uuid, NULL::uuid,
       COUNT(*)::text
FROM favorite_scope

UNION ALL
SELECT 'info', 'machine_added_to_workout_count',
       NULL::uuid, NULL::uuid, NULL::uuid,
       COUNT(*)::text
FROM machine_added_workout_exercises

ORDER BY severity, check_name, user_id, scan_id, related_id;
