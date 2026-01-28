-- =====================================================
-- MÓDULO IA SENDAFIT - TABLAS PARA FUNCIONALIDADES INTELIGENTES
-- Análisis de comida, escáner de máquinas, chat entrenador
-- =====================================================

-- 1. Tabla para análisis de comida con IA (Food Vision)
CREATE TABLE public.food_analysis_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  detected_foods jsonb DEFAULT '[]'::jsonb,
  estimated_macros jsonb DEFAULT '{}'::jsonb,
  adjusted_macros jsonb DEFAULT '{}'::jsonb,
  saved_to_daily boolean DEFAULT false,
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comentarios descriptivos
COMMENT ON TABLE public.food_analysis_logs IS 'Registros de análisis de comida con IA (Food Vision)';
COMMENT ON COLUMN public.food_analysis_logs.detected_foods IS 'Array de alimentos detectados: [{name, portion, confidence}]';
COMMENT ON COLUMN public.food_analysis_logs.estimated_macros IS 'Macros estimados por IA: {calories, protein, carbs, fat}';
COMMENT ON COLUMN public.food_analysis_logs.adjusted_macros IS 'Macros ajustados por usuario: {calories, protein, carbs, fat}';

-- RLS para food_analysis_logs
ALTER TABLE public.food_analysis_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own food analysis" ON public.food_analysis_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food analysis" ON public.food_analysis_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food analysis" ON public.food_analysis_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own food analysis" ON public.food_analysis_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_food_analysis_logs_updated_at
  BEFORE UPDATE ON public.food_analysis_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Tabla para historial de escaneo de máquinas de gym
CREATE TABLE public.machine_scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  machine_name text,
  machine_type text,
  primary_muscles text[] DEFAULT '{}',
  secondary_muscles text[] DEFAULT '{}',
  usage_instructions text,
  posture_tips text,
  related_exercises jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.machine_scan_history IS 'Historial de máquinas de gym escaneadas con IA';
COMMENT ON COLUMN public.machine_scan_history.related_exercises IS 'Ejercicios relacionados: [{name, description}]';

-- RLS para machine_scan_history
ALTER TABLE public.machine_scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own machine scans" ON public.machine_scan_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own machine scans" ON public.machine_scan_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own machine scans" ON public.machine_scan_history
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Tabla para conversaciones del chat IA entrenador
CREATE TABLE public.ai_trainer_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_type text NOT NULL CHECK (conversation_type IN ('general', 'routine', 'meal_plan', 'advice')),
  title text,
  messages jsonb DEFAULT '[]'::jsonb,
  generated_content jsonb DEFAULT '{}'::jsonb,
  saved_to_app boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_trainer_conversations IS 'Conversaciones con el entrenador IA';
COMMENT ON COLUMN public.ai_trainer_conversations.messages IS 'Historial de mensajes: [{role, content, timestamp}]';
COMMENT ON COLUMN public.ai_trainer_conversations.generated_content IS 'Contenido generado (rutinas, planes, etc.)';

-- RLS para ai_trainer_conversations
ALTER TABLE public.ai_trainer_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.ai_trainer_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON public.ai_trainer_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON public.ai_trainer_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON public.ai_trainer_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_trainer_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Storage bucket para imágenes de análisis IA
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-analysis-images', 'ai-analysis-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para el bucket
CREATE POLICY "Anyone can view AI analysis images" ON storage.objects
  FOR SELECT USING (bucket_id = 'ai-analysis-images');

CREATE POLICY "Users can upload AI analysis images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ai-analysis-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own AI analysis images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ai-analysis-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );