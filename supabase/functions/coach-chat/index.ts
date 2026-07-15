import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/aiClient.ts";
import { handleCors, isAllowedRequestOrigin, jsonResponse } from "../_shared/cors.ts";

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

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

interface CoachResponse {
  message: string;
  metadata_routine?: {
    routine_name: string;
    days: RoutineDay[];
  } | null;
}

interface CatalogExercise {
  id: string;
  nombre: string;
  aliases?: string[] | string | null;
  nivel_minimo?: string | null;
  nivel?: string | null;
  estado_calidad?: string | null;
  equipo_requerido?: string[] | null;
  equipamiento?: string | null;
}

const weekdayLabels: Record<number, string> = {
  1: "lunes",
  2: "martes",
  3: "miercoles",
  4: "jueves",
  5: "viernes",
  6: "sabado",
  7: "domingo",
};

const weekdayByText: Record<string, number> = {
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

const severeHealthPatterns = [
  "dolor fuerte",
  "dolor intenso",
  "dolor de pecho",
  "pecho apretado",
  "desmayo",
  "desmay",
  "mareo",
  "me mareo",
  "lesion severa",
  "lesión severa",
  "embarazo",
  "embarazada",
  "medicamento",
  "medicación",
  "enfermedad",
  "trastorno alimenticio",
  "vomito",
  "vómito",
];

function extractJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La IA no devolvio una respuesta valida.");
    return JSON.parse(match[0]);
  }
}

function normalizeCoachResponse(value: unknown): CoachResponse {
  const parsed = value as Partial<CoachResponse>;
  return {
    message: typeof parsed.message === "string" && parsed.message.trim()
      ? parsed.message.trim()
      : "Estoy aqui para ayudarte con tu entrenamiento, salud y nutricion.",
    metadata_routine: parsed.metadata_routine && Array.isArray(parsed.metadata_routine.days)
      ? parsed.metadata_routine
      : null,
  };
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function levelRank(level: unknown): number {
  const normalized = normalizeText(level);
  if (["avanzado", "p", "profesional"].includes(normalized)) return 3;
  if (["intermedio", "i"].includes(normalized)) return 2;
  return 1;
}

function normalizeProfileWeekdays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days
    .map((day) => weekdayByText[String(day).toLowerCase()] || Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))]
    .sort((a, b) => a - b);
}

function requestedWeekdaysFromMessage(message: string): number[] | null {
  const normalized = normalizeText(message);
  if (/toda la semana|semana completa|lunes a domingo/.test(normalized)) return [1, 2, 3, 4, 5, 6, 7];
  if (/lunes a sabado/.test(normalized)) return [1, 2, 3, 4, 5, 6];

  const explicit = Object.entries(weekdayByText)
    .filter(([label]) => normalized.includes(normalizeText(label)))
    .map(([, value]) => value);

  return explicit.length > 0 ? [...new Set(explicit)].sort((a, b) => a - b) : null;
}

function formatWeekdays(days: number[]): string {
  return days.map((day) => weekdayLabels[day] || String(day)).join(", ");
}

function classifyIntent(message: string): string {
  const text = normalizeText(message);
  if (/dolor|lesion|molestia|mareo|desmayo|pecho|enfermedad|medicamento|embaraz/.test(text)) return "lesion";
  if (/rutina|plan|programa|cambiar|modificar|entrenamiento nuevo|crear/.test(text)) return "rutina";
  if (/macro|caloria|proteina|carbo|grasa|comida|dieta|nutricion|receta/.test(text)) return "nutricion";
  if (/entreno|ejercicio|serie|repeticion|peso|carga|tecnica|descanso/.test(text)) return "entrenamiento";
  if (/motiv|animo|disciplina|constancia|ganas/.test(text)) return "motivacion";
  return "fuera_de_alcance";
}

function detectSafetyFlags(message: string): string[] {
  const normalized = normalizeText(message);
  return severeHealthPatterns
    .filter((pattern) => normalized.includes(normalizeText(pattern)))
    .map((pattern) => normalizeText(pattern).replace(/\s+/g, "_"));
}

