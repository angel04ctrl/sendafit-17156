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
  planProtection?: {
    isProtected: boolean;
    reason: string;
    planType: string;
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

export interface WorkoutSession {
  id: string;
  user_id: string;
  workout_id: string;
  started_at: string;
  finished_at: string | null;
  status: "active" | "completed" | "cancelled";
  duration_seconds: number | null;
  notes: string | null;
  session_feeling: "strong" | "normal" | "tired" | "pain" | null;
  pain_flag: boolean;
  pain_notes: string | null;
  overall_rpe: number | null;
  user_notes: string | null;
  created_at: string;
}

export interface WorkoutSessionSet {
  id: string;
  session_id: string;
  workout_exercise_id: string | null;
  exercise_id: string | null;
  set_number: number;
  target_reps: number | null;
  actual_reps: number | null;
  target_weight: number | null;
  actual_weight: number | null;
  rir: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  completed: boolean;
  exercise_name_snapshot: string | null;
  workout_exercise_name_snapshot: string | null;
  created_at: string;
}

export interface ExerciseProgressSet {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rir: number | null;
  rpe: number | null;
  volume: number;
}

export interface ExerciseProgressSession {
  sessionId: string;
  workoutId: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  notes: string | null;
  sessionFeeling: "strong" | "normal" | "tired" | "pain" | null;
  painFlag: boolean;
  painNotes: string | null;
  exerciseName: string;
  sets: ExerciseProgressSet[];
  totalVolume: number;
  maxWeight: number | null;
  totalReps: number;
}

export interface ExerciseProgressPrs {
  maxWeight: number | null;
  maxRepsAtMaxWeight: number | null;
  maxVolume: number;
  bestRecentSession: ExerciseProgressSession | null;
}

export interface ExerciseProgressSummary {
  exerciseName: string;
  source: "exercise_id" | "snapshot";
  sessions: ExerciseProgressSession[];
  lastSession: ExerciseProgressSession | null;
  prs: ExerciseProgressPrs;
}

export interface SaveProgressionSuggestionInput {
  exercise_id?: string | null;
  exercise_name_snapshot: string;
  source: "exercise_id" | "snapshot";
  workout_session_id?: string | null;
  previous_weight?: number | null;
  previous_reps?: number[] | null;
  suggested_action: string;
  suggested_weight?: number | null;
  suggested_reps?: number | null;
  confidence: "high" | "medium" | "low";
  reason: string;
  based_on_session_id?: string | null;
}

export interface ProgressionSuggestionRecord extends SaveProgressionSuggestionInput {
  id: string;
  user_id: string;
  created_at: string;
}

export interface SaveWorkoutSessionSetInput {
  session_id: string;
  workout_exercise_id?: string | null;
  exercise_id?: string | null;
  exercise_name_snapshot?: string | null;
  workout_exercise_name_snapshot?: string | null;
  set_number: number;
  target_reps?: number | null;
  actual_reps?: number | null;
  target_weight?: number | null;
  actual_weight?: number | null;
  rir?: number | null;
  rpe?: number | null;
  rest_seconds?: number | null;
  completed?: boolean;
}

export interface ExerciseProgressQuery {
  exerciseId?: string | null;
  exerciseName?: string | null;
  limit?: number;
}

type RawExerciseProgressSet = WorkoutSessionSet & {
  workout_sessions?: {
    id: string;
    workout_id: string;
    started_at: string;
    finished_at: string | null;
      duration_seconds: number | null;
      notes: string | null;
      session_feeling: "strong" | "normal" | "tired" | "pain" | null;
      pain_flag: boolean;
      pain_notes: string | null;
    } | null;
  workout_exercises?: {
    id: string;
    exercise_id: string | null;
    name: string;
  } | null;
};

function buildExerciseProgressSummary(
  exerciseName: string,
  rows: RawExerciseProgressSet[],
  source: "exercise_id" | "snapshot" = "snapshot",
): ExerciseProgressSummary {
  const sessions = new Map<string, ExerciseProgressSession>();

  for (const row of rows) {
    const session = row.workout_sessions;
    if (!session) continue;

    const key = session.id;
    const volume = (row.actual_weight || 0) * (row.actual_reps || 0);
    const existing = sessions.get(key);
    const setEntry: ExerciseProgressSet = {
      setNumber: row.set_number,
      reps: row.actual_reps,
      weight: row.actual_weight,
      rir: row.rir,
      rpe: row.rpe,
      volume,
    };

    if (existing) {
      existing.sets.push(setEntry);
      existing.totalVolume += volume;
      existing.totalReps += row.actual_reps || 0;
      existing.maxWeight = Math.max(existing.maxWeight || 0, row.actual_weight || 0) || null;
      continue;
    }

    sessions.set(key, {
      sessionId: session.id,
      workoutId: session.workout_id,
      startedAt: session.started_at,
      finishedAt: session.finished_at,
      durationSeconds: session.duration_seconds,
      notes: session.notes,
      sessionFeeling: session.session_feeling,
      painFlag: session.pain_flag,
      painNotes: session.pain_notes,
      exerciseName: row.exercise_name_snapshot || row.workout_exercise_name_snapshot || row.workout_exercises?.name || exerciseName,
      sets: [setEntry],
      totalVolume: volume,
      maxWeight: row.actual_weight,
      totalReps: row.actual_reps || 0,
    });
  }

  const sessionList = Array.from(sessions.values())
    .map((session) => ({
      ...session,
      sets: [...session.sets].sort((a, b) => a.setNumber - b.setNumber),
    }))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const allSets = sessionList.flatMap((session) => session.sets);
  const maxWeight = allSets.reduce<number | null>((max, set) => {
    if (set.weight === null) return max;
    return max === null ? set.weight : Math.max(max, set.weight);
  }, null);
  const maxRepsAtMaxWeight = maxWeight === null
    ? null
    : allSets
        .filter((set) => set.weight === maxWeight)
        .reduce<number | null>((max, set) => {
          if (set.reps === null) return max;
          return max === null ? set.reps : Math.max(max, set.reps);
        }, null);
  const bestRecentSession = sessionList.reduce<ExerciseProgressSession | null>((best, session) => {
    if (!best) return session;
    return session.totalVolume > best.totalVolume ? session : best;
  }, null);

  return {
    exerciseName,
    source,
    sessions: sessionList,
    lastSession: sessionList[0] || null,
    prs: {
      maxWeight,
      maxRepsAtMaxWeight,
      maxVolume: bestRecentSession?.totalVolume || 0,
      bestRecentSession,
    },
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

export async function getActiveWorkoutSession(workoutId: string): Promise<WorkoutSession | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuario no autenticado");

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("workout_id", workoutId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as WorkoutSession | null;
}

export async function startWorkoutSession(workoutId: string): Promise<WorkoutSession> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuario no autenticado");

  const existing = await getActiveWorkoutSession(workoutId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      workout_id: workoutId,
      status: "active",
    })
    .select("*")
    .single();

  if (error) {
    const concurrentSession = await getActiveWorkoutSession(workoutId);
    if (concurrentSession) return concurrentSession;
    throw error;
  }

  return data as WorkoutSession;
}

export async function getWorkoutSessionSets(sessionId: string): Promise<WorkoutSessionSet[]> {
  const { data, error } = await supabase
    .from("workout_session_sets")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as WorkoutSessionSet[];
}

export async function getExerciseProgressSummary(params: ExerciseProgressQuery): Promise<ExerciseProgressSummary> {
  const exerciseId = params.exerciseId?.trim() || "";
  const normalizedName = params.exerciseName?.trim() || "";
  const limit = params.limit || 60;

  if (!exerciseId && !normalizedName) {
    return buildExerciseProgressSummary("", [], "snapshot");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuario no autenticado");

  const selectClause = `
    *,
    workout_sessions!inner (
      id,
      user_id,
      workout_id,
      started_at,
      finished_at,
      duration_seconds,
      notes,
      session_feeling,
      pain_flag,
      pain_notes,
      status
    ),
    workout_exercises (
      id,
      exercise_id,
      name
    )
  `;

  const baseQuery = supabase
    .from("workout_session_sets")
    .select(selectClause)
    .eq("completed", true)
    .eq("workout_sessions.user_id", userId)
    .eq("workout_sessions.status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = exerciseId
    ? await baseQuery.eq("exercise_id", exerciseId)
    : await baseQuery.ilike("exercise_name_snapshot", normalizedName);

  if (error) throw error;
  if (data?.length || !exerciseId || !normalizedName) {
    return buildExerciseProgressSummary(
      normalizedName,
      (data || []) as unknown as RawExerciseProgressSet[],
      exerciseId ? "exercise_id" : "snapshot",
    );
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("workout_session_sets")
    .select(selectClause)
    .eq("completed", true)
    .eq("workout_sessions.user_id", userId)
    .eq("workout_sessions.status", "completed")
    .is("exercise_id", null)
    .ilike("exercise_name_snapshot", normalizedName)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fallbackError) throw fallbackError;
  return buildExerciseProgressSummary(normalizedName, (fallbackData || []) as unknown as RawExerciseProgressSet[], "snapshot");
}

export async function saveProgressionSuggestion(
  input: SaveProgressionSuggestionInput,
): Promise<ProgressionSuggestionRecord> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuario no autenticado");

  const { data, error } = await supabase
    .from("exercise_progression_suggestions")
    .upsert({
      ...input,
      user_id: userId,
    }, {
      onConflict: "user_id,exercise_key,workout_session_id,suggested_action",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ProgressionSuggestionRecord;
}

export async function saveWorkoutSessionSet(input: SaveWorkoutSessionSetInput): Promise<WorkoutSessionSet> {
  const { data, error } = await supabase
    .from("workout_session_sets")
    .upsert(
      {
        ...input,
        completed: input.completed ?? true,
      },
      { onConflict: "session_id,workout_exercise_id,set_number" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as WorkoutSessionSet;
}

export async function finishWorkoutSession(params: {
  sessionId: string;
  workoutId: string;
  startedAt: string;
  notes?: string;
  sessionFeeling?: "strong" | "normal" | "tired" | "pain" | null;
  painNotes?: string | null;
  overallRpe?: number | null;
  userNotes?: string | null;
}): Promise<{ success: boolean; session: WorkoutSession; workout: unknown }> {
  const finishedAt = new Date();
  const durationSeconds = Math.max(
    0,
    Math.round((finishedAt.getTime() - new Date(params.startedAt).getTime()) / 1000),
  );

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .update({
      status: "completed",
      finished_at: finishedAt.toISOString(),
      duration_seconds: durationSeconds,
      notes: params.notes?.trim() || null,
      session_feeling: params.sessionFeeling || null,
      pain_flag: params.sessionFeeling === "pain",
      pain_notes: params.painNotes?.trim() || null,
      overall_rpe: params.overallRpe ?? null,
      user_notes: params.userNotes?.trim() || null,
    })
    .eq("id", params.sessionId)
    .select("*")
    .single();

  if (sessionError) throw sessionError;

  const completedWorkout = await completeWorkout(params.workoutId, true);

  return {
    success: true,
    session: session as WorkoutSession,
    workout: completedWorkout.workout,
  };
}

export async function cancelWorkoutSession(sessionId: string): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error) throw error;
  return data as WorkoutSession;
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
