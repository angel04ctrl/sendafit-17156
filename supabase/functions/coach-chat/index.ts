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

function normalizeProfileWeekdays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days
    .map((day) => weekdayByText[String(day).toLowerCase()] || Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))]
    .sort((a, b) => a - b);
}

function requestedWeekdaysFromMessage(message: string): number[] | null {
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/toda la semana|semana completa|lunes a domingo/.test(normalized)) return [1, 2, 3, 4, 5, 6, 7];
  if (/lunes a sabado/.test(normalized)) return [1, 2, 3, 4, 5, 6];

  const explicit = Object.entries(weekdayByText)
    .filter(([label]) => normalized.includes(label.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
    .map(([, value]) => value);

  return explicit.length > 0 ? [...new Set(explicit)].sort((a, b) => a - b) : null;
}

function formatWeekdays(days: number[]): string {
  return days.map((day) => weekdayLabels[day] || String(day)).join(", ");
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("weight, height, fitness_goal, primary_goal, fitness_level, fase_menstrual_actual, available_weekdays, available_days_per_week, injuries_limitations, lesiones_activas, health_conditions")
      .eq("id", user.id)
      .maybeSingle();

    const context = { ...profile, ...user_context };
    const profileWeekdays = normalizeProfileWeekdays(profile?.available_weekdays || []);
    const requestedWeekdays = requestedWeekdaysFromMessage(user_message);

    if (requestedWeekdays && profileWeekdays.length > 0) {
      const sameDays = requestedWeekdays.length === profileWeekdays.length
        && requestedWeekdays.every((day) => profileWeekdays.includes(day));

      if (!sameDays) {
        return jsonResponse(req, {
          success: true,
          message: `Actualmente en tu perfil tienes seleccionados: ${formatWeekdays(profileWeekdays)}. Cuando dices "${user_message.trim()}", ¿te refieres a esos dias o quieres cambiarlo a ${formatWeekdays(requestedWeekdays)}? Puedo crear este plan como temporal o ayudarte a actualizar tus dias de entrenamiento en el perfil. ¿Que prefieres?`,
          metadata_routine: null,
          needs_day_confirmation: true,
          profile_weekdays: profileWeekdays,
          requested_weekdays: requestedWeekdays,
        });
      }
    }

    const compactHistory = (history as ChatHistoryItem[]).slice(-8).map((item) => ({
      role: item.role,
      content: String(item.content || "").slice(0, 1200),
    }));

    const systemPrompt = `Eres SendaFit Coach, un entrenador personal certificado y nutricionista deportivo experto.
Solo puedes responder preguntas relacionadas con ejercicio, rutinas, tecnicas de entrenamiento, anatomia, suplementacion, recetas y nutricion.
Si el usuario pregunta sobre noticias, cultura general, programacion, entretenimiento o cualquier tema ajeno al fitness, debes ignorarlo por completo y responder de forma identica, amable y exacta a:
"Lo siento, como tu coach de SendaFit solo puedo ayudarte con temas relacionados a tu entrenamiento, salud y nutricion. ¡Mantengamos el enfoque en tus objetivos!".

Responde siempre en JSON valido, sin markdown y sin texto adicional, con esta forma:
{
  "message": "Respuesta visible para el chat",
  "metadata_routine": null
}

Si el usuario pide explicitamente crear una rutina nueva o cambiar su entrenamiento actual, incluye metadata_routine:
{
  "message": "Resumen breve de la rutina propuesta",
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
          { "name": "Press banca", "sets": 4, "reps": 10, "notes": "Descanso 90s" }
        ]
      }
    ]
  }
}

Restricciones para metadata_routine:
- weekday debe ser 1=Lunes, 2=Martes, 3=Miercoles, 4=Jueves, 5=Viernes, 6=Sabado, 7=Domingo.
- Usa solo location: casa, gimnasio o exterior.
- reps debe ser numero entero; si recomiendas rango, usa el promedio y explica el rango en notes.
- Ajusta el numero de dias a available_weekdays cuando exista.
- No inventes consejos medicos. Si hay dolor, lesion seria o condicion medica, recomienda consultar a un profesional.

Contexto tecnico del usuario:
${JSON.stringify(context)}`;

    const content = await callAi({
      task: "text",
      jsonMode: true,
      temperature: 0.35,
      maxTokens: 2500,
      messages: [
        { role: "system", content: systemPrompt },
        ...compactHistory,
        { role: "user", content: user_message.trim() },
      ],
    });

    return jsonResponse(req, { success: true, ...normalizeCoachResponse(extractJson(content)) });
  } catch (error) {
    console.error("coach-chat error:", error);
    return jsonResponse(req, {
      error: error instanceof Error ? error.message : "No se pudo procesar el mensaje.",
    }, 500);
  }
});
