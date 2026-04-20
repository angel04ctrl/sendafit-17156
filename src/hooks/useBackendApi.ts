/**
 * useBackendApi.ts - Hooks personalizados para API del backend
 * 
 * Este documento centraliza todos los hooks de React Query para interactuar con el backend.
 * Se encarga de:
 * - Proveer hooks para obtener rutinas, entrenamientos y progreso
 * - Gestionar el cache y refetch automático de datos
 * - Manejar mutaciones (crear, actualizar, eliminar datos)
 * - Invalidar queries relacionadas automáticamente
 * - Simplificar el uso de la API en componentes
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  assignRoutine,
  getUserRoutine,
  recordProgress,
  getProgress,
  getProgressStats,
  getRoutines,
  getTodaysWorkouts,
  getWorkoutsByDate,
  getAllWorkouts,
  completeWorkout,
  getPredesignedPlans,
  redistributeWorkouts,
  validatePlanChange,
  type ProgressData
} from '@/lib/api/backend';

/**
 * Hook para obtener la rutina asignada al usuario
 * Retorna la rutina actual con todos sus ejercicios organizados por día
 */
export const useUserRoutine = () => {
  return useQuery({
    queryKey: ['user-routine'],
    queryFn: async () => {
      try {
        return await getUserRoutine();
      } catch (error) {
        console.error('Error fetching user routine:', error);
        return { routine: null, profile: null, message: 'Error loading routine' };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
    retry: 1
  });
};

/**
 * Hook para obtener los entrenamientos del día actual
 * Actualiza cada 2 minutos automáticamente
 */
export const useTodaysWorkouts = () => {
  return useQuery({
    queryKey: ['todays-workouts'],
    queryFn: async () => {
      try {
        return await getTodaysWorkouts();
      } catch (error) {
        console.error('Error fetching todays workouts:', error);
        return { workouts: [], date: new Date().toISOString().split('T')[0], count: 0 };
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutos de cache
    retry: 1
  });
};

/**
 * Hook para obtener entrenamientos por rango de fechas
 * Útil para el calendario semanal/mensual
 */
export const useWorkoutsByDate = (params?: {
  date?: string;
  start_date?: string;
  end_date?: string;
}) => {
  return useQuery({
    queryKey: ['workouts-by-date', params],
    queryFn: async () => {
      try {
        return await getWorkoutsByDate(params);
      } catch (error) {
        console.error('Error fetching workouts by date:', error);
        return { workouts: [], count: 0 };
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutos de cache
    enabled: !!params?.date || !!params?.start_date || !!params?.end_date,
  });
};

/**
 * Hook para generar entrenamientos semanales
 * Este hook unifica la asignación y redistribución de entrenamientos
 * Invalida todas las queries relacionadas al completarse
 */
export const useGenerateWeeklyWorkouts = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (options?: { reassign?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('generate-weekly-workouts', {
        body: options || {}
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Invalidar todas las queries relacionadas con entrenamientos
      queryClient.invalidateQueries({ queryKey: ['user-routine'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      
      // Mostrar mensaje de confirmación si se eliminaron entrenamientos
      if (data?.workouts_deleted && data.workouts_deleted > 0) {
        toast.success(`Se eliminaron ${data.workouts_deleted} entrenamientos anteriores y se crearon ${data.workouts_created} nuevos entrenamientos`);
      }
    },
  });
};

/**
 * Hook para asignar una rutina al usuario actual
 * Usa el generador unificado de entrenamientos con reassign=true
 */
export const useAssignRoutine = () => {
  const generateWorkouts = useGenerateWeeklyWorkouts();
  
  return useMutation({
    mutationFn: async () => {
      return generateWorkouts.mutateAsync({ reassign: true });
    },
  });
};

/**
 * Hook para registrar el progreso de un entrenamiento
 * Invalida las queries de progreso para refrescar datos
 */
export const useRecordProgress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ProgressData) => recordProgress(data),
    onSuccess: () => {
      // Invalidar queries de progreso para refetch
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['progress-stats'] });
    },
  });
};

/**
 * Hook para obtener historial de progreso
 * Soporta filtros por fecha y límite de resultados
 */
export const useProgress = (options?: {
  limit?: number;
  start_date?: string;
  end_date?: string;
}) => {
  return useQuery({
    queryKey: ['progress', options],
    queryFn: () => getProgress(options),
    staleTime: 2 * 60 * 1000, // 2 minutos de cache
  });
};

/**
 * Hook para obtener estadísticas de progreso
 * Calcula métricas como racha, total de entrenamientos, cambio de peso, etc.
 */
export const useProgressStats = (days: number = 30) => {
  return useQuery({
    queryKey: ['progress-stats', days],
    queryFn: async () => {
      try {
        return await getProgressStats(days);
      } catch (error) {
        console.error('Error fetching progress stats:', error);
        return {
          stats: {
            total_workouts: 0,
            weight_change: 0,
            average_energy_level: 0,
            workout_streak: 0,
            weight_trend: [],
            energy_trend: [],
          },
          period_days: days,
          calculated_at: new Date().toISOString(),
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
  });
};

/**
 * Hook para obtener rutinas disponibles
 * Soporta filtros por ubicación y límite de resultados
 */
export const useRoutines = (options?: {
  location?: string;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['routines', options],
    queryFn: () => getRoutines(options),
    staleTime: 10 * 60 * 1000, // 10 minutos de cache
  });
};

/**
 * Hook para obtener todos los entrenamientos del usuario
 * Útil para ver la rutina completa o historial
 */
export const useAllWorkouts = (params?: {
  include_completed?: boolean;
  tipo?: 'automatico' | 'manual';
}) => {
  return useQuery({
    queryKey: ['all-workouts', params],
    queryFn: () => getAllWorkouts(params),
    staleTime: 2 * 60 * 1000, // 2 minutos de cache
  });
};

/**
 * Hook para marcar un entrenamiento como completado/incompleto
 * Invalida todas las queries de entrenamientos al completarse
 */
export const useCompleteWorkout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ workoutId, completed }: { workoutId: string; completed?: boolean }) => 
      completeWorkout(workoutId, completed),
    onSuccess: () => {
      // Invalidar queries de entrenamientos para refetch
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
    },
  });
};

/**
 * Hook para obtener planes prediseñados
 * Soporta filtros por objetivo, nivel, lugar y días por semana
 */
export const usePredesignedPlans = (filters?: {
  objetivo?: string;
  nivel?: string;
  lugar?: string;
  dias_semana?: number;
}) => {
  return useQuery({
    queryKey: ['predesigned-plans', filters],
    queryFn: () => getPredesignedPlans(filters),
    staleTime: 30 * 60 * 1000, // 30 minutos de cache
  });
};

/**
 * Hook para validar cambios de plan
 * Valida si se pueden hacer cambios sin perder progreso
 */
export const useValidatePlanChange = () => {
  return useMutation({
    mutationFn: (params: { new_weekdays?: string[]; new_goal?: string }) =>
      validatePlanChange(params),
  });
};

/**
 * Hook para redistribuir entrenamientos
 * Usa el generador unificado de entrenamientos para reorganizar los días
 */
export const useRedistributeWorkouts = () => {
  return useGenerateWeeklyWorkouts();
};
