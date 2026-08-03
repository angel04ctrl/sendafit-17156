import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type {
  NutritionCatalogSearchRow,
  NutritionMealType,
  NutritionRpcDefinitions,
} from "@/integrations/supabase/nutrition-types";

const nutrientSchema = z.object({
  name: z.string(),
  unit: z.string(),
  amountPer100g: z.number().nonnegative(),
  verificationStatus: z.string(),
});

const servingSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  quantity: z.number().positive(),
  grams: z.number().positive().nullable(),
  milliliters: z.number().positive().nullable(),
  isDefault: z.boolean(),
  verificationStatus: z.string(),
  isCalculable: z.boolean(),
  unit: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    dimension: z.string(),
    gramsMultiplier: z.number().positive().nullable(),
    millilitersMultiplier: z.number().positive().nullable(),
  }),
});

const variantSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1),
  canonicalName: z.string().min(1),
  description: z.string().nullable(),
  foodKind: z.string(),
  verificationStatus: z.string(),
  isVerified: z.boolean(),
  isDefault: z.boolean(),
  variantType: z.string(),
  physicalState: z.object({ code: z.string(), name: z.string() }).nullable(),
  preparationMethod: z.object({ code: z.string(), name: z.string() }).nullable(),
  brandName: z.string().nullable(),
  categories: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    isPrimary: z.boolean(),
  })),
  servings: z.array(servingSchema),
  nutrients: z.record(z.string(), nutrientSchema),
});

const groupDetailSchema = z.object({
  id: z.string().uuid(),
  canonicalName: z.string().min(1),
  description: z.string().nullable(),
  defaultFoodId: z.string().uuid().nullable(),
  status: z.string(),
  variants: z.array(variantSchema),
});

const registrationSchema = z.object({
  nutritionMealLogId: z.string().uuid(),
  nutritionMealLogItemId: z.string().uuid().optional(),
  legacyMealId: z.string().uuid().nullable(),
  legacyMealIngredientId: z.string().uuid().optional(),
  canonicalGroupId: z.string().uuid().optional(),
  foodId: z.string().uuid().optional(),
  servingId: z.string().uuid().optional(),
  quantity: z.number().positive().optional(),
  consumedGrams: z.number().positive().optional(),
  consumedMilliliters: z.number().positive().nullable().optional(),
  calories: z.number().nonnegative().optional(),
  protein: z.number().nonnegative().optional(),
  carbs: z.number().nonnegative().optional(),
  fat: z.number().nonnegative().optional(),
  fiber: z.number().nonnegative().nullable().optional(),
  sugar: z.number().nonnegative().nullable().optional(),
  sodiumMg: z.number().nonnegative().nullable().optional(),
  deduplicated: z.boolean(),
});

const mealLogSchema = z.object({
  id: z.string().uuid(),
  legacyMealId: z.string().uuid().nullable(),
  mealType: z.string(),
  name: z.string(),
  loggedDate: z.string(),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative().nullable(),
  sugar: z.number().nonnegative().nullable(),
  sodiumMg: z.number().nonnegative().nullable(),
  source: z.string(),
  metadata: z.unknown(),
  items: z.array(z.object({
    id: z.string().uuid(),
    canonicalGroupId: z.string().uuid().nullable(),
    foodId: z.string().uuid().nullable(),
    servingId: z.string().uuid().nullable(),
    itemName: z.string(),
    quantity: z.number().positive(),
    unitLabel: z.string().nullable(),
    grams: z.number().positive().nullable(),
    calories: z.number().nonnegative(),
    protein: z.number().nonnegative(),
    carbs: z.number().nonnegative(),
    fat: z.number().nonnegative(),
    fiber: z.number().nonnegative().nullable(),
    sugar: z.number().nonnegative().nullable(),
    sodiumMg: z.number().nonnegative().nullable(),
    source: z.string(),
    metadata: z.unknown(),
  })),
});

export type NutritionServing = z.infer<typeof servingSchema>;
export type NutritionFoodVariant = z.infer<typeof variantSchema>;
export type NutritionCatalogGroupDetail = z.infer<typeof groupDetailSchema>;
export type NutritionRegistrationResult = z.infer<typeof registrationSchema>;
export type NutritionMealLog = z.infer<typeof mealLogSchema>;