function getModelUsed(): string {
  const provider = (Deno.env.get("AI_PROVIDER") || "groq").toLowerCase();
  const generic = Deno.env.get("AI_MODEL_TEXT");
  const providerSpecific = Deno.env.get(`${provider.toUpperCase()}_MODEL_TEXT`);
  return `${provider}:${generic || providerSpecific || "default"}`;
}

function compactForPrompt(context: Record<string, any>) {
  return {
    profile: {
      objective: context.objective,
      level: context.level,
      available_weekdays: context.profile?.available_weekdays,
      available_days_per_week: context.profile?.available_days_per_week,
      session_duration_minutes: context.profile?.session_duration_minutes,
      training_types: context.profile?.training_types,
      injuries_limitations: context.injuries_limitations,
      sleep_stress: context.sleep_stress,
    },
    today_workout: (context.today_workout || []).map((workout: Record<string, any>) => ({
      name: workout.name,
      scheduled_date: workout.scheduled_date,
      duration_minutes: workout.duration_minutes,
      exercises: (workout.workout_exercises || workout.exercises || []).slice(0, 8).map((exercise: Record<string, unknown>) => ({
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        rest_seconds: exercise.rest_seconds,
        target_rir: exercise.target_rir,
      })),
    })),
    weekly_calendar: {
      week_start: context.weekly_calendar?.week_start,
      week_end: context.weekly_calendar?.week_end,
      workouts: (context.weekly_calendar?.workouts || []).map((workout: Record<string, unknown>) => ({
        name: workout.name,
        scheduled_date: workout.scheduled_date,
        completed: workout.completed,
        skipped: workout.skipped,
      })),
    },
    today_macros: context.today_macros,
    latest_loads: (context.latest_loads || []).slice(0, 8),
    recent_sessions: (context.recent_sessions || []).slice(0, 3).map((session: Record<string, unknown>) => ({
      started_at: session.started_at,
      status: session.status,
      session_feeling: session.session_feeling,
      pain_flag: session.pain_flag,
      overall_rpe: session.overall_rpe,
    })),
    recent_meals: (context.recent_meals || []).slice(0, 5),
  };
}

function formatWorkoutList(workouts: Array<Record<string, any>>) {
  if (!workouts.length) return "No tienes entrenamiento programado para hoy.";
  return workouts.map((workout) => {
    const exercises = (workout.workout_exercises || workout.exercises || [])
      .slice(0, 6)
      .map((exercise: Record<string, unknown>) => `${exercise.name}${exercise.sets && exercise.reps ? ` ${exercise.sets}x${exercise.reps}` : ""}`)
      .join(", ");
    return `${workout.name}${workout.duration_minutes ? ` (${workout.duration_minutes} min)` : ""}${exercises ? `: ${exercises}` : ""}`;
  }).join("\n");
}

function buildFallbackResponse(intentType: string, userMessage: string, context: Record<string, any>): CoachResponse {
  const macros = context.today_macros || {};
  const consumed = macros.consumed || {};
  const goals = macros.goals || {};
  const todayWorkout = context.today_workout || [];

  if (intentType === "nutricion") {
    return {
      message: `Hoy llevas aproximadamente ${consumed.calories || 0}/${goals.calories || "N/A"} kcal, ${consumed.protein || 0}/${goals.protein || "N/A"} g de proteina, ${consumed.carbs || 0}/${goals.carbs || "N/A"} g de carbohidratos y ${consumed.fat || 0}/${goals.fat || "N/A"} g de grasa. Usa esto como guia practica; si falta registrar comida, el balance puede cambiar.`,
      metadata_routine: null,
    };
  }

  if (intentType === "rutina") {
    return {
      message: "Puedo ayudarte a cambiar la rutina, pero ahora el proveedor de IA no devolvio una respuesta usable para crear un preview validado. No aplique ningun cambio. Intenta de nuevo en unos minutos o pideme un ajuste mas especifico, por ejemplo: cambiar piernas a 3 dias o bajar volumen de hombro.",
      metadata_routine: null,
    };
  }

  if (intentType === "entrenamiento") {
    return {
      message: `Con el contexto disponible, esto es lo mas relevante para hoy:\n${formatWorkoutList(todayWorkout)}\n\nMantén la tecnica limpia, respeta el descanso prescrito y evita forzar si aparece dolor. No hice cambios automaticos.`,
      metadata_routine: null,
    };
  }

  if (intentType === "motivacion") {
    return {
      message: "Hoy apunta a una victoria pequena y concreta: empezar el entrenamiento, completar el primer bloque y registrar tus series. La consistencia gana por acumulacion, no por perfeccion.",
      metadata_routine: null,
    };
  }

  if (intentType === "lesion") {
    return {
      message: "Si hay dolor fuerte, dolor de pecho, mareo, desmayo o una molestia nueva que empeora, detén la actividad y consulta a un profesional. Puedo ayudarte a adaptar el entrenamiento a una version suave, pero no puedo diagnosticar.",
      metadata_routine: null,
    };
  }

  return {
    message: "Lo siento, como tu coach de SendaFit solo puedo ayudarte con temas relacionados a tu entrenamiento, salud y nutricion. Mantengamos el enfoque en tus objetivos!",
    metadata_routine: null,
  };
}

