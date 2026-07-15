-- Sprint 11 - AI machine analysis integrated into workouts.
-- Safe migration: additive metadata for scan history and favorite machine exercises.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_function_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_function_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own AI usage" ON public.ai_function_usage;
CREATE POLICY "Users can view own AI usage"
  ON public.ai_function_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_function_usage_user_function_created
  ON public.ai_function_usage (user_id, function_name, created_at DESC);

CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id uuid,
  _function_name text,
  _hourly_limit integer DEFAULT 5,
  _daily_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hourly_count integer;
  daily_count integer;
BEGIN
  SELECT COUNT(*) INTO hourly_count
  FROM public.ai_function_usage
  WHERE user_id = _user_id
    AND function_name = _function_name
    AND created_at > now() - interval '1 hour';

  IF hourly_count >= _hourly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', 'hour',
      'retryAfterSeconds', 3600
    );
  END IF;

  SELECT COUNT(*) INTO daily_count
  FROM public.ai_function_usage
  WHERE user_id = _user_id
    AND function_name = _function_name
    AND created_at > now() - interval '1 day';

  IF daily_count >= _daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', 'day',
      'retryAfterSeconds', 86400
    );
  END IF;

  INSERT INTO public.ai_function_usage (user_id, function_name)
  VALUES (_user_id, _function_name);

  RETURN jsonb_build_object(
    'allowed', true,
    'hourlyRemaining', GREATEST(_hourly_limit - hourly_count - 1, 0),
    'dailyRemaining', GREATEST(_daily_limit - daily_count - 1, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(uuid, text, integer, integer) TO service_role;

ALTER TABLE public.machine_scan_history
  ADD COLUMN IF NOT EXISTS confidence_score numeric,
  ADD COLUMN IF NOT EXISTS uncertainty_reason text,
  ADD COLUMN IF NOT EXISTS setup_steps text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS execution_steps text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS common_mistakes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS safety_warnings text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS recommended_sets integer,
  ADD COLUMN IF NOT EXISTS recommended_reps text,
  ADD COLUMN IF NOT EXISTS recommended_rest_seconds integer,
  ADD COLUMN IF NOT EXISTS possible_exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS not_sure_fallback text;

ALTER TABLE public.machine_scan_history
  DROP CONSTRAINT IF EXISTS machine_scan_history_confidence_check,
  DROP CONSTRAINT IF EXISTS machine_scan_history_prescription_check;

ALTER TABLE public.machine_scan_history
  ADD CONSTRAINT machine_scan_history_confidence_check
  CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  ADD CONSTRAINT machine_scan_history_prescription_check
  CHECK (
    (recommended_sets IS NULL OR recommended_sets BETWEEN 1 AND 10)
    AND (recommended_rest_seconds IS NULL OR recommended_rest_seconds BETWEEN 15 AND 600)
  );

CREATE TABLE IF NOT EXISTS public.machine_exercise_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  machine_scan_id uuid REFERENCES public.machine_scan_history(id) ON DELETE SET NULL,
  machine_name text NOT NULL,
  exercise_name text NOT NULL,
  exercise_id text REFERENCES public.exercises(id) ON DELETE SET NULL,
  primary_muscles text[] NOT NULL DEFAULT '{}'::text[],
  secondary_muscles text[] NOT NULL DEFAULT '{}'::text[],
  recommended_sets integer,
  recommended_reps text,
  recommended_rest_seconds integer,
  confidence_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT machine_exercise_favorites_confidence_check
  CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1)
);

ALTER TABLE public.machine_exercise_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own machine exercise favorites" ON public.machine_exercise_favorites;
CREATE POLICY "Users can view own machine exercise favorites"
ON public.machine_exercise_favorites
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own machine exercise favorites" ON public.machine_exercise_favorites;
CREATE POLICY "Users can insert own machine exercise favorites"
ON public.machine_exercise_favorites
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own machine exercise favorites" ON public.machine_exercise_favorites;
CREATE POLICY "Users can delete own machine exercise favorites"
ON public.machine_exercise_favorites
FOR DELETE
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS machine_scan_history_user_created_idx
  ON public.machine_scan_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS machine_exercise_favorites_user_created_idx
  ON public.machine_exercise_favorites (user_id, created_at DESC);

COMMENT ON TABLE public.machine_exercise_favorites IS
  'Favorite exercises created from Sprint 11 AI machine scans.';
COMMENT ON COLUMN public.machine_scan_history.posture_tips IS
  'Text posture tips. Sprint 11 keeps this column as text and stores structured setup/execution steps separately.';

COMMIT;
