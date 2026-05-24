-- ========================================
-- MIGRACIÓN: Corrección de Registros Huérfanos
-- Fecha: 2026-02-22
-- Objetivo: Reasignar entrenamientos y perfiles que apuntan a rutinas inexistentes
-- Severidad: ALTA
-- ========================================

-- Paso 0: Crear tabla de auditoría para registrar cambios
CREATE TABLE IF NOT EXISTS public.migration_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_name text NOT NULL,
  action text NOT NULL,
  affected_records integer,
  before_value text,
  after_value text,
  executed_at timestamptz DEFAULT now()
);

-- ========================================
-- TODA LA MIGRACIÓN EN UN BLOQUE ÚNICO
-- ========================================

DO $$ 
DECLARE
  v_fallback_plan_id text;
  v_valid_plans_count integer;
  v_orphaned_workouts_count integer;
  v_orphaned_profiles_count integer;
  v_workouts_updated integer := 0;
  v_profiles_updated integer := 0;
  v_final_orphaned_workouts integer;
  v_final_orphaned_profiles integer;
  v_total_plans integer;
  v_total_workouts integer;
  v_total_profiles integer;
  v_valid_workouts integer;
  v_valid_profiles integer;
BEGIN
  -- ========================================
  -- FASE 1: Identificación de Registros Huérfanos
  -- ========================================
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRACIÓN: fix_orphaned_records';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'FASE 1: Identificación de Registros Huérfanos';
  RAISE NOTICE '========================================';
  
  -- Contar workouts huérfanos
  SELECT COUNT(*) INTO v_orphaned_workouts_count
  FROM public.workouts w
  LEFT JOIN public.predesigned_plans pp ON w.plan_id = pp.id
  WHERE w.plan_id IS NOT NULL AND pp.id IS NULL;
  
  -- Contar profiles huérfanos
  SELECT COUNT(*) INTO v_orphaned_profiles_count
  FROM public.profiles p
  LEFT JOIN public.predesigned_plans pp ON p.assigned_routine_id = pp.id
  WHERE p.assigned_routine_id IS NOT NULL AND pp.id IS NULL;
  
  RAISE NOTICE 'ORPHANED_WORKOUTS: %', v_orphaned_workouts_count;
  RAISE NOTICE 'ORPHANED_PROFILES: %', v_orphaned_profiles_count;
  
  -- Registrar en auditoría
  INSERT INTO public.migration_audit (migration_name, action, affected_records, before_value)
  VALUES 
    ('20260222_fix_orphaned_records', 'BEFORE_orphaned_workouts', v_orphaned_workouts_count, 'Found ' || v_orphaned_workouts_count || ' workouts with invalid plan_id'),
    ('20260222_fix_orphaned_records', 'BEFORE_orphaned_profiles', v_orphaned_profiles_count, 'Found ' || v_orphaned_profiles_count || ' profiles with invalid routine_id');
  
  -- ========================================
  -- FASE 2: Seleccionar Plan de Reemplazo
  -- ========================================
  
  RAISE NOTICE '';
  RAISE NOTICE 'FASE 2: Seleccionar Plan de Reemplazo';
  RAISE NOTICE '========================================';
  IF v_orphaned_workouts_count = 0 AND v_orphaned_profiles_count = 0 THEN
    RAISE NOTICE 'No orphaned records found; fallback plan lookup skipped';
  ELSE
  
  -- Seleccionar plan con más ejercicios disponible
  SELECT pp.id INTO v_fallback_plan_id
  FROM public.predesigned_plans pp
  INNER JOIN public.plan_ejercicios pe ON pp.id = pe.plan_id
  WHERE pp.objetivo ILIKE '%mantener%' 
    OR pp.objetivo ILIKE '%tonificar%'
  GROUP BY pp.id, pp.nombre_plan
  ORDER BY COUNT(pe.id) DESC, pp.created_at ASC
  LIMIT 1;
  
  IF v_fallback_plan_id IS NULL THEN
    RAISE EXCEPTION 'No valid fallback plan found! Database state inconsistent.';
  END IF;
  
  -- Contar planes válidos disponibles
  SELECT COUNT(DISTINCT pp.id) INTO v_valid_plans_count
  FROM public.predesigned_plans pp
  INNER JOIN public.plan_ejercicios pe ON pp.id = pe.plan_id;
  
  RAISE NOTICE 'Fallback plan selected: %', v_fallback_plan_id;
  RAISE NOTICE 'Valid plans with exercises available: %', v_valid_plans_count;
  END IF;
  
  -- ========================================
  -- FASE 3: Reasignar Entrenamientos Huérfanos
  -- ========================================
  
  RAISE NOTICE '';
  RAISE NOTICE 'FASE 3: Reasignar Entrenamientos Huérfanos';
  RAISE NOTICE '========================================';
  
  -- Actualizar workouts con plan_id huérfano
  UPDATE public.workouts w
  SET plan_id = v_fallback_plan_id
  WHERE w.plan_id IS NOT NULL 
    AND w.plan_id NOT IN (SELECT id FROM public.predesigned_plans);
  
  GET DIAGNOSTICS v_workouts_updated = ROW_COUNT;
  
  IF v_workouts_updated > 0 THEN
    RAISE NOTICE 'WORKOUTS_REASIGNED: %', v_workouts_updated;
    INSERT INTO public.migration_audit (migration_name, action, affected_records, before_value, after_value)
    VALUES ('20260222_fix_orphaned_records', 'reasigned_workouts', v_workouts_updated, 'plan_id: invalid', 'plan_id: ' || v_fallback_plan_id);
  ELSE
    RAISE NOTICE 'No workouts needed reasignment';
  END IF;
  
  -- ========================================
  -- FASE 4: Reasignar Perfiles Huérfanos
  -- ========================================
  
  RAISE NOTICE '';
  RAISE NOTICE 'FASE 4: Reasignar Perfiles Huérfanos';
  RAISE NOTICE '========================================';
  
  -- Actualizar profiles con assigned_routine_id huérfano
  UPDATE public.profiles p
  SET assigned_routine_id = v_fallback_plan_id
  WHERE p.assigned_routine_id IS NOT NULL 
    AND p.assigned_routine_id NOT IN (SELECT id FROM public.predesigned_plans);
  
  GET DIAGNOSTICS v_profiles_updated = ROW_COUNT;
  
  IF v_profiles_updated > 0 THEN
    RAISE NOTICE 'PROFILES_REASIGNED: %', v_profiles_updated;
    INSERT INTO public.migration_audit (migration_name, action, affected_records, before_value, after_value)
    VALUES ('20260222_fix_orphaned_records', 'reasigned_profiles', v_profiles_updated, 'assigned_routine_id: invalid', 'assigned_routine_id: ' || v_fallback_plan_id);
  ELSE
    RAISE NOTICE 'No profiles needed reasignment';
  END IF;
  
  -- ========================================
  -- FASE 5: Verificación Post-Migración
  -- ========================================
  
  RAISE NOTICE '';
  RAISE NOTICE 'FASE 5: Verificación Post-Migración';
  RAISE NOTICE '========================================';
  
  -- Verificar que NO hay más registros huérfanos en workouts
  SELECT COUNT(*) INTO v_final_orphaned_workouts
  FROM public.workouts w
  LEFT JOIN public.predesigned_plans pp ON w.plan_id = pp.id
  WHERE w.plan_id IS NOT NULL AND pp.id IS NULL;
  
  -- Verificar que NO hay más registros huérfanos en profiles
  SELECT COUNT(*) INTO v_final_orphaned_profiles
  FROM public.profiles p
  LEFT JOIN public.predesigned_plans pp ON p.assigned_routine_id = pp.id
  WHERE p.assigned_routine_id IS NOT NULL AND pp.id IS NULL;
  
  IF v_final_orphaned_workouts = 0 AND v_final_orphaned_profiles = 0 THEN
    RAISE NOTICE '✓ PASSED: No orphaned records found';
  ELSE
    RAISE NOTICE '✗ FAILED: Still have % workouts and % profiles with orphaned records',
      v_final_orphaned_workouts, v_final_orphaned_profiles;
  END IF;
  
  RAISE NOTICE 'Final orphaned workouts: %', v_final_orphaned_workouts;
  RAISE NOTICE 'Final orphaned profiles: %', v_final_orphaned_profiles;
  
  -- ========================================
  -- FASE 6: Estadísticas Finales
  -- ========================================
  
  RAISE NOTICE '';
  RAISE NOTICE 'FASE 6: Estadísticas Finales';
  RAISE NOTICE '========================================';
  
  SELECT COUNT(*) INTO v_total_plans FROM public.predesigned_plans;
  SELECT COUNT(*) INTO v_total_workouts FROM public.workouts;
  SELECT COUNT(*) INTO v_total_profiles FROM public.profiles;
  SELECT COUNT(*) INTO v_valid_workouts 
  FROM public.workouts w 
  INNER JOIN public.predesigned_plans pp ON w.plan_id = pp.id;
  SELECT COUNT(*) INTO v_valid_profiles 
  FROM public.profiles p 
  WHERE p.assigned_routine_id IS NULL 
    OR EXISTS (SELECT 1 FROM public.predesigned_plans pp WHERE pp.id = p.assigned_routine_id);
  
  RAISE NOTICE 'Total predesigned_plans: %', v_total_plans;
  RAISE NOTICE 'Total workouts: %', v_total_workouts;
  RAISE NOTICE 'Total profiles: %', v_total_profiles;
  RAISE NOTICE 'Workouts with VALID plan_id: %', v_valid_workouts;
  RAISE NOTICE 'Profiles with VALID routine: %', v_valid_profiles;
  
  -- ========================================
  -- MIGRACIÓN COMPLETADA
  -- ========================================
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ MIGRACIÓN COMPLETADA EXITOSAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASOS:';
  RAISE NOTICE '1. Review migration_audit table for details';
  RAISE NOTICE '2. Deploy improved generate-weekly-workouts function';
  RAISE NOTICE '3. Test with new user onboarding';
  RAISE NOTICE '4. Monitor for errors in logs';
  RAISE NOTICE '';
  
END $$;
