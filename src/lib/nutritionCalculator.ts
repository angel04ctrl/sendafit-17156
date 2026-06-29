export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodiumMg?: number;
}

export interface FoodNutritionSource {
  id?: string | number;
  name?: string;
  nombre?: string;
  servingSize?: number | null;
  servingUnit?: string | null;
  gramsPerServing?: number | null;
  caloriesPer100g?: number | null;
  proteinPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
  fiberPer100g?: number | null;
  sugarPer100g?: number | null;
  sodiumMgPer100g?: number | null;
  racion?: number | null;
  unidad?: string | null;
  calorias?: number | null;
  proteinas?: number | null;
  carbohidratos?: number | null;
  grasas?: number | null;
  calories_per_100g?: number | null;
  protein_per_100g?: number | null;
  carbs_per_100g?: number | null;
  fat_per_100g?: number | null;
  fiber_per_100g?: number | null;
  sugar_per_100g?: number | null;
  sodium_mg_per_100g?: number | null;
  grams_per_serving?: number | null;
  serving_size?: number | null;
  serving_unit?: string | null;
}

export interface NutritionIngredientInput {
  id?: string;
  name: string;
  food?: FoodNutritionSource | null;
  grams?: number;
  servings?: number;
  unit?: string;
  source?: string;
  isVerified?: boolean;
  estimatedMacros?: MacroTotals;
}

export interface CalculatedIngredient {
  id?: string;
  name: string;
  grams: number;
  servings: number;
  unit: string;
  source: string;
  isVerified: boolean;
  macros: MacroTotals;
  warnings: string[];
}

