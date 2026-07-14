// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { handleCors, isAllowedRequestOrigin, jsonResponse } from "../_shared/cors.ts";
import { buildTrainingPlan } from "../_shared/trainingPlanner.ts";
import { canAutomaticPlannerReplaceWorkout } from "../_shared/planIdentity.ts";

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
  const userPrimaryGoal = profile.fitness_goal;
  const equivalentGoals = goalMapping[userPrimaryGoal] || [userPrimaryGoal];
  const planGoals = plan.objetivo
    ? plan.objetivo.split(",").map((goal: string) => normalizeGoal(goal)).filter(Boolean)
    : [];

  if (planGoals.some((goal: string) => equivalentGoals.includes(goal))) {
    score += 70;
  }

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

  let userTrainingTypes = profile.training_types;
  if (userTrainingTypes && typeof userTrainingTypes === "string") {
    try {
      userTrainingTypes = JSON.parse(userTrainingTypes);
    } catch {
      userTrainingTypes = [userTrainingTypes];
    }
  }

  if (Array.isArray(userTrainingTypes)) {
    const planLocation = normalizeGoal(plan.lugar);
    const normalizedUserTypes = userTrainingTypes.map((type: string) => normalizeGoal(type));
    if (normalizedUserTypes.includes(planLocation) || normalizedUserTypes.includes("mixto")) {
      score += 15;
    }
  }

  if (profile.health_conditions && !profile.health_conditions.includes("ninguna") && plan.nivel === "B") {
    score += 10;
  }

  return score;
};

const buildWorkoutPayload = (
  userId: string,
  selectedPlan: unknown,
  plannedDays: Record<string, unknown>[],
  selectedWeekdays: number[],
  monday: Date,
  baseDate: Date,
) => {
  return selectedWeekdays.map((weekday, index) => {
    const plannedDay = plannedDays[index];
    const workoutDate = new Date(monday);
    workoutDate.setUTCDate(monday.getUTCDate() + (weekday - 1));

    if (workoutDate < baseDate) {
      workoutDate.setUTCDate(workoutDate.getUTCDate() + 7);
    }

    const dayExercises = plannedDay?.exercises || [];
    const estimatedCalories = dayExercises.reduce((total: number, pe: unknown) => {
      const exercise = pe.exercises || pe;
      if (!exercise) return total;
      const caloriesPerRep = exercise.calorias_por_repeticion || 0;
      const reps = exercise.repeticiones_sugeridas || 10;
      const sets = exercise.series_sugeridas || 3;
      return total + caloriesPerRep * reps * sets;
    }, 0);

    const muscleGroup = plannedDay?.name || dayExercises[0]?.grupo_muscular || "General";

    return {
      user_id: userId,
      name: `${selectedPlan.nombre_plan} - ${dayNames[weekday]}`,
      description: `${muscleGroup} - ${selectedPlan.descripcion_plan}`,
      scheduled_date: workoutDate.toISOString().split("T")[0],
      weekday,
      plan_id: selectedPlan.id,
      location: normalizeLocation(selectedPlan.lugar),
      duration_minutes: plannedDay?.estimatedDurationMinutes || dayExercises.length * 5,
      estimated_calories: Math.round(estimatedCalories),
      completed: false,
      tipo: "automatico",
      plan_source: "planner",
      is_protected: false,
      exercises: dayExercises,
    };
  });
};

const findReplaceableAutomaticWorkouts = async (
  supabase: unknown,
  userId: string,
  fromDate: string,
) => {
  const { data: oldWorkouts, error } = await supabase
    .from("workouts")
    .select("id, scheduled_date, tipo, plan_source, is_protected, completed")
    .eq("user_id", userId)
    .eq("tipo", "automatico")
    .gte("scheduled_date", fromDate);

  if (error) return { ids: [], blocked: [], error };

  const protectedIds = (oldWorkouts || [])
    .filter((workout: unknown) => !canAutomaticPlannerReplaceWorkout(workout))
    .map((workout: unknown) => workout.id);
  const ids = (oldWorkouts || [])
    .filter((workout: unknown) => canAutomaticPlannerReplaceWorkout(workout))
    .map((workout: unknown) => workout.id);
  if (ids.length === 0) return { ids: [], blocked: [], error: null };

  const { data: sessions, error: sessionsError } = await supabase
    .from("workout_sessions")
    .select("workout_id, status")
    .in("workout_id", ids);

  if (sessionsError) return { ids: [], blocked: [], error: sessionsError };

  const blocked = [...new Set((sessions || []).map((session: unknown) => session.workout_id))];
  return {
    ids: ids.filter((id: string) => !blocked.includes(id)),
    blocked: [...new Set([...protectedIds, ...blocked])],
    error: null,
  };
};

