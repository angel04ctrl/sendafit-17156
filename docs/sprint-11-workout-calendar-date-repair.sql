-- Sprint 11 - Reparacion puntual de fechas de workouts automaticos de la semana actual.
-- Ejecutar en Supabase SQL Editor si la vista Semana agrupa varios dias en una sola fecha
-- o si Hoy aparece vacio aunque exista un workout con el weekday correcto.
--
-- Seguro: solo toca workouts automaticos pendientes/no saltados de la semana ISO actual,
-- conserva historial, y agrega eventos de calendario tipo moved para auditoria.

BEGIN;

WITH current_week AS (
  SELECT
    date_trunc('week', CURRENT_DATE)::date AS week_start,
    (date_trunc('week', CURRENT_DATE)::date + 6) AS week_end
),
misdated AS (
  SELECT
    w.id,
    w.user_id,
    w.scheduled_date AS old_date,
    (cw.week_start + ((w.weekday - 1) * INTERVAL '1 day'))::date AS expected_date
  FROM public.workouts w
  CROSS JOIN current_week cw
  WHERE w.tipo = 'automatico'
    AND w.completed IS DISTINCT FROM true
    AND COALESCE(w.skipped, false) IS DISTINCT FROM true
    AND w.weekday BETWEEN 1 AND 7
    AND w.scheduled_date >= cw.week_start
    AND w.scheduled_date <= cw.week_end
    AND w.scheduled_date IS DISTINCT FROM (cw.week_start + ((w.weekday - 1) * INTERVAL '1 day'))::date
),
updated AS (
  UPDATE public.workouts w
  SET
    scheduled_date = m.expected_date,
    rescheduled_from = COALESCE(w.rescheduled_from, m.old_date),
    rescheduled_at = now()
  FROM misdated m
  WHERE w.id = m.id
  RETURNING w.id, w.user_id, m.old_date, w.scheduled_date
)
INSERT INTO public.workout_calendar_events (
  user_id,
  workout_id,
  action,
  from_date,
  to_date,
  reason
)
SELECT
  user_id,
  id,
  'moved',
  old_date,
  scheduled_date,
  'repair_weekday_date_alignment'
FROM updated;

COMMIT;

-- Verificacion rapida: debe devolver 0 filas.
WITH current_week AS (
  SELECT
    date_trunc('week', CURRENT_DATE)::date AS week_start,
    (date_trunc('week', CURRENT_DATE)::date + 6) AS week_end
)
SELECT
  id,
  name,
  scheduled_date,
  weekday,
  EXTRACT(ISODOW FROM scheduled_date)::int AS expected_weekday
FROM public.workouts w
CROSS JOIN current_week cw
WHERE w.tipo = 'automatico'
  AND w.completed IS DISTINCT FROM true
  AND COALESCE(w.skipped, false) IS DISTINCT FROM true
  AND w.scheduled_date >= cw.week_start
  AND w.scheduled_date <= cw.week_end
  AND w.weekday IS DISTINCT FROM EXTRACT(ISODOW FROM w.scheduled_date)::int;
