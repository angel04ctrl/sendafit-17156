/**
 * analyze-food - Edge Function para analisis visual de comida.
 *
 * Recibe una imagen en base64 o URL y devuelve alimentos detectados con
 * porciones y macros estimados. Usa el cliente IA compartido del proyecto
 * para respetar AI_PROVIDER y las API keys configuradas en Supabase.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/aiClient.ts";

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
  notes?: string;
}

interface AnalyzeFoodBody {
  imageBase64?: string;
  imageUrl?: string;
  mimeType?: string;
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] || content;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("La IA no devolvio JSON valido.");
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : fallback;
}

function normalizeAnalysis(raw: unknown): AnalysisResult {
  const candidate = raw as Partial<AnalysisResult>;
  const foods = Array.isArray(candidate.foods)
    ? candidate.foods
      .map((food) => {
        const item = food as Partial<FoodItem>;
        const name = String(item.name || "").trim();
        if (!name) return null;

        return {
          name,
          portion: String(item.portion || "porción estimada").trim(),
          confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.6)),
          calories: toNumber(item.calories),
          protein: toNumber(item.protein),
          carbs: toNumber(item.carbs),
          fat: toNumber(item.fat),
        };
      })
      .filter((food): food is FoodItem => Boolean(food))
    : [];

  const summedTotals = foods.reduce(
    (acc, food) => ({
      calories: acc.calories + food.calories,
      protein: acc.protein + food.protein,
      carbs: acc.carbs + food.carbs,
      fat: acc.fat + food.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const totals = candidate.totals
    ? {
      calories: toNumber(candidate.totals.calories, summedTotals.calories),
      protein: toNumber(candidate.totals.protein, summedTotals.protein),
      carbs: toNumber(candidate.totals.carbs, summedTotals.carbs),
      fat: toNumber(candidate.totals.fat, summedTotals.fat),
    }
    : summedTotals;

  return {
    foods,
    totals,
    notes: typeof candidate.notes === "string" ? candidate.notes : undefined,
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

    const { imageBase64, imageUrl, mimeType = "image/jpeg" } = await req.json() as AnalyzeFoodBody;
    if (!imageBase64 && !imageUrl) {
      return respond({ error: "Debes enviar una imagen para analizar." }, 400);
    }

    const imageSource = imageBase64
      ? `data:${mimeType};base64,${imageBase64}`
      : imageUrl!;

    const aiContent = await callAi({
      task: "vision",
      jsonMode: true,
      maxTokens: 1800,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `Eres una nutriologa experta en analisis visual de comida. Devuelve SOLO JSON valido.

Estructura exacta:
{
  "foods": [
    {
      "name": "nombre del alimento en espanol",
      "portion": "porcion estimada, por ejemplo 150g, 1 taza, 2 unidades",
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
  },
  "notes": "advertencia breve si la foto no permite estimar con confianza"
}

Reglas:
- Identifica todos los alimentos visibles.
- Estima porciones realistas segun la imagen.
- Usa gramos para macros y kcal para calorias.
- Redondea a numeros enteros.
- Si no hay comida visible, devuelve foods vacio y totals en cero.
- No incluyas markdown ni texto fuera del JSON.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analiza la comida de esta imagen y estima alimentos, porciones, calorias y macronutrientes.",
            },
            {
              type: "image_url",
              image_url: { url: imageSource },
            },
          ],
        },
      ],
    });

    const analysis = normalizeAnalysis(JSON.parse(extractJsonObject(aiContent)));

    console.log(`Food analysis for user ${user.id}: ${analysis.foods.length} foods detected`);

    return respond({
      success: true,
      analysis,
      userId: user.id,
    });
  } catch (error) {
    console.error("analyze-food error:", error);
    return respond({
      error: error instanceof Error ? error.message : "No se pudo analizar la imagen.",
    }, 500);
  }
});
