-- Sprint 8 - Validacion de sustituciones de ejercicios.
-- Ejecutar en Supabase SQL Editor despues de aplicar 20260713010000.
-- Resultado esperado para cierre: 0 filas critical.

WITH substituted_exercises AS (
  SELECT
    we.id AS workout_exercise_id,
    w.user_id,
    we.workout_id,
    we.exercise_id,
    we.name,
    we.original_exercise_id,
    we.original_name,
    we.substitution_reason,
    we.substituted_at,
    we.substitution_count,
    e.id AS current_catalog_exercise_id,
    oe.id AS original_catalog_exercise_id
  FROM public.workout_exercises we
  JOIN public.workouts w ON w.id = we.workout_id
  LEFT JOIN public.exercises e ON e.id = we.exercise_id
  LEFT JOIN public.exercises oe ON oe.id = we.original_exercise_id
  WHERE COALESCE(we.substitution_count, 0) > 0
     OR we.original_exercise_id IS NOT NULL
     OR we.substitution_reason IS NOT NULL
),
audit_scope AS (
  SELECT
    s.id AS substitution_id,
    s.user_id,
    s.workout_id,
    s.workout_exercise_id,
    s.original_exercise_id,
    s.original_name,
    s.new_exercise_id,
    s.new_name,
    s.reason,
    we.id AS matched_workout_exercise_id,
    w.id AS matched_workout_id,
    e.id AS matched_new_exercise_id
  FROM public.workout_exercise_substitutions s
  LEFT JOIN public.workout_exercises we ON we.id = s.workout_exercise_id
  LEFT JOIN public.workouts w ON w.id = s.workout_id AND w.user_id = s.user_id
  LEFT JOIN public.exercises e ON e.id = s.new_exercise_id
)
SELECT 'critical' AS severity, 'substitution_missing_original_metadata' AS check_name,
       user_id, workout_id, workout_exercise_id, name AS details
FROM substituted_exercises
WHERE original_exercise_id IS NULL
   OR original_name IS NULL
   OR substitution_reason IS NULL
   OR substituted_at IS NULL

UNION ALL
SELECT 'critical', 'substitution_current_exercise_missing_catalog',
       user_id, workout_id, workout_exercise_id, exercise_id
FROM substituted_exercises
WHERE exercise_id IS NOT NULL
  AND current_catalog_exercise_id IS NULL

UNION ALL
SELECT 'critical', 'substitution_original_exercise_missing_catalog',
       user_id, workout_id, workout_exercise_id, original_exercise_id
FROM substituted_exercises
WHERE original_exercise_id IS NOT NULL
  AND original_catalog_exercise_id IS NULL

UNION ALL
SELECT 'critical', 'audit_row_orphan_reference',
       user_id, workout_id, workout_exercise_id, substitution_id::text
FROM audit_scope
WHERE matched_workout_exercise_id IS NULL
   OR matched_workout_id IS NULL
   OR matched_new_exercise_id IS NULL

UNION ALL
SELECT 'critical', 'audit_reason_invalid',
       user_id, workout_id, workout_exercise_id, reason
FROM audit_scope
WHERE reason NOT IN ('machine_busy', 'pain_discomfort', 'not_available', 'preference', 'app_recommended')

UNION ALL
SELECT 'warning', 'substitution_without_audit_row',
       se.user_id, se.workout_id, se.workout_exercise_id, se.name
FROM substituted_exercises se
WHERE NOT EXISTS (
  SELECT 1
  FROM public.workout_exercise_substitutions s
  WHERE s.workout_exercise_id = se.workout_exercise_id
)

UNION ALL
SELECT 'info', 'substitution_count',
       NULL::uuid, NULL::uuid, NULL::uuid, COUNT(*)::text
FROM audit_scope

ORDER BY severity, check_name, user_id, workout_id, workout_exercise_id;
