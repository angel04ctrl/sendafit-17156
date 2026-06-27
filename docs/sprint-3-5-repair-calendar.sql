-- Sprint 3.5 calendar repair.
-- Purpose: repair automatic workouts whose weekday does not match scheduled_date.
-- This does not delete workouts and never touches manual workouts.

BEGIN;

-- 1. Preview rows that will be repaired.
SELECT
  id,
  user_id,
  name,
  completed,
  scheduled_date AS current_scheduled_date,
  weekday,
  (scheduled_date::date - (EXTRACT(ISODOW FROM scheduled_date::date)::int - 1) + (weekday - 1))::date AS repaired_scheduled_date
FROM public.workouts
WHERE tipo = 'automatico'
  AND weekday IS NOT NULL
  AND weekday BETWEEN 1 AND 7
  AND scheduled_date IS NOT NULL
  AND EXTRACT(ISODOW FROM scheduled_date::date)::int <> weekday
ORDER BY user_id, scheduled_date, weekday;

-- 2. Repair automatic workouts.
UPDATE public.workouts
SET scheduled_date = (
  scheduled_date::date
  - (EXTRACT(ISODOW FROM scheduled_date::date)::int - 1)
  + (weekday - 1)
)::date
WHERE tipo = 'automatico'
  AND weekday IS NOT NULL
  AND weekday BETWEEN 1 AND 7
  AND scheduled_date IS NOT NULL
  AND EXTRACT(ISODOW FROM scheduled_date::date)::int <> weekday;

-- 3. Confirm no automatic workouts remain inconsistent.
SELECT
  id,
  user_id,
  name,
  scheduled_date,
  weekday,
  EXTRACT(ISODOW FROM scheduled_date::date)::int AS scheduled_isodow
FROM public.workouts
WHERE tipo = 'automatico'
  AND weekday IS NOT NULL
  AND scheduled_date IS NOT NULL
  AND EXTRACT(ISODOW FROM scheduled_date::date)::int <> weekday;

COMMIT;
