-- Sprint 3.5 validation queries.

-- 1. Sets completed without stable exercise_id.
SELECT wss.*
FROM public.workout_session_sets wss
WHERE wss.completed = true
  AND wss.exercise_id IS NULL;

-- 2. Active sessions duplicated by user/workout.
SELECT user_id, workout_id, count(*) AS active_sessions
FROM public.workout_sessions
WHERE status = 'active'
GROUP BY user_id, workout_id
HAVING count(*) > 1;

-- 3. Orphan sets without an existing session.
SELECT wss.*
FROM public.workout_session_sets wss
LEFT JOIN public.workout_sessions ws ON ws.id = wss.session_id
WHERE ws.id IS NULL;

-- 4. Sessions with structured pain feedback.
SELECT id, user_id, workout_id, session_feeling, pain_flag, pain_notes, user_notes, finished_at
FROM public.workout_sessions
WHERE pain_flag = true
   OR session_feeling = 'pain';

-- 5. Weekday not matching scheduled_date.
SELECT id, user_id, name, tipo, scheduled_date, weekday,
  EXTRACT(ISODOW FROM scheduled_date::date)::int AS scheduled_isodow
FROM public.workouts
WHERE weekday IS NOT NULL
  AND scheduled_date IS NOT NULL
  AND EXTRACT(ISODOW FROM scheduled_date::date)::int <> weekday
ORDER BY scheduled_date DESC;

-- 5b. Automatic workouts that should be empty after repair migration.
SELECT
  id,
  name,
  weekday,
  scheduled_date,
  EXTRACT(ISODOW FROM scheduled_date::date)::int AS scheduled_isodow
FROM public.workouts
WHERE tipo = 'automatico'
  AND scheduled_date IS NOT NULL
  AND weekday IS NOT NULL
  AND EXTRACT(ISODOW FROM scheduled_date::date)::int <> weekday
ORDER BY scheduled_date DESC;

-- 5c. Manual workouts with mismatches, review only. Do not auto-repair.
SELECT
  id,
  name,
  weekday,
  scheduled_date,
  EXTRACT(ISODOW FROM scheduled_date::date)::int AS scheduled_isodow
FROM public.workouts
WHERE tipo = 'manual'
  AND scheduled_date IS NOT NULL
  AND weekday IS NOT NULL
  AND EXTRACT(ISODOW FROM scheduled_date::date)::int <> weekday
ORDER BY scheduled_date DESC;

-- 6. Automatic workouts with same scheduled_date but different weekday.
SELECT
  user_id,
  scheduled_date,
  count(*) AS workouts_count,
  count(*) FILTER (WHERE completed = false) AS pending_count,
  count(*) FILTER (WHERE completed = true) AS completed_count,
  count(DISTINCT weekday) AS weekday_count,
  array_agg(DISTINCT weekday ORDER BY weekday) AS weekdays
FROM public.workouts
WHERE tipo = 'automatico'
GROUP BY user_id, scheduled_date
HAVING count(DISTINCT weekday) > 1;

-- 6b. Detail rows for calendar inconsistencies.
SELECT
  id,
  user_id,
  name,
  tipo,
  completed,
  scheduled_date AS current_scheduled_date,
  weekday,
  (scheduled_date::date - (EXTRACT(ISODOW FROM scheduled_date::date)::int - 1) + (weekday - 1))::date AS repaired_scheduled_date
FROM public.workouts
WHERE tipo = 'automatico'
  AND weekday IS NOT NULL
  AND scheduled_date IS NOT NULL
  AND EXTRACT(ISODOW FROM scheduled_date::date)::int <> weekday
ORDER BY user_id, scheduled_date, weekday;

-- 7. Corrupt visible text in catalog data.
SELECT id, nombre, descripcion
FROM public.exercises
WHERE nombre LIKE '%Ãƒ%'
   OR nombre LIKE '%Ã‚%'
   OR nombre LIKE '%ï¿½%'
   OR descripcion LIKE '%Ãƒ%'
   OR descripcion LIKE '%Ã‚%'
   OR descripcion LIKE '%ï¿½%';

-- 8. Corrupt visible text in workouts and workout exercises.
SELECT id, name, description
FROM public.workouts
WHERE name LIKE '%Ãƒ%'
   OR name LIKE '%Ã‚%'
   OR name LIKE '%ï¿½%'
   OR description LIKE '%Ãƒ%'
   OR description LIKE '%Ã‚%'
   OR description LIKE '%ï¿½%';

SELECT id, workout_id, name, notes
FROM public.workout_exercises
WHERE name LIKE '%Ãƒ%'
   OR name LIKE '%Ã‚%'
   OR name LIKE '%ï¿½%'
   OR notes LIKE '%Ãƒ%'
   OR notes LIKE '%Ã‚%'
   OR notes LIKE '%ï¿½%';
