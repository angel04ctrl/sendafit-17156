-- Create security definer function to check user roles
-- This prevents recursive RLS policy issues
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Add UPDATE policy for user_subscriptions
-- Regular users CANNOT update subscriptions (only webhooks via service role can)
-- Service role operations bypass RLS, so this blocks all authenticated users
CREATE POLICY "Users cannot update subscriptions"
ON public.user_subscriptions
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Add DELETE policy for user_subscriptions
-- Users cannot delete subscriptions (only service role can if needed)
CREATE POLICY "Users cannot delete subscriptions"
ON public.user_subscriptions
FOR DELETE
TO authenticated
USING (false);

-- Add comment for security documentation
COMMENT ON TABLE public.user_subscriptions IS 
'Contains sensitive payment data (Stripe/PayPal IDs). 
RLS policies: Users can only view/insert their own subscriptions. 
Updates/deletes only via service role (webhooks/admin operations).
All user_id columns enforce auth.uid() matching.';