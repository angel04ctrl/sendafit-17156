-- Sprint 2: active workout sessions and logged sets.

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  duration_seconds integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_sessions_status_check CHECK (status IN ('active', 'completed', 'cancelled')),
  CONSTRAINT workout_sessions_duration_non_negative CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_one_active_per_workout
  ON public.workout_sessions (user_id, workout_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS workout_sessions_user_status_idx
  ON public.workout_sessions (user_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.workout_session_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  workout_exercise_id uuid REFERENCES public.workout_exercises(id) ON DELETE SET NULL,
  exercise_id text,
  set_number integer NOT NULL,
  target_reps integer,
  actual_reps integer,
  target_weight numeric,
  actual_weight numeric,
  rir integer,
  rpe integer,
  rest_seconds integer,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_session_sets_set_number_check CHECK (set_number > 0),
  CONSTRAINT workout_session_sets_actual_reps_check CHECK (actual_reps IS NULL OR actual_reps >= 0),
  CONSTRAINT workout_session_sets_target_reps_check CHECK (target_reps IS NULL OR target_reps >= 0),
  CONSTRAINT workout_session_sets_weight_check CHECK (
    (target_weight IS NULL OR target_weight >= 0)
    AND (actual_weight IS NULL OR actual_weight >= 0)
  ),
  CONSTRAINT workout_session_sets_rir_check CHECK (rir IS NULL OR rir BETWEEN 0 AND 10),
  CONSTRAINT workout_session_sets_rpe_check CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  CONSTRAINT workout_session_sets_rest_check CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
  CONSTRAINT workout_session_sets_unique_set UNIQUE (session_id, workout_exercise_id, set_number)
);

CREATE INDEX IF NOT EXISTS workout_session_sets_session_idx
  ON public.workout_session_sets (session_id, workout_exercise_id, set_number);

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_session_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workout sessions" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can insert own workout sessions" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can update own workout sessions" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can delete own workout sessions" ON public.workout_sessions;

CREATE POLICY "Users can view own workout sessions"
  ON public.workout_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout sessions"
  ON public.workout_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.workouts
      WHERE workouts.id = workout_sessions.workout_id
        AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own workout sessions"
  ON public.workout_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout sessions"
  ON public.workout_sessions FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own workout session sets" ON public.workout_session_sets;
DROP POLICY IF EXISTS "Users can insert own workout session sets" ON public.workout_session_sets;
DROP POLICY IF EXISTS "Users can update own workout session sets" ON public.workout_session_sets;
DROP POLICY IF EXISTS "Users can delete own workout session sets" ON public.workout_session_sets;

CREATE POLICY "Users can view own workout session sets"
  ON public.workout_session_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workout_sessions
      WHERE workout_sessions.id = workout_session_sets.session_id
        AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own workout session sets"
  ON public.workout_session_sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workout_sessions
      WHERE workout_sessions.id = workout_session_sets.session_id
        AND workout_sessions.user_id = auth.uid()
        AND workout_sessions.status = 'active'
    )
  );

CREATE POLICY "Users can update own workout session sets"
  ON public.workout_session_sets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workout_sessions
      WHERE workout_sessions.id = workout_session_sets.session_id
        AND workout_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workout_sessions
      WHERE workout_sessions.id = workout_session_sets.session_id
        AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own workout session sets"
  ON public.workout_session_sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workout_sessions
      WHERE workout_sessions.id = workout_session_sets.session_id
        AND workout_sessions.user_id = auth.uid()
    )
  );
