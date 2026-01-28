/**
 * analyze-gym-machine - Edge Function para identificar máquinas de gimnasio
 * 
 * Recibe una imagen de una máquina de gym y devuelve:
 * - Nombre y tipo de la máquina
 * - Músculos trabajados (primarios y secundarios)
 * - Instrucciones de uso paso a paso
 * - Consejos de postura
 * - Ejercicios relacionados
 * 
 * Usa Lovable AI con modelo de visión (Gemini)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MachineAnalysis {
  machineName: string;
  machineType: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  usageInstructions: string[];
  postureTips: string[];
  relatedExercises: Array<{
    name: string;
    description: string;
  }>;
  confidence: number;
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
    const { imageBase64, imageUrl } = await req.json();

    if (!imageBase64 && !imageUrl) {
      return new Response(JSON.stringify({ error: "Image required (base64 or URL)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Prepare image content for vision model
    const imageContent = imageBase64
      ? {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
          },
        }
      : {
          type: "image_url",
          image_url: {
            url: imageUrl,
          },
        };

    // Call Lovable AI with vision model
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Eres un experto en equipamiento de gimnasio y entrenamiento físico. Analiza la imagen de la máquina de gimnasio y devuelve SOLO un JSON válido con la siguiente estructura exacta:
{
  "machineName": "Nombre de la máquina en español",
  "machineType": "Tipo (ej: 'Cable', 'Peso libre', 'Máquina guiada', 'Cardio')",
  "primaryMuscles": ["músculo principal 1", "músculo principal 2"],
  "secondaryMuscles": ["músculo secundario 1", "músculo secundario 2"],
  "usageInstructions": [
    "Paso 1: Ajusta el asiento...",
    "Paso 2: Coloca las manos...",
    "Paso 3: Realiza el movimiento..."
  ],
  "postureTips": [
    "Mantén la espalda recta",
    "No bloquees las articulaciones",
    "Respira correctamente"
  ],
  "relatedExercises": [
    {
      "name": "Nombre del ejercicio alternativo",
      "description": "Breve descripción del ejercicio"
    }
  ],
  "confidence": 0.9
}

Reglas:
- Identifica la máquina específica del gimnasio
- Lista los músculos en español (pecho, espalda, cuádriceps, etc.)
- Proporciona instrucciones claras paso a paso
- Incluye al menos 3 consejos de postura
- Sugiere 2-3 ejercicios alternativos que trabajen músculos similares
- confidence es un número entre 0 y 1
- Si no puedes identificar la máquina, indica confidence bajo y sugiere alternativas
- SOLO devuelve JSON, sin texto adicional`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identifica esta máquina de gimnasio y proporciona instrucciones de uso completas:",
              },
              imageContent,
            ],
          },
        ],
        max_tokens: 2000,
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

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON response from AI
    let analysisResult: MachineAnalysis;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, aiContent];
      const jsonStr = jsonMatch[1] || aiContent;
      analysisResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Error parsing AI response:", aiContent);
      analysisResult = {
        machineName: "Máquina no identificada",
        machineType: "Desconocido",
        primaryMuscles: [],
        secondaryMuscles: [],
        usageInstructions: ["No se pudo analizar la imagen correctamente"],
        postureTips: [],
        relatedExercises: [],
        confidence: 0,
      };
    }

    // Log the analysis
    console.log(`Machine analysis for user ${userId}:`, JSON.stringify(analysisResult));

    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResult,
      userId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("analyze-gym-machine error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Error desconocido",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