export interface NutritionCatalogCard {
  id: string;
  name: string;
  description: string | null;
  defaultFoodId: string;
  defaultFoodName: string;
  foodKind: string;
  variantCount: number;
  categoryName: string | null;
  brandName: string | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  defaultServingId: string | null;
  defaultServingLabel: string | null;
  defaultServingQuantity: number | null;
  defaultServingGrams: number | null;
  defaultServingMilliliters: number | null;
  verificationStatus: string;
  isCommon: boolean;
}

export interface NutritionCatalogPage {
  items: NutritionCatalogCard[];
  total: number;
  offset: number;
  nextOffset: number | null;
}

export interface NutritionSelectionTotals {
  quantity: number;
  grams: number;
  milliliters: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodiumMg: number | null;
}

type RpcError = { message: string; code?: string; details?: string | null };
type RpcResult<T> = PromiseLike<{ data: T | null; error: RpcError | null }>;

interface NutritionRpcClient {
  rpc(
    name: "search_nutrition_catalog",
    args: NutritionRpcDefinitions["search_nutrition_catalog"]["Args"],
  ): RpcResult<NutritionRpcDefinitions["search_nutrition_catalog"]["Returns"]>;
  rpc(
    name: "get_nutrition_catalog_group",
    args: NutritionRpcDefinitions["get_nutrition_catalog_group"]["Args"],
  ): RpcResult<NutritionRpcDefinitions["get_nutrition_catalog_group"]["Returns"]>;
  rpc(
    name: "register_nutrition_food_meal",
    args: NutritionRpcDefinitions["register_nutrition_food_meal"]["Args"],
  ): RpcResult<NutritionRpcDefinitions["register_nutrition_food_meal"]["Returns"]>;
  rpc(
    name: "get_nutrition_meal_log",
    args: NutritionRpcDefinitions["get_nutrition_meal_log"]["Args"],
  ): RpcResult<NutritionRpcDefinitions["get_nutrition_meal_log"]["Returns"]>;
}

const nutritionRpc = supabase as unknown as NutritionRpcClient;

export class NutritionCatalogError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "NutritionCatalogError";
  }
}

function throwRpcError(error: RpcError): never {
  const knownMessages: Record<string, string> = {
    not_authenticated: "Tu sesion expiro. Inicia sesion nuevamente.",
    invalid_quantity: "La cantidad seleccionada no es valida.",
    invalid_catalog_selection: "La variante o porcion ya no esta disponible.",
    serving_without_gram_equivalence: "Esta porcion no tiene una equivalencia verificable para calcular nutrientes.",
    food_missing_core_nutrients: "Este alimento no tiene suficientes datos nutricionales para registrarse.",
  };
  const matched = Object.keys(knownMessages).find((code) => error.message.includes(code));
  throw new NutritionCatalogError(
    matched ? knownMessages[matched] : "No se pudo completar la operacion nutricional.",
    matched || error.code,
  );
}

function mapCard(row: NutritionCatalogSearchRow): NutritionCatalogCard {
  return {
    id: row.canonical_group_id,
    name: row.canonical_name,
    description: row.group_description,
    defaultFoodId: row.default_food_id,
    defaultFoodName: row.default_food_name,
    foodKind: row.food_kind,
    variantCount: Number(row.variant_count),
    categoryName: row.category_name,
    brandName: row.brand_name,
    caloriesPer100g: row.calories_per_100g,
    proteinPer100g: row.protein_per_100g,
    carbsPer100g: row.carbs_per_100g,
    fatPer100g: row.fat_per_100g,
    defaultServingId: row.default_serving_id,
    defaultServingLabel: row.default_serving_label,
    defaultServingQuantity: row.default_serving_quantity,
    defaultServingGrams: row.default_serving_grams,
    defaultServingMilliliters: row.default_serving_milliliters,
    verificationStatus: row.verification_status,
    isCommon: row.is_common,
  };
}

export async function searchNutritionCatalog(input: {
  query?: string;
  offset?: number;
  pageSize?: number;
} = {}): Promise<NutritionCatalogPage> {
  const offset = Math.max(0, input.offset || 0);
  const pageSize = Math.min(50, Math.max(1, input.pageSize || 24));
  const { data, error } = await nutritionRpc.rpc("search_nutrition_catalog", {
    _query: input.query?.trim() || null,
    _limit: pageSize,
    _offset: offset,
  });

  if (error) throwRpcError(error);

  const rows = data || [];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(mapCard);
  const loadedThrough = offset + items.length;

  return {
    items,
    total,
    offset,
    nextOffset: loadedThrough < total ? loadedThrough : null,
  };
}

