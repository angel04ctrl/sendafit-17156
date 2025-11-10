import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
 * Hook to get the user's assigned routine
 */
export const useUserRoutine = () => {
  return useQuery({
    queryKey: ['user-routine'],
    queryFn: getUserRoutine,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });
};

/**
 * Hook to get today's workouts
 */
export const useTodaysWorkouts = () => {
  return useQuery({
    queryKey: ['todays-workouts'],
    queryFn: getTodaysWorkouts,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1
  });
};

/**
 * Hook to get workouts by date range
 */
export const useWorkoutsByDate = (params?: {
  date?: string;
  start_date?: string;
  end_date?: string;
}) => {
  return useQuery({
    queryKey: ['workouts-by-date', params],
    queryFn: () => getWorkoutsByDate(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!params?.date || !!params?.start_date || !!params?.end_date,
  });
};

/**
 * Generate weekly workouts (unified assign + redistribute)
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
      // Invalidate all workout-related queries
      queryClient.invalidateQueries({ queryKey: ['user-routine'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      
      // Show confirmation message if workouts were deleted
      if (data?.workouts_deleted && data.workouts_deleted > 0) {
        const { toast } = await import('sonner');
        toast.success(`Se eliminaron ${data.workouts_deleted} entrenamientos anteriores y se crearon ${data.workouts_created} nuevos entrenamientos`);
      }
    },
  });
};

/**
 * Hook to assign a routine to the current user
 * Now uses unified generate-weekly-workouts function
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
 * Hook to record workout progress
 */
export const useRecordProgress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ProgressData) => recordProgress(data),
    onSuccess: () => {
      // Invalidate progress queries to refetch
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['progress-stats'] });
    },
  });
};

/**
 * Hook to get progress history
 */
export const useProgress = (options?: {
  limit?: number;
  start_date?: string;
  end_date?: string;
}) => {
  return useQuery({
    queryKey: ['progress', options],
    queryFn: () => getProgress(options),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook to get progress statistics
 */
export const useProgressStats = (days: number = 30) => {
  return useQuery({
    queryKey: ['progress-stats', days],
    queryFn: () => getProgressStats(days),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to get all available routines
 */
export const useRoutines = (options?: {
  location?: string;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['routines', options],
    queryFn: () => getRoutines(options),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to get all workouts for the current user (complete routine)
 */
export const useAllWorkouts = (params?: {
  include_completed?: boolean;
  tipo?: 'automatico' | 'manual';
}) => {
  return useQuery({
    queryKey: ['all-workouts', params],
    queryFn: () => getAllWorkouts(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook to mark a workout as completed
 */
export const useCompleteWorkout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ workoutId, completed }: { workoutId: string; completed?: boolean }) => 
      completeWorkout(workoutId, completed),
    onSuccess: () => {
      // Invalidate workout queries to refetch
      queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
    },
  });
};

/**
 * Hook to get predesigned plans
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
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

/**
 * Hook to validate plan changes
 */
export const useValidatePlanChange = () => {
  return useMutation({
    mutationFn: (params: { new_weekdays?: string[]; new_goal?: string }) =>
      validatePlanChange(params),
  });
};

/**
 * Hook to redistribute workouts based on updated weekdays
 * Now uses unified generate-weekly-workouts function
 */
export const useRedistributeWorkouts = () => {
  return useGenerateWeeklyWorkouts();
};