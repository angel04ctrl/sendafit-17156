-- Sprint 4 validation queries.

-- 1. Saved suggestions without a visible reason.
SELECT *
FROM public.exercise_progression_suggestions
WHERE reason IS NULL
   OR length(trim(reason)) = 0;

-- 2. Invalid confidence/action/source values.
SELECT *
FROM public.exercise_progression_suggestions
WHERE confidence NOT IN ('high', 'medium', 'low')
   OR source NOT IN ('exercise_id', 'snapshot')
   OR suggested_action NOT IN ('increase_weight', 'maintain_weight', 'decrease_weight', 'increase_reps', 'no_data', 'blocked_pain');

-- 3. Fallback suggestions that are not conservative low-confidence records.
SELECT *
FROM public.exercise_progression_suggestions
WHERE source = 'snapshot'
  AND (confidence <> 'low' OR suggested_action = 'increase_weight');

-- 4. Suggestions that recommended increasing weight from a painful base session.
SELECT eps.*, ws.session_feeling, ws.pain_flag
FROM public.exercise_progression_suggestions eps
JOIN public.workout_sessions ws ON ws.id = eps.based_on_session_id
WHERE eps.suggested_action = 'increase_weight'
  AND (ws.pain_flag = true OR ws.session_feeling = 'pain');

-- 5. Recent suggestions by user/exercise for manual review.
SELECT
  user_id,
  exercise_id,
  exercise_name_snapshot,
  source,
  suggested_action,
  suggested_weight,
  suggested_reps,
  confidence,
  reason,
  created_at
FROM public.exercise_progression_suggestions
ORDER BY created_at DESC
LIMIT 50;