export async function getNutritionCatalogGroup(groupId: string): Promise<NutritionCatalogGroupDetail> {
  const { data, error } = await nutritionRpc.rpc("get_nutrition_catalog_group", {
    _canonical_group_id: groupId,
  });
  if (error) throwRpcError(error);
  if (!data) throw new NutritionCatalogError("El alimento seleccionado ya no esta disponible.", "group_not_found");

  const parsed = groupDetailSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid nutrition group payload", parsed.error.flatten());
    throw new NutritionCatalogError("El catalogo devolvio datos incompletos.", "invalid_group_payload");
  }
  return parsed.data;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function nutrientAmount(variant: NutritionFoodVariant, code: string): number | null {
  return variant.nutrients[code]?.amountPer100g ?? null;
}

export function calculateNutritionSelection(
  variant: NutritionFoodVariant,
  serving: NutritionServing,
  quantity: number,
): NutritionSelectionTotals {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) {
    throw new NutritionCatalogError("La cantidad debe ser mayor a cero y menor o igual a 1000.", "invalid_quantity");
  }

  const gramsPerServing = serving.grams
    ?? (serving.unit.gramsMultiplier ? serving.quantity * serving.unit.gramsMultiplier : null);
  if (!gramsPerServing || gramsPerServing <= 0) {
    throw new NutritionCatalogError(
      "Esta porcion no tiene una equivalencia verificable para calcular nutrientes.",
      "serving_without_gram_equivalence",
    );
  }

  const energy = nutrientAmount(variant, "energy_kcal");
  const protein = nutrientAmount(variant, "protein_g");
  const carbs = nutrientAmount(variant, "carbs_g");
  const fat = nutrientAmount(variant, "fat_g");
  if (energy === null || protein === null || carbs === null || fat === null) {
    throw new NutritionCatalogError(
      "Este alimento no tiene suficientes datos nutricionales para calcularse.",
      "food_missing_core_nutrients",
    );
  }

  const grams = gramsPerServing * quantity;
  const multiplier = grams / 100;
  const optional = (code: string) => {
    const value = nutrientAmount(variant, code);
    return value === null ? null : round(value * multiplier);
  };

  const millilitersPerServing = serving.milliliters
    ?? (serving.unit.millilitersMultiplier
      ? serving.quantity * serving.unit.millilitersMultiplier
      : null);

  return {
    quantity,
    grams: round(grams),
    milliliters: millilitersPerServing === null ? null : round(millilitersPerServing * quantity),
    calories: round(energy * multiplier),
    protein: round(protein * multiplier),
    carbs: round(carbs * multiplier),
    fat: round(fat * multiplier),
    fiber: optional("fiber_g"),
    sugar: optional("sugar_g"),
    sodiumMg: optional("sodium_mg"),
  };
}

export function getNutritionQuantityWarning(quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return "La cantidad debe ser mayor a cero.";
  if (quantity > 1000) return "La cantidad supera el limite permitido.";
  if (quantity > 20) return "La cantidad parece muy alta; confirma que elegiste la porcion correcta.";
  return null;
}

export async function registerNutritionFoodSelection(input: {
  canonicalGroupId: string;
  foodId: string;
  servingId: string;
  quantity: number;
  mealType: NutritionMealType;
  loggedDate: string;
  clientRequestId: string;
}): Promise<NutritionRegistrationResult> {
  const { data, error } = await nutritionRpc.rpc("register_nutrition_food_meal", {
    _canonical_group_id: input.canonicalGroupId,
    _food_id: input.foodId,
    _serving_id: input.servingId,
    _quantity: input.quantity,
    _meal_type: input.mealType,
    _logged_date: input.loggedDate,
    _client_request_id: input.clientRequestId,
  });
  if (error) throwRpcError(error);

  const parsed = registrationSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid nutrition registration payload", parsed.error.flatten());
    throw new NutritionCatalogError("La comida se guardo con una respuesta incompleta.", "invalid_registration_payload");
  }
  return parsed.data;
}

export async function getNutritionMealLog(mealLogId: string): Promise<NutritionMealLog> {
  const { data, error } = await nutritionRpc.rpc("get_nutrition_meal_log", {
    _nutrition_meal_log_id: mealLogId,
  });
  if (error) throwRpcError(error);
  if (!data) throw new NutritionCatalogError("No se encontro el registro nutricional.", "meal_log_not_found");

  const parsed = mealLogSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Invalid nutrition meal payload", parsed.error.flatten());
    throw new NutritionCatalogError("El registro nutricional esta incompleto.", "invalid_meal_payload");
  }
  return parsed.data;
}
