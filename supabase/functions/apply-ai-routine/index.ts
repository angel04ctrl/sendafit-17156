import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceAiRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { handleCors, isAllowedRequestOrigin, jsonResponse } from "../_shared/cors.ts";
import { canAutomaticPlannerReplaceWorkout } from "../_shared/planIdentity.ts";
import {
  type CatalogExercise,
  normalizeExerciseText,
  resolveRoutineExercises,
} from "../_shared/exerciseResolver.ts";

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

function normalizeText(value: unknown): string {
  return normalizeExerciseText(value);
}

const deleteWorkoutTree = async (supabase: any, workoutIds: string[]) => {
  if (workoutIds.length === 0) return null;

  const { error: exercisesError } = await supabase
    .from("workout_exercises")
    .delete()
    .in("workout_id", workoutIds);

  if (exercisesError) return exercisesError;

  const { error: workoutsError } = await supabase
    .from("workouts")
    .delete()
    .in("id", workoutIds);

  return workoutsError || null;
};

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
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (!isAllowedRequestOrigin(req)) return jsonResponse(req, { error: "Origen no permitido." }, 403);
    if (req.method !== "POST") return jsonResponse(req, { error: "Metodo no permitido." }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse(req, { error: "No autorizado." }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResponse(req, { error: "Sesion invalida." }, 401);

    const limit = await enforceAiRateLimit({
      userId: user.id,
      functionName: "apply-ai-routine",
      hourlyLimit: 4,
      dailyLimit: 12,
    });
    if (limit.allowed === false) return jsonResponse(req, rateLimitResponse(limit), 429);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { metadata_routine: rawRoutine, coach_action_id } = await req.json() as {
      metadata_routine?: MetadataRoutine;
      coach_action_id?: string;
    };
    const metadata_routine = rawRoutine ? normalizeRoutine(rawRoutine) : undefined;
    if (!metadata_routine?.days?.length) {
      return jsonResponse(req, { error: "La rutina sugerida no contiene días válidos." }, 400);
    }

    if (coach_action_id) {
      const { data: action, error: actionError } = await supabase
        .from("coach_actions")
        .select("id,status,action_type,user_id")
        .eq("id", coach_action_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (actionError) throw actionError;
      if (!action) return jsonResponse(req, { error: "coach_action_not_found" }, 404);
      if (action.action_type !== "modify_routine") {
        return jsonResponse(req, { error: "invalid_coach_action_type" }, 400);
      }
      if (action.status !== "pending" && action.status !== "confirmed") {
        return jsonResponse(req, { error: "coach_action_not_pending" }, 409);
      }

      const { error: confirmError } = await supabase
        .from("coach_actions")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", coach_action_id)
        .eq("user_id", user.id);

      if (confirmError) throw confirmError;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("available_weekdays, assigned_routine_id, fitness_level")
      .eq("id", user.id)
      .maybeSingle();

    const { data: exerciseCatalog, error: catalogError } = await supabase
      .from("exercises")
      .select("id,nombre,aliases,nivel,nivel_minimo,estado_calidad,tipo_entrenamiento,descanso_segundos_min,descanso_segundos_max,rir_recomendado");

    if (catalogError || !exerciseCatalog?.length) {
      return jsonResponse(req, { error: "No se pudo validar la biblioteca de ejercicios." }, 500);
    }

    const routineResolution = resolveRoutineExercises(
      metadata_routine.days,
      exerciseCatalog as CatalogExercise[],
      profile?.fitness_level,
    );
    const { unresolved, ambiguous, incompatible, substitutions, resolvedByKey } = routineResolution;

    if (!routineResolution.ok) {
      return jsonResponse(req, {
        error: "ai_routine_unresolved_exercises",
        unresolved,
        ambiguous,
        incompatible,
        substitutions,
      }, 409);
    }

    const fallbackWeekdays = (profile?.available_weekdays || [])
      .map((day: string) => normalizeWeekday(day, 0))
      .filter((day: number) => day >= 1 && day <= 7);

    const workoutRows = metadata_routine.days.map((day, index) => {
      const fallback = fallbackWeekdays[index] || ((index % 7) + 1);
      const weekday = normalizeWeekday(day.weekday, fallback);
      const assignedRoutineId = profile?.assigned_routine_id || null;
      const hasAssignedPlan = Boolean(assignedRoutineId);

      return {
        user_id: user.id,
        name: day.day_name || `${metadata_routine.routine_name || "Rutina IA"} - Dia ${index + 1}`,
        description: metadata_routine.routine_name || "Rutina personalizada por SendaFit AI Coach",
        location: day.location || "gimnasio",
        tipo: hasAssignedPlan ? "automatico" as const : "manual" as const,
        plan_id: hasAssignedPlan ? assignedRoutineId : null,
        plan_source: "ai_coach",
        is_protected: true,
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
        .map((exercise, exerciseIndex) => {
          const resolved = resolvedByKey.get(`${workoutIndex}:${exerciseIndex}`)!;
          const type = normalizeText(resolved.tipo_entrenamiento);
          return {
          workout_id: workout.id,
          exercise_id: resolved.id,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          rest_seconds: resolved.descanso_segundos_max || resolved.descanso_segundos_min || null,
          target_rir: type.includes("cardio") ? null : resolved.rir_recomendado ?? 2,
          order_index: exerciseIndex + 1,
          duration_minutes: exercise.duration_minutes || null,
          notes: exercise.notes || null,
        };
      });
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
      .select("id, tipo, plan_source, is_protected, completed")
      .eq("user_id", user.id)
      .eq("tipo", "automatico")
      .not("id", "in", `(${insertedWorkouts.map((workout) => workout.id).join(",")})`);

    if (oldError) throw oldError;

    const blockedOldIds = (oldWorkouts || [])
      .filter((workout) => !canAutomaticPlannerReplaceWorkout(workout))
      .map((workout) => workout.id);
    const oldIds = (oldWorkouts || [])
      .filter((workout) => canAutomaticPlannerReplaceWorkout(workout))
      .map((workout) => workout.id);

    if (blockedOldIds.length > 0) {
      const cleanupError = await deleteWorkoutTree(supabase, insertedWorkouts.map((workout) => workout.id));
      if (cleanupError) throw cleanupError;
      return jsonResponse(req, {
        error: "protected_plan_replacement_blocked",
        message: "La rutina IA no reemplazo entrenamientos protegidos o historicos.",
        blocked_workout_ids: blockedOldIds,
      }, 409);
    }

    if (oldIds.length > 0) {
      const cleanupOldError = await deleteWorkoutTree(supabase, oldIds);
      if (cleanupOldError) throw cleanupOldError;
    }

    if (coach_action_id) {
      const { error: actionUpdateError } = await supabase
        .from("coach_actions")
        .update({
          status: "applied",
          applied_at: new Date().toISOString(),
          validation_result: {
            applied: true,
            workouts_created: insertedWorkouts.length,
            exercises_created: exerciseRows.length,
            workouts_deleted: oldIds.length,
          },
        })
        .eq("id", coach_action_id)
        .eq("user_id", user.id);

      if (actionUpdateError) throw actionUpdateError;
    }

    return jsonResponse(req, {
      success: true,
      workouts_created: insertedWorkouts.length,
      exercises_created: exerciseRows.length,
      workouts_deleted: oldIds.length,
    });
  } catch (error) {
    console.error("apply-ai-routine error:", error);
    return jsonResponse(req, {
      error: error instanceof Error ? error.message : "No se pudo aplicar la rutina.",
    }, 500);
  }
});
