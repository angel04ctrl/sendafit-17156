-- Add DELETE policy for profiles
-- Users can only delete their own profile
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Create trigger to prevent profile ID modification
-- This ensures the profile ID always matches the auth user
CREATE OR REPLACE FUNCTION public.prevent_profile_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent changing the profile ID
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Cannot modify profile ID. This violates security policy.';
  END IF;
  
  -- Ensure the ID matches the authenticated user
  IF NEW.id != auth.uid() THEN
    RAISE EXCEPTION 'Profile ID must match authenticated user ID.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to profiles table
DROP TRIGGER IF EXISTS enforce_profile_id_security ON public.profiles;
CREATE TRIGGER enforce_profile_id_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_id_change();

-- Add security comment to the table
COMMENT ON TABLE public.profiles IS 
'CRITICAL SECURITY: Contains highly sensitive personal health data (PHI).
RLS policies enforce: Users can only SELECT/INSERT/UPDATE/DELETE their own profile.
Additional protections: 
  - Trigger prevents profile ID modification
  - All operations validate id = auth.uid()
  - No public or anon access allowed
Recommendations:
  - Enable MFA for all users handling health data
  - Implement rate limiting on profile access
  - Enable audit logging for compliance
  - Use HTTPS only for all communications';

-- Add security comment to sensitive columns
COMMENT ON COLUMN public.profiles.health_conditions IS 'HIPAA/PHI: Protected health information';
COMMENT ON COLUMN public.profiles.current_medications IS 'HIPAA/PHI: Protected health information';
COMMENT ON COLUMN public.profiles.injuries_limitations IS 'HIPAA/PHI: Protected health information';
COMMENT ON COLUMN public.profiles.menstrual_tracking_enabled IS 'HIPAA/PHI: Protected health information';
COMMENT ON COLUMN public.profiles.stress_level IS 'HIPAA/PHI: Protected health information';
COMMENT ON COLUMN public.profiles.average_sleep_hours IS 'HIPAA/PHI: Protected health information';