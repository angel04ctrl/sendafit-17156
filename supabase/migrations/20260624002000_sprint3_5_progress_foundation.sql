-- Sprint 3.5: technical closure before load progression.

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS exercise_id text REFERENCES public.exercises(id) ON DELETE SET NULL;

ALTER TABLE public.workout_session_sets
  ADD COLUMN IF NOT EXISTS exercise_name_snapshot text,
  ADD COLUMN IF NOT EXISTS workout_exercise_name_snapshot text;

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS session_feeling text,
  ADD COLUMN IF NOT EXISTS pain_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pain_notes text,
  ADD COLUMN IF NOT EXISTS overall_rpe numeric,
  ADD COLUMN IF NOT EXISTS user_notes text;

ALTER TABLE public.workout_sessions
  DROP CONSTRAINT IF EXISTS workout_sessions_session_feeling_check,
  DROP CONSTRAINT IF EXISTS workout_sessions_overall_rpe_check;

ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_session_feeling_check
  CHECK (session_feeling IS NULL OR session_feeling IN ('strong', 'normal', 'tired', 'pain')),
  ADD CONSTRAINT workout_sessions_overall_rpe_check
  CHECK (overall_rpe IS NULL OR overall_rpe BETWEEN 1 AND 10);

CREATE INDEX IF NOT EXISTS workout_exercises_exercise_id_idx
  ON public.workout_exercises (exercise_id);

CREATE INDEX IF NOT EXISTS workout_session_sets_exercise_id_idx
  ON public.workout_session_sets (exercise_id);

-- Existing unique partial index from Sprint 2. Re-declare defensively.
CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_one_active_per_workout
  ON public.workout_sessions (user_id, workout_id)
  WHERE status = 'active';

-- Backfill catalog ids on workout_exercises from exact exercise names.
UPDATE public.workout_exercises we
SET exercise_id = e.id
FROM public.exercises e
WHERE we.exercise_id IS NULL
  AND lower(trim(we.name)) = lower(trim(e.nombre));

-- If Sprint 3 temporarily stored exercise names in workout_session_sets.exercise_id,
-- convert exact catalog-name matches to stable catalog ids.
UPDATE public.workout_session_sets wss
SET exercise_id = e.id
FROM public.exercises e
WHERE wss.exercise_id IS NOT NULL
  AND wss.exercise_id = e.nombre;

-- Backfill set exercise ids from their workout exercise rows when possible.
UPDATE public.workout_session_sets wss
SET exercise_id = we.exercise_id
FROM public.workout_exercises we
WHERE wss.workout_exercise_id = we.id
  AND wss.exercise_id IS NULL
  AND we.exercise_id IS NOT NULL;

-- Snapshot names preserve historical labels even if catalog names change later.
UPDATE public.workout_session_sets wss
SET workout_exercise_name_snapshot = we.name
FROM public.workout_exercises we
WHERE wss.workout_exercise_id = we.id
  AND wss.workout_exercise_name_snapshot IS NULL;

UPDATE public.workout_session_sets wss
SET exercise_name_snapshot = COALESCE(e.nombre, wss.workout_exercise_name_snapshot, wss.exercise_id)
FROM public.exercises e
WHERE wss.exercise_id = e.id
  AND wss.exercise_name_snapshot IS NULL;

UPDATE public.workout_session_sets
SET exercise_name_snapshot = COALESCE(exercise_name_snapshot, workout_exercise_name_snapshot, exercise_id)
WHERE exercise_name_snapshot IS NULL;

COMMENT ON COLUMN public.workout_exercises.exercise_id IS 'Stable catalog exercise id when the workout exercise comes from public.exercises.';
COMMENT ON COLUMN public.workout_session_sets.exercise_id IS 'Stable catalog exercise id when known; null for manual/freeform exercises.';
COMMENT ON COLUMN public.workout_session_sets.exercise_name_snapshot IS 'Exercise catalog/display name at the time the set was recorded.';
COMMENT ON COLUMN public.workout_session_sets.workout_exercise_name_snapshot IS 'Workout exercise display name at the time the set was recorded.';
COMMENT ON COLUMN public.workout_sessions.session_feeling IS 'Structured session feeling: strong, normal, tired, pain.';
COMMENT ON COLUMN public.workout_sessions.pain_flag IS 'True when the user reported pain or discomfort in the session.';
COMMENT ON COLUMN public.workout_sessions.pain_notes IS 'Optional pain/discomfort notes.';
COMMENT ON COLUMN public.workout_sessions.overall_rpe IS 'Optional overall session RPE from 1 to 10.';
COMMENT ON COLUMN public.workout_sessions.user_notes IS 'Freeform user notes for the session.';
