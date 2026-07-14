-- Sprint 9 - Validacion de calendario adaptativo.
-- Ejecutar en Supabase SQL Editor despues de aplicar 20260714010000.
-- Resultado esperado para cierre: 0 filas critical.

WITH workout_scope AS (
  SELECT
    id AS workout_id,
    user_id,
    name,
    scheduled_date,
    weekday,
    completed,
    skipped,
    skipped_at,
    skip_reason,
    rescheduled_from,
    rescheduled_at,
    EXTRACT(ISODOW FROM scheduled_date)::int AS scheduled_isodow
  FROM public.workouts
),
active_day_counts AS (
  SELECT
    user_id,
    scheduled_date,
    COUNT(*) AS pending_count,
    ARRAY_AGG(workout_id ORDER BY workout_id) AS workout_ids
  FROM workout_scope
  WHERE completed IS DISTINCT FROM true
    AND skipped IS DISTINCT FROM true
  GROUP BY user_id, scheduled_date
),
event_scope AS (
  SELECT
    e.id AS event_id,
    e.user_id,
    e.workout_id,
    e.action,
    e.from_date,
    e.to_date,
    e.reason,
    w.workout_id AS matched_workout_id
  FROM public.workout_calendar_events e
  LEFT JOIN workout_scope w
    ON w.workout_id = e.workout_id
   AND w.user_id = e.user_id
)
SELECT 'critical' AS severity, 'pending_workout_date_conflict' AS check_name,
       user_id, NULL::uuid AS workout_id, scheduled_date,
       CONCAT('count=', pending_count, ', ids=', workout_ids::text) AS details
FROM active_day_counts
WHERE pending_count > 1

UNION ALL
SELECT 'critical', 'skipped_workout_missing_reason',
       user_id, workout_id, scheduled_date,
       CONCAT('skipped_at=', skipped_at, ', reason=', skip_reason)
FROM workout_scope
WHERE skipped IS TRUE
  AND (skipped_at IS NULL OR skip_reason IS NULL)

UNION ALL
SELECT 'critical', 'weekday_mismatch_after_move',
       user_id, workout_id, scheduled_date,
       CONCAT('weekday=', weekday, ', isodow=', scheduled_isodow)
FROM workout_scope
WHERE weekday IS DISTINCT FROM scheduled_isodow

UNION ALL
SELECT 'critical', 'calendar_event_orphan_workout',
       user_id, workout_id, NULL::date,
       event_id::text
FROM event_scope
WHERE matched_workout_id IS NULL

UNION ALL
SELECT 'critical', 'calendar_event_invalid_action',
       user_id, workout_id, NULL::date,
       action
FROM event_scope
WHERE action NOT IN ('moved', 'skipped', 'redistributed')

UNION ALL
SELECT 'warning', 'moved_workout_missing_event',
       user_id, workout_id, scheduled_date,
       CONCAT('from=', rescheduled_from, ', moved_at=', rescheduled_at)
FROM workout_scope w
WHERE rescheduled_from IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.workout_calendar_events e
    WHERE e.workout_id = w.workout_id
      AND e.action = 'moved'
  )

UNION ALL
SELECT 'warning', 'skipped_workout_missing_event',
       user_id, workout_id, scheduled_date,
       skip_reason
FROM workout_scope w
WHERE skipped IS TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.workout_calendar_events e
    WHERE e.workout_id = w.workout_id
      AND e.action = 'skipped'
  )

UNION ALL
SELECT 'info', 'calendar_event_counts',
       NULL::uuid, NULL::uuid, NULL::date,
       CONCAT(action, '=', COUNT(*))
FROM event_scope
GROUP BY action

ORDER BY severity, check_name, user_id, scheduled_date, workout_id;
