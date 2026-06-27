-- Align PRO entitlement checks with paid subscription plans and add persistent AI rate limiting.

CREATE OR REPLACE FUNCTION public.is_user_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (end_date IS NULL OR end_date > now())
  )
$$;

COMMENT ON FUNCTION public.is_user_pro(uuid) IS 'Verifica si un usuario tiene una suscripcion activa, sin exigir plan = pro.';

CREATE TABLE IF NOT EXISTS public.ai_function_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_function_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_function_usage_user_function_created
  ON public.ai_function_usage(user_id, function_name, created_at DESC);

DROP POLICY IF EXISTS "Users can view own AI usage" ON public.ai_function_usage;
CREATE POLICY "Users can view own AI usage"
  ON public.ai_function_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id uuid,
  _function_name text,
  _hourly_limit integer DEFAULT 5,
  _daily_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hourly_count integer;
  daily_count integer;
BEGIN
  SELECT COUNT(*) INTO hourly_count
  FROM public.ai_function_usage
  WHERE user_id = _user_id
    AND function_name = _function_name
    AND created_at > now() - interval '1 hour';

  IF hourly_count >= _hourly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', 'hour',
      'retryAfterSeconds', 3600
    );
  END IF;

  SELECT COUNT(*) INTO daily_count
  FROM public.ai_function_usage
  WHERE user_id = _user_id
    AND function_name = _function_name
    AND created_at > now() - interval '1 day';

  IF daily_count >= _daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', 'day',
      'retryAfterSeconds', 86400
    );
  END IF;

  INSERT INTO public.ai_function_usage (user_id, function_name)
  VALUES (_user_id, _function_name);

  RETURN jsonb_build_object(
    'allowed', true,
    'hourlyRemaining', GREATEST(_hourly_limit - hourly_count - 1, 0),
    'dailyRemaining', GREATEST(_daily_limit - daily_count - 1, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(uuid, text, integer, integer) TO service_role;
