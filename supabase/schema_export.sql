-- ============================================================
-- SENDAFIT - Full Database Schema Export
-- Generated: 2026-02-15
-- Ready to paste into Supabase SQL Editor
-- ============================================================

-- ========================
-- 1. EXTENSIONS
-- ========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- ========================
-- 2. CUSTOM ENUMS
-- ========================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('user', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.fitness_goal AS ENUM (
    'bajar_peso', 'aumentar_masa', 'mantener_peso', 'tonificar',
    'mejorar_resistencia', 'bajar_grasa', 'ganar_masa', 'rendimiento'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.fitness_level AS ENUM ('principiante', 'intermedio', 'avanzado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.meal_type AS ENUM ('desayuno', 'colacion_am', 'comida', 'colacion_pm', 'cena');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.workout_location AS ENUM ('casa', 'gimnasio', 'exterior');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.workout_type AS ENUM ('automatico', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================
-- 3. TABLES
-- ========================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  full_name text NOT NULL,
  gender text,
  age integer,
  weight numeric,
  height numeric,
  fitness_level fitness_level NOT NULL DEFAULT 'principiante',
  fitness_goal fitness_goal NOT NULL DEFAULT 'mantener_peso',
  primary_goal text,
  daily_calorie_goal integer DEFAULT 2000,
  daily_protein_goal integer DEFAULT 150,
  daily_carbs_goal integer DEFAULT 200,
  daily_fat_goal integer DEFAULT 50,
  available_days_per_week integer,
  available_weekdays text[],
  session_duration_minutes integer,
  training_types text[],
  health_conditions text[],
  health_conditions_encrypted text,
  current_medications text,
  current_medications_encrypted text,
  injuries_limitations text,
  injuries_limitations_encrypted text,
  allergies_restrictions text,
  allergies_restrictions_encrypted text,
  dietary_preferences text[],
  menstrual_tracking_enabled boolean DEFAULT false,
  menstrual_tracking_app text,
  menstrual_auto_sync boolean DEFAULT false,
  fase_menstrual_actual text,
  lesiones_activas text[],
  current_calorie_intake integer,
  average_sleep_hours numeric,
  stress_level integer,
  nivel_fatiga integer,
  initial_measurements jsonb,
  initial_photo_url text,
  motivation_phrase text,
  theme_preference text DEFAULT 'auto',
  notifications_enabled boolean DEFAULT true,
  wearables_sync_enabled boolean DEFAULT false,
  terms_accepted boolean DEFAULT false,
  onboarding_completed boolean DEFAULT false,
  assigned_routine_id text,
  dev_override boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- predesigned_plans
CREATE TABLE IF NOT EXISTS public.predesigned_plans (
  id text NOT NULL PRIMARY KEY,
  nombre_plan text NOT NULL,
  objetivo text NOT NULL,
  nivel text NOT NULL,
  lugar text NOT NULL,
  dias_semana integer NOT NULL,
  descripcion_plan text NOT NULL,
  ejercicios_ids_ordenados jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK for profiles -> predesigned_plans
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_assigned_routine_id_fkey
  FOREIGN KEY (assigned_routine_id) REFERENCES public.predesigned_plans(id);

-- exercises
CREATE TABLE IF NOT EXISTS public.exercises (
  id text NOT NULL PRIMARY KEY,
  nombre text NOT NULL,
  grupo_muscular text NOT NULL,
  nivel text NOT NULL,
  tipo_entrenamiento text NOT NULL,
  descripcion text NOT NULL,
  lugar text DEFAULT 'casa',
  objetivo text DEFAULT 'tonificar',
  equipamiento text,
  maquina_gym text,
  repeticiones_sugeridas integer,
  series_sugeridas integer,
  duracion_promedio_segundos integer,
  calorias_por_repeticion numeric,
  imagen text,
  video text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- plan_ejercicios
CREATE TABLE IF NOT EXISTS public.plan_ejercicios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id text NOT NULL REFERENCES public.predesigned_plans(id),
  ejercicio_id text NOT NULL REFERENCES public.exercises(id),
  dia integer NOT NULL,
  orden integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- workouts
CREATE TABLE IF NOT EXISTS public.workouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  name text NOT NULL,
  description text,
  location workout_location NOT NULL DEFAULT 'casa',
  tipo workout_type DEFAULT 'manual',
  plan_id text REFERENCES public.predesigned_plans(id),
  scheduled_date date NOT NULL,
  weekday integer,
  duration_minutes integer,
  estimated_calories integer DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- workout_exercises
CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id uuid NOT NULL REFERENCES public.workouts(id),
  name text NOT NULL,
  sets integer,
  reps integer,
  duration_minutes integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- meals
CREATE TABLE IF NOT EXISTS public.meals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  name text NOT NULL,
  meal_type meal_type NOT NULL,
  calories integer NOT NULL,
  protein integer DEFAULT 0,
  carbs integer DEFAULT 0,
  fat integer DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- foods
CREATE TABLE IF NOT EXISTS public.foods (
  id serial PRIMARY KEY,
  nombre text NOT NULL,
  racion numeric NOT NULL,
  unidad text NOT NULL,
  calorias numeric NOT NULL,
  proteinas numeric NOT NULL,
  carbohidratos numeric NOT NULL,
  grasas numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- progress_logs
CREATE TABLE IF NOT EXISTS public.progress_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  weight numeric,
  notes text,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- progress_tracking
CREATE TABLE IF NOT EXISTS public.progress_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workout_id uuid REFERENCES public.workouts(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight numeric,
  body_measurements jsonb,
  energy_level integer,
  exercises_completed jsonb,
  menstrual_phase text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- health_data
CREATE TABLE IF NOT EXISTS public.health_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  data_type text NOT NULL,
  data_value jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- menstrual_logs
CREATE TABLE IF NOT EXISTS public.menstrual_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  period_start_date date NOT NULL,
  period_end_date date,
  cycle_length integer DEFAULT 28,
  period_length integer DEFAULT 5,
  symptoms text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- user_subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  paypal_subscription_id text,
  last_event text,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- user_settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid NOT NULL PRIMARY KEY,
  is_pro boolean NOT NULL DEFAULT false,
  dev_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- app_config
CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ai_trainer_conversations
CREATE TABLE IF NOT EXISTS public.ai_trainer_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  conversation_type text NOT NULL,
  title text,
  messages jsonb DEFAULT '[]'::jsonb,
  generated_content jsonb DEFAULT '{}'::jsonb,
  saved_to_app boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- food_analysis_logs
CREATE TABLE IF NOT EXISTS public.food_analysis_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  image_url text NOT NULL,
  detected_foods jsonb DEFAULT '[]'::jsonb,
  estimated_macros jsonb DEFAULT '{}'::jsonb,
  adjusted_macros jsonb DEFAULT '{}'::jsonb,
  saved_to_daily boolean DEFAULT false,
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- machine_scan_history
CREATE TABLE IF NOT EXISTS public.machine_scan_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  image_url text NOT NULL,
  machine_name text,
  machine_type text,
  primary_muscles text[] DEFAULT '{}'::text[],
  secondary_muscles text[] DEFAULT '{}'::text[],
  usage_instructions text,
  posture_tips text,
  related_exercises jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========================
-- 4. SQL FUNCTIONS
-- ========================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_encryption_key()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  RETURN current_setting('app.settings.encryption_key', true);
EXCEPTION WHEN OTHERS THEN
  RETURN encode(digest(current_database() || 'health_data_key', 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.encrypt_health_data(data text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF data IS NULL OR data = '' THEN RETURN NULL; END IF;
  RETURN encode(extensions.pgp_sym_encrypt(data, get_encryption_key()), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_health_data(encrypted_data text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF encrypted_data IS NULL OR encrypted_data = '' THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(decode(encrypted_data, 'base64'), get_encryption_key());
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_user_pro(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = _user_id AND status = 'active'
      AND (end_date IS NULL OR end_date > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.has_dev_pro_override(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.dev_override = true);
$$;

CREATE OR REPLACE FUNCTION public.calculate_menstrual_phase(_user_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  last_period_start date; cycle_len integer; days_since_period integer; phase text;
BEGIN
  SELECT period_start_date, cycle_length INTO last_period_start, cycle_len
  FROM public.menstrual_logs WHERE user_id = _user_id ORDER BY period_start_date DESC LIMIT 1;
  IF last_period_start IS NULL THEN RETURN NULL; END IF;
  days_since_period := CURRENT_DATE - last_period_start;
  IF days_since_period >= cycle_len THEN days_since_period := days_since_period % cycle_len; END IF;
  IF days_since_period <= 5 THEN phase := 'menstrual';
  ELSIF days_since_period <= 13 THEN phase := 'folicular';
  ELSIF days_since_period <= 16 THEN phase := 'ovulacion';
  ELSE phase := 'lutea'; END IF;
  RETURN phase;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_weekday_from_date(date_val date)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  RETURN CASE WHEN EXTRACT(DOW FROM date_val) = 0 THEN 7
    ELSE EXTRACT(DOW FROM date_val)::integer END;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user_settings_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.encrypt_profile_health_data()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.health_conditions IS NOT NULL THEN
    NEW.health_conditions_encrypted := encrypt_health_data(NEW.health_conditions::text);
  END IF;
  IF NEW.current_medications IS NOT NULL THEN
    NEW.current_medications_encrypted := encrypt_health_data(NEW.current_medications);
  END IF;
  IF NEW.injuries_limitations IS NOT NULL THEN
    NEW.injuries_limitations_encrypted := encrypt_health_data(NEW.injuries_limitations);
  END IF;
  IF NEW.allergies_restrictions IS NOT NULL THEN
    NEW.allergies_restrictions_encrypted := encrypt_health_data(NEW.allergies_restrictions);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_id_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Cannot modify profile ID.';
  END IF;
  IF NEW.id != auth.uid() THEN
    RAISE EXCEPTION 'Profile ID must match authenticated user ID.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_profile_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.id != auth.uid() THEN
    RAISE EXCEPTION 'Security violation: Profile ID must match authenticated user';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD.health_conditions IS DISTINCT FROM NEW.health_conditions OR
    OLD.current_medications IS DISTINCT FROM NEW.current_medications OR
    OLD.injuries_limitations IS DISTINCT FROM NEW.injuries_limitations
  ) THEN
    RAISE NOTICE 'Health data modified for user %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_user_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.id != auth.uid() THEN RAISE EXCEPTION 'Cannot modify another user''s profile'; END IF;
  END IF;
  IF TG_TABLE_NAME = 'health_data' THEN
    IF NEW.user_id != auth.uid() THEN RAISE EXCEPTION 'Cannot insert health data for another user'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_routine_on_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.workouts_before_insert_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.weekday IS NULL AND NEW.scheduled_date IS NOT NULL THEN
    NEW.weekday := calculate_weekday_from_date(NEW.scheduled_date);
  END IF;
  IF NEW.tipo = 'automatico' THEN
    IF NEW.plan_id IS NULL THEN RAISE EXCEPTION 'Automatic workouts must have a plan_id'; END IF;
    IF NEW.weekday IS NULL THEN RAISE EXCEPTION 'Automatic workouts must have a weekday (1-7)'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ========================
-- 5. TRIGGERS
-- ========================

CREATE TRIGGER handle_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_progress_tracking_updated_at BEFORE UPDATE ON public.progress_tracking
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_menstrual_logs_updated_at BEFORE UPDATE ON public.menstrual_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_ai_conversations_updated_at BEFORE UPDATE ON public.ai_trainer_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_food_analysis_updated_at BEFORE UPDATE ON public.food_analysis_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_profile_created AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_user_settings_on_signup();

CREATE TRIGGER encrypt_health_data_trigger BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_profile_health_data();

CREATE TRIGGER prevent_id_change BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_id_change();

CREATE TRIGGER validate_access BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_access();

CREATE TRIGGER validate_ownership BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_ownership();

CREATE TRIGGER validate_health_ownership BEFORE INSERT ON public.health_data
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_ownership();

CREATE TRIGGER auto_assign_routine AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_routine_on_onboarding();

CREATE TRIGGER workouts_validate BEFORE INSERT OR UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.workouts_before_insert_update();

-- ========================
-- 6. RLS POLICIES
-- ========================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menstrual_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predesigned_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_trainer_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_scan_history ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() IS NOT NULL AND auth.uid() = id) WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- workouts
CREATE POLICY "Users can view own workouts" ON public.workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON public.workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workouts" ON public.workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON public.workouts FOR DELETE USING (auth.uid() = user_id);

-- workout_exercises
CREATE POLICY "Users can view exercises from own workouts" ON public.workout_exercises FOR SELECT
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid()));
CREATE POLICY "Users can insert exercises to own workouts" ON public.workout_exercises FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid()));
CREATE POLICY "Users can update exercises in own workouts" ON public.workout_exercises FOR UPDATE
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid()));
CREATE POLICY "Users can delete exercises from own workouts" ON public.workout_exercises FOR DELETE
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid()));

-- meals
CREATE POLICY "Users can view own meals" ON public.meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meals" ON public.meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meals" ON public.meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meals" ON public.meals FOR DELETE USING (auth.uid() = user_id);

-- foods (public read-only)
CREATE POLICY "Anyone can view foods" ON public.foods FOR SELECT USING (true);

-- progress_logs
CREATE POLICY "Users can view own progress" ON public.progress_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.progress_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.progress_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress" ON public.progress_logs FOR DELETE USING (auth.uid() = user_id);

-- progress_tracking
CREATE POLICY "Users can view own progress" ON public.progress_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.progress_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.progress_tracking FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress" ON public.progress_tracking FOR DELETE USING (auth.uid() = user_id);

-- health_data
CREATE POLICY "Users can view own health data" ON public.health_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own health data" ON public.health_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own health data" ON public.health_data FOR DELETE USING (auth.uid() = user_id);

-- menstrual_logs
CREATE POLICY "Users can view own menstrual logs" ON public.menstrual_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own menstrual logs" ON public.menstrual_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own menstrual logs" ON public.menstrual_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own menstrual logs" ON public.menstrual_logs FOR DELETE USING (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role during signup" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Block user subscription updates" ON public.user_subscriptions FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block user subscription deletes" ON public.user_subscriptions FOR DELETE USING (false);

-- user_settings
CREATE POLICY "Users can read own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- app_config (public read-only)
CREATE POLICY "Anyone can read app_config" ON public.app_config FOR SELECT USING (true);

-- predesigned_plans (public read-only)
CREATE POLICY "Authenticated users can view predesigned plans" ON public.predesigned_plans FOR SELECT USING (true);

-- plan_ejercicios (public read-only)
CREATE POLICY "Anyone can view plan exercises" ON public.plan_ejercicios FOR SELECT USING (true);

-- exercises (public read-only)
CREATE POLICY "Anyone can view exercises" ON public.exercises FOR SELECT USING (true);

-- ai_trainer_conversations
CREATE POLICY "Users can view own conversations" ON public.ai_trainer_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.ai_trainer_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.ai_trainer_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.ai_trainer_conversations FOR DELETE USING (auth.uid() = user_id);

-- food_analysis_logs
CREATE POLICY "Users can view own food analysis" ON public.food_analysis_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own food analysis" ON public.food_analysis_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own food analysis" ON public.food_analysis_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own food analysis" ON public.food_analysis_logs FOR DELETE USING (auth.uid() = user_id);

-- machine_scan_history
CREATE POLICY "Users can view own machine scans" ON public.machine_scan_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own machine scans" ON public.machine_scan_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own machine scans" ON public.machine_scan_history FOR DELETE USING (auth.uid() = user_id);

-- ========================
-- 7. STORAGE BUCKETS
-- ========================
INSERT INTO storage.buckets (id, name, public) VALUES ('exercise-images', 'exercise-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('exercise-videos', 'exercise-videos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-analysis-images', 'ai-analysis-images', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Public read exercise-images" ON storage.objects FOR SELECT USING (bucket_id = 'exercise-images');
CREATE POLICY "Auth upload exercise-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'exercise-images' AND auth.role() = 'authenticated');
CREATE POLICY "Public read exercise-videos" ON storage.objects FOR SELECT USING (bucket_id = 'exercise-videos');
CREATE POLICY "Auth upload exercise-videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'exercise-videos' AND auth.role() = 'authenticated');
CREATE POLICY "Public read ai-analysis-images" ON storage.objects FOR SELECT USING (bucket_id = 'ai-analysis-images');
CREATE POLICY "Auth upload ai-analysis-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ai-analysis-images' AND auth.role() = 'authenticated');

-- ============================================================
-- END OF SCHEMA EXPORT
-- ============================================================
