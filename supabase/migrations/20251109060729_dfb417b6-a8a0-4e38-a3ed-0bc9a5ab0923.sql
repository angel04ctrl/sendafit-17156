-- Fix search_path for immutable function
CREATE OR REPLACE FUNCTION public.calculate_weekday_from_date(date_val date)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
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