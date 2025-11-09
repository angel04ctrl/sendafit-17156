-- Enable Realtime for workouts table
ALTER PUBLICATION supabase_realtime ADD TABLE public.workouts;

-- Function to auto-calculate weekday from scheduled_date
-- weekday: 1=Monday, 2=Tuesday, ..., 7=Sunday
CREATE OR REPLACE FUNCTION public.calculate_weekday_from_date(date_val date)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- EXTRACT(DOW) returns 0=Sunday, 1=Monday, ..., 6=Saturday
  -- We need 1=Monday, ..., 7=Sunday
  RETURN CASE 
    WHEN EXTRACT(DOW FROM date_val) = 0 THEN 7  -- Sunday
    ELSE EXTRACT(DOW FROM date_val)::integer    -- Monday-Saturday
  END;
END;
$$;

-- Trigger function to auto-populate weekday and validate automatic workouts
CREATE OR REPLACE FUNCTION public.workouts_before_insert_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-calculate weekday from scheduled_date if not provided
  IF NEW.weekday IS NULL AND NEW.scheduled_date IS NOT NULL THEN
    NEW.weekday := calculate_weekday_from_date(NEW.scheduled_date);
  END IF;

  -- Validate automatic workouts have required fields
  IF NEW.tipo = 'automatico' THEN
    IF NEW.plan_id IS NULL THEN
      RAISE EXCEPTION 'Automatic workouts must have a plan_id';
    END IF;
    
    IF NEW.weekday IS NULL THEN
      RAISE EXCEPTION 'Automatic workouts must have a weekday (1-7)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS workouts_before_insert_update_trigger ON public.workouts;
CREATE TRIGGER workouts_before_insert_update_trigger
  BEFORE INSERT OR UPDATE ON public.workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.workouts_before_insert_update();