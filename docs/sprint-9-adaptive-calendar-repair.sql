-- Sprint 9 - Reparacion segura de calendario adaptativo.
-- Ejecutar en Supabase SQL Editor solo si la validacion reporta:
-- - pending_workout_date_conflict en fechas pasadas
-- - weekday_mismatch_after_move
--
-- No borra workouts. Corrige weekday y marca como saltados los pendientes
-- historicos duplicados para que no sigan bloqueando el calendario adaptativo.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sprint9_adaptive_calendar_repair_backup AS
SELECT *
FROM public.workouts
WHERE false;

INSERT INTO public.sprint9_adaptive_calendar_repair_backup
SELECT w.*
FROM public.workouts w
WHERE w.weekday IS DISTINCT FROM EXTRACT(ISODOW FROM w.scheduled_date)::int
   OR EXISTS (
     SELECT 1
     FROM public.workouts w2
     WHERE w2.user_id = w.user_id
       AND w2.scheduled_date = w.scheduled_date
       AND w2.completed IS DISTINCT FROM true
       AND COALESCE(w2.skipped, false) IS DISTINCT FROM true
       AND w2.scheduled_date < CURRENT_DATE
     GROUP BY w2.user_id, w2.scheduled_date
     HAVING COUNT(*) > 1
   )
ON CONFLICT DO NOTHING;

-- Corrige el dia ISO en todos los workouts con scheduled_date valido.
UPDATE public.workouts
SET weekday = EXTRACT(ISODOW FROM scheduled_date)::int
WHERE scheduled_date IS NOT NULL
  AND weekday IS DISTINCT FROM EXTRACT(ISODOW FROM scheduled_date)::int;

WITH duplicate_past_pending AS (
  SELECT
    w.id,
    w.user_id,
    w.scheduled_date,
    ROW_NUMBER() OVER (
      PARTITION BY w.user_id, w.scheduled_date
      ORDER BY COALESCE(w.created_at, w.scheduled_date::timestamptz) DESC, w.id
    ) AS keep_rank,
    COUNT(*) OVER (PARTITION BY w.user_id, w.scheduled_date) AS day_count
  FROM public.workouts w
  WHERE w.scheduled_date < CURRENT_DATE
    AND w.completed IS DISTINCT FROM true
    AND COALESCE(w.skipped, false) IS DISTINCT FROM true
),
to_skip AS (
  SELECT *
  FROM duplicate_past_pending
  WHERE day_count > 1
),
updated AS (
  UPDATE public.workouts w
  SET
    skipped = true,
    skipped_at = now(),
    skip_reason = 'other',
    completed = false,
    completed_at = NULL
  FROM to_skip t
  WHERE w.id = t.id
  RETURNING w.id, w.user_id, w.scheduled_date
)
INSERT INTO public.workout_calendar_events (
  user_id,
  workout_id,
  action,
  from_date,
  reason
)
SELECT
  u.user_id,
  u.id,
  'skipped',
  u.scheduled_date,
  'other'
FROM updated u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.workout_calendar_events e
  WHERE e.workout_id = u.id
    AND e.action = 'skipped'
);

COMMIT;
