-- Sprint 4.1: progression reliability, active-session dedupe, and owner PRO support.
-- Additive and corrective only; no calendar repair or advanced routine generation.

ALTER TABLE public.exercise_progression_suggestions
  ADD COLUMN IF NOT EXISTS workout_session_id uuid REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS exercise_key text GENERATED ALWAYS AS (COALESCE(exercise_id, exercise_name_snapshot)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS exercise_progression_suggestions_session_unique
  ON public.exercise_progression_suggestions (user_id, exercise_key, workout_session_id, suggested_action);

CREATE INDEX IF NOT EXISTS exercise_progression_suggestions_session_idx
  ON public.exercise_progression_suggestions (user_id, workout_session_id, created_at DESC);

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_provider_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_provider_check
  CHECK (provider IN ('stripe', 'paypal', 'manual_admin'));

UPDATE public.user_subscriptions
SET
  current_period_start = COALESCE(current_period_start, start_date),
  current_period_end = COALESCE(current_period_end, end_date)
WHERE current_period_start IS NULL
   OR current_period_end IS NULL;

CREATE OR REPLACE FUNCTION public.is_user_pro(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (
        COALESCE(current_period_end, end_date) IS NULL
        OR COALESCE(current_period_end, end_date) > now()
      )
  );
$$;

COMMENT ON COLUMN public.exercise_progression_suggestions.workout_session_id IS 'Active workout session where the suggestion was shown/saved.';
COMMENT ON COLUMN public.exercise_progression_suggestions.exercise_key IS 'Stable dedupe key: exercise_id when present, otherwise exercise name snapshot.';
COMMENT ON COLUMN public.user_subscriptions.current_period_start IS 'Current subscription period start for Stripe/manual owner PRO compatibility.';
COMMENT ON COLUMN public.user_subscriptions.current_period_end IS 'Current subscription period end used for monthly PRO expiration checks.';
