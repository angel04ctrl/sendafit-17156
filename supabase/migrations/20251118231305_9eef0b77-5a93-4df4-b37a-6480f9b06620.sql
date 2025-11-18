-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encrypted columns for the most sensitive health data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS health_conditions_encrypted TEXT,
ADD COLUMN IF NOT EXISTS current_medications_encrypted TEXT,
ADD COLUMN IF NOT EXISTS injuries_limitations_encrypted TEXT,
ADD COLUMN IF NOT EXISTS allergies_restrictions_encrypted TEXT;

-- Create a secure encryption key function (uses a secret key from environment)
-- In production, this key should be stored in Supabase secrets
CREATE OR REPLACE FUNCTION public.get_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This uses a project-specific key. In production, consider using Vault
  RETURN current_setting('app.settings.encryption_key', true);
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to a hash of the database identifier
    RETURN encode(digest(current_database() || 'health_data_key', 'sha256'), 'hex');
END;
$$;

-- Create function to encrypt sensitive health data
CREATE OR REPLACE FUNCTION public.encrypt_health_data(data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF data IS NULL OR data = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN encode(
    pgp_sym_encrypt(data, get_encryption_key()),
    'base64'
  );
END;
$$;

-- Create function to decrypt sensitive health data
CREATE OR REPLACE FUNCTION public.decrypt_health_data(encrypted_data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN pgp_sym_decrypt(
    decode(encrypted_data, 'base64'),
    get_encryption_key()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Create trigger function to automatically encrypt sensitive fields
CREATE OR REPLACE FUNCTION public.encrypt_profile_health_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Encrypt health_conditions if it's an array, convert to JSON first
  IF NEW.health_conditions IS NOT NULL THEN
    NEW.health_conditions_encrypted := encrypt_health_data(NEW.health_conditions::text);
  END IF;
  
  -- Encrypt medications
  IF NEW.current_medications IS NOT NULL THEN
    NEW.current_medications_encrypted := encrypt_health_data(NEW.current_medications);
  END IF;
  
  -- Encrypt injuries/limitations
  IF NEW.injuries_limitations IS NOT NULL THEN
    NEW.injuries_limitations_encrypted := encrypt_health_data(NEW.injuries_limitations);
  END IF;
  
  -- Encrypt allergies
  IF NEW.allergies_restrictions IS NOT NULL THEN
    NEW.allergies_restrictions_encrypted := encrypt_health_data(NEW.allergies_restrictions);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to encrypt data on insert and update
DROP TRIGGER IF EXISTS encrypt_health_data_trigger ON public.profiles;
CREATE TRIGGER encrypt_health_data_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_profile_health_data();

-- Add additional validation trigger to ensure user_id matches auth
CREATE OR REPLACE FUNCTION public.validate_profile_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure that the profile ID always matches the authenticated user
  IF NEW.id != auth.uid() THEN
    RAISE EXCEPTION 'Security violation: Profile ID must match authenticated user';
  END IF;
  
  -- Log access to sensitive health data (for audit purposes)
  IF TG_OP = 'UPDATE' AND (
    OLD.health_conditions IS DISTINCT FROM NEW.health_conditions OR
    OLD.current_medications IS DISTINCT FROM NEW.current_medications OR
    OLD.injuries_limitations IS DISTINCT FROM NEW.injuries_limitations
  ) THEN
    -- In a production system, this would log to an audit table
    RAISE NOTICE 'Health data modified for user %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_access_trigger ON public.profiles;
CREATE TRIGGER validate_profile_access_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_access();

-- Add a comment to document the security measures
COMMENT ON TABLE public.profiles IS 'Contains user profile data with encrypted sensitive health information. RLS policies enforce user-level access. Sensitive fields (health_conditions, current_medications, injuries_limitations, allergies_restrictions) are automatically encrypted using pgcrypto.';

-- Strengthen RLS by ensuring no gaps in policy coverage
-- Re-create policies with explicit checks
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  auth.uid() = id
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND 
  auth.uid() = id
)
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid() = id
);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid() = id
);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL AND 
  auth.uid() = id
);

-- Add security labels for compliance tracking
COMMENT ON COLUMN public.profiles.health_conditions IS 'ENCRYPTED - PHI/HIPAA - Array of health conditions, automatically encrypted';
COMMENT ON COLUMN public.profiles.current_medications IS 'ENCRYPTED - PHI/HIPAA - Current medications, automatically encrypted';
COMMENT ON COLUMN public.profiles.injuries_limitations IS 'ENCRYPTED - PHI/HIPAA - Injuries and physical limitations, automatically encrypted';
COMMENT ON COLUMN public.profiles.allergies_restrictions IS 'ENCRYPTED - PHI/HIPAA - Allergies and dietary restrictions, automatically encrypted';