-- Sprint 12 - Validacion de reportes, progreso visual y dashboard.
-- Ejecutar en Supabase SQL Editor despues de desplegar get-monthly-report.
-- Resultado esperado para cierre: 0 filas critical.

WITH recent_workouts AS (
  SELECT
    id AS workout_id,
    user_id,
    name,
    scheduled_date,
    completed,
    completed_at,
    skipped,
    skipped_at
  FROM public.workouts
  WHERE scheduled_date >= CURRENT_DATE - INTERVAL '45 days'
     OR completed_at >= CURRENT_DATE - INTERVAL '45 days'
     OR skipped_at >= CURRENT_DATE - INTERVAL '45 days'
),
recent_sessions AS (
  SELECT
    id AS session_id,
    user_id,
    workout_id,
    status,
    started_at,
    finished_at
  FROM public.workout_sessions
  WHERE started_at >= CURRENT_DATE - INTERVAL '45 days'
),
completed_sets AS (
  SELECT
    ss.id AS set_id,
    ss.session_id,
    ss.workout_exercise_id,
    ss.exercise_id,
    ss.exercise_name_snapshot,
    ss.workout_exercise_name_snapshot,
    ss.actual_reps,
    ss.target_reps,
    ss.actual_weight,
    ss.completed,
    s.user_id,
    s.workout_id,
    s.status AS session_status
  FROM public.workout_session_sets ss
  LEFT JOIN recent_sessions s ON s.session_id = ss.session_id
  WHERE ss.completed IS TRUE
),
session_set_counts AS (
  SELECT
    session_id,
    COUNT(*) AS completed_sets
  FROM completed_sets
  GROUP BY session_id
),
meal_days AS (
  SELECT
    user_id,
    date,
    SUM(COALESCE(calories, 0)) AS calories,
    SUM(COALESCE(protein, 0)) AS protein
  FROM public.meals
  WHERE date >= CURRENT_DATE - INTERVAL '45 days'
  GROUP BY user_id, date
)
SELECT 'critical' AS severity, 'completed_set_orphan_session' AS check_name,
       user_id, workout_id, set_id::text AS subject_id,
       session_id::text AS details
FROM completed_sets
WHERE session_id IS NOT NULL
  AND session_status IS NULL

UNION ALL
SELECT 'critical', 'completed_session_missing_workout',
       s.user_id, s.workout_id, s.session_id::text,
       CONCAT('status=', s.status, ', started=', s.started_at)
FROM recent_sessions s
LEFT JOIN public.workouts w ON w.id = s.workout_id
WHERE s.status = 'completed'
  AND w.id IS NULL

UNION ALL
SELECT 'warning', 'completed_session_without_sets',
       s.user_id, s.workout_id, s.session_id::text,
       CONCAT('started=', s.started_at)
FROM recent_sessions s
LEFT JOIN session_set_counts sc ON sc.session_id = s.session_id
WHERE s.status = 'completed'
  AND COALESCE(sc.completed_sets, 0) = 0

UNION ALL
SELECT 'warning', 'completed_workout_without_completed_session',
       w.user_id, w.workout_id, w.workout_id::text,
       CONCAT('completed_at=', w.completed_at)
FROM recent_workouts w
WHERE w.completed IS TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM recent_sessions s
    WHERE s.workout_id = w.workout_id
      AND s.status = 'completed'
  )

UNION ALL
SELECT 'warning', 'completed_set_missing_reps',
       user_id, workout_id, set_id::text,
       CONCAT('exercise=', COALESCE(exercise_name_snapshot, workout_exercise_name_snapshot, exercise_id::text))
FROM completed_sets
WHERE COALESCE(actual_reps, target_reps) IS NULL

UNION ALL
SELECT 'info', 'recent_report_source_counts',
       NULL::uuid, NULL::uuid, 'workouts'::text,
       COUNT(*)::text
FROM recent_workouts

UNION ALL
SELECT 'info', 'recent_report_source_counts',
       NULL::uuid, NULL::uuid, 'completed_sessions',
       COUNT(*)::text
FROM recent_sessions
WHERE status = 'completed'

UNION ALL
SELECT 'info', 'recent_report_source_counts',
       NULL::uuid, NULL::uuid, 'completed_sets',
       COUNT(*)::text
FROM completed_sets

UNION ALL
SELECT 'info', 'recent_report_source_counts',
       NULL::uuid, NULL::uuid, 'meal_days',
       COUNT(*)::text
FROM meal_days

ORDER BY severity, check_name, user_id, workout_id, subject_id;
