-- ========================================
-- MIGRACIÓN: Corrección de Integridad Referencial
-- Fecha: 2026-02-22
-- Objetivo: Prevenir registros huérfanos y asegurar consistencia de datos
-- Severidad: CRÍTICA
-- ========================================

-- Paso 1: Eliminar constraint antiguo en workouts si existe
-- Esto es seguro porque lo vamos a reemplazar inmediatamente
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'workouts' AND constraint_name = 'workouts_plan_id_fkey'
  ) THEN
    ALTER TABLE public.workouts
    DROP CONSTRAINT workouts_plan_id_fkey;
    RAISE NOTICE 'Dropped existing workouts_plan_id_fkey constraint';
  END IF;
END $$;

-- Paso 2: Agregar constraint con ON DELETE RESTRICT
-- Esto PREVIENE que se eliminen planes que tengan entrenamientos
ALTER TABLE public.workouts
ADD CONSTRAINT workouts_plan_id_fkey 
FOREIGN KEY (plan_id) REFERENCES public.predesigned_plans(id) 
ON DELETE RESTRICT NOT VALID;

-- Paso 3: Validar el constraint
-- NOT VALID permite crear el constraint sin escanear todos los datos
-- VALIDATE lo chequea, pero solo valida, no bloquea aplicación
ALTER TABLE public.workouts
VALIDATE CONSTRAINT workouts_plan_id_fkey;

-- Paso 4: Repetir para profiles.assigned_routine_id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_assigned_routine_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
    DROP CONSTRAINT profiles_assigned_routine_id_fkey;
    RAISE NOTICE 'Dropped existing profiles_assigned_routine_id_fkey constraint';
  END IF;
END $$;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_assigned_routine_id_fkey 
FOREIGN KEY (assigned_routine_id) REFERENCES public.predesigned_plans(id) 
ON DELETE RESTRICT;

-- Paso 5: Crear índices para mejor performance en búsquedas
CREATE INDEX IF NOT EXISTS idx_workouts_plan_id 
ON public.workouts(plan_id) 
WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_routine_id 
ON public.profiles(assigned_routine_id) 
WHERE assigned_routine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workouts_plan_completed 
ON public.workouts(plan_id, completed) 
WHERE completed = false;

-- Paso 6: Crear función protectora para prevenir eliminación accidental
CREATE OR REPLACE FUNCTION public.prevent_active_plan_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_active_workouts integer;
  v_active_profiles integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Verificar entrenamientos activos asociados al plan
    SELECT COUNT(*) INTO v_active_workouts
    FROM public.workouts
    WHERE plan_id = OLD.id AND (completed = false OR completed_at IS NULL);
    
    -- Verificar perfiles que tienen este plan asignado
    SELECT COUNT(*) INTO v_active_profiles
    FROM public.profiles
    WHERE assigned_routine_id = OLD.id;
    
    -- Si hay referencias activas, rechazar la eliminación
    IF v_active_workouts > 0 OR v_active_profiles > 0 THEN
      RAISE EXCEPTION 'Cannot delete predesigned_plan % - has % active workouts and is assigned to % users. Use reassign_plan() instead.',
        OLD.id, v_active_workouts, v_active_profiles
      USING ERRCODE = '23503';
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Paso 7: Crear trigger que usa la función
DROP TRIGGER IF EXISTS prevent_plan_deletion ON public.predesigned_plans;
CREATE TRIGGER prevent_plan_deletion
BEFORE DELETE ON public.predesigned_plans
FOR EACH ROW
EXECUTE FUNCTION public.prevent_active_plan_deletion();

-- Paso 8: Crear función auxiliar para reasignar planes
CREATE OR REPLACE FUNCTION public.reassign_plan(_old_plan_id text, _new_plan_id text)
RETURNS TABLE(
  workouts_updated integer,
  profiles_updated integer,
  success boolean
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_workouts_updated integer := 0;
  v_profiles_updated integer := 0;
BEGIN
  -- Validar que el nuevo plan existe
  IF NOT EXISTS (SELECT 1 FROM public.predesigned_plans WHERE id = _new_plan_id) THEN
    RAISE EXCEPTION 'Target plan % does not exist', _new_plan_id;
  END IF;
  
  -- Reasignar workouts
  UPDATE public.workouts
  SET plan_id = _new_plan_id
  WHERE plan_id = _old_plan_id;
  
  GET DIAGNOSTICS v_workouts_updated = ROW_COUNT;
  
  -- Reasignar profiles
  UPDATE public.profiles
  SET assigned_routine_id = _new_plan_id
  WHERE assigned_routine_id = _old_plan_id;
  
  GET DIAGNOSTICS v_profiles_updated = ROW_COUNT;
  
  RETURN QUERY SELECT v_workouts_updated, v_profiles_updated, true;
END;
$$;

-- Paso 9: Crear función para auditoría de integridad
CREATE OR REPLACE FUNCTION public.check_referential_integrity()
RETURNS TABLE(
  check_name text,
  issue_count integer,
  details text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  -- Chequeo 1: Workouts con plan_id huérfano
  RETURN QUERY
  SELECT 'orphaned_workouts_plans'::text,
    COUNT(*)::integer,
    'Workouts pointing to non-existent plans'::text
  FROM public.workouts w
  LEFT JOIN public.predesigned_plans pp ON w.plan_id = pp.id
  WHERE w.plan_id IS NOT NULL AND pp.id IS NULL;
  
  -- Chequeo 2: Profiles con routine_id huérfana
  RETURN QUERY
  SELECT 'orphaned_profiles_routines'::text,
    COUNT(*)::integer,
    'Profiles with non-existent assigned_routine_id'::text
  FROM public.profiles p
  LEFT JOIN public.predesigned_plans pp ON p.assigned_routine_id = pp.id
  WHERE p.assigned_routine_id IS NOT NULL AND pp.id IS NULL;
  
  -- Chequeo 3: Planes sin ejercicios
  RETURN QUERY
  SELECT 'plans_without_exercises'::text,
    COUNT(*)::integer,
    'Plans in predesigned_plans but no exercises defined'::text
  FROM public.predesigned_plans pp
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plan_ejercicios pe WHERE pe.plan_id = pp.id
  );
END;
$$;

-- Paso 10: Ejecutar verificación inicial y log de migración
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Integrity Check Results:';
  RAISE NOTICE '========================================';
END $$;

-- Mostrar resultados de integridad
SELECT 'Issue: ' || check_name || ' - Count: ' || issue_count as "Integrity Check"
FROM public.check_referential_integrity()
WHERE issue_count > 0;

-- Paso 11: Log de migración
INSERT INTO public.app_config (key, value, updated_at)
VALUES ('referential_integrity_fixed', true, now())
ON CONFLICT (key) DO UPDATE SET value = true, updated_at = now();

-- Log final
DO $$ 
BEGIN
  RAISE NOTICE '✓ Migration completed successfully';
  RAISE NOTICE '✓ Constraints added: workouts.plan_id, profiles.assigned_routine_id';
  RAISE NOTICE '✓ Protection enabled: Plans cannot be deleted if in use';
  RAISE NOTICE '✓ Functions available: reassign_plan(), check_referential_integrity()';
END $$;
