
-- Migration: 20251021190511
-- Create enum types
CREATE TYPE public.fitness_level AS ENUM ('principiante', 'intermedio', 'avanzado');
CREATE TYPE public.fitness_goal AS ENUM ('bajar_peso', 'aumentar_masa', 'mantener_peso', 'tonificar', 'mejorar_resistencia');
CREATE TYPE public.app_role AS ENUM ('user', 'pro');
CREATE TYPE public.meal_type AS ENUM ('desayuno', 'colacion_am', 'comida', 'colacion_pm', 'cena');
CREATE TYPE public.workout_location AS ENUM ('casa', 'gimnasio', 'exterior');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  fitness_level fitness_level NOT NULL DEFAULT 'principiante',
  fitness_goal fitness_goal NOT NULL DEFAULT 'mantener_peso',
  weight DECIMAL(5,2),
  height DECIMAL(5,2),
  age INTEGER,
  daily_calorie_goal INTEGER DEFAULT 2000,
  daily_protein_goal INTEGER DEFAULT 150,
  daily_carbs_goal INTEGER DEFAULT 200,
  daily_fat_goal INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Meals tracking table
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  meal_type meal_type NOT NULL,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein INTEGER NOT NULL DEFAULT 0,
  carbs INTEGER NOT NULL DEFAULT 0,
  fat INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meals"
  ON public.meals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meals"
  ON public.meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meals"
  ON public.meals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals"
  ON public.meals FOR DELETE
  USING (auth.uid() = user_id);

-- Workouts table
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location workout_location NOT NULL DEFAULT 'casa',
  estimated_calories INTEGER DEFAULT 0,
  duration_minutes INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  scheduled_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workouts"
  ON public.workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts"
  ON public.workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts"
  ON public.workouts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
  ON public.workouts FOR DELETE
  USING (auth.uid() = user_id);

-- Workout exercises table
CREATE TABLE public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view exercises from own workouts"
  ON public.workout_exercises FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workouts 
    WHERE workouts.id = workout_exercises.workout_id 
    AND workouts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert exercises to own workouts"
  ON public.workout_exercises FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workouts 
    WHERE workouts.id = workout_exercises.workout_id 
    AND workouts.user_id = auth.uid()
  ));

CREATE POLICY "Users can update exercises in own workouts"
  ON public.workout_exercises FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.workouts 
    WHERE workouts.id = workout_exercises.workout_id 
    AND workouts.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete exercises from own workouts"
  ON public.workout_exercises FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.workouts 
    WHERE workouts.id = workout_exercises.workout_id 
    AND workouts.user_id = auth.uid()
  ));

-- Progress logs table
CREATE TABLE public.progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  weight DECIMAL(5,2),
  notes TEXT,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.progress_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.progress_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.progress_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON public.progress_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Health data table (prepared for future integrations)
CREATE TABLE public.health_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL,
  data_value JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.health_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health data"
  ON public.health_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health data"
  ON public.health_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Migration: 20251021205420
-- Agregar nuevos campos a la tabla profiles para el formulario completo de onboarding

-- Sección 1: Datos personales básicos (edad ya existe, añadimos los demás)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('masculino', 'femenino')),
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Sección 2: Objetivos y nivel
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS primary_goal text,
ADD COLUMN IF NOT EXISTS training_types text[], -- Array para múltiples opciones
ADD COLUMN IF NOT EXISTS available_days_per_week integer CHECK (available_days_per_week >= 1 AND available_days_per_week <= 7),
ADD COLUMN IF NOT EXISTS session_duration_minutes integer;

-- Sección 3: Salud y condiciones fisiológicas
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS health_conditions text[], -- Array para múltiples condiciones
ADD COLUMN IF NOT EXISTS current_medications text,
ADD COLUMN IF NOT EXISTS injuries_limitations text;

-- Sección 4: Seguimiento menstrual
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS menstrual_tracking_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS menstrual_tracking_app text,
ADD COLUMN IF NOT EXISTS menstrual_auto_sync boolean DEFAULT false;

