-- Sprint 4: simple progression suggestions based on real workout history.
-- Additive only: stores calculated recommendations without changing workouts or calendar data.

CREATE TABLE IF NOT EXISTS public.exercise_progression_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id text,
  exercise_name_snapshot text NOT NULL,
  source text NOT NULL DEFAULT 'snapshot',
  previous_weight numeric,
  previous_reps integer[] DEFAULT '{}'::integer[],
  suggested_action text NOT NULL,
  suggested_weight numeric,
  suggested_reps integer,
  confidence text NOT NULL DEFAULT 'low',
  reason text NOT NULL,
  based_on_session_id uuid REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercise_progression_suggestions_source_check
    CHECK (source IN ('exercise_id', 'snapshot')),
  CONSTRAINT exercise_progression_suggestions_action_check
    CHECK (suggested_action IN ('increase_weight', 'maintain_weight', 'decrease_weight', 'increase_reps', 'no_data', 'blocked_pain')),
  CONSTRAINT exercise_progression_suggestions_confidence_check
    CHECK (confidence IN ('high', 'medium', 'low')),
  CONSTRAINT exercise_progression_suggestions_weight_check
    CHECK (
      (previous_weight IS NULL OR previous_weight >= 0)
      AND (suggested_weight IS NULL OR suggested_weight >= 0)
    ),
  CONSTRAINT exercise_progression_suggestions_reps_check
    CHECK (suggested_reps IS NULL OR suggested_reps >= 0)
);

CREATE INDEX IF NOT EXISTS exercise_progression_suggestions_user_created_idx
  ON public.exercise_progression_suggestions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS exercise_progression_suggestions_exercise_idx
  ON public.exercise_progression_suggestions (user_id, exercise_id, created_at DESC)
  WHERE exercise_id IS NOT NULL;

ALTER TABLE public.exercise_progression_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own progression suggestions" ON public.exercise_progression_suggestions;
DROP POLICY IF EXISTS "Users can insert own progression suggestions" ON public.exercise_progression_suggestions;
DROP POLICY IF EXISTS "Users can delete own progression suggestions" ON public.exercise_progression_suggestions;

CREATE POLICY "Users can view own progression suggestions"
  ON public.exercise_progression_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progression suggestions"
  ON public.exercise_progression_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own progression suggestions"
  ON public.exercise_progression_suggestions FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.exercise_progression_suggestions IS 'Sprint 4 simple progression recommendations generated from real workout history.';
COMMENT ON COLUMN public.exercise_progression_suggestions.source IS 'exercise_id when based on stable exercise_id history, snapshot when fallback used by exercise name.';
