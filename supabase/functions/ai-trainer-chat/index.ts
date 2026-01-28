/**
 * ai-trainer-chat - Edge Function para chat con entrenador personal IA
 * 
 * Funcionalidades:
 * - Chat conversacional general sobre fitness
 * - Generación de rutinas personalizadas
 * - Creación de planes de alimentación
 * - Consejos de entrenamiento
 * 
 * Usa Lovable AI con streaming para respuestas en tiempo real
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserProfile {
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
  fitness_level?: string;
  fitness_goal?: string;
  available_days_per_week?: number;
  available_weekdays?: string[];
  health_conditions?: string[];
  injuries_limitations?: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;

    // Parse request body
    const { messages, chatType, stream = true } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("age, gender, weight, height, fitness_level, fitness_goal, available_days_per_week, available_weekdays, health_conditions, injuries_limitations")
      .eq("id", userId)
      .single();

    const userProfile: UserProfile = profile || {};

    // Build system prompt based on chat type and user profile
    const systemPrompt = buildSystemPrompt(chatType, userProfile);

    // Prepare messages for AI
    const aiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("Error en el servicio de IA");
    }

    // Return streaming response directly if streaming
    if (stream) {
      return new Response(aiResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming response
    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      success: true,
      message: aiContent,
      userId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("ai-trainer-chat error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Error desconocido",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(chatType: string, profile: UserProfile): string {
  const profileContext = buildProfileContext(profile);
  
  const basePrompt = `Eres un entrenador personal experto y nutricionista certificado. Tu nombre es "Coach Senda" y eres el asistente de IA de la app SendaFit.

DATOS DEL USUARIO:
${profileContext}

PERSONALIDAD:
- Eres motivador, empático y profesional
- Usas un tono cercano pero respetuoso
- Siempre priorizas la seguridad y salud del usuario
- Adaptas tus recomendaciones al nivel y objetivos del usuario
- Respondes en español

CAPACIDADES:
- Generar rutinas de entrenamiento personalizadas
- Crear planes de alimentación
- Dar consejos de nutrición y suplementación
- Explicar técnicas de ejercicios
- Motivar y dar seguimiento al progreso
- Responder dudas sobre fitness y salud

REGLAS IMPORTANTES:
- Nunca recomiendes sustancias prohibidas o peligrosas
- Si el usuario menciona condiciones médicas serias, recomienda consultar a un profesional
- Considera las lesiones y limitaciones del usuario
- Mantén respuestas concisas pero completas`;

  // Add specific instructions based on chat type
  switch (chatType) {
    case "routine":
      return `${basePrompt}

MODO ACTUAL: Generación de rutina
- Pregunta los datos necesarios si no los tienes (días disponibles, objetivo, nivel)
- Genera rutinas estructuradas con:
  * Nombre del día (ej: "Día 1: Pecho y Tríceps")
  * Lista de ejercicios con series y repeticiones
  * Tiempo de descanso recomendado
  * Notas de ejecución
- Cuando generes la rutina completa, formatea como JSON al final:
\`\`\`json
{
  "routineName": "Nombre de la rutina",
  "days": [
    {
      "day": 1,
      "name": "Pecho y Tríceps",
      "exercises": [
        {"name": "Press banca", "sets": 4, "reps": "8-10", "rest": "90s"}
      ]
    }
  ]
}
\`\`\``;

    case "meal_plan":
      return `${basePrompt}

MODO ACTUAL: Plan de alimentación
- Pregunta preferencias alimentarias y restricciones
- Genera planes con:
  * Desayuno, almuerzo, cena y snacks
  * Ingredientes específicos con cantidades
  * Macros por comida
  * Recetas simplificadas
- Considera el objetivo del usuario (déficit, superávit, mantenimiento)
- Cuando generes el plan, formatea como JSON al final:
\`\`\`json
{
  "planName": "Plan Semana 1",
  "dailyCalories": 2000,
  "meals": [
    {
      "type": "desayuno",
      "name": "Avena proteica",
      "ingredients": ["50g avena", "30g proteína", "1 banana"],
      "macros": {"calories": 400, "protein": 35, "carbs": 55, "fat": 8},
      "recipe": "Mezclar la avena con agua caliente..."
    }
  ]
}
\`\`\``;

    case "advice":
      return `${basePrompt}

MODO ACTUAL: Consejos y orientación
- Responde preguntas sobre técnica, nutrición, recuperación
- Da consejos prácticos y aplicables
- Explica el "por qué" detrás de las recomendaciones
- Usa ejemplos cuando sea útil`;

    default:
      return `${basePrompt}

MODO ACTUAL: Chat general
- Responde cualquier pregunta sobre fitness, nutrición o bienestar
- Puedes cambiar de tema según lo que el usuario necesite
- Ofrece ayuda con rutinas o planes si lo solicitan`;
  }
}

function buildProfileContext(profile: UserProfile): string {
  const lines: string[] = [];
  
  if (profile.age) lines.push(`- Edad: ${profile.age} años`);
  if (profile.gender) lines.push(`- Género: ${profile.gender}`);
  if (profile.weight) lines.push(`- Peso: ${profile.weight} kg`);
  if (profile.height) lines.push(`- Altura: ${profile.height} cm`);
  if (profile.fitness_level) lines.push(`- Nivel fitness: ${profile.fitness_level}`);
  if (profile.fitness_goal) lines.push(`- Objetivo: ${profile.fitness_goal}`);
  if (profile.available_days_per_week) lines.push(`- Días disponibles: ${profile.available_days_per_week}/semana`);
  if (profile.available_weekdays?.length) lines.push(`- Días de entrenamiento: ${profile.available_weekdays.join(", ")}`);
  if (profile.health_conditions?.length) lines.push(`- Condiciones de salud: ${profile.health_conditions.join(", ")}`);
  if (profile.injuries_limitations) lines.push(`- Lesiones/Limitaciones: ${profile.injuries_limitations}`);
  
  return lines.length > 0 ? lines.join("\n") : "No hay información de perfil disponible";
}
