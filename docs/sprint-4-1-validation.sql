-- Sprint 4.1 validation queries.

-- 1. Suggestions that fell back to snapshot even though the saved workout set has exercise_id.
SELECT eps.*
FROM public.exercise_progression_suggestions eps
WHERE eps.source = 'snapshot'
  AND eps.exercise_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.workout_session_sets wss
    WHERE wss.exercise_name_snapshot = eps.exercise_name_snapshot
      AND wss.exercise_id IS NOT NULL
  );

-- 2. Duplicate suggestions per user/exercise/session/action.
SELECT user_id, exercise_key, workout_session_id, suggested_action, count(*) AS duplicates
FROM public.exercise_progression_suggestions
WHERE workout_session_id IS NOT NULL
GROUP BY user_id, exercise_key, workout_session_id, suggested_action
HAVING count(*) > 1;

-- 3. Painful base sessions that still recommended increasing weight.
SELECT eps.*, ws.session_feeling, ws.pain_flag
FROM public.exercise_progression_suggestions eps
JOIN public.workout_sessions ws ON ws.id = eps.based_on_session_id
WHERE eps.suggested_action = 'increase_weight'
  AND (ws.pain_flag = true OR ws.session_feeling = 'pain');

-- 4. Completed sets with invalid set number for their workout exercise.
SELECT wss.*, we.sets AS target_sets
FROM public.workout_session_sets wss
JOIN public.workout_exercises we ON we.id = wss.workout_exercise_id
WHERE wss.completed = true
  AND (wss.set_number < 1 OR wss.set_number > COALESCE(we.sets, 1));

-- 5. Potential custom/AI/manual plan records that should not be deleted automatically.
SELECT id, user_id, name, tipo, plan_id, completed, scheduled_date, description
FROM public.workouts
WHERE tipo = 'manual'
   OR plan_id IS NULL
   OR lower(COALESCE(description, '')) LIKE '%ia%'
   OR lower(COALESCE(description, '')) LIKE '%personalizada%'
   OR lower(COALESCE(description, '')) LIKE '%coach%';

-- 6. Owner PRO status and expiration.
SELECT
  p.id,
  p.full_name,
  us.plan,
  us.provider,
  us.status,
  us.current_period_start,
  us.current_period_end,
  public.is_user_pro(p.id) AS is_user_pro
FROM public.profiles p
LEFT JOIN public.user_subscriptions us ON us.user_id = p.id
WHERE p.id::text LIKE '96ff31bf%'
  AND p.full_name = 'Angel Augusto Perez Tek';

-- 7. Coach day-change confirmation is enforced in code before routine metadata is generated.
-- Manual check: ask Coach "plan para toda la semana" while profile has fewer selected weekdays.
-- Expected: response asks whether to use profile days or requested days and does not update profiles.available_weekdays.
SELECT id, full_name, available_weekdays, updated_at
FROM public.profiles
WHERE id::text LIKE '96ff31bf%'
  AND full_name = 'Angel Augusto Perez Tek';
