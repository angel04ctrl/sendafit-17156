-- Sprint 8 - Exercise substitutions and workout adaptation.
-- Safe migration: additive metadata + audit table + atomic RPC.

BEGIN;

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS original_exercise_id text REFERENCES public.exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_name text,
  ADD COLUMN IF NOT EXISTS substitution_reason text,
  ADD COLUMN IF NOT EXISTS substituted_at timestamptz,
  ADD COLUMN IF NOT EXISTS substitution_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.workout_exercises
  DROP CONSTRAINT IF EXISTS workout_exercises_substitution_reason_check,
  DROP CONSTRAINT IF EXISTS workout_exercises_substitution_count_check;

ALTER TABLE public.workout_exercises
  ADD CONSTRAINT workout_exercises_substitution_reason_check
  CHECK (
    substitution_reason IS NULL
    OR substitution_reason IN ('machine_busy', 'pain_discomfort', 'not_available', 'preference', 'app_recommended')
  ),
  ADD CONSTRAINT workout_exercises_substitution_count_check
  CHECK (substitution_count >= 0);

CREATE TABLE IF NOT EXISTS public.workout_exercise_substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  workout_exercise_id uuid NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  original_exercise_id text REFERENCES public.exercises(id) ON DELETE SET NULL,
  original_name text NOT NULL,
  new_exercise_id text NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  new_name text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_exercise_substitutions_reason_check
  CHECK (reason IN ('machine_busy', 'pain_discomfort', 'not_available', 'preference', 'app_recommended'))
);

ALTER TABLE public.workout_exercise_substitutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own exercise substitutions"
ON public.workout_exercise_substitutions;

CREATE POLICY "Users can view own exercise substitutions"
ON public.workout_exercise_substitutions
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own exercise substitutions"
ON public.workout_exercise_substitutions;

CREATE POLICY "Users can insert own exercise substitutions"
ON public.workout_exercise_substitutions
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS workout_exercise_substitutions_user_created_idx
  ON public.workout_exercise_substitutions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workout_exercise_substitutions_workout_exercise_idx
  ON public.workout_exercise_substitutions (workout_exercise_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.substitute_workout_exercise(
  _workout_exercise_id uuid,
  _new_exercise_id text,
  _reason text
)
RETURNS public.workout_exercises
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _old public.workout_exercises%ROWTYPE;
  _new public.exercises%ROWTYPE;
  _workout public.workouts%ROWTYPE;
  _result public.workout_exercises%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _reason NOT IN ('machine_busy', 'pain_discomfort', 'not_available', 'preference', 'app_recommended') THEN
    RAISE EXCEPTION 'invalid_substitution_reason';
  END IF;

  SELECT *
  INTO _old
  FROM public.workout_exercises
  WHERE id = _workout_exercise_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workout_exercise_not_found';
  END IF;

  SELECT *
  INTO _workout
  FROM public.workouts
  WHERE id = _old.workout_id
    AND user_id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workout_not_owned';
  END IF;

  SELECT *
  INTO _new
  FROM public.exercises
  WHERE id = _new_exercise_id
    AND estado_calidad = 'curado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'replacement_exercise_not_available';
  END IF;

  IF _old.exercise_id = _new.id THEN
    RAISE EXCEPTION 'replacement_same_as_original';
  END IF;

  INSERT INTO public.workout_exercise_substitutions (
    user_id,
    workout_id,
    workout_exercise_id,
    original_exercise_id,
    original_name,
    new_exercise_id,
    new_name,
    reason
  )
  VALUES (
    _user_id,
    _old.workout_id,
    _old.id,
    COALESCE(_old.original_exercise_id, _old.exercise_id),
    COALESCE(_old.original_name, _old.name),
    _new.id,
    _new.nombre,
    _reason
  );

  UPDATE public.workout_exercises
  SET
    original_exercise_id = COALESCE(original_exercise_id, _old.exercise_id),
    original_name = COALESCE(original_name, _old.name),
    exercise_id = _new.id,
    name = _new.nombre,
    rest_seconds = COALESCE(_new.descanso_segundos_max, _new.descanso_segundos_min, rest_seconds),
    target_rir = CASE
      WHEN lower(COALESCE(_new.tipo_entrenamiento, '')) LIKE '%cardio%' THEN NULL
      ELSE COALESCE(_new.rir_recomendado, target_rir, 2)
    END,
    duration_minutes = CASE
      WHEN _new.duracion_promedio_segundos IS NULL THEN duration_minutes
      ELSE CEIL(_new.duracion_promedio_segundos / 60.0)::integer
    END,
    substitution_reason = _reason,
    substituted_at = now(),
    substitution_count = substitution_count + 1
  WHERE id = _old.id
  RETURNING * INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.substitute_workout_exercise(uuid, text, text) TO authenticated;

COMMENT ON TABLE public.workout_exercise_substitutions IS
  'Audit trail for Sprint 8 exercise substitutions. Keeps original and replacement exercise identity.';
COMMENT ON FUNCTION public.substitute_workout_exercise(uuid, text, text) IS
  'Atomically substitutes one workout_exercise while preserving original exercise metadata and audit trail.';

COMMIT;
