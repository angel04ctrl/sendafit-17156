import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type {
  Json,
} from "@/integrations/supabase/types";
import type {
  NutritionMealType,
  NutritionRecipeSearchRow,
  NutritionRpcDefinitions,
} from "@/integrations/supabase/nutrition-types";

const nullableNumber = z.number().nonnegative().nullable();

const recipeSummarySchema = z.object({
  recipe_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  origin: z.enum(["user", "system", "duplicated"]),
  category: z.string().nullable(),
  difficulty: z.enum(["facil", "intermedia", "avanzada"]).nullable(),
  meal_types: z.array(z.enum(["desayuno", "colacion_am", "comida", "colacion_pm", "cena"])),
  visibility: z.enum(["private", "shared", "global"]),
  is_owner: z.boolean(),
  current_version_id: z.string().uuid(),
  version_number: z.number().int().positive(),
  servings: z.number().positive(),
  yield_quantity: nullableNumber,
  yield_unit: z.string().nullable(),
  prep_time_minutes: z.number().int().nonnegative().nullable(),
  cook_time_minutes: z.number().int().nonnegative().nullable(),
  total_time_minutes: z.number().int().nonnegative(),
  ingredient_count: z.coerce.number().int().nonnegative(),
  calculation_complete: z.boolean(),
  missing_nutrient_codes: z.array(z.string()),
  calories_per_serving: nullableNumber,
  protein_per_serving: nullableNumber,
  carbs_per_serving: nullableNumber,
  fat_per_serving: nullableNumber,
  total_count: z.coerce.number().int().nonnegative(),
});

const nutrientValueSchema = z.object({
  name: z.string(),
  unit: z.string(),
  total: z.number().nonnegative(),
  perServing: z.number().nonnegative(),
  per100g: z.number().nonnegative().nullable(),
});

const ingredientNutrientSchema = z.object({
  name: z.string(),
  unit: z.string(),
  amount: z.number().nonnegative(),
});

const recipeDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  origin: z.enum(["user", "system", "duplicated"]),
  locale: z.string(),
  category: z.string().nullable(),
  difficulty: z.enum(["facil", "intermedia", "avanzada"]).nullable(),
  imageUrl: z.string().nullable(),
  visibility: z.enum(["private", "shared", "global"]),
  status: z.enum(["active", "archived"]),
  tags: z.array(z.string()),
  mealTypes: z.array(z.enum(["desayuno", "colacion_am", "comida", "colacion_pm", "cena"])),
  dietaryLabels: z.array(z.string()),
  allergens: z.array(z.string()),
  attributeEvaluationComplete: z.boolean(),
  isOwner: z.boolean(),
  sourceRecipeId: z.string().uuid().nullable(),
  currentVersionId: z.string().uuid(),
  version: z.object({
    id: z.string().uuid(),
    versionNumber: z.number().int().positive(),
    status: z.enum(["draft", "published", "archived"]),
    servings: z.number().positive(),
    yieldQuantity: nullableNumber,
    yieldUnit: z.string().nullable(),
    finalWeightGrams: nullableNumber,
    finalVolumeMilliliters: nullableNumber,
    ingredientWeightGrams: nullableNumber,
    prepTimeMinutes: z.number().int().nonnegative().nullable(),
    cookTimeMinutes: z.number().int().nonnegative().nullable(),
    totalTimeMinutes: z.number().int().nonnegative(),
    calculationComplete: z.boolean(),
    missingNutrientCodes: z.array(z.string()),
    calculatedAt: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: z.string(),
    publishedAt: z.string().nullable(),
  }),
  ingredients: z.array(z.object({
    id: z.string().uuid(),
    canonicalGroupId: z.string().uuid(),
    foodId: z.string().uuid(),
    servingId: z.string().uuid(),
    unitId: z.string().uuid().nullable(),
    foodName: z.string().min(1),
    servingLabel: z.string().nullable(),
    unitLabel: z.string().nullable(),
    quantity: z.number().positive(),
    grams: z.number().positive(),
    milliliters: z.number().positive().nullable(),
    orderIndex: z.number().int().positive(),
    notes: z.string().nullable(),
    nutrients: z.record(z.string(), ingredientNutrientSchema),
    verificationStatus: z.string().nullable(),
  })),
  steps: z.array(z.object({
    id: z.string().uuid(),
    stepNumber: z.number().int().positive(),
    instruction: z.string().min(1),
    durationMinutes: z.number().int().nonnegative().nullable(),
  })),
  nutrients: z.record(z.string(), nutrientValueSchema),
});

