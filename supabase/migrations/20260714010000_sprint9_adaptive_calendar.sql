-- Sprint 9 - Adaptive calendar for moving and skipping workouts.
-- Safe migration: additive fields, audit trail, and ownership-checked RPCs.

BEGIN;

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS skip_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_from date,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz;

ALTER TABLE public.workouts
  DROP CONSTRAINT IF EXISTS workouts_skip_reason_check,
  DROP CONSTRAINT IF EXISTS workouts_skipped_metadata_check;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_skip_reason_check
  CHECK (
    skip_reason IS NULL
    OR skip_reason IN ('no_time', 'tired', 'pain', 'travel', 'other')
  ),
  ADD CONSTRAINT workouts_skipped_metadata_check
  CHECK (
    (skipped = false AND skipped_at IS NULL AND skip_reason IS NULL)
    OR (skipped = true AND skipped_at IS NOT NULL AND skip_reason IS NOT NULL)
  );

CREATE TABLE IF NOT EXISTS public.workout_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_date date,
  to_date date,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_calendar_events_action_check
  CHECK (action IN ('moved', 'skipped', 'redistributed'))
);

ALTER TABLE public.workout_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workout calendar events"
ON public.workout_calendar_events;

CREATE POLICY "Users can view own workout calendar events"
ON public.workout_calendar_events
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own workout calendar events"
ON public.workout_calendar_events;

CREATE POLICY "Users can insert own workout calendar events"
ON public.workout_calendar_events
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS workouts_user_scheduled_active_idx
  ON public.workouts (user_id, scheduled_date)
  WHERE completed IS DISTINCT FROM true AND skipped IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS workout_calendar_events_user_created_idx
  ON public.workout_calendar_events (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sprint9_isodow(_date date)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(ISODOW FROM _date)::integer
$$;

CREATE OR REPLACE FUNCTION public.move_workout_to_date(
  _workout_id uuid,
  _new_date date
)
RETURNS public.workouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _old public.workouts%ROWTYPE;
  _result public.workouts%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _new_date IS NULL THEN
    RAISE EXCEPTION 'new_date_required';
  END IF;

  SELECT *
  INTO _old
  FROM public.workouts
  WHERE id = _workout_id
    AND user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workout_not_found';
  END IF;

  IF _old.completed IS TRUE THEN
    RAISE EXCEPTION 'completed_workout_cannot_move';
  END IF;

  IF _old.scheduled_date = _new_date THEN
    RETURN _old;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workouts w
    WHERE w.user_id = _user_id
      AND w.id <> _old.id
      AND w.scheduled_date = _new_date
      AND w.completed IS DISTINCT FROM true
      AND COALESCE(w.skipped, false) IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'workout_date_conflict';
  END IF;

  UPDATE public.workouts
  SET
    scheduled_date = _new_date,
    weekday = public.sprint9_isodow(_new_date),
    skipped = false,
    skipped_at = NULL,
    skip_reason = NULL,
    rescheduled_from = COALESCE(rescheduled_from, _old.scheduled_date),
    rescheduled_at = now()
  WHERE id = _old.id
  RETURNING * INTO _result;

  INSERT INTO public.workout_calendar_events (
    user_id,
    workout_id,
    action,
    from_date,
    to_date
  )
  VALUES (
    _user_id,
    _old.id,
    'moved',
    _old.scheduled_date,
    _new_date
  );

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.skip_workout(
  _workout_id uuid,
  _reason text
)
RETURNS public.workouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _old public.workouts%ROWTYPE;
  _result public.workouts%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _reason NOT IN ('no_time', 'tired', 'pain', 'travel', 'other') THEN
    RAISE EXCEPTION 'invalid_skip_reason';
  END IF;

  SELECT *
  INTO _old
  FROM public.workouts
  WHERE id = _workout_id
    AND user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workout_not_found';
  END IF;

  IF _old.completed IS TRUE THEN
    RAISE EXCEPTION 'completed_workout_cannot_skip';
  END IF;

  UPDATE public.workout_sessions
  SET
    status = 'cancelled',
    finished_at = COALESCE(finished_at, now()),
    notes = COALESCE(notes, 'Cancelada al saltar entrenamiento')
  WHERE user_id = _user_id
    AND workout_id = _old.id
    AND status = 'active';

  UPDATE public.workouts
  SET
    skipped = true,
    skipped_at = now(),
    skip_reason = _reason,
    completed = false,
    completed_at = NULL
  WHERE id = _old.id
  RETURNING * INTO _result;

  INSERT INTO public.workout_calendar_events (
    user_id,
    workout_id,
    action,
    from_date,
    reason
  )
  VALUES (
    _user_id,
    _old.id,
    'skipped',
    _old.scheduled_date,
    _reason
  );

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_workout_to_date(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_workout(uuid, text) TO authenticated;

COMMENT ON TABLE public.workout_calendar_events IS
  'Audit trail for Sprint 9 adaptive calendar actions.';
COMMENT ON FUNCTION public.move_workout_to_date(uuid, date) IS
  'Moves a pending workout to a new date after ownership and same-day conflict checks.';
COMMENT ON FUNCTION public.skip_workout(uuid, text) IS
  'Marks a pending workout as skipped and stores the reason without deleting history.';

COMMIT;
