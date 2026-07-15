import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  startDate?: string;
  endDate?: string;
}

interface ReportDay {
  date: string;
  weight: number | null;
  body_fat_percentage: number | null;
  energy_level: number | null;
  calories_burned: number;
  workouts_completed: number;
  workouts_scheduled: number;
  workouts_skipped: number;
  calories_consumed: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MuscleSummary {
  muscle: string;
  sets: number;
  volume: number;
}

interface ExerciseTrendPoint {
  date: string;
  weight: number | null;
  reps: number;
  volume: number;
}

interface ExerciseSummary {
  exercise_id: string | null;
  exercise_name: string;
  muscle: string;
  sessions: number;
  sets: number;
  reps: number;
  volume: number;
  max_weight: number | null;
  best_volume: number;
  last_session_date: string | null;
  trend: ExerciseTrendPoint[];
}

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string | undefined): value is string {
  if (!value || !dateOnlyPattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundNumber(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}

function getExerciseKey(row: Record<string, unknown>) {
  return String(row.exercise_id || row.exercise_name_snapshot || row.workout_exercise_name_snapshot || "Ejercicio sin nombre");
}

function getExerciseName(row: Record<string, unknown>) {
  return String(row.exercise_name_snapshot || row.workout_exercise_name_snapshot || "Ejercicio sin nombre");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({})) as ReportRequest;
    const startDate = body.startDate;
    const endDate = body.endDate;

    if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
      return new Response(
        JSON.stringify({ error: "startDate and endDate must use YYYY-MM-DD format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (startDate > endDate) {
      return new Response(
        JSON.stringify({ error: "startDate must be before or equal to endDate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const days = enumerateDates(startDate, endDate);
    if (days.length > 370) {
      return new Response(
        JSON.stringify({ error: "Date range cannot exceed 370 days" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reportByDate = new Map<string, ReportDay>(
      days.map((date) => [
        date,
        {
          date,
          weight: null,
          body_fat_percentage: null,
          energy_level: null,
          calories_burned: 0,
          workouts_completed: 0,
          workouts_scheduled: 0,
          workouts_skipped: 0,
          calories_consumed: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
      ]),
    );

    const [
      workoutsResult,
      progressLogsResult,
      progressTrackingResult,
      mealsResult,
      sessionsResult,
    ] = await Promise.all([
      supabase
        .from("workouts")
        .select("id, scheduled_date, estimated_calories, completed, completed_at, skipped, skipped_at")
        .eq("user_id", user.id)
        .or(
          `and(scheduled_date.gte.${startDate},scheduled_date.lte.${endDate}),and(completed_at.gte.${startDate}T00:00:00.000Z,completed_at.lte.${endDate}T23:59:59.999Z),and(skipped_at.gte.${startDate}T00:00:00.000Z,skipped_at.lte.${endDate}T23:59:59.999Z)`,
        ),
      supabase
        .from("progress_logs")
        .select("log_date, weight, body_fat_percentage, energy_level")
        .eq("user_id", user.id)
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .order("log_date", { ascending: true }),
      supabase
        .from("progress_tracking")
        .select("date, weight, energy_level")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true }),
      supabase
        .from("meals")
        .select("date, calories, protein, carbs, fat")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("workout_sessions")
        .select("id, workout_id, started_at, finished_at, status, duration_seconds")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("started_at", `${startDate}T00:00:00.000Z`)
        .lte("started_at", `${endDate}T23:59:59.999Z`),
    ]);

    if (workoutsResult.error) throw workoutsResult.error;
    if (progressLogsResult.error) throw progressLogsResult.error;
    if (progressTrackingResult.error) throw progressTrackingResult.error;
    if (mealsResult.error) throw mealsResult.error;
    if (sessionsResult.error) throw sessionsResult.error;

    const sessions = sessionsResult.data || [];
    const sessionIds = sessions.map((session) => session.id as string);
    const sessionById = new Map(sessions.map((session) => [session.id as string, session]));

    const setsResult = sessionIds.length > 0
      ? await supabase
          .from("workout_session_sets")
          .select("session_id, exercise_id, exercise_name_snapshot, workout_exercise_name_snapshot, set_number, actual_reps, target_reps, actual_weight, completed")
          .in("session_id", sessionIds)
          .eq("completed", true)
      : { data: [], error: null };

    if (setsResult.error) throw setsResult.error;

    const sets = setsResult.data || [];
    const exerciseIds = [...new Set(sets.map((set) => set.exercise_id).filter(Boolean))] as string[];
    const exerciseCatalogResult = exerciseIds.length > 0
      ? await supabase
          .from("exercises")
          .select("id, nombre, grupo_muscular, musculo_principal")
          .in("id", exerciseIds)
      : { data: [], error: null };

    if (exerciseCatalogResult.error) throw exerciseCatalogResult.error;
    const exerciseCatalog = new Map((exerciseCatalogResult.data || []).map((exercise) => [exercise.id as string, exercise]));

    for (const workout of workoutsResult.data || []) {
      const scheduledDate = workout.scheduled_date as string | null;
      if (scheduledDate && reportByDate.has(scheduledDate)) {
        reportByDate.get(scheduledDate)!.workouts_scheduled += 1;
      }

      if (workout.skipped) {
        const skippedDate = workout.skipped_at
          ? String(workout.skipped_at).slice(0, 10)
          : scheduledDate;

        if (skippedDate && reportByDate.has(skippedDate)) {
          reportByDate.get(skippedDate)!.workouts_skipped += 1;
        }
      }

      if (workout.completed) {
        const completedDate = workout.completed_at
          ? String(workout.completed_at).slice(0, 10)
          : scheduledDate;

        if (completedDate && reportByDate.has(completedDate)) {
          const reportDay = reportByDate.get(completedDate)!;
          reportDay.workouts_completed += 1;
          reportDay.calories_burned += Number(workout.estimated_calories || 0);
        }
      }
    }

    for (const progress of progressTrackingResult.data || []) {
      const reportDay = reportByDate.get(progress.date as string);
      if (!reportDay) continue;

      const weight = toNumber(progress.weight);
      const energyLevel = toNumber(progress.energy_level);

      if (weight !== null) reportDay.weight = weight;
      if (energyLevel !== null) reportDay.energy_level = energyLevel;
    }

    for (const progress of progressLogsResult.data || []) {
      const reportDay = reportByDate.get(progress.log_date as string);
      if (!reportDay) continue;

      const weight = toNumber(progress.weight);
      const bodyFatPercentage = toNumber(progress.body_fat_percentage);
      const energyLevel = toNumber(progress.energy_level);

      if (weight !== null) reportDay.weight = weight;
      if (bodyFatPercentage !== null) reportDay.body_fat_percentage = bodyFatPercentage;
      if (energyLevel !== null) reportDay.energy_level = energyLevel;
    }

    for (const meal of mealsResult.data || []) {
      const reportDay = reportByDate.get(meal.date as string);
      if (!reportDay) continue;

      reportDay.calories_consumed += Number(meal.calories || 0);
      reportDay.protein += Number(meal.protein || 0);
      reportDay.carbs += Number(meal.carbs || 0);
      reportDay.fat += Number(meal.fat || 0);
    }

    const daily = Array.from(reportByDate.values());
    const totals = daily.reduce(
      (acc, day) => {
        acc.calories_burned += day.calories_burned;
        acc.workouts_completed += day.workouts_completed;
        acc.workouts_scheduled += day.workouts_scheduled;
        acc.workouts_skipped += day.workouts_skipped;
        acc.calories_consumed += day.calories_consumed;
        acc.protein += day.protein;
        acc.carbs += day.carbs;
        acc.fat += day.fat;
        return acc;
      },
      {
        calories_burned: 0,
        workouts_completed: 0,
        workouts_scheduled: 0,
        workouts_skipped: 0,
        calories_consumed: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    );

    const exerciseMap = new Map<string, ExerciseSummary & { sessionKeys: Set<string> }>();
    const muscleMap = new Map<string, MuscleSummary>();

    for (const set of sets) {
      const session = sessionById.get(set.session_id as string);
      if (!session) continue;

      const sessionDate = String(session.started_at).slice(0, 10);
      const actualReps = Number(set.actual_reps || set.target_reps || 0);
      const actualWeight = toNumber(set.actual_weight);
      const volume = actualWeight !== null ? actualWeight * actualReps : 0;
      const exerciseId = (set.exercise_id as string | null) || null;
      const catalogExercise = exerciseId ? exerciseCatalog.get(exerciseId) : null;
      const exerciseName = catalogExercise?.nombre || getExerciseName(set);
      const muscle = String(catalogExercise?.musculo_principal || catalogExercise?.grupo_muscular || "Sin clasificar");
      const key = exerciseId || getExerciseKey(set);
      const sessionKey = `${key}:${session.id}`;

      const current = exerciseMap.get(key) || {
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        muscle,
        sessions: 0,
        sets: 0,
        reps: 0,
        volume: 0,
        max_weight: null,
        best_volume: 0,
        last_session_date: null,
        trend: [],
        sessionKeys: new Set<string>(),
      };

      current.sets += 1;
      current.reps += actualReps;
      current.volume += volume;
      current.best_volume = Math.max(current.best_volume, volume);
      current.last_session_date = !current.last_session_date || sessionDate > current.last_session_date
        ? sessionDate
        : current.last_session_date;
      if (!current.sessionKeys.has(sessionKey)) {
        current.sessionKeys.add(sessionKey);
        current.sessions += 1;
      }
      if (actualWeight !== null) {
        current.max_weight = current.max_weight === null ? actualWeight : Math.max(current.max_weight, actualWeight);
      }

      const trendPoint = current.trend.find((point) => point.date === sessionDate);
      if (trendPoint) {
        trendPoint.reps += actualReps;
        trendPoint.volume += volume;
        trendPoint.weight = actualWeight === null
          ? trendPoint.weight
          : trendPoint.weight === null
            ? actualWeight
            : Math.max(trendPoint.weight, actualWeight);
      } else {
        current.trend.push({
          date: sessionDate,
          weight: actualWeight,
          reps: actualReps,
          volume,
        });
      }

      exerciseMap.set(key, current);

      const muscleSummary = muscleMap.get(muscle) || { muscle, sets: 0, volume: 0 };
      muscleSummary.sets += 1;
      muscleSummary.volume += volume;
      muscleMap.set(muscle, muscleSummary);
    }

    const allExerciseProgress = Array.from(exerciseMap.values())
      .map(({ sessionKeys: _sessionKeys, ...exercise }) => ({
        ...exercise,
        volume: roundNumber(exercise.volume),
        best_volume: roundNumber(exercise.best_volume),
        max_weight: exercise.max_weight === null ? null : roundNumber(exercise.max_weight),
        trend: exercise.trend
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((point) => ({
            ...point,
            weight: point.weight === null ? null : roundNumber(point.weight),
            volume: roundNumber(point.volume),
          })),
      }))
      .sort((a, b) => b.volume - a.volume);

    const exerciseProgress = allExerciseProgress.slice(0, 12);

    const muscleSummary = Array.from(muscleMap.values())
      .map((muscle) => ({ ...muscle, volume: roundNumber(muscle.volume) }))
      .sort((a, b) => b.sets - a.sets || b.volume - a.volume);

    const completedSets = sets.length;
    const totalVolume = roundNumber(allExerciseProgress.reduce((sum, exercise) => sum + exercise.volume, 0));
    const averageCalories = days.length > 0 ? Math.round(totals.calories_consumed / days.length) : 0;
    const averageProtein = days.length > 0 ? roundNumber(totals.protein / days.length) : 0;

    const weights = daily.filter((day) => day.weight !== null).map((day) => day.weight as number);
    const energyLevels = daily
      .filter((day) => day.energy_level !== null)
      .map((day) => day.energy_level as number);

    const summary = {
      total_days: daily.length,
      completion_rate: totals.workouts_scheduled > 0
        ? Math.round((totals.workouts_completed / totals.workouts_scheduled) * 100)
        : 0,
      average_energy_level: energyLevels.length > 0
        ? Number((energyLevels.reduce((sum, value) => sum + value, 0) / energyLevels.length).toFixed(1))
        : null,
      weight_change: weights.length >= 2
        ? Number((weights[weights.length - 1] - weights[0]).toFixed(2))
        : null,
    };

    return new Response(
      JSON.stringify({
        range: { startDate, endDate },
        daily,
        totals,
        summary,
        training: {
          completed_sets: completedSets,
          total_volume: totalVolume,
          muscles: muscleSummary,
          average_calories: averageCalories,
          average_protein: averageProtein,
          completed_sessions: sessions.length,
        },
        exercise_progress: exerciseProgress,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in get-monthly-report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
