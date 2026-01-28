/**
 * analyze-food - Edge Function para análisis de comida con IA (Food Vision)
 * 
 * Recibe una imagen de comida y devuelve:
 * - Alimentos detectados
 * - Estimación de macronutrientes (calorías, proteínas, carbohidratos, grasas)
 * 
 * Usa Lovable AI con modelo de visión (Gemini)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FoodItem {
  name: string;
  portion: string;
  confidence: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AnalysisResult {
  foods: FoodItem[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
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
            content: `Eres un nutricionista experto en análisis visual de alimentos. Analiza la imagen de comida y devuelve SOLO un JSON válido con la siguiente estructura exacta:
{
  "foods": [
    {
      "name": "nombre del alimento en español",
      "portion": "cantidad estimada (ej: '150g', '1 taza', '1 unidad')",
      "confidence": 0.85,
      "calories": 250,
      "protein": 20,
      "carbs": 30,
      "fat": 8
    }
  ],
  "totals": {
    "calories": 500,
    "protein": 40,
    "carbs": 60,
    "fat": 16
  }
}

Reglas:
- Identifica TODOS los alimentos visibles en la imagen
- Estima porciones realistas basándote en el tamaño visual
- Los valores nutricionales deben ser por porción identificada
- confidence es un número entre 0 y 1 indicando certeza de la identificación
- totals es la suma de todos los alimentos
- Si no puedes identificar alimentos, devuelve arrays/objetos vacíos
- SOLO devuelve JSON, sin texto adicional`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analiza esta imagen de comida y proporciona el desglose nutricional completo:",
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
    let analysisResult: AnalysisResult;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, aiContent];
      const jsonStr = jsonMatch[1] || aiContent;
      analysisResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Error parsing AI response:", aiContent);
      analysisResult = {
        foods: [],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      };
    }

    // Log the analysis
    console.log(`Food analysis for user ${userId}:`, JSON.stringify(analysisResult));

    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResult,
      userId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("analyze-food error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Error desconocido",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
