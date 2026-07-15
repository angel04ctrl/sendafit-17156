import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/aiClient.ts";
import { handleCors, isAllowedRequestOrigin, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";

interface PossibleExercise {
  name: string;
  catalogExerciseId?: string | null;
  confidence?: number;
  reason?: string;
}

interface MachineAnalysis {
  machineName: string;
  confidenceScore: number;
  uncertaintyReason: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  setupSteps: string[];
  executionSteps: string[];
  commonMistakes: string[];
  safetyWarnings: string[];
  recommendedSets: number;
  recommendedReps: string;
  recommendedRestSeconds: number;
  possibleExercises: PossibleExercise[];
  notSureFallback: string;
}

interface CatalogExercise {
  id: string;
  nombre: string;
  aliases?: string[] | string | null;
}

function getServiceRoleKey() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
}

function respond(req: Request, body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), ...extraHeaders, "Content-Type": "application/json" },
  });
}

function parseJsonObject(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La IA no devolvio JSON valido.");
    return JSON.parse(match[0]);
  }
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function stringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 8);
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

function normalizeAnalysis(value: unknown): MachineAnalysis {
  const parsed = value as Partial<MachineAnalysis> & {
    primaryMuscle?: string;
    exercises?: Record<string, unknown>;
  };

  const confidenceScore = clampNumber(parsed.confidenceScore, 0.5, 0, 1);
  const possibleExercisesSource = Array.isArray(parsed.possibleExercises)
    ? parsed.possibleExercises
    : Object.values(parsed.exercises || {}).flat();

  const possibleExercises = (possibleExercisesSource as unknown[])
    .map((item) => {
      if (typeof item === "string") return { name: item };
      const candidate = item as Partial<PossibleExercise>;
      return {
        name: String(candidate.name || "").trim(),
        confidence: clampNumber(candidate.confidence, confidenceScore, 0, 1),
        reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
      };
    })
    .filter((item) => item.name)
    .slice(0, 8);

  const machineName = typeof parsed.machineName === "string" && parsed.machineName.trim()
    ? parsed.machineName.trim()
    : "Maquina no identificada";

  const primaryMuscles = stringArray(parsed.primaryMuscles, parsed.primaryMuscle ? [parsed.primaryMuscle] : ["grupo muscular no identificado"]);
  const safetyWarnings = stringArray(parsed.safetyWarnings, []);
  const normalizedSafetyWarnings = safetyWarnings.map(normalizeText).join(" ");
  if (!normalizedSafetyWarnings.includes("verifica")) {
    safetyWarnings.unshift("Verifica el nombre de la maquina antes de usarla.");
  }
  if (!normalizedSafetyWarnings.includes("dolor")) {
    safetyWarnings.push("Si sientes dolor, detente.");
  }

  return {
    machineName,
    confidenceScore,
    uncertaintyReason: typeof parsed.uncertaintyReason === "string" && parsed.uncertaintyReason.trim()
      ? parsed.uncertaintyReason.trim()
      : confidenceScore < 0.7 ? "La imagen no permite confirmar con certeza el modelo de la maquina." : null,
    primaryMuscles,
    secondaryMuscles: stringArray(parsed.secondaryMuscles, []),
    setupSteps: stringArray(parsed.setupSteps, [
      "Verifica el nombre de la maquina en la etiqueta.",
      "Ajusta asiento, respaldo y topes antes de cargar peso.",
      "Usa un peso que puedas controlar sin dolor.",
    ]),
    executionSteps: stringArray(parsed.executionSteps, [
      "Haz una repeticion lenta de prueba.",
      "Mantén el tronco estable durante todo el recorrido.",
      "Regresa con control y sin soltar la carga.",
    ]),
    commonMistakes: stringArray(parsed.commonMistakes, [
      "Usar demasiado peso.",
      "Recortar el rango de movimiento.",
      "Perder postura al final de la serie.",
    ]),
    safetyWarnings: safetyWarnings.slice(0, 8),
    recommendedSets: Math.round(clampNumber(parsed.recommendedSets, 3, 1, 6)),
    recommendedReps: typeof parsed.recommendedReps === "string" && parsed.recommendedReps.trim()
      ? parsed.recommendedReps.trim()
      : "10-12",
    recommendedRestSeconds: Math.round(clampNumber(parsed.recommendedRestSeconds, 90, 30, 240)),
    possibleExercises: possibleExercises.length > 0
      ? possibleExercises
      : [{
          name: machineName === "Maquina no identificada" ? "Ejercicio en maquina no identificado" : machineName,
          confidence: confidenceScore,
          reason: "Fallback conservador porque la IA no devolvio ejercicios posibles.",
        }],
    notSureFallback: typeof parsed.notSureFallback === "string" && parsed.notSureFallback.trim()
      ? parsed.notSureFallback.trim()
      : "No estoy completamente seguro. Toma otra foto donde se vea la etiqueta, el asiento y la trayectoria de movimiento.",
  };
}

