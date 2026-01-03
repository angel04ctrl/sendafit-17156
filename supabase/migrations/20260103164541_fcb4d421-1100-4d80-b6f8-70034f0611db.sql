-- =============================================
-- SISTEMA DE DIFERENCIACIÓN FREE/PRO
-- =============================================

-- 1. Añadir campos de salud detallados a profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fase_menstrual_actual text,
ADD COLUMN IF NOT EXISTS lesiones_activas text[],
ADD COLUMN IF NOT EXISTS nivel_fatiga integer CHECK (nivel_fatiga >= 1 AND nivel_fatiga <= 10);

-- Comentarios para documentación
COMMENT ON COLUMN public.profiles.fase_menstrual_actual IS 'Fase menstrual calculada: menstrual, folicular, ovulacion, lutea';
COMMENT ON COLUMN public.profiles.lesiones_activas IS 'Array de lesiones/limitaciones actuales del usuario';
COMMENT ON COLUMN public.profiles.nivel_fatiga IS 'Nivel de fatiga 1-10, usado para ajustar entrenamientos';

-- 2. Crear tabla para tracking menstrual (solo PRO)
CREATE TABLE IF NOT EXISTS public.menstrual_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start_date date NOT NULL,
  period_end_date date,
  cycle_length integer DEFAULT 28,
  period_length integer DEFAULT 5,
  symptoms text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start_date)
);

-- Índices para menstrual_logs
CREATE INDEX IF NOT EXISTS idx_menstrual_logs_user_id ON public.menstrual_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_menstrual_logs_period_start ON public.menstrual_logs(period_start_date DESC);

-- Habilitar RLS en menstrual_logs
ALTER TABLE public.menstrual_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para menstrual_logs
CREATE POLICY "Users can view own menstrual logs"
  ON public.menstrual_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own menstrual logs"
  ON public.menstrual_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own menstrual logs"
  ON public.menstrual_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own menstrual logs"
  ON public.menstrual_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at en menstrual_logs
CREATE TRIGGER update_menstrual_logs_updated_at
  BEFORE UPDATE ON public.menstrual_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Función para verificar si un usuario es PRO
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
      AND plan = 'pro'
      AND (end_date IS NULL OR end_date > now())
  )
$$;

-- 4. Función para calcular fase menstrual actual
CREATE OR REPLACE FUNCTION public.calculate_menstrual_phase(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_period_start date;
  cycle_len integer;
  days_since_period integer;
  phase text;
BEGIN
  -- Obtener el último registro de periodo
  SELECT period_start_date, cycle_length 
  INTO last_period_start, cycle_len
  FROM public.menstrual_logs
  WHERE user_id = _user_id
  ORDER BY period_start_date DESC
  LIMIT 1;
  
  -- Si no hay registros, retornar null
  IF last_period_start IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calcular días desde el inicio del último periodo
  days_since_period := CURRENT_DATE - last_period_start;
  
  -- Ajustar si estamos en un nuevo ciclo
  IF days_since_period >= cycle_len THEN
    days_since_period := days_since_period % cycle_len;
  END IF;
  
  -- Determinar fase (aproximación estándar de 28 días)
  -- Días 1-5: Menstrual
  -- Días 6-13: Folicular
  -- Días 14-16: Ovulación
  -- Días 17-28: Lútea
  IF days_since_period <= 5 THEN
    phase := 'menstrual';
  ELSIF days_since_period <= 13 THEN
    phase := 'folicular';
  ELSIF days_since_period <= 16 THEN
    phase := 'ovulacion';
  ELSE
    phase := 'lutea';
  END IF;
  
  RETURN phase;
END;
$$;

-- Comentario para la función
COMMENT ON FUNCTION public.is_user_pro IS 'Verifica si un usuario tiene suscripción PRO activa';
COMMENT ON FUNCTION public.calculate_menstrual_phase IS 'Calcula la fase menstrual actual basada en los logs';