const saveResultSchema = z.object({
  recipeId: z.string().uuid(),
  recipeVersionId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  deduplicated: z.boolean(),
});

const registrationResultSchema = z.object({
  nutritionMealLogId: z.string().uuid(),
  nutritionMealLogItemId: z.string().uuid().optional(),
  legacyMealId: z.string().uuid().nullable(),
  legacyMealIngredientId: z.string().uuid().optional(),
  recipeId: z.string().uuid().optional(),
  recipeVersionId: z.string().uuid().optional(),
  servings: z.number().positive().optional(),
  calories: z.number().nonnegative().optional(),
  protein: z.number().nonnegative().optional(),
  carbs: z.number().nonnegative().optional(),
  fat: z.number().nonnegative().optional(),
  deduplicated: z.boolean(),
});

export type NutritionRecipeSummary = z.infer<typeof recipeSummarySchema>;
export type NutritionRecipeDetail = z.infer<typeof recipeDetailSchema>;
export type NutritionRecipeSaveResult = z.infer<typeof saveResultSchema>;
export type NutritionRecipeRegistrationResult = z.infer<typeof registrationResultSchema>;

export interface RecipeDraftIngredient {
  canonicalGroupId: string;
  foodId: string;
  servingId: string;
  foodName: string;
  servingLabel: string;
  quantity: number;
  gramsPerUnit: number;
  nutrientsPerUnit: Record<string, number>;
  notes?: string;
}

export interface NutritionRecipeDraft {
  recipeId?: string;
  sourceRecipeId?: string;
  name: string;
  description?: string;
  category?: string;
  difficulty?: "facil" | "intermedia" | "avanzada";
  visibility: "private";
  servings: number;
  yieldQuantity?: number;
  yieldUnit?: string;
  finalWeightGrams?: number;
  finalVolumeMilliliters?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  notes?: string;
  tags: string[];
  mealTypes: NutritionMealType[];
  ingredients: RecipeDraftIngredient[];
  steps: string[];
  clientRequestId: string;
}

export interface NutritionRecipePage {
  items: NutritionRecipeSummary[];
  total: number;
  offset: number;
  nextOffset: number | null;
}

export interface RecipeDraftTotals {
  totalWeightGrams: number;
  total: Record<string, number>;
  perServing: Record<string, number>;
  per100g: Record<string, number> | null;
  calculationComplete: boolean;
  missingNutrientCodes: string[];
}

type RpcError = { message: string; code?: string; details?: string | null };
type RpcResult<T> = PromiseLike<{ data: T | null; error: RpcError | null }>;

interface NutritionRecipeRpcClient {
  rpc(name: "search_nutrition_recipes", args: NutritionRpcDefinitions["search_nutrition_recipes"]["Args"]): RpcResult<NutritionRecipeSearchRow[]>;
  rpc(name: "get_nutrition_recipe", args: NutritionRpcDefinitions["get_nutrition_recipe"]["Args"]): RpcResult<Json>;
  rpc(name: "save_nutrition_recipe", args: NutritionRpcDefinitions["save_nutrition_recipe"]["Args"]): RpcResult<Json>;
  rpc(name: "duplicate_nutrition_recipe", args: NutritionRpcDefinitions["duplicate_nutrition_recipe"]["Args"]): RpcResult<Json>;
  rpc(name: "archive_nutrition_recipe", args: NutritionRpcDefinitions["archive_nutrition_recipe"]["Args"]): RpcResult<undefined>;
  rpc(name: "register_nutrition_recipe_meal", args: NutritionRpcDefinitions["register_nutrition_recipe_meal"]["Args"]): RpcResult<Json>;
}

const recipeRpc = supabase as unknown as NutritionRecipeRpcClient;

export class NutritionRecipeError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "NutritionRecipeError";
  }
}