function attachCatalogMatches(analysis: MachineAnalysis, catalog: CatalogExercise[]) {
  return {
    ...analysis,
    possibleExercises: analysis.possibleExercises.map((exercise) => {
      const wanted = normalizeText(exercise.name);
      const match = catalog.find((candidate) => {
        const names = [candidate.nombre, ...toArray(candidate.aliases)].map(normalizeText);
        return names.includes(wanted) || names.some((name) => wanted.includes(name) || name.includes(wanted));
      });

      return {
        ...exercise,
        catalogExerciseId: match?.id || null,
        name: match?.nombre || exercise.name,
      };
    }),
  };
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (!isAllowedRequestOrigin(req)) return jsonResponse(req, { error: "Origen no permitido." }, 403);
    if (req.method !== "POST") return respond(req, { error: "Metodo no permitido." }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond(req, { error: "No autorizado." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return respond(req, { error: "Sesion invalida." }, 401);

    const { imageUrl, fitness_level } = await req.json();
    if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
      return respond(req, { error: "imageUrl es requerido y debe ser una URL valida." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      getServiceRoleKey(),
    );

    const { data: limitResult, error: limitError } = await admin.rpc("check_ai_rate_limit", {
      _user_id: user.id,
      _function_name: "analyze-machine",
      _hourly_limit: 5,
      _daily_limit: 20,
    });

    if (limitError) {
      console.error("rate limit error:", limitError);
      return respond(req, {
        error: "No se pudo validar la cuota de IA.",
        detail: limitError.message,
        hint: "Ejecuta la migracion Sprint 11 actualizada y confirma que SUPABASE_SERVICE_ROLE_KEY exista en los secrets de Edge Functions.",
      }, 503);
    }

    const rateLimit = limitResult as {
      allowed?: boolean;
      limit?: "hour" | "day";
      retryAfterSeconds?: number;
    };

    if (!rateLimit?.allowed) {
      const retryAfter = String(rateLimit?.retryAfterSeconds || 3600);
      return respond(
        req,
        { error: "Limite de analisis alcanzado. Intenta mas tarde.", limit: rateLimit?.limit || "hour" },
        429,
        { "Retry-After": retryAfter },
      );
    }

    const systemPrompt = `Eres un experto en biomecanica y maquinas de gimnasio. Responde unicamente con JSON valido, sin markdown ni texto extra.
Analiza la imagen con prudencia. Si no estas seguro, usa confidenceScore bajo y explica uncertaintyReason.
El JSON debe tener exactamente esta estructura:
{
  "machineName": "Nombre comercial probable",
  "confidenceScore": 0.0,
  "uncertaintyReason": "Motivo si hay duda o null",
  "primaryMuscles": ["musculo principal"],
  "secondaryMuscles": ["musculo secundario"],
  "setupSteps": ["Ajuste seguro 1"],
  "executionSteps": ["Ejecucion segura 1"],
  "commonMistakes": ["Error comun 1"],
  "safetyWarnings": ["Advertencia 1"],
  "recommendedSets": 3,
  "recommendedReps": "10-12",
  "recommendedRestSeconds": 90,
  "possibleExercises": [
    { "name": "Nombre de ejercicio compatible con catalogo", "confidence": 0.8, "reason": "Por que encaja" }
  ],
  "notSureFallback": "Mensaje si no estas completamente seguro"
}
Reglas:
- Usa espanol claro.
- No diagnostiques lesiones.
- No des instrucciones agresivas si confidenceScore < 0.7.
- Siempre incluye: "Verifica el nombre de la maquina antes de usarla" y "Si sientes dolor, detente" en safetyWarnings.
- Adapta sets/reps al nivel del usuario: ${fitness_level || "principiante"}.`;

    const content = await callAi({
      task: "vision",
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 1800,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analiza esta maquina de gimnasio con el contrato indicado." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const { data: catalog } = await admin
      .from("exercises")
      .select("id,nombre,aliases")
      .limit(250);

    const analysis = attachCatalogMatches(
      normalizeAnalysis(parseJsonObject(content)),
      (catalog || []) as CatalogExercise[],
    );
    console.log(`analyze-machine user=${user.id} machine=${analysis.machineName} confidence=${analysis.confidenceScore}`);

    return respond(req, { success: true, analysis });
  } catch (error) {
    console.error("analyze-machine error:", error);
    return respond(req, {
      error: error instanceof Error ? error.message : "No se pudo analizar la imagen.",
    }, 500);
  }
});
