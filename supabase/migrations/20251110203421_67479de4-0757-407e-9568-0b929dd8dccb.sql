-- Create security definer function to validate user ownership
CREATE OR REPLACE FUNCTION public.validate_user_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For profiles table, ensure id matches auth.uid()
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.id != auth.uid() THEN
      RAISE EXCEPTION 'Cannot modify another user''s profile';
    END IF;
  END IF;
  
  -- For health_data table, ensure user_id matches auth.uid()
  IF TG_TABLE_NAME = 'health_data' THEN
    IF NEW.user_id != auth.uid() THEN
      RAISE EXCEPTION 'Cannot insert health data for another user';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to profiles table for INSERT and UPDATE
DROP TRIGGER IF EXISTS validate_profile_ownership ON public.profiles;
CREATE TRIGGER validate_profile_ownership
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_ownership();

-- Add trigger to health_data table for INSERT
DROP TRIGGER IF EXISTS validate_health_data_ownership ON public.health_data;
CREATE TRIGGER validate_health_data_ownership
  BEFORE INSERT ON public.health_data
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_ownership();

-- Add DELETE policy for health_data (only users can delete their own data)
CREATE POLICY "Users can delete own health data"
ON public.health_data
FOR DELETE
USING (auth.uid() = user_id);

-- Ensure health_data cannot be updated by anyone (immutable records for audit trail)
-- This is already the case, but let's be explicit about it

-- Add additional constraint to profiles table
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_not_null;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_not_null CHECK (id IS NOT NULL);

-- Add constraint to health_data table
ALTER TABLE public.health_data
  DROP CONSTRAINT IF EXISTS health_data_user_id_not_null;
ALTER TABLE public.health_data
  ADD CONSTRAINT health_data_user_id_not_null CHECK (user_id IS NOT NULL);