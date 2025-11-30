-- Fix encrypt_health_data to use extensions schema
CREATE OR REPLACE FUNCTION public.encrypt_health_data(data text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF data IS NULL OR data = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN encode(
    extensions.pgp_sym_encrypt(data, get_encryption_key()),
    'base64'
  );
END;
$$;

-- Fix decrypt_health_data to use extensions schema
CREATE OR REPLACE FUNCTION public.decrypt_health_data(encrypted_data text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN extensions.pgp_sym_decrypt(
    decode(encrypted_data, 'base64'),
    get_encryption_key()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;