function resolveExerciseByName(name: string, catalog: CatalogExercise[]) {
  const wanted = normalizeText(name);
  return catalog.filter((exercise) => {
    const names = [exercise.nombre, ...toArray(exercise.aliases)].map(normalizeText);
    return names.includes(wanted);
  });
}

function validateRoutine(
  routine: CoachResponse["metadata_routine"],
  catalog: CatalogExercise[],
  profile: Record<string, unknown> | null,
) {
  const unresolved: string[] = [];
  const incompatible: string[] = [];
  const ambiguous: Record<string, string[]> = {};
  if (!routine?.days?.length) return { ok: true, unresolved, incompatible, ambiguous };

  routine.days.forEach((day) => {
    (day.exercises || []).forEach((exercise) => {
      const matches = resolveExerciseByName(exercise.name, catalog);
      if (matches.length === 0) {
        unresolved.push(exercise.name);
        return;
      }
      if (matches.length > 1) {
        ambiguous[exercise.name] = matches.map((match) => `${match.id}:${match.nombre}`);
        return;
      }
      const resolved = matches[0];
      const quality = normalizeText(resolved.estado_calidad || "curado");
      if (["deprecado", "revisar"].includes(quality) || levelRank(resolved.nivel_minimo || resolved.nivel) > levelRank(profile?.fitness_level)) {
        incompatible.push(`${exercise.name} -> ${resolved.nombre}`);
      }
    });
  });

  return {
    ok: unresolved.length === 0 && incompatible.length === 0 && Object.keys(ambiguous).length === 0,
    unresolved,
    incompatible,
    ambiguous,
  };
}

async function safeQuery<T>(query: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  const { data, error } = await query;
  if (error) {
    console.warn("coach context query skipped:", error);
    return fallback;
  }
  return data || fallback;
}