function throwRpcError(error: RpcError): never {
  const knownMessages: Record<string, string> = {
    not_authenticated: "Tu sesion expiro. Inicia sesion nuevamente.",
    recipe_not_found: "La receta ya no esta disponible.",
    recipe_not_editable: "Esta receta no se puede editar.",
    recipe_version_not_available: "La version seleccionada ya no esta disponible.",
    invalid_recipe_name: "Escribe un nombre valido para la receta.",
    invalid_recipe_servings: "La cantidad de porciones no es valida.",
    invalid_recipe_ingredients: "Agrega al menos un ingrediente del catalogo.",
    invalid_recipe_steps: "Agrega al menos un paso de preparacion.",
    invalid_recipe_catalog_selection: "Uno de los ingredientes ya no esta disponible.",
    recipe_serving_without_gram_equivalence: "Una porcion no tiene equivalencia en gramos.",
    recipe_ingredient_missing_core_nutrients: "Un ingrediente no tiene datos nutricionales completos.",
    invalid_recipe_registration_servings: "La cantidad de porciones no es valida.",
    client_request_conflict: "La solicitud ya fue usada para otra operacion.",
  };
  const matched = Object.keys(knownMessages).find((code) => error.message.includes(code));
  throw new NutritionRecipeError(
    matched ? knownMessages[matched] : "No se pudo completar la operacion con la receta.",
    matched || error.code,
  );
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, code: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`Invalid nutrition recipe payload (${code})`, parsed.error.flatten());
    throw new NutritionRecipeError("La receta devolvio datos incompletos.", code);
  }
  return parsed.data;
}

export async function searchNutritionRecipes(input: {
  query?: string;
  offset?: number;
  pageSize?: number;
} = {}): Promise<NutritionRecipePage> {
  const offset = Math.max(0, input.offset || 0);
  const pageSize = Math.min(50, Math.max(1, input.pageSize || 20));
  const { data, error } = await recipeRpc.rpc("search_nutrition_recipes", {
    _query: input.query?.trim() || null,
    _limit: pageSize,
    _offset: offset,
  });
  if (error) throwRpcError(error);

  const items = (data || []).map((row) => parseOrThrow(recipeSummarySchema, row, "invalid_recipe_summary"));
  const total = items[0]?.total_count || 0;
  const loadedThrough = offset + items.length;
  return { items, total, offset, nextOffset: loadedThrough < total ? loadedThrough : null };
}

export async function getNutritionRecipe(recipeId: string): Promise<NutritionRecipeDetail> {
  const { data, error } = await recipeRpc.rpc("get_nutrition_recipe", { _recipe_id: recipeId });
  if (error) throwRpcError(error);
  return parseOrThrow(recipeDetailSchema, data, "invalid_recipe_detail");
}

function optionalFinite(value: number | undefined): number | undefined {
  return value === undefined || !Number.isFinite(value) ? undefined : value;
}

export async function saveNutritionRecipe(draft: NutritionRecipeDraft): Promise<NutritionRecipeSaveResult> {
  const payload = {
    recipeId: draft.recipeId,
    sourceRecipeId: draft.sourceRecipeId,
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    category: draft.category?.trim() || undefined,
    difficulty: draft.difficulty,
    visibility: draft.visibility,
    servings: draft.servings,
    yieldQuantity: optionalFinite(draft.yieldQuantity),
    yieldUnit: draft.yieldUnit?.trim() || undefined,
    finalWeightGrams: optionalFinite(draft.finalWeightGrams),
    finalVolumeMilliliters: optionalFinite(draft.finalVolumeMilliliters),
    prepTimeMinutes: optionalFinite(draft.prepTimeMinutes),
    cookTimeMinutes: optionalFinite(draft.cookTimeMinutes),
    notes: draft.notes?.trim() || undefined,
    tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
    mealTypes: draft.mealTypes,
    ingredients: draft.ingredients.map((ingredient) => ({
      canonicalGroupId: ingredient.canonicalGroupId,
      foodId: ingredient.foodId,
      servingId: ingredient.servingId,
      quantity: ingredient.quantity,
      notes: ingredient.notes?.trim() || undefined,
    })),
    steps: draft.steps.map((step) => step.trim()),
    clientRequestId: draft.clientRequestId,
  } as Json;

  const { data, error } = await recipeRpc.rpc("save_nutrition_recipe", { _payload: payload });
  if (error) throwRpcError(error);
  return parseOrThrow(saveResultSchema, data, "invalid_recipe_save_result");
}

export async function duplicateNutritionRecipe(input: {
  recipeId: string;
  clientRequestId: string;
}): Promise<NutritionRecipeSaveResult> {
  const { data, error } = await recipeRpc.rpc("duplicate_nutrition_recipe", {
    _recipe_id: input.recipeId,
    _client_request_id: input.clientRequestId,
  });
  if (error) throwRpcError(error);
  return parseOrThrow(saveResultSchema, data, "invalid_recipe_duplicate_result");
}

export async function archiveNutritionRecipe(recipeId: string): Promise<void> {
  const { error } = await recipeRpc.rpc("archive_nutrition_recipe", { _recipe_id: recipeId });
  if (error) throwRpcError(error);
}

