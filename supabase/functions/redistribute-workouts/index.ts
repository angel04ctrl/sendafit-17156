// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const dayMap: Record<string, number> = {
  L: 1,
  M: 2,
  Mi: 3,
  J: 4,
  V: 5,
  S: 6,
  D: 7,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
};

const dayNames: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miercoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sabado",
  7: "Domingo",
};

const normalizeLocation = (lugar: string | null | undefined): "casa" | "gimnasio" | "exterior" => {
  const normalized = lugar?.toLowerCase() || "casa";
  if (normalized.includes("casa")) return "casa";
  if (normalized.includes("gimnasio") || normalized.includes("gym")) return "gimnasio";
  if (normalized.includes("exterior") || normalized.includes("parque")) return "exterior";
  return "casa";
};

const normalizeSelectedWeekdays = (selectedDays: unknown[]): number[] => {
  const weekdays = selectedDays
    .map((dayCode) => dayMap[String(dayCode)])
    .filter((weekday): weekday is number => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7);

  return [...new Set(weekdays)].sort((a, b) => a - b);
};

const groupPlanExercisesByDay = (planExercises: unknown[]) => {
  const exercisesByDay: Record<number, Record<string, unknown>[]> = {};

  planExercises.forEach((pe: unknown) => {
    const planDay = Number(pe.dia);
    if (!Number.isInteger(planDay)) return;

    if (!exercisesByDay[planDay]) {
      exercisesByDay[planDay] = [];
    }

    const alreadyExists = exercisesByDay[planDay].some(
      (existing: unknown) => existing.ejercicio_id === pe.ejercicio_id,
    );

    if (!alreadyExists) {
      exercisesByDay[planDay].push(pe);
    }
  });

  return exercisesByDay;
};

function dateForWeekday(weekday: number, baseDate = new Date()): string {
  const current = baseDate.getDay() === 0 ? 7 : baseDate.getDay();
  const diff = (weekday - current + 7) % 7;
  const target = new Date(baseDate);
  target.setDate(baseDate.getDate() + diff);
  return target.toISOString().slice(0, 10);
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.available_weekdays?.length) {
      return new Response(
        JSON.stringify({ error: "No training days configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!profile.assigned_routine_id) {
      return new Response(
        JSON.stringify({ error: "No routine assigned" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const selectedWeekdays = normalizeSelectedWeekdays(profile.available_weekdays as unknown[]);
    if (selectedWeekdays.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid training days configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: planExercises, error: planExercisesError } = await supabase
      .from("plan_ejercicios")
      .select("*, exercises:ejercicio_id (*)")
      .eq("plan_id", profile.assigned_routine_id)
      .order("dia", { ascending: true })
      .order("orden", { ascending: true });

    if (planExercisesError || !planExercises?.length) {
      return new Response(
        JSON.stringify({ error: "No exercises found for routine" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const exercisesByDay = groupPlanExercisesByDay(planExercises);
    const planDays = Object.keys(exercisesByDay).map(Number).sort((a, b) => a - b);

    if (planDays.length !== selectedWeekdays.length) {
      return new Response(
        JSON.stringify({
          error: "Assigned plan day count does not match selected weekdays",
          selected_weekdays: selectedWeekdays,
          available_plan_days: planDays,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: planData } = await supabase
      .from("predesigned_plans")
      .select("*")
      .eq("id", profile.assigned_routine_id)
      .maybeSingle();

    const workoutsToCreate = selectedWeekdays.map((weekday, index) => {
      const planDay = planDays[index];
      const dayExercises = exercisesByDay[planDay] || [];
      const estimatedCalories = dayExercises.reduce((total: number, pe: unknown) => {
        const exercise = pe.exercises;
        if (!exercise) return total;
        const caloriesPerRep = exercise.calorias_por_repeticion || 0;
        const reps = exercise.repeticiones_sugeridas || 10;
        const sets = exercise.series_sugeridas || 3;
        return total + caloriesPerRep * reps * sets;
      }, 0);

      const muscleGroup = dayExercises[0]?.exercises?.grupo_muscular || "General";

      return {
        user_id: user.id,
        name: `${planData?.nombre_plan || "Entrenamiento"} - ${dayNames[weekday]}`,
        description: `${muscleGroup} - ${planData?.descripcion_plan || "Rutina personalizada"}`,
        scheduled_date: dateForWeekday(weekday),
        weekday,
        plan_id: profile.assigned_routine_id,
        location: normalizeLocation(planData?.lugar),
        duration_minutes: dayExercises.length * 5,
        estimated_calories: Math.round(estimatedCalories),
        completed: false,
        tipo: "automatico",
        exercises: dayExercises,
      };
    });

    const { data: deletedWorkouts, error: deleteError } = await supabase
      .from("workouts")
      .delete()
      .eq("user_id", user.id)
      .eq("tipo", "automatico")
      .select("id");

    if (deleteError) {
      console.error("Error deleting old workouts:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete old automatic workouts", details: deleteError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const createdWorkouts = [];
    for (const workoutData of workoutsToCreate) {
      const { exercises, ...workoutInsertData } = workoutData;

      const { data: workout, error: workoutError } = await supabase
        .from("workouts")
        .insert(workoutInsertData)
        .select()
        .single();

      if (workoutError) {
        console.error("Error creating workout:", workoutError);
        continue;
      }

      const workoutExercises = exercises
        .filter((pe: unknown) => pe.exercises?.nombre)
        .map((pe: unknown) => {
          const exercise = pe.exercises;
          return {
            workout_id: workout.id,
            exercise_id: exercise.id,
            name: exercise.nombre,
            sets: exercise.series_sugeridas || 3,
            reps: exercise.repeticiones_sugeridas || 10,
            notes: `${exercise.grupo_muscular || "General"} - ${exercise.nivel || "B"}`,
            duration_minutes: exercise.duracion_promedio_segundos
              ? Math.ceil(exercise.duracion_promedio_segundos / 60)
              : null,
          };
        });

      if (workoutExercises.length > 0) {
        const { error: exercisesError } = await supabase
          .from("workout_exercises")
          .insert(workoutExercises);

        if (exercisesError) {
          console.error("Error adding exercises to workout:", workout.id, exercisesError);
        }
      }

      createdWorkouts.push(workout);
    }

    if (createdWorkouts.length !== workoutsToCreate.length) {
      return new Response(
        JSON.stringify({
          error: "Failed to create all redistributed workouts",
          workouts_created: createdWorkouts.length,
          workouts_expected: workoutsToCreate.length,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Workouts redistributed successfully",
        workouts_created: createdWorkouts.length,
        workouts_deleted: deletedWorkouts?.length || 0,
        training_weekdays: selectedWeekdays,
        plan_days: planDays,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in redistribute-workouts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
