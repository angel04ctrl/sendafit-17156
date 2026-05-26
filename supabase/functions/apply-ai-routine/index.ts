import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RoutineExercise {
  name: string;
  sets?: number;
  reps?: number;
  notes?: string;
  duration_minutes?: number;
}

interface RoutineDay {
  day_name: string;
  weekday?: number;
  location?: "casa" | "gimnasio" | "exterior";
  duration_minutes?: number;
  estimated_calories?: number;
  exercises: RoutineExercise[];
}

interface MetadataRoutine {
  routine_name?: string;
  days: RoutineDay[];
}

const WEEKDAY_BY_NAME: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  "miércoles": 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  "sábado": 6,
  domingo: 7,
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dateForWeekday(weekday: number): string {
  const today = new Date();
  const current = today.getDay() === 0 ? 7 : today.getDay();
  const diff = (weekday - current + 7) % 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().slice(0, 10);
}

function normalizeWeekday(value: unknown, fallback: number): number {
  if (typeof value === "number" && value >= 1 && value <= 7) return Math.trunc(value);
  if (typeof value === "string") return WEEKDAY_BY_NAME[value.toLowerCase()] || fallback;
  return fallback;
}

function normalizeLocation(value: unknown): "casa" | "gimnasio" | "exterior" {
  const normalized = String(value || "").toLowerCase().trim();
  return normalized === "casa" || normalized === "gimnasio" || normalized === "exterior" ? normalized : "gimnasio";
}

function normalizeRoutine(metadataRoutine: MetadataRoutine): MetadataRoutine {
  return {
    routine_name: metadataRoutine.routine_name || "Rutina personalizada por IA",
    days: metadataRoutine.days
      .filter((day) => Array.isArray(day.exercises) && day.exercises.length > 0)
      .map((day, dayIndex) => ({
        ...day,
        day_name: day.day_name || `Dia ${dayIndex + 1}`,
        location: normalizeLocation(day.location),
        duration_minutes: Math.max(10, Math.min(180, Number(day.duration_minutes) || 60)),
        estimated_calories: Math.max(0, Math.min(2000, Number(day.estimated_calories) || 300)),
        exercises: day.exercises
          .filter((exercise) => typeof exercise.name === "string" && exercise.name.trim().length > 0)
          .map((exercise) => ({
            ...exercise,
            name: exercise.name.trim(),
            sets: Math.max(1, Math.min(10, Number(exercise.sets) || 3)),
            reps: Math.max(1, Math.min(100, Number(exercise.reps) || 10)),
            duration_minutes: exercise.duration_minutes ? Math.max(1, Math.min(60, Number(exercise.duration_minutes))) : undefined,
          })),
      })),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return respond({ error: "Metodo no permitido." }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "No autorizado." }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return respond({ error: "Sesion invalida." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { metadata_routine: rawRoutine } = await req.json() as { metadata_routine?: MetadataRoutine };
    const metadata_routine = rawRoutine ? normalizeRoutine(rawRoutine) : undefined;
    if (!metadata_routine?.days?.length) {
      return respond({ error: "La rutina sugerida no contiene dias validos." }, 400);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("available_weekdays, assigned_routine_id")
      .eq("id", user.id)
      .maybeSingle();

    const fallbackWeekdays = (profile?.available_weekdays || [])
      .map((day: string) => normalizeWeekday(day, 0))
      .filter((day: number) => day >= 1 && day <= 7);

    const workoutRows = metadata_routine.days.map((day, index) => {
      const fallback = fallbackWeekdays[index] || ((index % 7) + 1);
      const weekday = normalizeWeekday(day.weekday, fallback);
      const hasAssignedPlan = Boolean(profile?.assigned_routine_id);

      return {
        user_id: user.id,
        name: day.day_name || `${metadata_routine.routine_name || "Rutina IA"} - Dia ${index + 1}`,
        description: metadata_routine.routine_name || "Rutina personalizada por SendaFit AI Coach",
        location: day.location || "gimnasio",
        tipo: hasAssignedPlan ? "automatico" as const : "manual" as const,
        plan_id: hasAssignedPlan ? profile.assigned_routine_id : null,
        scheduled_date: dateForWeekday(weekday),
        weekday,
        duration_minutes: day.duration_minutes,
        estimated_calories: day.estimated_calories,
        completed: false,
      };
    });

    const { data: insertedWorkouts, error: insertWorkoutError } = await supabase
      .from("workouts")
      .insert(workoutRows)
      .select("id, name");

    if (insertWorkoutError) throw insertWorkoutError;

    const exerciseRows = insertedWorkouts.flatMap((workout, workoutIndex) => {
      const day = metadata_routine.days[workoutIndex];
      return (day.exercises || [])
        .map((exercise) => ({
          workout_id: workout.id,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          duration_minutes: exercise.duration_minutes || null,
          notes: exercise.notes || null,
        }));
    });

    if (exerciseRows.length > 0) {
      const { error: insertExercisesError } = await supabase
        .from("workout_exercises")
        .insert(exerciseRows);
      if (insertExercisesError) {
        await supabase
          .from("workouts")
          .delete()
          .in("id", insertedWorkouts.map((workout) => workout.id));
        throw insertExercisesError;
      }
    }

    const { data: oldWorkouts, error: oldError } = await supabase
      .from("workouts")
      .select("id")
      .eq("user_id", user.id)
      .eq("tipo", "automatico")
      .not("id", "in", `(${insertedWorkouts.map((workout) => workout.id).join(",")})`);

    if (oldError) throw oldError;

    const oldIds = oldWorkouts?.map((workout) => workout.id) || [];
    if (oldIds.length > 0) {
      const { error: deleteExercisesError } = await supabase
        .from("workout_exercises")
        .delete()
        .in("workout_id", oldIds);
      if (deleteExercisesError) throw deleteExercisesError;

      const { error: deleteWorkoutsError } = await supabase
        .from("workouts")
        .delete()
        .in("id", oldIds);
      if (deleteWorkoutsError) throw deleteWorkoutsError;
    }

    return respond({
      success: true,
      workouts_created: insertedWorkouts.length,
      exercises_created: exerciseRows.length,
      workouts_deleted: oldIds.length,
    });
  } catch (error) {
    console.error("apply-ai-routine error:", error);
    return respond({
      error: error instanceof Error ? error.message : "No se pudo aplicar la rutina.",
    }, 500);
  }
});