export async function registerNutritionRecipe(input: {
  recipeId: string;
  recipeVersionId: string;
  servings: number;
  mealType: NutritionMealType;
  loggedDate: string;
  clientRequestId: string;
}): Promise<NutritionRecipeRegistrationResult> {
  const { data, error } = await recipeRpc.rpc("register_nutrition_recipe_meal", {
    _recipe_id: input.recipeId,
    _recipe_version_id: input.recipeVersionId,
    _servings: input.servings,
    _meal_type: input.mealType,
    _logged_date: input.loggedDate,
    _client_request_id: input.clientRequestId,
  });
  if (error) throwRpcError(error);
  return parseOrThrow(registrationResultSchema, data, "invalid_recipe_registration_result");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateRecipeDraftTotals(
  ingredients: RecipeDraftIngredient[],
  servings: number,
  finalWeightGrams?: number,
): RecipeDraftTotals {
  if (!Number.isFinite(servings) || servings <= 0 || servings > 1000) {
    throw new NutritionRecipeError("La cantidad de porciones no es valida.", "invalid_recipe_servings");
  }

  const total: Record<string, number> = {};
  const requiredCodes = ["energy_kcal", "protein_g", "carbs_g", "fat_g"];
  let totalWeightGrams = 0;
  for (const ingredient of ingredients) {
    if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0 || ingredient.quantity > 1000) {
      throw new NutritionRecipeError("La cantidad de un ingrediente no es valida.", "invalid_recipe_ingredient_quantity");
    }
    totalWeightGrams += ingredient.gramsPerUnit * ingredient.quantity;
    Object.entries(ingredient.nutrientsPerUnit).forEach(([code, amount]) => {
      total[code] = (total[code] || 0) + amount * ingredient.quantity;
    });
  }

  const roundedTotal = Object.fromEntries(Object.entries(total).map(([code, amount]) => [code, round(amount)]));
  const perServing = Object.fromEntries(
    Object.entries(roundedTotal).map(([code, amount]) => [code, round(amount / servings)]),
  );
  const missingNutrientCodes = requiredCodes.filter((code) => (
    ingredients.some((ingredient) => ingredient.nutrientsPerUnit[code] === undefined)
  ));
  const per100g = finalWeightGrams && finalWeightGrams > 0
    ? Object.fromEntries(Object.entries(roundedTotal).map(([code, amount]) => [code, round(amount / finalWeightGrams * 100)]))
    : null;
  return {
    totalWeightGrams: round(totalWeightGrams),
    total: roundedTotal,
    perServing,
    per100g,
    calculationComplete: missingNutrientCodes.length === 0,
    missingNutrientCodes,
  };
}

export function recipeDetailToDraft(detail: NutritionRecipeDetail): Omit<NutritionRecipeDraft, "clientRequestId"> {
  return {
    recipeId: detail.id,
    sourceRecipeId: detail.sourceRecipeId || undefined,
    name: detail.name,
    description: detail.description || undefined,
    category: detail.category || undefined,
    difficulty: detail.difficulty || undefined,
    visibility: "private",
    servings: detail.version.servings,
    yieldQuantity: detail.version.yieldQuantity || undefined,
    yieldUnit: detail.version.yieldUnit || undefined,
    finalWeightGrams: detail.version.finalWeightGrams || undefined,
    finalVolumeMilliliters: detail.version.finalVolumeMilliliters || undefined,
    prepTimeMinutes: detail.version.prepTimeMinutes ?? undefined,
    cookTimeMinutes: detail.version.cookTimeMinutes ?? undefined,
    notes: detail.version.notes || undefined,
    tags: detail.tags,
    mealTypes: detail.mealTypes,
    ingredients: detail.ingredients.map((ingredient) => ({
      canonicalGroupId: ingredient.canonicalGroupId,
      foodId: ingredient.foodId,
      servingId: ingredient.servingId,
      foodName: ingredient.foodName,
      servingLabel: ingredient.servingLabel || "Porcion",
      quantity: ingredient.quantity,
      gramsPerUnit: ingredient.grams / ingredient.quantity,
      nutrientsPerUnit: Object.fromEntries(
        Object.entries(ingredient.nutrients).map(([code, nutrient]) => [code, nutrient.amount / ingredient.quantity]),
      ),
      notes: ingredient.notes || undefined,
    })),
    steps: detail.steps.map((step) => step.instruction),
  };
}
