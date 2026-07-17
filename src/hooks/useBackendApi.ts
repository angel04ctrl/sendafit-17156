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
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logAppError } from '@/lib/appErrorLogger';
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
  cancelWorkoutSession,
  getExerciseProgressSummary,
  getPredesignedPlans,
  getActiveWorkoutSession,
  getWorkoutSessionSets,
  finishWorkoutSession,
  saveProgressionSuggestion,
  saveWorkoutSessionSet,
  startWorkoutSession,
  substituteWorkoutExercise,
  moveWorkoutToDate,
  skipWorkout,
  fetchMonthlyReport,
  redistributeWorkouts,
  validatePlanChange,
  type MonthlyReportParams,
  type ProgressData,
  type SaveProgressionSuggestionInput,
  type SaveWorkoutSessionSetInput,
  type SubstituteWorkoutExerciseInput,
  type MoveWorkoutInput,
  type SkipWorkoutInput,
} from '@/lib/api/backend';

const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

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
 * Hook para obtener el reporte mensual avanzado
 * Devuelve datos diarios listos para Recharts
 */
export const useMonthlyReport = (params: MonthlyReportParams) => {
  return useQuery({
    queryKey: ['monthly-report', params.startDate, params.endDate],
    queryFn: () => fetchMonthlyReport(params),
    enabled: !!params.startDate && !!params.endDate,
    staleTime: 10 * 60 * 1000,
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
    onSuccess: (data) => {
      const updatedWorkout = data?.workout;

      if (updatedWorkout?.id) {
        queryClient.setQueriesData({ queryKey: ['weekly-workouts'] }, (oldData: unknown) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map((workout) =>
            workout && typeof workout === 'object' && 'id' in workout && workout.id === updatedWorkout.id
              ? { ...workout, ...updatedWorkout }
              : workout,
          );
        });

        queryClient.setQueriesData({ queryKey: ['todays-workouts'] }, (oldData: unknown) => {
          if (!oldData || typeof oldData !== 'object' || !('workouts' in oldData)) return oldData;
          const response = oldData as { workouts?: unknown[] };
          return {
            ...response,
            workouts: (response.workouts || []).map((workout) =>
              workout && typeof workout === 'object' && 'id' in workout && workout.id === updatedWorkout.id
                ? { ...workout, ...updatedWorkout }
                : workout,
            ),
          };
        });
      }

      // Invalidar queries de entrenamientos para refetch
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-calendar-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
    },
  });
};

export const useActiveWorkoutSession = (workoutId?: string | null) => {
  return useQuery({
    queryKey: ['active-workout-session', workoutId],
    queryFn: () => getActiveWorkoutSession(workoutId || ''),
    enabled: !!workoutId,
    staleTime: 30 * 1000,
  });
};

export const useWorkoutSessionSets = (sessionId?: string | null) => {
  return useQuery({
    queryKey: ['workout-session-sets', sessionId],
    queryFn: () => getWorkoutSessionSets(sessionId || ''),
    enabled: !!sessionId,
    staleTime: 15 * 1000,
  });
};

export const useExerciseProgressSummary = (params?: {
  exerciseId?: string | null;
  exerciseName?: string | null;
}) => {
  const exerciseId = params?.exerciseId?.trim() || '';
  const normalizedName = params?.exerciseName?.trim() || '';

  return useQuery({
    queryKey: ['exercise-progress-summary', exerciseId || normalizedName],
    queryFn: () => getExerciseProgressSummary({ exerciseId, exerciseName: normalizedName }),
    enabled: !!exerciseId || !!normalizedName,
    staleTime: 60 * 1000,
  });
};

export const useStartWorkoutSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workoutId: string) => startWorkoutSession(workoutId),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['active-workout-session', session.workout_id] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets', session.id] });
    },
  });
};

export const useSaveWorkoutSessionSet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveWorkoutSessionSetInput) => saveWorkoutSessionSet(input),
    onSuccess: (set) => {
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets', set.session_id] });
      queryClient.invalidateQueries({ queryKey: ['exercise-progress-summary'] });
    },
  });
};

export const useSubstituteWorkoutExercise = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubstituteWorkoutExerciseInput) => substituteWorkoutExercise(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['exercise-progress-summary'] });
    },
  });
};

const invalidateWorkoutQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
  queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
  queryClient.invalidateQueries({ queryKey: ['weekly-workouts'] });
  queryClient.invalidateQueries({ queryKey: ['weekly-calendar-workouts'] });
  queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
};

export const useMoveWorkoutToDate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MoveWorkoutInput) => moveWorkoutToDate(input),
    onSuccess: () => {
      invalidateWorkoutQueries(queryClient);
    },
  });
};

export const useSkipWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SkipWorkoutInput) => skipWorkout(input),
    onSuccess: () => {
      invalidateWorkoutQueries(queryClient);
    },
  });
};

export const useSaveProgressionSuggestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveProgressionSuggestionInput) => saveProgressionSuggestion(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progression-suggestions'] });
    },
  });
};

