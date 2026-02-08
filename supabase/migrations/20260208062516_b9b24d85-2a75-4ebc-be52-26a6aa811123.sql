
-- Create app_config table for global feature flags
CREATE TABLE public.app_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read app_config (global flags)
CREATE POLICY "Anyone can read app_config"
ON public.app_config FOR SELECT
USING (true);

-- No one can modify via client (admin-only via service role)
-- No INSERT/UPDATE/DELETE policies = blocked for anon/authenticated

-- Seed default global flags
INSERT INTO public.app_config (key, value) VALUES
  ('aiEnabled', false),
  ('foodAIEnabled', false),
  ('gymAIEnabled', false),
  ('coachAIEnabled', false);

-- Create user_settings table for per-user flags
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_pro boolean NOT NULL DEFAULT false,
  dev_mode boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can read their own settings
CREATE POLICY "Users can read own settings"
ON public.user_settings FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own settings (but dev_mode should only be set by admins via service role)
CREATE POLICY "Users can update own settings"
ON public.user_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
ON public.user_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-create user_settings on profile creation
CREATE OR REPLACE FUNCTION public.create_user_settings_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_create_settings
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_user_settings_on_signup();

-- Auto-update updated_at
CREATE TRIGGER update_app_config_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