export const emptyMacroTotals: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundMacro(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

function readMacroPer100g(food: FoodNutritionSource, camelKey: keyof FoodNutritionSource, snakeKey: keyof FoodNutritionSource, legacyKey: keyof FoodNutritionSource): number {
  const direct = toFiniteNumber(food[camelKey] ?? food[snakeKey], Number.NaN);
  if (Number.isFinite(direct)) return direct;

  const legacyValue = toFiniteNumber(food[legacyKey], Number.NaN);
  const ration = toFiniteNumber(food.racion, 0);
  const unit = String(food.unidad || "").toLowerCase();

  if (Number.isFinite(legacyValue) && ration > 0 && ["g", "gr", "gramo", "gramos"].includes(unit)) {
    return (legacyValue / ration) * 100;
  }

  return Number.isFinite(legacyValue) ? legacyValue : 0;
}

export function normalizeFoodNutrition(food: FoodNutritionSource) {
  const gramsPerServing = toFiniteNumber(
    food.gramsPerServing ?? food.grams_per_serving ?? food.servingSize ?? food.serving_size ?? food.racion,
    100,
  );

  return {
    id: food.id,
    name: String(food.name || food.nombre || "Alimento").trim(),
    servingSize: toFiniteNumber(food.servingSize ?? food.serving_size ?? food.racion, 1),
    servingUnit: String(food.servingUnit || food.serving_unit || food.unidad || "g"),
    gramsPerServing: gramsPerServing > 0 ? gramsPerServing : 100,
    caloriesPer100g: readMacroPer100g(food, "caloriesPer100g", "calories_per_100g", "calorias"),
    proteinPer100g: readMacroPer100g(food, "proteinPer100g", "protein_per_100g", "proteinas"),
    carbsPer100g: readMacroPer100g(food, "carbsPer100g", "carbs_per_100g", "carbohidratos"),
    fatPer100g: readMacroPer100g(food, "fatPer100g", "fat_per_100g", "grasas"),
    fiberPer100g: toFiniteNumber(food.fiberPer100g ?? food.fiber_per_100g, 0),
    sugarPer100g: toFiniteNumber(food.sugarPer100g ?? food.sugar_per_100g, 0),
    sodiumMgPer100g: toFiniteNumber(food.sodiumMgPer100g ?? food.sodium_mg_per_100g, 0),
  };
}

export function calculateMacrosByGrams(food: FoodNutritionSource, grams: number): MacroTotals {
  const normalized = normalizeFoodNutrition(food);
  const multiplier = grams / 100;

  return {
    calories: roundMacro(normalized.caloriesPer100g * multiplier),
    protein: roundMacro(normalized.proteinPer100g * multiplier),
    carbs: roundMacro(normalized.carbsPer100g * multiplier),
    fat: roundMacro(normalized.fatPer100g * multiplier),
    fiber: roundMacro(normalized.fiberPer100g * multiplier),
    sugar: roundMacro(normalized.sugarPer100g * multiplier),
    sodiumMg: roundMacro(normalized.sodiumMgPer100g * multiplier),
  };
}

export function calculateMacrosByServings(food: FoodNutritionSource, servings: number): MacroTotals {
  const normalized = normalizeFoodNutrition(food);
  return calculateMacrosByGrams(food, normalized.gramsPerServing * servings);
}

export function validateIngredientQuantity(grams: number, servings = 1): string[] {
  const warnings: string[] = [];

  if (!Number.isFinite(grams) || grams <= 0) warnings.push("Los gramos deben ser mayores a cero.");
  if (!Number.isFinite(servings) || servings <= 0) warnings.push("Las porciones deben ser mayores a cero.");
  if (grams > 2000) warnings.push("La cantidad en gramos parece muy alta para una sola comida.");
  if (servings > 20) warnings.push("La cantidad de porciones parece muy alta.");

  return warnings;
}

export function calculateIngredient(input: NutritionIngredientInput): CalculatedIngredient {
  const servings = toFiniteNumber(input.servings, 1);
  const normalizedFood = input.food ? normalizeFoodNutrition(input.food) : null;
  const grams = toFiniteNumber(input.grams, normalizedFood ? normalizedFood.gramsPerServing * servings : 0);
  const warnings = validateIngredientQuantity(grams, servings);
  const macros = normalizedFood
    ? calculateMacrosByGrams(input.food!, grams)
    : {
      calories: roundMacro(toFiniteNumber(input.estimatedMacros?.calories, 0)),
      protein: roundMacro(toFiniteNumber(input.estimatedMacros?.protein, 0)),
      carbs: roundMacro(toFiniteNumber(input.estimatedMacros?.carbs, 0)),
      fat: roundMacro(toFiniteNumber(input.estimatedMacros?.fat, 0)),
      fiber: roundMacro(toFiniteNumber(input.estimatedMacros?.fiber, 0)),
      sugar: roundMacro(toFiniteNumber(input.estimatedMacros?.sugar, 0)),
      sodiumMg: roundMacro(toFiniteNumber(input.estimatedMacros?.sodiumMg, 0)),
    };

  return {
    id: input.id,
    name: input.name.trim() || normalizedFood?.name || "Ingrediente",
    grams,
    servings,
    unit: input.unit || "g",
    source: input.source || (normalizedFood ? "food_database" : "ai_estimated"),
    isVerified: Boolean(input.isVerified ?? normalizedFood),
    macros,
    warnings,
  };
}

export function sumMacroTotals(items: Array<MacroTotals | undefined>): MacroTotals {
  const total = items.reduce(
    (acc, item) => ({
      calories: acc.calories + toFiniteNumber(item?.calories, 0),
      protein: acc.protein + toFiniteNumber(item?.protein, 0),
      carbs: acc.carbs + toFiniteNumber(item?.carbs, 0),
      fat: acc.fat + toFiniteNumber(item?.fat, 0),
      fiber: acc.fiber + toFiniteNumber(item?.fiber, 0),
      sugar: acc.sugar + toFiniteNumber(item?.sugar, 0),
      sodiumMg: acc.sodiumMg + toFiniteNumber(item?.sodiumMg, 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodiumMg: 0 },
  );

  return {
    calories: Math.round(total.calories),
    protein: roundMacro(total.protein),
    carbs: roundMacro(total.carbs),
    fat: roundMacro(total.fat),
    fiber: roundMacro(total.fiber),
    sugar: roundMacro(total.sugar),
    sodiumMg: roundMacro(total.sodiumMg),
  };
}