export const useFinishWorkoutSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: finishWorkoutSession,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-workout-session', data.session.workout_id] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets', data.session.id] });
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-calendar-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['exercise-progress-summary'] });
    },
  });
};

export const useCancelWorkoutSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => cancelWorkoutSession(sessionId),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['active-workout-session', session.workout_id] });
      queryClient.invalidateQueries({ queryKey: ['workout-session-sets', session.id] });
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

export const useUserProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useWeeklyWorkouts = (userId: string | undefined, startDate: string) => {
  return useQuery({
    queryKey: ['weekly-workouts', userId, startDate],
    queryFn: async () => {
      if (!userId) return [];
      const end = new Date(`${startDate}T00:00:00`);
      end.setDate(end.getDate() + 6);
      const endDate = end.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('workouts')
        .select('*, workout_exercises(*)')
        .eq('user_id', userId)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!startDate,
    staleTime: 5 * 60 * 1000,
  });
};

export const useDeleteWorkout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
    }
  });
};

export const useCreateWorkout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async ({ workout, exercises }: { workout: any, exercises: any[] }) => {
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .insert([workout])
        .select()
        .single();

      if (workoutError) throw workoutError;

      if (exercises.length > 0) {
        const exercisesToInsert = exercises.map(ex => ({
          ...ex,
          workout_id: workoutData.id
        }));
        const { error: exercisesError } = await supabase
          .from('workout_exercises')
          .insert(exercisesToInsert);
        
        if (exercisesError) throw exercisesError;
      }
      
      return workoutData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
    }
  });
};

/**
 * Hook para obtener entrenamientos de un rango de fechas (Calendario)
 * Consulta directamente la tabla workouts para máxima fiabilidad
 * Ordena por scheduled_date para vista ordenada
 */
export const useWeeklyCalendarWorkouts = (startDate: string, endDate: string, userId?: string) => {
  const { user } = useAuth();
  const finalUserId = userId || user?.id;
  
  return useQuery({
    queryKey: ['weekly-calendar-workouts', finalUserId, startDate, endDate],
    queryFn: async () => {
      if (!finalUserId) return [];
      const { data, error } = await supabase
        .from('workouts')
        .select('*, workout_exercises(*)')
        .eq('user_id', finalUserId)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })
        .order('weekday', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!finalUserId && !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000, // 2 minutos de cache
  });
};

/**
 * Hook para obtener comidas de un rango de fechas (Historial de Comidas)
 * Soporta filtros por usuario y rango de fechas
 */
export const useMealsHistory = (startDate?: string, endDate?: string, userId?: string) => {
  const { user } = useAuth();
  const finalUserId = userId || user?.id;
  
  return useQuery({
    queryKey: ['meals-history', finalUserId, startDate, endDate],
    queryFn: async () => {
      if (!finalUserId) return [];
      let query = supabase
        .from('meals')
        .select('*')
        .eq('user_id', finalUserId)
        .order('date', { ascending: false });
      
      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!finalUserId,
    staleTime: 2 * 60 * 1000, // 2 minutos de cache
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

/**
 * Hook para generar entrenamientos semanales CON REINTENTOS
 */
export const useGenerateWeeklyWorkouts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (options?: { reassign?: boolean; retries?: number; planChangeAction?: string }) => {
      const userLocalDate = getLocalDateString();
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const maxRetries = options?.retries || 3;
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Generating workouts - Attempt ${attempt}/${maxRetries}`);
          
          const { data, error } = await supabase.functions.invoke('generate-weekly-workouts', {
            body: { 
              ...options, 
              userLocalDate, 
              userTimezone,
              attempt // Pasar el número de intento
            }
          });
          
          if (error) {
            lastError = error;
            console.error(`Attempt ${attempt} failed:`, error);
            
            if (attempt < maxRetries) {
              // Esperar progresivamente más entre reintentos
              await new Promise(resolve => 
                setTimeout(resolve, 1000 * attempt)
              );
              continue; // Reintentar
            }
          } else {
            return data; // Éxito
          }
        } catch (err) {
          lastError = err;
          console.error(`Attempt ${attempt} threw exception:`, err);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => 
              setTimeout(resolve, 1000 * attempt)
            );
            continue;
          }
        }
      }

      throw lastError;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-routine'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-calendar-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      
      if (data?.workouts_deleted && data.workouts_deleted > 0) {
        toast.success(
          `✅ Entrenamientos actualizados: ${data.workouts_created} nuevos`
        );
      }
    },
    onError: (error: unknown) => {
      console.error('All retry attempts failed:', error);
      void logAppError({
        userId: user?.id,
        source: 'routine-generation',
        message: error instanceof Error ? error.message : 'No se pudieron generar entrenamientos.',
        severity: 'error',
      });
      toast.error(
        'No se pudieron generar tus entrenamientos. Por favor intenta más tarde.'
      );
    }
  });
};
