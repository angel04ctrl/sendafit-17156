-- Sprint 11 - AI machine analysis integrated into workouts.
-- Safe migration: additive metadata for scan history and favorite machine exercises.

BEGIN;

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
