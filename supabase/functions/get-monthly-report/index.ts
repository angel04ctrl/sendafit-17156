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
  calories_consumed: number;
  protein: number;
  carbs: number;
  fat: number;
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
    ] = await Promise.all([
      supabase
        .from("workouts")
        .select("id, scheduled_date, estimated_calories, completed, completed_at")
        .eq("user_id", user.id)
        .or(
          `and(scheduled_date.gte.${startDate},scheduled_date.lte.${endDate}),and(completed_at.gte.${startDate}T00:00:00.000Z,completed_at.lte.${endDate}T23:59:59.999Z)`,
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
    ]);

    if (workoutsResult.error) throw workoutsResult.error;
    if (progressLogsResult.error) throw progressLogsResult.error;
    if (progressTrackingResult.error) throw progressTrackingResult.error;
    if (mealsResult.error) throw mealsResult.error;

    for (const workout of workoutsResult.data || []) {
      const scheduledDate = workout.scheduled_date as string | null;
      if (scheduledDate && reportByDate.has(scheduledDate)) {
        reportByDate.get(scheduledDate)!.workouts_scheduled += 1;
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
        calories_consumed: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    );

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
