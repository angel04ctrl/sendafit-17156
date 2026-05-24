-- ========================================
-- MIGRACIÓN: Implementar Auto-Assignment Trigger
-- Fecha: 2026-02-22
-- Objetivo: Asignar automáticamente rutina al completar onboarding
-- Severidad: MEDIA
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRACIÓN: implement_auto_assign_trigger';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- Paso 1: Reemplazar el trigger vacío con lógica real
CREATE OR REPLACE FUNCTION public.auto_assign_routine_on_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_best_plan_id text;
  v_plan_count integer;
  v_fitness_goal text;
  v_fitness_level text;
BEGIN
  -- Solo ejecutar si onboarding fue completado en este UPDATE
  IF NEW.onboarding_completed = true AND 
     (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    
    -- Si ya tiene rutina asignada, no hacer nada
    IF NEW.assigned_routine_id IS NOT NULL THEN
      RAISE NOTICE 'User % already has routine assigned: %', NEW.id, NEW.assigned_routine_id;
      RETURN NEW;
    END IF;
    
    -- Verificar que existan planes disponibles
    SELECT COUNT(*) INTO v_plan_count FROM public.predesigned_plans;
    
    IF v_plan_count = 0 THEN
      RAISE EXCEPTION 'No predesigned plans available for routine assignment. Contact admin.';
    END IF;
    
    -- Obtener fitness_goal y fitness_level del perfil
    v_fitness_goal := COALESCE(NEW.fitness_goal::text, 'mantener');
    v_fitness_level := COALESCE(NEW.fitness_level::text, 'principiante');
    
    -- Seleccionar el mejor plan basado en objetivo y nivel del usuario
    SELECT pp.id INTO v_best_plan_id
    FROM public.predesigned_plans pp
    WHERE 
      (LOWER(pp.objetivo) ILIKE '%' || LOWER(v_fitness_goal) || '%'
       OR LOWER(pp.objetivo) ILIKE '%mantener%')
      AND LOWER(pp.nivel) = (CASE 
        WHEN LOWER(v_fitness_level) = 'principiante' THEN 'b'
        WHEN LOWER(v_fitness_level) = 'intermedio' THEN 'i'
        WHEN LOWER(v_fitness_level) = 'avanzado' THEN 'p'
        ELSE 'b'
      END)
      AND EXISTS (
        SELECT 1 FROM public.plan_ejercicios 
        WHERE plan_id = pp.id
      )
    ORDER BY pp.created_at ASC
    LIMIT 1;
    
    -- Si no encuentra plan específico, tomar el primero disponible con ejercicios
    IF v_best_plan_id IS NULL THEN
      SELECT pp.id INTO v_best_plan_id
      FROM public.predesigned_plans pp
      WHERE EXISTS (
        SELECT 1 FROM public.plan_ejercicios 
        WHERE plan_id = pp.id
      )
      ORDER BY pp.nombre_plan ASC, pp.created_at ASC
      LIMIT 1;
    END IF;
    
    -- Si aún no hay plan (base de datos vacía), generar error
    IF v_best_plan_id IS NULL THEN
      RAISE EXCEPTION 'No valid predesigned plans with exercises available. Contact admin.';
    END IF;
    
    -- Asignar la rutina
    NEW.assigned_routine_id := v_best_plan_id;
    
    RAISE NOTICE 'Auto-assigned routine % (goal: %, level: %) to user %', 
      v_best_plan_id, v_fitness_goal, v_fitness_level, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'Function auto_assign_routine_on_onboarding updated';
END $$;

-- Paso 2: Crear o reemplazar el trigger
-- El trigger ejecuta la función BEFORE UPDATE para persistir NEW.assigned_routine_id
DROP TRIGGER IF EXISTS auto_assign_routine_on_completion ON public.profiles;

CREATE TRIGGER auto_assign_routine_on_completion
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (NEW.onboarding_completed = true 
  AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false))
EXECUTE FUNCTION public.auto_assign_routine_on_onboarding();

DO $$
BEGIN
  RAISE NOTICE 'Trigger auto_assign_routine_on_completion created';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ AUTO-ASSIGNMENT TRIGGER IMPLEMENTED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Now when a user completes onboarding:';
  RAISE NOTICE '1. A routine will be auto-assigned based on goal & level';
  RAISE NOTICE '2. Edge function will generate workouts automatically';
  RAISE NOTICE '3. User profile will be fully initialized';
  RAISE NOTICE '';
END $$;
