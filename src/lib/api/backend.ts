import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Backend API client for fitness app
 * Wraps all edge function calls with proper error handling
 */

export interface ProgressData {
  workout_id?: string;
  date?: string;
  weight?: number;
  body_measurements?: Record<string, number>;
  energy_level?: number;
  menstrual_phase?: string;
  notes?: string;
  exercises_completed?: Array<{
    exercise_id: string;
    sets?: number;
    reps?: number;
    duration_minutes?: number;
    weight_used?: number;
  }>;
}

export interface RoutineResponse {
  routine: any;
  profile?: any;
  message?: string;
}

export interface ProgressResponse {
  progress: any[];
  count: number;
}

export interface StatsResponse {
  stats: {
    total_workouts: number;
    weight_change: number;
    average_energy_level: number;
    workout_streak: number;
    weight_trend: Array<{ date: string; weight: number }>;
    energy_trend: Array<{ date: string; energy: number }>;
  };
  period_days: number;
  calculated_at: string;
}

export interface PlanChangeValidation {
  action: string;
  needsReassign: boolean;
  needsRedistribute: boolean;
  reason: string;
  changes: {
    goalChanged: boolean;
    weekdaysCountChanged: boolean;
    weekdaysChanged: boolean;
    oldGoal: string;
    newGoal: string;
    oldWeekdays: string[];
    newWeekdays: string[];
    oldDaysCount: number;
    newDaysCount: number;
  };
  impact: {
    affectedWorkoutsCount: number;
    completedWorkoutsCount: number;
    pendingWorkoutsCount: number;
    willPreserveCompleted: boolean;
  };
  currentPlan?: {
    nombre_plan: string;
    dias_semana: number;
    objetivo: string;
  };
  preview: {
    message: string;
    summary: string;
  };
}

/**
 * Assign a routine automatically to the current user based on their profile
 */
export async function assignRoutine(): Promise<RoutineResponse> {
  const { data, error } = await supabase.functions.invoke('assign-routine', {
    method: 'POST'
  });

  if (error) throw error;
  return data;
}

/**
 * Get the assigned routine for the current user
 */
export async function getUserRoutine(): Promise<RoutineResponse> {
  const { data, error } = await supabase.functions.invoke('get-user-routine', {
    method: 'GET'
  });

  if (error) throw error;
  return data;
}

/**
 * Get today's workouts
 */
export async function getTodaysWorkouts(): Promise<{ workouts: any[]; date: string; count: number }> {
  const { data, error } = await supabase.functions.invoke('get-todays-workouts', {
    method: 'GET'
  });

  if (error) throw error;
  return data;
}

/**
 * Get workouts by date or date range
 */
export async function getWorkoutsByDate(params?: {
  date?: string;
  start_date?: string;
  end_date?: string;
}): Promise<{ workouts: any[]; count: number }> {
  const queryParams = new URLSearchParams();
  if (params?.date) queryParams.append('date', params.date);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const url = `${SUPABASE_URL}/functions/v1/get-workouts-by-date${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workouts: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Record progress for a workout
 */
export async function recordProgress(progressData: ProgressData): Promise<{ success: boolean; progress: any; message: string }> {
  const { data, error } = await supabase.functions.invoke('record-progress', {
    body: progressData
  });

  if (error) throw error;
  return data;
}

/**
 * Get progress history for the current user
 */
export async function getProgress(options?: {
  limit?: number;
  start_date?: string;
  end_date?: string;
}): Promise<ProgressResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.start_date) params.append('start_date', options.start_date);
  if (options?.end_date) params.append('end_date', options.end_date);

  const url = `${SUPABASE_URL}/functions/v1/get-progress${params.toString() ? '?' + params.toString() : ''}`;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch progress: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get progress statistics for the current user
 */
export async function getProgressStats(days: number = 30): Promise<StatsResponse> {
  const params = new URLSearchParams({ days: days.toString() });
  const url = `${SUPABASE_URL}/functions/v1/get-progress-stats?${params.toString()}`;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all available routines
 */
export async function getRoutines(options?: {
  location?: string;
  limit?: number;
}): Promise<{ routines: any[]; count: number }> {
  const params = new URLSearchParams();
  if (options?.location) params.append('location', options.location);
  if (options?.limit) params.append('limit', options.limit.toString());

  const url = `${SUPABASE_URL}/functions/v1/get-routines${params.toString() ? '?' + params.toString() : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch routines: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all workouts for the current user (complete routine)
 */
export async function getAllWorkouts(params?: {
  include_completed?: boolean;
  tipo?: 'automatico' | 'manual';
}): Promise<{ workouts: any[]; stats: any }> {
  const queryParams = new URLSearchParams();
  if (params?.include_completed !== undefined) {
    queryParams.append('include_completed', params.include_completed.toString());
  }
  if (params?.tipo) {
    queryParams.append('tipo', params.tipo);
  }

  const url = `${SUPABASE_URL}/functions/v1/get-all-workouts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch all workouts: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Mark a workout as completed or incomplete
 */
export async function completeWorkout(
  workoutId: string, 
  completed: boolean = true
): Promise<{ success: boolean; workout: any }> {
  const { data, error } = await supabase.functions.invoke('complete-workout', {
    body: { workout_id: workoutId, completed }
  });

  if (error) throw error;
  return data;
}

/**
 * Get all predesigned plans available
 */
export async function getPredesignedPlans(filters?: {
  objetivo?: string;
  nivel?: string;
  lugar?: string;
  dias_semana?: number;
}): Promise<{ plans: any[]; count: number }> {
  const params = new URLSearchParams();
  if (filters?.objetivo) params.append('objetivo', filters.objetivo);
  if (filters?.nivel) params.append('nivel', filters.nivel);
  if (filters?.lugar) params.append('lugar', filters.lugar);
  if (filters?.dias_semana) params.append('dias_semana', filters.dias_semana.toString());

  const url = `${SUPABASE_URL}/functions/v1/get-predesigned-plans${params.toString() ? '?' + params.toString() : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch predesigned plans: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Validate plan changes before applying them
 */
export async function validatePlanChange(params: {
  new_weekdays?: string[];
  new_goal?: string;
}): Promise<PlanChangeValidation> {
  const { data, error } = await supabase.functions.invoke('validate-plan-change', {
    body: params,
  });

  if (error) throw error;
  return data;
}

/**
 * Redistribute workouts based on updated user weekdays
 */
export async function redistributeWorkouts(): Promise<{ success: boolean; workouts_created: number; training_days: string[] }> {
  const { data, error } = await supabase.functions.invoke('redistribute-workouts', {
    method: 'POST'
  });

  if (error) throw error;
  return data;
}