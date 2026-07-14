-- Sprint 7.3 - Plan identity and workout prescription persistence.
-- Safe migration: additive columns, conservative backfill, no id changes, no deletes.

BEGIN;

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS plan_source text NOT NULL DEFAULT 'legacy_unknown',
  ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT true;

ALTER TABLE public.workouts
  DROP CONSTRAINT IF EXISTS workouts_plan_source_check;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_plan_source_check
  CHECK (plan_source IN ('planner', 'predesigned', 'ai_coach', 'manual', 'personalized', 'legacy_unknown'));

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS rest_seconds integer,
  ADD COLUMN IF NOT EXISTS target_rir numeric,
  ADD COLUMN IF NOT EXISTS order_index integer;

ALTER TABLE public.workout_exercises
  DROP CONSTRAINT IF EXISTS workout_exercises_rest_seconds_check,
  DROP CONSTRAINT IF EXISTS workout_exercises_target_rir_check,
  DROP CONSTRAINT IF EXISTS workout_exercises_order_index_check;

ALTER TABLE public.workout_exercises
  ADD CONSTRAINT workout_exercises_rest_seconds_check
  CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 600),
  ADD CONSTRAINT workout_exercises_target_rir_check
  CHECK (target_rir IS NULL OR target_rir BETWEEN 0 AND 5),
  ADD CONSTRAINT workout_exercises_order_index_check
  CHECK (order_index IS NULL OR order_index > 0);

-- Conservative backfill. Unknown remains protected.
UPDATE public.workouts
SET
  plan_source = CASE
    WHEN tipo = 'manual' THEN 'manual'
    WHEN tipo = 'automatico'
      AND (
        lower(coalesce(description, '')) LIKE '%ia%'
        OR lower(coalesce(description, '')) LIKE '%coach%'
        OR lower(coalesce(description, '')) LIKE '%personalizada%'
      ) THEN 'ai_coach'
    WHEN tipo = 'automatico' AND plan_id IS NOT NULL THEN 'predesigned'
    ELSE 'legacy_unknown'
  END,
  is_protected = CASE
    WHEN tipo = 'automatico'
      AND plan_id IS NOT NULL
      AND NOT (
        lower(coalesce(description, '')) LIKE '%ia%'
        OR lower(coalesce(description, '')) LIKE '%coach%'
        OR lower(coalesce(description, '')) LIKE '%personalizada%'
      ) THEN false
    ELSE true
  END
WHERE plan_source = 'legacy_unknown';

CREATE INDEX IF NOT EXISTS workouts_user_plan_source_idx
  ON public.workouts (user_id, plan_source, scheduled_date);

CREATE INDEX IF NOT EXISTS workout_exercises_order_idx
  ON public.workout_exercises (workout_id, order_index);

COMMENT ON COLUMN public.workouts.plan_source IS
  'Origin of workout/plan materialization: planner, predesigned, ai_coach, manual, personalized, legacy_unknown.';
COMMENT ON COLUMN public.workouts.is_protected IS
  'When true, automatic planner flows must not replace this workout without explicit compatible flow.';
COMMENT ON COLUMN public.workout_exercises.rest_seconds IS
  'Plan prescription snapshot: target rest after a set for this workout exercise.';
COMMENT ON COLUMN public.workout_exercises.target_rir IS
  'Plan prescription snapshot: target reps in reserve. Execution RIR remains in workout_session_sets.rir.';
COMMENT ON COLUMN public.workout_exercises.order_index IS
  'Plan prescription snapshot: exercise order within the workout.';

COMMIT;