-- Sección 5: Nutrición y hábitos
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dietary_preferences text[], -- Array para múltiples preferencias
ADD COLUMN IF NOT EXISTS allergies_restrictions text,
ADD COLUMN IF NOT EXISTS current_calorie_intake integer,
ADD COLUMN IF NOT EXISTS average_sleep_hours numeric(3,1),
ADD COLUMN IF NOT EXISTS stress_level integer CHECK (stress_level >= 1 AND stress_level <= 5);

-- Sección 6: Progreso inicial y motivación
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS initial_measurements jsonb, -- {waist, chest, arms, legs}
ADD COLUMN IF NOT EXISTS initial_photo_url text,
ADD COLUMN IF NOT EXISTS motivation_phrase text;

-- Sección 7: Preferencias de app
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'auto' CHECK (theme_preference IN ('light', 'dark', 'auto')),
ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS wearables_sync_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

-- Migration: 20251021221120
-- Primero eliminamos el trigger existente que crea perfiles automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Creamos una nueva función que solo crea el user_role (sin crear el perfil)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Solo crear el rol de usuario, NO el perfil
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;

-- Recreamos el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Migration: 20251021224014
-- Eliminar el trigger que causa el error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Eliminar la función del trigger
DROP FUNCTION IF EXISTS public.handle_new_user();

-- El user_role se creará desde la aplicación junto con el perfil;

-- Migration: 20251021224742
-- Permitir que los usuarios creen su propio rol durante el registro
CREATE POLICY "Users can insert own role during signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Migration: 20251021231943
-- Actualizamos el enum fitness_goal para incluir los valores correctos
-- Primero agregamos los nuevos valores al enum existente
ALTER TYPE public.fitness_goal ADD VALUE IF NOT EXISTS 'bajar_grasa';
ALTER TYPE public.fitness_goal ADD VALUE IF NOT EXISTS 'ganar_masa';
ALTER TYPE public.fitness_goal ADD VALUE IF NOT EXISTS 'rendimiento';

