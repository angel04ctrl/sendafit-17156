import { supabase } from "@/integrations/supabase/client";

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

export interface MonthlyReportParams {
  startDate: string;
  endDate: string;
}

export interface MonthlyReportDay {
  date: string;
  weight: number | null;
  body_fat_percentage: number | null;
  energy_level: number | null;
  calories_burned: number;
  workouts_completed: number;
  workouts_scheduled: number;
  calories_consumed: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MonthlyReportResponse {
  range: MonthlyReportParams;
  daily: MonthlyReportDay[];
  totals: {
    calories_burned: number;
    workouts_completed: number;
    workouts_scheduled: number;
    calories_consumed: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  summary: {
    total_days: number;
    completion_rate: number;
    average_energy_level: number | null;
    weight_change: number | null;
  };
  generated_at: string;
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
  const userLocalDate = new Date().toISOString().split('T')[0];
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data, error } = await supabase.functions.invoke('assign-routine', {
    method: 'POST',
    body: { userLocalDate, userTimezone }
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
  // Send client timezone to get correct workouts for today
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const { data, error } = await supabase.functions.invoke('get-todays-workouts', {
    method: 'POST',
    body: { timezone }
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
  const { data, error } = await supabase.functions.invoke('get-workouts-by-date', {
    method: 'POST',
    body: params || {}
  });

  if (error) throw error;
  return data;
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
  const { data, error } = await supabase.functions.invoke('get-progress', {
    method: 'POST',
    body: options || {}
  });

  if (error) throw error;
  return data;
}

/**
 * Get progress statistics for the current user
 */
export async function getProgressStats(days: number = 30): Promise<StatsResponse> {
  const { data, error } = await supabase.functions.invoke('get-progress-stats', {
    method: 'POST',
    body: { days }
  });

  if (error) throw error;
  return data;
}

/**
 * Get advanced monthly report data ready for charts
 */
export async function fetchMonthlyReport(params: MonthlyReportParams): Promise<MonthlyReportResponse> {
  const { data, error } = await supabase.functions.invoke('get-monthly-report', {
    method: 'POST',
    body: params
  });

  if (error) throw error;
  return data;
}

/**
 * Get all available routines
 */
export async function getRoutines(options?: {
  location?: string;
  limit?: number;
}): Promise<{ routines: any[]; count: number }> {
  const { data, error } = await supabase.functions.invoke('get-routines', {
    method: 'POST',
    body: options || {}
  });

  if (error) throw error;
  return data;
}

/**
 * Get all workouts for the current user (complete routine)
 */
export async function getAllWorkouts(params?: {
  include_completed?: boolean;
  tipo?: 'automatico' | 'manual';
}): Promise<{ workouts: any[]; stats: any }> {
  const { data, error } = await supabase.functions.invoke('get-all-workouts', {
    method: 'POST',
    body: params || {}
  });

  if (error) throw error;
  return data;
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
  const { data, error } = await supabase.functions.invoke('get-predesigned-plans', {
    method: 'POST',
    body: filters || {}
  });

  if (error) throw error;
  return data;
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