const deleteWorkoutTree = async (supabase: unknown, workoutIds: string[]) => {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse(req, { error: "Invalid token", details: userError }, 401);
    }

    const baseDate = new Date(`${userLocalDate}T00:00:00Z`);
    const currentDay = baseDate.getUTCDay();
    const monday = new Date(baseDate);
    monday.setUTCDate(baseDate.getUTCDate() - currentDay + (currentDay === 0 ? -6 : 1));

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
      await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          routine_assignment_status: "failed",
          routine_assignment_error: "No valid training weekdays configured",
        })
        .eq("id", user.id);

      return jsonResponse(req, {
        success: false,
        status: "failed",
        error: "No valid training weekdays configured",
      });
    }
    const expectedTrainingDayCount = Math.min(selectedWeekdays.length, 6);

    const { data: plans, error: plansError } = await supabase
      .from("predesigned_plans")
      .select("*");

    if (plansError || !plans?.length) {
      await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          routine_assignment_status: "failed",
          routine_assignment_error: "No predesigned plans available",
        })
        .eq("id", user.id);

      return jsonResponse(req, {
        success: false,
        status: "failed",
        error: "No predesigned plans available",
      });
    }

    const scoredPlans = plans
      .map((plan: unknown) => ({ plan, score: scorePlan(plan, profile) }))
      .sort((a, b) => b.score - a.score);

    let selectedPlan = null;
    let exercisesByDay: Record<number, Record<string, unknown>[]> = {};
    let lastCoverageFailure: Record<string, unknown> | null = null;
    let fallbackPlan = null;
    let fallbackExercisesByDay: Record<number, Record<string, unknown>[]> = {};

    for (const { plan } of scoredPlans) {
      const { data: planExercises, error: planExercisesError } = await supabase
        .from("plan_ejercicios")
        .select("*, exercises:ejercicio_id (*)")
        .eq("plan_id", plan.id)
        .order("dia", { ascending: true })
        .order("orden", { ascending: true });

      if (planExercisesError || !planExercises?.length) continue;

      const candidateExercisesByDay = groupPlanExercisesByDay(planExercises);
      const candidatePlanDays = Object.keys(candidateExercisesByDay).map(Number).sort((a, b) => a - b);

      if (!fallbackPlan && candidatePlanDays.length > 0) {
        fallbackPlan = plan;
        fallbackExercisesByDay = candidateExercisesByDay;
      }

      if (candidatePlanDays.length > 0) {
        selectedPlan = plan;
        exercisesByDay = candidateExercisesByDay;
        if (candidatePlanDays.length !== expectedTrainingDayCount) {
          lastCoverageFailure = {
            plan_id: plan.id,
            plan_name: plan.nombre_plan,
            selected_weekdays_count: selectedWeekdays.length,
            expected_training_day_count: expectedTrainingDayCount,
            available_plan_days: candidatePlanDays,
            planner_remapped_split: true,
          };
        }
        break;
      }

      lastCoverageFailure = {
        plan_id: plan.id,
        plan_name: plan.nombre_plan,
        selected_weekdays_count: selectedWeekdays.length,
        available_plan_days: candidatePlanDays,
      };
    }

    if (!selectedPlan && fallbackPlan) {
      selectedPlan = fallbackPlan;
      exercisesByDay = fallbackExercisesByDay;
      lastCoverageFailure = {
        ...lastCoverageFailure,
        fallback_used: true,
        reason: "No exact day-count match; using highest scored plan with exercises.",
      };
      console.warn("assign-routine fallback used", {
        user_id: user.id,
        selected_weekdays: selectedWeekdays,
        selected_plan: selectedPlan.id,
        lastCoverageFailure,
      });
    }

    if (!selectedPlan) {
      await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          routine_assignment_status: "failed",
          routine_assignment_error: "No compatible plan matches the selected weekday count",
        })
        .eq("id", user.id);

      return jsonResponse(req, {
          success: false,
          status: "failed",
          error: "No compatible plan matches the selected weekday count",
          selected_weekdays: selectedWeekdays,
          last_coverage_failure: lastCoverageFailure,
        });
    }

    const { data: exerciseCatalog, error: exerciseCatalogError } = await supabase
      .from("exercises")
      .select("*")
      .in("estado_calidad", ["curado", "revisar"]);

    if (exerciseCatalogError || !exerciseCatalog?.length) {
      return jsonResponse(req, {
          error: "No exercise catalog available for planner",
          details: exerciseCatalogError,
        }, 500);
    }

    const professionalPlan = buildTrainingPlan({
      profile,
      selectedWeekdays,
      exercises: exerciseCatalog,
    });
    const trainingWeekdays = professionalPlan.trainingWeekdays;
    const insufficientPlan = professionalPlan.warnings.some((warning: string) =>
      warning.includes("planner_insufficient_compatible_exercises")
    ) || professionalPlan.days.some((day: unknown) => !day.exercises?.length);

    if (insufficientPlan) {
      return jsonResponse(req, {
          error: "planner_insufficient_compatible_exercises",
          warnings: professionalPlan.warnings,
          message: "No se pudo construir una semana completa sin relajar restricciones criticas de seguridad, nivel o equipo.",
        }, 409);
    }

    const replaceable = await findReplaceableAutomaticWorkouts(supabase, user.id, userLocalDate);
    if (replaceable.error) {
      return jsonResponse(req, { error: "Failed to inspect old automatic workouts", details: replaceable.error }, 500);
    }
    if (replaceable.blocked.length > 0) {
      return jsonResponse(req, {
          error: "active_or_historical_sessions_block_assignment",
          message: "Hay sesiones registradas en entrenamientos que se intentaban reemplazar. No se borro historial ni sesiones activas.",
          blocked_workout_ids: replaceable.blocked,
        }, 409);
    }

    const workoutsToCreate = buildWorkoutPayload(
      user.id,
      selectedPlan,
      professionalPlan.days,
      trainingWeekdays,
      monday,
      baseDate,
    );

    const createdWorkouts = [];
    let lastError: unknown = null;
    let createdExerciseRows = 0;
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
        .map((pe: unknown) => pe.exercises || pe)
        .filter((exercise: unknown) => exercise?.nombre)
        .map((pe: unknown, index: number) => {
          const exercise = pe;
          const exerciseType = String(exercise.tipo_entrenamiento || "").toLowerCase();
          return {
            workout_id: workout.id,
            exercise_id: exercise.id,
            name: exercise.nombre,
            sets: exercise.series_sugeridas || 3,
            reps: exercise.repeticiones_sugeridas || 10,
            rest_seconds: exercise.descanso_segundos_max || exercise.descanso_segundos_min || null,
            target_rir: exerciseType.includes("cardio") ? null : exercise.rir_recomendado ?? 2,
            order_index: index + 1,
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
          lastError = exercisesError;
          console.error("Error adding exercises to workout:", workout.id, exercisesError);
          break;
        }
        createdExerciseRows += workoutExercises.length;
      }

      createdWorkouts.push(workout);
    }

    if (createdWorkouts.length !== workoutsToCreate.length || createdExerciseRows === 0) {
      const cleanupError = await deleteWorkoutTree(supabase, createdWorkouts.map((workout: unknown) => workout.id));
      await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          routine_assignment_status: "failed",
          routine_assignment_error: "Failed to create all workouts",
        })
        .eq("id", user.id);

      return jsonResponse(req, {
          error: "Failed to create all workouts",
          details: lastError,
          cleanup_error: cleanupError,
          workouts_created: createdWorkouts.length,
          workouts_expected: workoutsToCreate.length,
        }, 500);
    }

    const deleteError = await deleteWorkoutTree(supabase, replaceable.ids);
    if (deleteError) {
      await deleteWorkoutTree(supabase, createdWorkouts.map((workout: unknown) => workout.id));
      return jsonResponse(req, { error: "Failed to replace old automatic workouts", details: deleteError }, 500);
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        assigned_routine_id: selectedPlan.id,
        onboarding_completed: true,
        routine_assignment_status: "assigned",
        routine_assignment_error: null,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating profile with assigned plan:", updateError);
    }

    return jsonResponse(req, {
        success: true,
        status: "assigned",
        message: `Routine assigned successfully: ${selectedPlan.nombre_plan}`,
        plan: selectedPlan,
        workouts_created: createdWorkouts.length,
        workouts_deleted: replaceable.ids.length,
        training_weekdays: trainingWeekdays,
        planner: {
          split: professionalPlan.split,
          rest_day: professionalPlan.restDay,
          target_duration_minutes: professionalPlan.targetDurationMinutes,
          equipment_mode: professionalPlan.equipmentMode,
          muscle_stats: professionalPlan.muscleStats,
          warnings: professionalPlan.warnings,
          explanation: professionalPlan.explanation,
        },
      });
  } catch (error) {
    console.error("Error in assign-routine:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(req, { error: errorMessage }, 500);
  }
});
