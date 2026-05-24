import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MachineAnalysis {
  machineName: string;
  primaryMuscle: string;
  setupSteps: string[];
  exercises: {
    principiante: string[];
    intermedio: string[];
    avanzado: string[];
  };
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

function normalizeAnalysis(value: unknown): MachineAnalysis {
  const parsed = value as Partial<MachineAnalysis>;
  const exercises = (parsed.exercises || {}) as Partial<MachineAnalysis["exercises"]>;

  return {
    machineName: typeof parsed.machineName === "string" && parsed.machineName.trim()
      ? parsed.machineName.trim()
      : "Maquina no identificada",
    primaryMuscle: typeof parsed.primaryMuscle === "string" && parsed.primaryMuscle.trim()
      ? parsed.primaryMuscle.trim()
      : "Grupo muscular no identificado",
    setupSteps: Array.isArray(parsed.setupSteps)
      ? parsed.setupSteps.filter((step): step is string => typeof step === "string" && step.trim().length > 0)
      : ["Ajusta la maquina a tu altura antes de iniciar.", "Usa un peso controlable.", "Deten el ejercicio si sientes dolor articular."],
    exercises: {
      principiante: Array.isArray(exercises.principiante)
        ? exercises.principiante.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
      intermedio: Array.isArray(exercises.intermedio)
        ? exercises.intermedio.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
      avanzado: Array.isArray(exercises.avanzado)
        ? exercises.avanzado.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return respond({ error: "Metodo no permitido." }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "No autorizado." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return respond({ error: "Sesion invalida." }, 401);

    const { imageUrl, fitness_level } = await req.json();
    if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
      return respond({ error: "imageUrl es requerido y debe ser una URL valida." }, 400);
    }

    const systemPrompt = `Eres un experto en biomecanica y maquinas de gimnasio. Responde unicamente con JSON valido, sin markdown ni texto extra.
El JSON debe tener exactamente esta estructura:
{
  "machineName": "Nombre comercial de la maquina",
  "primaryMuscle": "Grupo muscular principal",
  "setupSteps": ["Paso breve 1", "Paso breve 2", "Paso breve 3"],
  "exercises": {
    "principiante": ["Ejercicio basico 1", "Ejercicio basico 2"],
    "intermedio": ["Variacion intermedia 1", "Variacion intermedia 2"],
    "avanzado": ["Variacion avanzada o tecnica de intensidad"]
  }
}
Usa espanol claro. Prioriza seguridad. Adapta las sugerencias al nivel del usuario: ${fitness_level || "principiante"}.`;

    const content = await callAi({
      task: "vision",
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 1400,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analiza esta maquina de gimnasio." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const analysis = normalizeAnalysis(parseJsonObject(content));
    console.log(`analyze-machine user=${user.id} machine=${analysis.machineName}`);

    return respond({ success: true, analysis });
  } catch (error) {
    console.error("analyze-machine error:", error);
    return respond({
      error: error instanceof Error ? error.message : "No se pudo analizar la imagen.",
    }, 500);
  }
});
