-- =====================================================
-- PARCHE ADITIVO: Dev Override para acceso Pro
-- NO destructivo, NO modifica lógica existente
-- =====================================================

-- 1. Añadir campo dev_override a profiles (default false)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS dev_override boolean DEFAULT false;

-- 2. Comentario descriptivo
COMMENT ON COLUMN public.profiles.dev_override IS 'Override de desarrollo para acceso Pro. Solo efectivo para usuarios admin.';

-- 3. Crear función de verificación de override (ADITIVA, no reemplaza is_user_pro)
CREATE OR REPLACE FUNCTION public.has_dev_pro_override(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.dev_override = true
  )
$$;

-- 4. Comentario descriptivo de la función
COMMENT ON FUNCTION public.has_dev_pro_override IS 'Verifica si un usuario tiene el override de desarrollo activo. Función ADITIVA que no reemplaza is_user_pro.';