-- Migration: 20251022004000
-- Create foods table for nutritional tracking
CREATE TABLE public.foods (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  racion NUMERIC NOT NULL,
  unidad TEXT NOT NULL,
  calorias NUMERIC NOT NULL,
  proteinas NUMERIC NOT NULL,
  carbohidratos NUMERIC NOT NULL,
  grasas NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

-- Allow all users to read foods (public reference data)
CREATE POLICY "Anyone can view foods"
ON public.foods
FOR SELECT
USING (true);

-- Create index for faster searches
CREATE INDEX idx_foods_nombre ON public.foods(nombre);

-- Insert food data from CSV
INSERT INTO public.foods (id, nombre, racion, unidad, calorias, proteinas, carbohidratos, grasas) VALUES
(1, 'Huevo entero', 100, 'g', 143, 13.0, 1.1, 9.5),
(2, 'Huevo (1 unidad aprox 50g)', 50, 'g', 72, 6.3, 0.6, 4.8),
(3, 'Plátano', 100, 'g', 89, 1.1, 22.8, 0.3),
(4, 'Manzana', 100, 'g', 52, 0.3, 14.0, 0.2),
(5, 'Naranja', 100, 'g', 47, 0.9, 12.0, 0.1),
(6, 'Pan blanco', 100, 'g', 265, 9.0, 49.0, 3.2),
(7, 'Pan integral', 100, 'g', 247, 13.0, 41.0, 4.2),
(8, 'Arroz blanco cocido', 100, 'g', 130, 2.4, 28.0, 0.3),
(9, 'Arroz integral cocido', 100, 'g', 111, 2.6, 23.0, 0.9),
(10, 'Pasta cocida', 100, 'g', 131, 5.0, 25.0, 1.1),
(11, 'Avena cruda', 100, 'g', 389, 16.9, 66.3, 6.9),
(12, 'Leche entera', 100, 'ml', 61, 3.2, 4.8, 3.3),
(13, 'Leche descremada', 100, 'ml', 34, 3.4, 5.0, 0.1),
(14, 'Yogur natural entero', 100, 'g', 61, 3.5, 4.7, 3.3),
(15, 'Queso cheddar', 100, 'g', 403, 24.9, 1.3, 33.1),
(16, 'Mantequilla', 100, 'g', 717, 0.9, 0.1, 81.1),
(17, 'Aceite de oliva', 100, 'g', 884, 0.0, 0.0, 100.0),
(18, 'Aguacate', 100, 'g', 160, 2.0, 9.0, 15.0),
(19, 'Pollo pechuga sin piel (cruda)', 100, 'g', 165, 31.0, 0.0, 3.6),
(20, 'Pollo pechuga (cocida)', 100, 'g', 165, 31.0, 0.0, 3.6),
(21, 'Carne de res magra (cruda)', 100, 'g', 250, 26.0, 0.0, 15.0),
(22, 'Carne de res magra (cocida)', 100, 'g', 217, 26.1, 0.0, 11.8),
(23, 'Pescado salmón (crudo)', 100, 'g', 208, 20.4, 0.0, 13.4),
(24, 'Atún en agua (enlatado)', 100, 'g', 116, 26.0, 0.0, 0.8),
(25, 'Camarón (crudo)', 100, 'g', 99, 24.0, 0.2, 0.3),
(26, 'Pavo (pechuga, cocida)', 100, 'g', 135, 29.0, 0.0, 1.0),
(27, 'Jamón de pavo', 100, 'g', 145, 20.0, 2.0, 6.0),
(28, 'Tocino (cocido)', 100, 'g', 541, 37.0, 1.4, 42.0),
(29, 'Carne de cerdo (lomo, cocido)', 100, 'g', 242, 27.0, 0.0, 14.0),
(30, 'Frijoles negros cocidos', 100, 'g', 132, 8.9, 23.7, 0.5),
(31, 'Lentejas cocidas', 100, 'g', 116, 9.0, 20.1, 0.4),
(32, 'Garbanzos cocidos', 100, 'g', 164, 8.9, 27.4, 2.6),
(33, 'Tofu firme', 100, 'g', 76, 8.0, 1.9, 4.8),
(34, 'Soja (granos cocidos)', 100, 'g', 172, 16.6, 9.9, 9.0),
(35, 'Almendras', 100, 'g', 579, 21.2, 21.6, 49.9),
(36, 'Nueces', 100, 'g', 654, 15.2, 13.7, 65.2),
(37, 'Cacahuate (maní)', 100, 'g', 567, 25.8, 16.1, 49.2),
(38, 'Mantequilla de cacahuate', 100, 'g', 588, 25.0, 20.0, 50.0),
(39, 'Semillas de chía', 100, 'g', 486, 16.5, 42.1, 30.7),
(40, 'Quinoa (cocida)', 100, 'g', 120, 4.4, 21.3, 1.9),
(41, 'Patata (cocida)', 100, 'g', 87, 1.9, 20.1, 0.1),
(42, 'Batata (camote) cocida', 100, 'g', 90, 2.0, 20.7, 0.1),
(43, 'Maíz amarillo (cocido)', 100, 'g', 96, 3.4, 19.0, 1.5),
(44, 'Harina de trigo (100g)', 100, 'g', 364, 10.3, 76.3, 1.0),
(45, 'Azúcar (granulada)', 100, 'g', 387, 0.0, 100.0, 0.0),
(46, 'Miel', 100, 'g', 304, 0.3, 82.4, 0.0),
(47, 'Chocolate negro 70%', 100, 'g', 598, 7.8, 46.0, 42.6),
(48, 'Helado (vainilla)', 100, 'g', 207, 3.5, 24.0, 11.0),
(49, 'Yogur griego natural (entero)', 100, 'g', 97, 9.0, 3.6, 5.3),
(50, 'Cereal de desayuno (general)', 100, 'g', 375, 8.0, 80.0, 3.5),
(51, 'Tortilla de maíz', 100, 'g', 218, 5.7, 44.0, 3.6),
(52, 'Tortilla de harina', 100, 'g', 300, 8.0, 49.0, 7.0),
(53, 'Sopa de pollo (comercial)', 100, 'g', 40, 1.5, 3.0, 2.0),
(54, 'Caldo de verduras', 100, 'g', 10, 0.5, 1.0, 0.0),
(55, 'Puré de papa', 100, 'g', 88, 1.6, 17.5, 1.2),
(56, 'Lechuga', 100, 'g', 15, 1.4, 2.9, 0.2),
(57, 'Espinaca cruda', 100, 'g', 23, 2.9, 3.6, 0.4),
(58, 'Brócoli crudo', 100, 'g', 34, 2.8, 6.6, 0.4),
(59, 'Zanahoria cruda', 100, 'g', 41, 0.9, 9.6, 0.2),
(60, 'Tomate', 100, 'g', 18, 0.9, 3.9, 0.2),
(61, 'Pepino', 100, 'g', 16, 0.7, 3.6, 0.1),
(62, 'Cebolla', 100, 'g', 40, 1.1, 9.3, 0.1),
(63, 'Pimiento rojo', 100, 'g', 31, 1.0, 6.0, 0.3),
(64, 'Ajo', 100, 'g', 149, 6.4, 33.1, 0.5),
(65, 'Jengibre', 100, 'g', 80, 1.8, 17.8, 0.8),
(66, 'Limón', 100, 'g', 29, 1.1, 9.3, 0.3),
(67, 'Fresa', 100, 'g', 32, 0.7, 7.7, 0.3),
(68, 'Uva', 100, 'g', 69, 0.7, 18.1, 0.2),
(69, 'Sandía', 100, 'g', 30, 0.6, 7.6, 0.2),
(70, 'Melón', 100, 'g', 34, 0.8, 8.2, 0.2),
(71, 'Piña', 100, 'g', 50, 0.5, 13.1, 0.1),
(72, 'Mango', 100, 'g', 60, 0.8, 15.0, 0.4),
(73, 'Pera', 100, 'g', 57, 0.4, 15.2, 0.1),
(74, 'Kiwi', 100, 'g', 61, 1.1, 14.7, 0.5),
(75, 'Cereza', 100, 'g', 63, 1.1, 16.0, 0.2),
(76, 'Arándanos', 100, 'g', 57, 0.7, 14.5, 0.3),
(77, 'Frambuesa', 100, 'g', 52, 1.2, 11.9, 0.7),
(78, 'Mora', 100, 'g', 43, 1.4, 9.6, 0.5),
(79, 'Durazno', 100, 'g', 39, 0.9, 9.5, 0.3),
(80, 'Ciruela', 100, 'g', 46, 0.7, 11.4, 0.3),
(81, 'Dátil', 100, 'g', 277, 1.8, 75.0, 0.2),
(82, 'Higo', 100, 'g', 74, 0.8, 19.2, 0.3),
(83, 'Coco rallado', 100, 'g', 354, 3.3, 15.2, 33.5),
(84, 'Leche de coco', 100, 'ml', 230, 2.3, 6.0, 24.0),
(85, 'Leche de almendra', 100, 'ml', 17, 0.6, 0.6, 1.1),
(86, 'Café negro', 100, 'ml', 2, 0.3, 0.0, 0.0),
(87, 'Té verde', 100, 'ml', 1, 0.0, 0.0, 0.0),
(88, 'Jugo de naranja', 100, 'ml', 45, 0.7, 10.4, 0.2),
(89, 'Refresco cola', 100, 'ml', 42, 0.0, 10.6, 0.0),
(90, 'Cerveza', 100, 'ml', 43, 0.5, 3.6, 0.0),
(91, 'Vino tinto', 100, 'ml', 85, 0.1, 2.6, 0.0),
(92, 'Vodka', 100, 'ml', 231, 0.0, 0.0, 0.0),
(93, 'Pizza (margarita)', 100, 'g', 266, 11.0, 33.0, 10.0),
(94, 'Hamburguesa (con pan)', 100, 'g', 295, 17.0, 24.0, 14.0),
(95, 'Hot dog (con pan)', 100, 'g', 290, 10.4, 25.0, 16.0),
(96, 'Papas fritas', 100, 'g', 312, 3.4, 41.4, 15.0),
(97, 'Galletas tipo María', 100, 'g', 435, 7.0, 72.0, 13.0),
(98, 'Galletas de avena', 100, 'g', 450, 6.5, 68.0, 16.0),
(99, 'Pan dulce (concha)', 100, 'g', 411, 7.0, 51.0, 19.0),
(100, 'Pastel (chocolate)', 100, 'g', 371, 4.7, 50.7, 16.4),
(101, 'Dona glaseada', 100, 'g', 452, 5.3, 51.3, 25.5),
(102, 'Croissant', 100, 'g', 406, 8.2, 45.8, 21.0),
(103, 'Bagel simple', 100, 'g', 257, 10.0, 50.0, 1.5),
(104, 'Muffin de arándano', 100, 'g', 377, 6.2, 54.5, 15.2),
(105, 'Waffles', 100, 'g', 291, 7.9, 38.1, 11.6),
(106, 'Pancakes', 100, 'g', 227, 6.4, 28.3, 9.7),
(107, 'Nachos con queso', 100, 'g', 346, 9.0, 36.0, 18.0),
(108, 'Tacos de carne', 100, 'g', 226, 11.6, 18.0, 12.0),
(109, 'Burrito de frijol', 100, 'g', 198, 7.4, 30.5, 5.0),
(110, 'Quesadilla de queso', 100, 'g', 240, 10.0, 26.0, 10.0),
(111, 'Sushi (rollo california)', 100, 'g', 128, 3.8, 18.4, 3.9),
(112, 'Ensalada césar', 100, 'g', 190, 7.0, 7.0, 15.0),
(113, 'Ensalada verde simple', 100, 'g', 20, 1.5, 4.0, 0.2),
(114, 'Hummus', 100, 'g', 166, 8.0, 14.0, 10.0),
(115, 'Guacamole', 100, 'g', 150, 2.0, 9.0, 14.0),
(116, 'Salsa de tomate', 100, 'g', 29, 1.3, 6.7, 0.2),
(117, 'Mayonesa', 100, 'g', 680, 1.0, 0.6, 75.0),
(118, 'Ketchup', 100, 'g', 112, 1.0, 27.0, 0.1),
(119, 'Mostaza', 100, 'g', 60, 3.7, 5.3, 3.3),
(120, 'Vinagre', 100, 'ml', 18, 0.0, 0.8, 0.0),
(121, 'Salsa de soja', 100, 'ml', 53, 5.9, 4.9, 0.1);

-- Migration: 20251022004212
-- Fix function search_path mutable warning
-- Drop the function with CASCADE to remove dependent triggers
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Recreate the function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Recreate the trigger on profiles table
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Migration: 20251022020000
-- Create exercises table
CREATE TABLE public.exercises (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  grupo_muscular TEXT NOT NULL,
  nivel TEXT NOT NULL,
  lugar TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  tipo_entrenamiento TEXT NOT NULL,
  equipamiento TEXT,
  maquina_gym TEXT,
  descripcion TEXT NOT NULL,
  repeticiones_sugeridas INTEGER,
  series_sugeridas INTEGER,
  duracion_promedio_segundos INTEGER,
  calorias_por_repeticion NUMERIC,
  imagen TEXT,
  video TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on exercises
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Everyone can view exercises (reference data)
CREATE POLICY "Anyone can view exercises"
ON public.exercises
FOR SELECT
USING (true);

-- Create pre-designed plans table
CREATE TABLE public.predesigned_plans (
  plan_id TEXT PRIMARY KEY,
  nombre_plan TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  nivel TEXT NOT NULL,
  lugar TEXT NOT NULL,
  dias_semana INTEGER NOT NULL,
  ejercicios_ids_ordenados JSONB NOT NULL,
  descripcion_plan TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on predesigned plans
ALTER TABLE public.predesigned_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view predesigned plans (reference data)
CREATE POLICY "Anyone can view predesigned plans"
ON public.predesigned_plans
FOR SELECT
USING (true);

-- Migration: 20251022023740
-- Add assigned_routine_id to profiles table
ALTER TABLE public.profiles
ADD COLUMN assigned_routine_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL;

-- Create progress_tracking table
CREATE TABLE public.progress_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight NUMERIC,
  body_measurements JSONB,
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
  menstrual_phase TEXT,
  notes TEXT,
  exercises_completed JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on progress_tracking
ALTER TABLE public.progress_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for progress_tracking
CREATE POLICY "Users can view own progress"
ON public.progress_tracking
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
ON public.progress_tracking
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
ON public.progress_tracking
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
ON public.progress_tracking
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for progress_tracking updated_at
CREATE TRIGGER update_progress_tracking_updated_at
BEFORE UPDATE ON public.progress_tracking
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add index for better query performance
CREATE INDEX idx_progress_tracking_user_date ON public.progress_tracking(user_id, date DESC);
CREATE INDEX idx_profiles_assigned_routine ON public.profiles(assigned_routine_id);

-- Migration: 20251022125128
-- Add available_weekdays column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN available_weekdays integer[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.available_weekdays IS 'Specific weekdays available for training (1=Monday, 2=Tuesday, ..., 7=Sunday)';

-- Migration: 20251022131402
-- Rename plan_id to id in predesigned_plans table to match standard convention
ALTER TABLE public.predesigned_plans 
RENAME COLUMN plan_id TO id;

COMMENT ON COLUMN public.predesigned_plans.id IS 'Unique identifier for the predesigned plan';

-- Migration: 20251022131734
-- Adjust exercises table to allow CSV import
-- Make columns that aren't in the CSV nullable or provide defaults

ALTER TABLE public.exercises 
ALTER COLUMN lugar DROP NOT NULL,
ALTER COLUMN objetivo DROP NOT NULL;

-- Add default values for better data integrity
ALTER TABLE public.exercises 
ALTER COLUMN lugar SET DEFAULT 'casa',
ALTER COLUMN objetivo SET DEFAULT 'tonificar';

COMMENT ON COLUMN public.exercises.lugar IS 'Training location (casa/gimnasio/parque) - defaults to casa if not specified';
COMMENT ON COLUMN public.exercises.objetivo IS 'Training objective - defaults to tonificar if not specified';

-- Migration: 20251022133315
-- Modify predesigned_plans table to accommodate CSV data
-- Make ejercicios_ids_ordenados nullable since CSV doesn't include exercises
ALTER TABLE public.predesigned_plans 
ALTER COLUMN ejercicios_ids_ordenados DROP NOT NULL,
ALTER COLUMN ejercicios_ids_ordenados SET DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.predesigned_plans.ejercicios_ids_ordenados IS 'Array of exercise IDs in order - can be empty for plans without assigned exercises yet';
COMMENT ON COLUMN public.predesigned_plans.nivel IS 'B = Principiante/Básico, I = Intermedio, P = Profesional/Avanzado';
COMMENT ON COLUMN public.predesigned_plans.objetivo IS 'Can contain multiple objectives separated by commas (e.g., "Ganar Masa, Perder Grasa, Definir, Mantener" or single like "Fuerza")';

-- Migration: 20251022133559
-- Create plan_ejercicios table to link exercises to predesigned plans
CREATE TABLE public.plan_ejercicios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES public.predesigned_plans(id) ON DELETE CASCADE,
  ejercicio_id TEXT NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  dia INTEGER NOT NULL,
  orden INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_plan_ejercicios_plan_id ON public.plan_ejercicios(plan_id);
CREATE INDEX idx_plan_ejercicios_ejercicio_id ON public.plan_ejercicios(ejercicio_id);
CREATE INDEX idx_plan_ejercicios_plan_dia ON public.plan_ejercicios(plan_id, dia);

-- Enable Row Level Security
ALTER TABLE public.plan_ejercicios ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (predesigned plans are public)
CREATE POLICY "Anyone can view plan exercises"
ON public.plan_ejercicios
FOR SELECT
USING (true);

-- Add comments for clarity
COMMENT ON TABLE public.plan_ejercicios IS 'Links exercises to predesigned workout plans with day and order information';
COMMENT ON COLUMN public.plan_ejercicios.plan_id IS 'Reference to the predesigned plan';
COMMENT ON COLUMN public.plan_ejercicios.ejercicio_id IS 'Reference to the exercise';
COMMENT ON COLUMN public.plan_ejercicios.dia IS 'Day number in the plan (1, 2, 3, etc.)';
COMMENT ON COLUMN public.plan_ejercicios.orden IS 'Order/position of the exercise within that day';

-- Migration: 20251022134714
-- Add tipo column to workouts table to distinguish between automatic and manual workouts
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workout_type') THEN
    CREATE TYPE public.workout_type AS ENUM ('automatico', 'manual');
  END IF;
END $$;

ALTER TABLE public.workouts 
ADD COLUMN IF NOT EXISTS tipo public.workout_type DEFAULT 'manual';

-- Add index for better query performance on tipo and scheduled_date
CREATE INDEX IF NOT EXISTS idx_workouts_tipo ON public.workouts(tipo);
CREATE INDEX IF NOT EXISTS idx_workouts_scheduled_date ON public.workouts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON public.workouts(user_id, scheduled_date);

-- Create function to automatically assign routine when user completes onboarding
CREATE OR REPLACE FUNCTION public.auto_assign_routine_on_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger if onboarding_completed changes from false to true
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    -- Call the assign-routine edge function asynchronously via pg_net (we'll handle this in the edge function instead)
    -- For now, we'll just update the profile, and the frontend will call assign-routine
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for automatic routine assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_routine ON public.profiles;
CREATE TRIGGER trigger_auto_assign_routine
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_routine_on_onboarding();

COMMENT ON COLUMN public.workouts.tipo IS 'Type of workout: automatico (from predesigned plan) or manual (user created)';
COMMENT ON FUNCTION public.auto_assign_routine_on_onboarding() IS 'Triggers automatic routine assignment when user completes onboarding';

-- Migration: 20251022160517
-- Drop existing policy
DROP POLICY IF EXISTS "Anyone can view predesigned plans" ON public.predesigned_plans;

-- Create new policy for authenticated users only
CREATE POLICY "Authenticated users can view predesigned plans"
ON public.predesigned_plans
FOR SELECT
TO authenticated
USING (true);

-- Migration: 20251022164159
-- Eliminar la foreign key incorrecta que apunta a workouts
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_assigned_routine_id_fkey;

-- Cambiar el tipo de assigned_routine_id de uuid a text para que coincida con predesigned_plans.id
ALTER TABLE profiles ALTER COLUMN assigned_routine_id TYPE text USING assigned_routine_id::text;

-- Añadir la foreign key correcta que apunta a predesigned_plans
ALTER TABLE profiles 
ADD CONSTRAINT profiles_assigned_routine_id_fkey 
FOREIGN KEY (assigned_routine_id) 
REFERENCES predesigned_plans(id) 
ON DELETE SET NULL;

COMMENT ON COLUMN profiles.assigned_routine_id IS 'ID del plan prediseñado asignado (referencia a predesigned_plans.id)';

-- Migration: 20251022205201
-- Cambiar el tipo de available_weekdays de integer[] a text[]
ALTER TABLE public.profiles 
ALTER COLUMN available_weekdays TYPE text[] USING available_weekdays::text[];
