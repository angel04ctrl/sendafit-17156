/**
 * analyze-meal - Edge Function para analisis visual de comidas.
 *
 * Recibe una imagen en base64 o URL y devuelve el contrato estricto usado por
 * el modal de macros: plato, ingredientes detectados, macros y feedback.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/aiClient.ts";
import { handleCors, isAllowedRequestOrigin, jsonResponse } from "../_shared/cors.ts";

type ConfidenceScore = "alta" | "media" | "baja";

interface DetectedIngredient {
  name: string;
  estimatedWeightGrams: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface MealAnalysis {
  dishName: string;
  estimatedTotalWeightGrams: number;
  confidenceScore: ConfidenceScore;
  macros: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fats: number;
  };
  detectedIngredients: DetectedIngredient[];
  coachFeedback: string;
}

interface AnalyzeMealBody {
  imageBase64?: string;
  imageUrl?: string;
  mimeType?: string;
}

const fallbackAnalysis: MealAnalysis = {
  dishName: "Alimento no identificado",
  estimatedTotalWeightGrams: 0,
  confidenceScore: "baja",
  macros: {
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fats: 0,
  },
  detectedIngredients: [],
  coachFeedback: "No pude identificar comida con suficiente claridad. Toma una foto mas cercana, bien iluminada y centrada en el plato para volver a analizarla.",
};

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const systemPrompt = `Eres un Nutricionista Deportivo y Experto en Análisis Visual de Alimentos de SendaFit.
Tu única tarea es analizar la imagen de un plato de comida provista por el usuario, identificar los alimentos presentes, estimar de forma madura y profesional sus porciones en gramos y calcular los macronutrientes correspondientes (Calorías, Proteínas, Carbohidratos y Grasas).

REGLAS DE CÁLCULO NUTRICIONAL:
1. Sé realista con los tamaños de las porciones promedio en contextos de gimnasio y vida saludable.
2. Considera los aceites invisibles de cocción si notas que los alimentos son fritos o salteados a la plancha.
3. Los valores totales de la clave "macros" deben ser la suma matemática exacta de los macronutrientes individuales listados en "detectedIngredients".

REGLAS DE FORMATO OBLIGATORIAS:
- Debes responder EXCLUSIVAMENTE con un objeto JSON válido que cumpla estrictamente con la estructura solicitada.
- NO agregues introducciones, comentarios, ni los bloques envueltos en markdown como \`\`\`json o \`\`\`. Tu respuesta debe empezar directamente con '{' y terminar con '}'.
- Si la imagen es borrosa o no contiene comida, devuelve un JSON con la estructura estándar pero pon valores en 0, "dishName": "Alimento no identificado" y en "coachFeedback" solicita amablemente al usuario tomar una foto más clara y cercana del plato.

ESTRUCTURA DEL JSON A DEVOLVER:
{
  "dishName": "string",
  "estimatedTotalWeightGrams": number,
  "confidenceScore": "alta" | "media" | "baja",
  "macros": {
    "calories": number,
    "protein": number,
    "carbohydrates": number,
    "fats": number
  },
  "detectedIngredients": [
    { "name": "string", "estimatedWeightGrams": number, "protein": number, "carbs": number, "fats": number }
  ],
  "coachFeedback": "string motivacional y educativo de 2 frases máximo sobre la calidad del plato analizado"
}`;

function getBase64Size(base64: string): number {
  const normalized = base64.replace(/\s/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
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

function toConfidence(value: unknown): ConfidenceScore {
  return value === "alta" || value === "media" || value === "baja" ? value : "media";
}

function normalizeAnalysis(raw: unknown): MealAnalysis {
  const candidate = raw as Partial<MealAnalysis>;

  const detectedIngredients = Array.isArray(candidate.detectedIngredients)
    ? candidate.detectedIngredients
      .map((ingredient) => {
        const item = ingredient as Partial<DetectedIngredient>;
        const name = String(item.name || "").trim();
        if (!name) return null;

        return {
          name,
          estimatedWeightGrams: toNumber(item.estimatedWeightGrams),
          protein: toNumber(item.protein),
          carbs: toNumber(item.carbs),
          fats: toNumber(item.fats),
        };
      })
      .filter((ingredient): ingredient is DetectedIngredient => Boolean(ingredient))
    : [];

  const macroSums = detectedIngredients.reduce(
    (acc, ingredient) => ({
      protein: acc.protein + ingredient.protein,
      carbohydrates: acc.carbohydrates + ingredient.carbs,
      fats: acc.fats + ingredient.fats,
      weight: acc.weight + ingredient.estimatedWeightGrams,
    }),
    { protein: 0, carbohydrates: 0, fats: 0, weight: 0 },
  );

  const rawMacros = candidate.macros || fallbackAnalysis.macros;
  const dishName = String(candidate.dishName || "").trim() || fallbackAnalysis.dishName;
  const hasIngredients = detectedIngredients.length > 0;

  return {
    dishName,
    estimatedTotalWeightGrams: toNumber(
      candidate.estimatedTotalWeightGrams,
      hasIngredients ? macroSums.weight : fallbackAnalysis.estimatedTotalWeightGrams,
    ),
    confidenceScore: toConfidence(candidate.confidenceScore),
    macros: {
      calories: toNumber(rawMacros.calories),
      protein: hasIngredients ? macroSums.protein : toNumber(rawMacros.protein),
      carbohydrates: hasIngredients ? macroSums.carbohydrates : toNumber(rawMacros.carbohydrates),
      fats: hasIngredients ? macroSums.fats : toNumber(rawMacros.fats),
    },
    detectedIngredients,
    coachFeedback: String(candidate.coachFeedback || "").trim() || fallbackAnalysis.coachFeedback,
  };
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

    const { imageBase64, imageUrl, mimeType = "image/jpeg" } = await req.json() as AnalyzeMealBody;
    if (!imageBase64 && !imageUrl) {
      return jsonResponse(req, { error: "Debes enviar una imagen para analizar." }, 400);
    }

    if (imageBase64 && getBase64Size(imageBase64) > MAX_IMAGE_BYTES) {
      return jsonResponse(req, { error: "La imagen es demasiado grande. Usa una imagen menor a 6 MB." }, 413);
    }

    if (imageBase64 && !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return jsonResponse(req, { error: "Formato de imagen no valido. Usa JPG, PNG o WebP." }, 415);
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
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analiza esta foto de comida y responde solo con el JSON solicitado.",
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

    console.log(
      `Meal analysis for user ${user.id}: ${analysis.detectedIngredients.length} ingredients detected`,
    );

    return jsonResponse(req, analysis);
  } catch (error) {
    console.error("analyze-meal error:", error);
    return jsonResponse(req, {
      error: error instanceof Error ? error.message : "No se pudo analizar la imagen.",
    }, 500);
  }
});
