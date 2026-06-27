// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { handleCors, isAllowedRequestOrigin, jsonResponse } from "../_shared/cors.ts";

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

const normalizeSelectedWeekdays = (selectedDays: unknown[]): number[] => {
  const weekdays = selectedDays
    .map((dayCode) => dayMap[String(dayCode)])
    .filter((weekday): weekday is number => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7);

  return [...new Set(weekdays)].sort((a, b) => a - b);
};

const normalizeGoal = (goal: string | null | undefined): string => {
  if (!goal) return "";
  return goal
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .trim();
};

const normalizeLocation = (lugar: string | null | undefined): "casa" | "gimnasio" | "exterior" => {
  const normalized = lugar?.toLowerCase() || "casa";
  if (normalized.includes("casa")) return "casa";
  if (normalized.includes("gimnasio") || normalized.includes("gym")) return "gimnasio";
  if (normalized.includes("exterior") || normalized.includes("parque")) return "exterior";
  return "casa";
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

const scorePlan = (plan: unknown, profile: unknown): number => {
  const goalMapping: Record<string, string[]> = {
    ganar_masa: ["ganar_masa", "fuerza", "aumentar_masa"],
    aumentar_masa: ["ganar_masa", "fuerza", "aumentar_masa"],
    bajar_peso: ["perder_grasa", "tonificar", "bajar_grasa", "definir"],
    perder_peso: ["perder_grasa", "tonificar", "bajar_grasa", "definir"],
    bajar_grasa: ["perder_grasa", "tonificar", "definir"],
    mantener_peso: ["mantener_peso", "mantener", "tonificar"],
    tonificar: ["tonificar", "definir", "perder_grasa"],
  };

  const levelMapping: Record<string, string> = {
    principiante: "B",
    intermedio: "I",
    avanzado: "P",
  };

  let score = 0;
  const equivalentGoals = goalMapping[profile.fitness_goal] || [profile.fitness_goal];
  const planGoals = plan.objetivo
    ? plan.objetivo.split(",").map((goal: string) => normalizeGoal(goal)).filter(Boolean)
    : [];

  if (planGoals.some((goal: string) => equivalentGoals.includes(goal))) score += 70;

  const userLevelCode = levelMapping[profile.fitness_level];
  if (plan.nivel === userLevelCode) {
    score += 30;
  } else if ((userLevelCode === "B" && plan.nivel === "I") || (userLevelCode === "I" && plan.nivel === "P")) {
    score += 15;
  }

  if (profile.available_days_per_week >= plan.dias_semana) {
    const daysDiff = Math.abs(profile.available_days_per_week - plan.dias_semana);
    score += Math.max(0, 20 - daysDiff * 3);
  } else {
    score -= 30;
  }

  return score;
};

const getPlanExercises = async (supabase: unknown, planId: string) => {
  const { data, error } = await supabase
    .from("plan_ejercicios")
    .select("*, exercises:ejercicio_id (*)")
    .eq("plan_id", planId)
    .order("dia", { ascending: true })
    .order("orden", { ascending: true });

  if (error || !data?.length) {
    return { exercises: [], exercisesByDay: {}, missingError: error };
  }

  return {
    exercises: data,
    exercisesByDay: groupPlanExercisesByDay(data),
    missingError: null,
  };
};

const findCompatiblePlan = async (
  supabase: unknown,
  profile: unknown,
  selectedWeekdays: number[],
  preferredPlanId?: string | null,
) => {
  if (preferredPlanId) {
    const { data: preferredPlan } = await supabase
      .from("predesigned_plans")
      .select("*")
      .eq("id", preferredPlanId)
      .maybeSingle();

    if (preferredPlan) {
      const preferredExercises = await getPlanExercises(supabase, preferredPlan.id);
      const preferredPlanDays = Object.keys(preferredExercises.exercisesByDay).map(Number).sort((a, b) => a - b);

      if (preferredPlanDays.length === selectedWeekdays.length) {
        return {
          plan: preferredPlan,
          exercisesByDay: preferredExercises.exercisesByDay,
          reassigned: false,
          lastCoverageFailure: null,
        };
      }
    }
  }

  const { data: plans, error: plansError } = await supabase
    .from("predesigned_plans")
    .select("*");

  if (plansError || !plans?.length) {
    return { plan: null, exercisesByDay: {}, reassigned: false, lastCoverageFailure: { error: "No plans available" } };
  }

  const scoredPlans = plans
    .map((plan: unknown) => ({ plan, score: scorePlan(plan, profile) }))
    .sort((a, b) => b.score - a.score);

  let lastCoverageFailure = null;
  let fallbackWithExercises: {
    plan: unknown;
    exercisesByDay: Record<number, Record<string, unknown>[]>;
  } | null = null;

  for (const { plan } of scoredPlans) {
    const candidateExercises = await getPlanExercises(supabase, plan.id);
    const candidatePlanDays = Object.keys(candidateExercises.exercisesByDay).map(Number).sort((a, b) => a - b);

    if (!fallbackWithExercises && candidatePlanDays.length > 0) {
      fallbackWithExercises = {
        plan,
        exercisesByDay: candidateExercises.exercisesByDay,
      };
    }

    if (candidatePlanDays.length === selectedWeekdays.length) {
      return {
        plan,
        exercisesByDay: candidateExercises.exercisesByDay,
        reassigned: plan.id !== preferredPlanId,
        lastCoverageFailure: null,
      };
    }

    lastCoverageFailure = {
      plan_id: plan.id,
      plan_name: plan.nombre_plan,
      selected_weekdays_count: selectedWeekdays.length,
      available_plan_days: candidatePlanDays,
    };
  }

  if (fallbackWithExercises) {
    return {
      plan: fallbackWithExercises.plan,
      exercisesByDay: fallbackWithExercises.exercisesByDay,
      reassigned: fallbackWithExercises.plan.id !== preferredPlanId,
      lastCoverageFailure: {
        ...lastCoverageFailure,
        fallback_used: true,
        reason: "No exact day-count match; using nearest scored plan with exercises.",
      },
    };
  }

  return { plan: null, exercisesByDay: {}, reassigned: false, lastCoverageFailure };
};

const buildWorkoutPayload = (
  userId: string,
  plan: unknown,
  exercisesByDay: Record<number, Record<string, unknown>[]>,
  planDays: number[],
  selectedWeekdays: number[],
  monday: Date,
  baseDate: Date,
) => {
  return selectedWeekdays.map((weekday, index) => {
    const planDay = planDays[index % planDays.length];
    const workoutDate = new Date(monday);
    workoutDate.setUTCDate(monday.getUTCDate() + (weekday - 1));

    if (workoutDate < baseDate) {
      workoutDate.setUTCDate(workoutDate.getUTCDate() + 7);
    }

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
      user_id: userId,
      name: `${plan.nombre_plan} - ${dayNames[weekday]}`,
      description: `${muscleGroup} - ${plan.descripcion_plan || "Plan personalizado"}`,
      scheduled_date: workoutDate.toISOString().split("T")[0],
      weekday,
      plan_id: plan.id,
      location: normalizeLocation(plan.lugar),
      duration_minutes: dayExercises.length * 5,
      estimated_calories: Math.round(estimatedCalories),
      completed: false,
      tipo: "automatico",
      exercises: dayExercises,
    };
  });
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (!isAllowedRequestOrigin(req)) return jsonResponse(req, { error: "Origen no permitido." }, 403);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "No authorization header" }, 401);
    }

    const requestBody = await req.json().catch(() => ({}));
    const userLocalDate = requestBody.userLocalDate || new Date().toISOString().split("T")[0];
    const forceReassign = Boolean(requestBody.reassign);
    const baseDate = new Date(`${userLocalDate}T00:00:00Z`);
    const currentDay = baseDate.getUTCDay();
    const monday = new Date(baseDate);
    monday.setUTCDate(baseDate.getUTCDate() - currentDay + (currentDay === 0 ? -6 : 1));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse(req, { error: "Invalid token" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse(req, { error: "Profile not found" }, 404);
    }

    const selectedWeekdays = normalizeSelectedWeekdays(profile.available_weekdays || []);
    if (selectedWeekdays.length === 0) {
      return jsonResponse(req, { error: "No valid training weekdays configured" }, 400);
    }

    const compatiblePlan = await findCompatiblePlan(
      supabase,
      profile,
      selectedWeekdays,
      forceReassign ? null : profile.assigned_routine_id,
    );

    if (!compatiblePlan.plan) {
      await supabase
        .from("profiles")
        .update({
          routine_assignment_status: "failed",
          routine_assignment_error: "No compatible plan matches the selected weekday count",
        })
        .eq("id", user.id);

      return jsonResponse(req, {
          error: "No compatible plan matches the selected weekday count",
          selected_weekdays: selectedWeekdays,
          last_coverage_failure: compatiblePlan.lastCoverageFailure,
        }, 409);
    }

    const workoutsToCreate = buildWorkoutPayload(
      user.id,
      compatiblePlan.plan,
      compatiblePlan.exercisesByDay,
      Object.keys(compatiblePlan.exercisesByDay).map(Number).sort((a, b) => a - b),
      selectedWeekdays,
      monday,
      baseDate,
    );

    if (workoutsToCreate.length !== selectedWeekdays.length) {
      return jsonResponse(req, {
          error: "Workout preparation did not cover all selected weekdays",
          selected_weekdays: selectedWeekdays,
          workouts_prepared: workoutsToCreate.length,
        }, 500);
    }

    const { data: deletedWorkouts, error: deleteError } = await supabase
      .from("workouts")
      .delete()
      .eq("user_id", user.id)
      .eq("tipo", "automatico")
      .eq("completed", false)
      .gte("scheduled_date", userLocalDate)
      .select("id");

    if (deleteError) {
      return jsonResponse(req, { error: "Failed to delete old automatic workouts", details: deleteError }, 500);
    }

    const createdWorkouts = [];
    let lastError: unknown = null;

    for (const workoutData of workoutsToCreate) {
      const { exercises, ...workoutInsertData } = workoutData;

      const { data: workout, error: workoutError } = await supabase
        .from("workouts")
        .insert(workoutInsertData)
        .select()
        .single();

      if (workoutError) {
        lastError = workoutError;
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
      return jsonResponse(req, {
          error: "Failed to create all workouts",
          details: lastError,
          workouts_created: createdWorkouts.length,
          workouts_expected: workoutsToCreate.length,
        }, 500);
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        assigned_routine_id: compatiblePlan.plan.id,
        routine_assignment_status: "assigned",
        routine_assignment_error: null,
      })
      .eq("id", user.id);

    if (profileUpdateError) {
      console.error("Error updating assigned routine:", profileUpdateError);
    }

    return jsonResponse(req, {
        success: true,
        message: "Entrenamientos generados correctamente",
        plan_id: compatiblePlan.plan.id,
        workouts_created: createdWorkouts.length,
        workouts_deleted: deletedWorkouts?.length || 0,
        training_weekdays: selectedWeekdays,
        reassignment_triggered: compatiblePlan.reassigned || forceReassign,
      });
  } catch (error) {
    console.error("Error in generate-weekly-workouts:", error);
    return jsonResponse(req, {
        error: error instanceof Error ? error.message : "Unknown error",
        type: error instanceof Error ? error.constructor.name : "UnknownError",
      }, 500);
  }
});