async function buildCoachContext(supabase: any, userId: string, profile: Record<string, unknown> | null) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay() === 0 ? 7 : monday.getDay();
  monday.setDate(now.getDate() - day + 1);
  const weekStart = monday.toISOString().slice(0, 10);
  const weekEndDate = new Date(monday);
  weekEndDate.setDate(monday.getDate() + 6);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);

  const [weekWorkouts, todayMeals, recentMeals, latestSessions] = await Promise.all([
    safeQuery(
      supabase
        .from("workouts")
        .select("id,name,scheduled_date,weekday,duration_minutes,estimated_calories,completed,skipped,skip_reason,plan_source,is_protected,workout_exercises(id,exercise_id,name,sets,reps,rest_seconds,target_rir,order_index)")
        .eq("user_id", userId)
        .gte("scheduled_date", weekStart)
        .lte("scheduled_date", weekEnd)
        .order("scheduled_date", { ascending: true }),
      [],
    ),
    safeQuery(
      supabase
        .from("meals")
        .select("name,meal_type,calories,protein,carbs,fat,date")
        .eq("user_id", userId)
        .eq("date", today)
        .order("created_at", { ascending: false }),
      [],
    ),
    safeQuery(
      supabase
        .from("meals")
        .select("name,meal_type,calories,protein,carbs,fat,date")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
      [],
    ),
    safeQuery(
      supabase
        .from("workout_sessions")
        .select("id,workout_id,started_at,finished_at,status,session_feeling,pain_flag,pain_notes,overall_rpe,workouts(name,scheduled_date),workout_session_sets(exercise_name_snapshot,actual_reps,actual_weight,rir,rpe,set_number,completed)")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(5),
      [],
    ),
  ]);

  const macroTotals = (todayMeals as Array<Record<string, number>>).reduce((acc, meal) => ({
    calories: acc.calories + Number(meal.calories || 0),
    protein: acc.protein + Number(meal.protein || 0),
    carbs: acc.carbs + Number(meal.carbs || 0),
    fat: acc.fat + Number(meal.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const todayWorkout = (weekWorkouts as Array<Record<string, unknown>>)
    .filter((workout) => workout.scheduled_date === today && workout.skipped !== true);

  return {
    profile,
    objective: profile?.fitness_goal || profile?.primary_goal,
    level: profile?.fitness_level,
    injuries_limitations: {
      injuries_limitations: profile?.injuries_limitations,
      lesiones_activas: profile?.lesiones_activas,
      health_conditions: profile?.health_conditions,
      current_medications: profile?.current_medications,
    },
    sleep_stress: {
      average_sleep_hours: profile?.average_sleep_hours,
      stress_level: profile?.stress_level,
      fatigue_level: profile?.nivel_fatiga,
    },
    current_routine: (weekWorkouts as Array<Record<string, unknown>>).map((workout) => ({
      id: workout.id,
      name: workout.name,
      scheduled_date: workout.scheduled_date,
      weekday: workout.weekday,
      completed: workout.completed,
      skipped: workout.skipped,
      exercises: workout.workout_exercises,
    })),
    today_workout: todayWorkout,
    weekly_calendar: {
      week_start: weekStart,
      week_end: weekEnd,
      workouts: weekWorkouts,
    },
    recent_sessions: latestSessions,
    latest_loads: (latestSessions as Array<Record<string, any>>).flatMap((session) =>
      (session.workout_session_sets || [])
        .filter((set: Record<string, unknown>) => set.actual_weight || set.actual_reps)
        .slice(0, 8)
        .map((set: Record<string, unknown>) => ({
          exercise: set.exercise_name_snapshot,
          reps: set.actual_reps,
          weight: set.actual_weight,
          rir: set.rir,
          rpe: set.rpe,
        }))
    ).slice(0, 12),
    today_macros: {
      goals: {
        calories: profile?.daily_calorie_goal,
        protein: profile?.daily_protein_goal,
        carbs: profile?.daily_carbs_goal,
        fat: profile?.daily_fat_goal,
      },
      consumed: macroTotals,
      meals: todayMeals,
    },
    recent_meals: recentMeals,
  };
}

async function persistConversation(
  supabase: any,
  userId: string,
  intentType: string,
  userMessage: string,
  assistantMessage: string,
  contextUsed: Record<string, unknown>,
  metadataRoutine: CoachResponse["metadata_routine"],
  safetyFlags: string[],
) {
  const { data, error } = await supabase
    .from("ai_trainer_conversations")
    .insert({
      user_id: userId,
      conversation_type: intentType,
      title: userMessage.slice(0, 80),
      user_message: userMessage,
      assistant_message: assistantMessage,
      context_used: contextUsed,
      model_used: getModelUsed(),
      intent_type: intentType,
      safety_flags: safetyFlags,
      messages: [
        { role: "user", content: userMessage, timestamp: new Date().toISOString() },
        { role: "assistant", content: assistantMessage, timestamp: new Date().toISOString() },
      ],
      generated_content: metadataRoutine ? { metadata_routine: metadataRoutine } : {},
      saved_to_app: false,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("coach conversation persist failed:", error);
    return null;
  }
  return data?.id || null;
}

async function createRoutineAction(
  supabase: any,
  userId: string,
  conversationId: string | null,
  routine: NonNullable<CoachResponse["metadata_routine"]>,
  validationResult: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("coach_actions")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      action_type: "modify_routine",
      status: "pending",
      title: routine.routine_name || "Rutina sugerida por SendaFit AI Coach",
      preview: routine,
      payload: { metadata_routine: routine },
      validation_result: validationResult,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("coach action persist failed:", error);
    return null;
  }
  return data?.id || null;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (!isAllowedRequestOrigin(req)) return jsonResponse(req, { error: "Origen no permitido." }, 403);
    if (req.method !== "POST") return jsonResponse(req, { error: "Metodo no permitido." }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse(req, { error: "No autorizado." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse(req, { error: "Sesion invalida." }, 401);

    const { user_message, history = [], user_context = {} } = await req.json();
    if (typeof user_message !== "string" || !user_message.trim()) {
      return jsonResponse(req, { error: "user_message es requerido." }, 400);
    }

    const userMessage = user_message.trim();
    const intentType = classifyIntent(userMessage);
    const safetyFlags = detectSafetyFlags(userMessage);

    const { data: profile } = await supabase
      .from("profiles")
      .select("weight,height,fitness_goal,primary_goal,fitness_level,fase_menstrual_actual,available_weekdays,available_days_per_week,session_duration_minutes,training_types,injuries_limitations,lesiones_activas,health_conditions,current_medications,daily_calorie_goal,daily_protein_goal,daily_carbs_goal,daily_fat_goal,average_sleep_hours,stress_level,nivel_fatiga,dietary_preferences,allergies_restrictions")
      .eq("id", user.id)
      .maybeSingle();

    const contextProfile = { ...(profile || {}), ...(user_context || {}) };
    const context = await buildCoachContext(supabase, user.id, contextProfile);
    const profileWeekdays = normalizeProfileWeekdays(profile?.available_weekdays || []);
    const requestedWeekdays = requestedWeekdaysFromMessage(userMessage);

    if (requestedWeekdays && profileWeekdays.length > 0) {
      const sameDays = requestedWeekdays.length === profileWeekdays.length
        && requestedWeekdays.every((day) => profileWeekdays.includes(day));

      if (!sameDays) {
        const message = `Actualmente en tu perfil tienes seleccionados: ${formatWeekdays(profileWeekdays)}. Cuando dices "${userMessage}", ¿te refieres a esos dias o quieres cambiarlo a ${formatWeekdays(requestedWeekdays)}? Puedo preparar un preview, pero no aplicare cambios sin tu confirmacion.`;
        const conversationId = await persistConversation(supabase, user.id, "rutina", userMessage, message, context, null, safetyFlags);
        return jsonResponse(req, {
          success: true,
          message,
          metadata_routine: null,
          coach_action_id: null,
          conversation_id: conversationId,
          needs_day_confirmation: true,
          profile_weekdays: profileWeekdays,
          requested_weekdays: requestedWeekdays,
        });
      }
    }

    if (safetyFlags.length > 0) {
      const message = "Por seguridad, detén la actividad si hay dolor fuerte, dolor de pecho, desmayo, mareo intenso o una lesión seria. No puedo diagnosticar ni reemplazar a un profesional de salud. Si el síntoma es agudo, nuevo o preocupante, consulta atención médica antes de seguir entrenando. Si quieres, puedo ayudarte a adaptar el entrenamiento a una versión suave y sin dolor.";
      const conversationId = await persistConversation(supabase, user.id, "lesion", userMessage, message, context, null, safetyFlags);
      return jsonResponse(req, {
        success: true,
        message,
        metadata_routine: null,
        coach_action_id: null,
        conversation_id: conversationId,
        intent_type: "lesion",
        safety_flags: safetyFlags,
      });
    }

    const compactHistory = (history as ChatHistoryItem[]).slice(-8).map((item) => ({
      role: item.role,
      content: String(item.content || "").slice(0, 1200),
    }));

    const systemPrompt = `Eres SendaFit Coach, un entrenador personal certificado y nutricionista deportivo experto.
Solo puedes responder preguntas relacionadas con ejercicio, rutinas, tecnica de entrenamiento, anatomia, suplementacion, recetas, macros y nutricion.
Si el usuario pregunta sobre noticias, cultura general, programacion, entretenimiento o cualquier tema ajeno al fitness, responde exactamente:
"Lo siento, como tu coach de SendaFit solo puedo ayudarte con temas relacionados a tu entrenamiento, salud y nutricion. Mantengamos el enfoque en tus objetivos!".

Reglas de seguridad:
- No diagnostiques enfermedades ni lesiones.
- Si hay dolor fuerte, dolor de pecho, mareo, desmayo, embarazo, enfermedad, medicamentos o trastornos alimenticios, recomienda detener actividad si aplica y consultar a un profesional.
- No prometas resultados.
- No apliques cambios. Solo puedes proponer previews; la app pedira confirmacion al usuario.
- Si propones rutina, usa solo ejercicios comunes que existan en el catalogo de SendaFit y respeta nivel, equipo, lesiones y calendario.

Responde siempre en JSON valido, sin markdown y sin texto adicional, con esta forma:
{
  "message": "Respuesta visible para el chat",
  "metadata_routine": null
}

Si el usuario pide explicitamente crear una rutina nueva o cambiar su entrenamiento actual, incluye metadata_routine:
{
  "message": "Resumen breve de la rutina propuesta y aviso de que requiere confirmacion",
  "metadata_routine": {
    "routine_name": "Nombre de la rutina",
    "days": [
      {
        "day_name": "Pecho y triceps",
        "weekday": 1,
        "location": "gimnasio",
        "duration_minutes": 60,
        "estimated_calories": 350,
        "exercises": [
          { "name": "Press de banca con barra", "sets": 4, "reps": 10, "notes": "Descanso 90s" }
        ]
      }
    ]
  }
}

Restricciones para metadata_routine:
- weekday debe ser 1=Lunes, 2=Martes, 3=Miercoles, 4=Jueves, 5=Viernes, 6=Sabado, 7=Domingo.
- Usa solo location: casa, gimnasio o exterior.
- reps debe ser numero entero; si recomiendas rango, usa el promedio y explica el rango en notes.
- Ajusta dias a available_weekdays cuando exista.
- No generes plan agresivo si hay fatiga alta, estres alto o sueño bajo.

Contexto estructurado resumido del usuario:
${JSON.stringify(compactForPrompt(context))}`;

    let response: CoachResponse;
    let aiFallbackUsed = false;

    try {
      const content = await callAi({
        task: "text",
        jsonMode: true,
        temperature: 0.3,
        maxTokens: 1800,
        messages: [
          { role: "system", content: systemPrompt },
          ...compactHistory,
          { role: "user", content: userMessage },
        ],
      });

      response = normalizeCoachResponse(extractJson(content));
    } catch (aiError) {
      aiFallbackUsed = true;
      console.warn("coach AI fallback used:", aiError);
      response = buildFallbackResponse(intentType, userMessage, context);
    }
    let routineValidation: Record<string, unknown> | null = null;
    let coachActionId: string | null = null;

    if (response.metadata_routine) {
      const { data: catalog } = await supabase
        .from("exercises")
        .select("id,nombre,aliases,nivel,nivel_minimo,estado_calidad,equipo_requerido,equipamiento");

      routineValidation = validateRoutine(response.metadata_routine, (catalog || []) as CatalogExercise[], contextProfile);
      if (!routineValidation.ok) {
        response.message = `${response.message}\n\nNo dejare esta rutina lista para aplicar todavia porque algunos ejercicios no pasaron validacion del catalogo. Puedo ajustarla con ejercicios disponibles si me lo pides.`;
        response.metadata_routine = null;
      }
    }

    const conversationId = await persistConversation(
      supabase,
      user.id,
      intentType,
      userMessage,
      response.message,
      context,
      response.metadata_routine || null,
      safetyFlags,
    );

    if (response.metadata_routine && routineValidation?.ok) {
      coachActionId = await createRoutineAction(
        supabase,
        user.id,
        conversationId,
        response.metadata_routine,
        routineValidation,
      );
    }

    return jsonResponse(req, {
      success: true,
      ...response,
      conversation_id: conversationId,
      coach_action_id: coachActionId,
      intent_type: intentType,
      safety_flags: safetyFlags,
      routine_validation: routineValidation,
      ai_fallback_used: aiFallbackUsed,
    });
  } catch (error) {
    console.error("coach-chat error:", error);
    return jsonResponse(req, {
      error: error instanceof Error ? error.message : "No se pudo procesar el mensaje.",
    }, 500);
  }
});
