export type MealType = "desayuno" | "colacion_am" | "comida" | "colacion_pm" | "cena";

export interface MealInput {
  name: string;
  meal_type: string;
  calories: string | number;
  protein: string | number;
  carbs: string | number;
  fat: string | number;
  date: string;
}

export interface CalculatedMealInput extends MealInput {
  ingredientCount?: number;
  hasCalculatedMacros?: boolean;
}

export interface NormalizedMealInput {
  name: string;
  meal_type: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
}

const validMealTypes: MealType[] = ["desayuno", "colacion_am", "comida", "colacion_pm", "cena"];

export function parseMealNumber(value: string | number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : Number.NaN;
}

export function calculateCaloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export function validateMealInput(input: MealInput): {
  meal?: NormalizedMealInput;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = String(input.name || "").trim();
  const calories = parseMealNumber(input.calories);
  const protein = parseMealNumber(input.protein || 0);
  const carbs = parseMealNumber(input.carbs || 0);
  const fat = parseMealNumber(input.fat || 0);
  const date = String(input.date || "").trim();
  const mealType = String(input.meal_type || "") as MealType;

  if (!name) errors.push("La comida necesita un nombre.");
  if (!validMealTypes.includes(mealType)) errors.push("Selecciona un tipo de comida valido.");
  if (!date) errors.push("Selecciona una fecha.");

  const numericFields = [
    ["calorías", calories],
    ["proteína", protein],
    ["carbohidratos", carbs],
    ["grasas", fat],
  ] as const;

  numericFields.forEach(([label, value]) => {
    if (!Number.isFinite(value)) errors.push(`El valor de ${label} no es valido.`);
    if (Number.isFinite(value) && value < 0) errors.push(`El valor de ${label} no puede ser negativo.`);
  });

  if (Number.isFinite(calories) && calories <= 0) errors.push("Las calorías deben ser mayores a cero.");
  if (Number.isFinite(calories) && calories > 5000) errors.push("Las calorías parecen imposibles para una sola comida.");
  if (protein === 0 && carbs === 0 && fat === 0) errors.push("Agrega al menos un macro: proteína, carbohidratos o grasa.");

  if (protein > 180) warnings.push("La proteína parece muy alta para una sola comida.");
  if (carbs > 300) warnings.push("Los carbohidratos parecen muy altos para una sola comida.");
  if (fat > 160) warnings.push("La grasa parece muy alta para una sola comida.");

  if (Number.isFinite(calories) && protein + carbs + fat > 0) {
    const macroCalories = calculateCaloriesFromMacros(protein, carbs, fat);
    const difference = Math.abs(calories - macroCalories);
    const tolerance = Math.max(80, calories * 0.25);
    if (difference > tolerance) {
      warnings.push("Las calorías no coinciden bien con los macros aproximados.");
    }
  }

  if (errors.length > 0) return { errors, warnings };

  return {
    meal: {
      name,
      meal_type: mealType,
      calories,
      protein,
      carbs,
      fat,
      date,
    },
    errors,
    warnings,
  };
}

export function validateCalculatedMealInput(input: CalculatedMealInput): {
  meal?: NormalizedMealInput;
  errors: string[];
  warnings: string[];
} {
  const result = validateMealInput(input);
  const errors = [...result.errors];
  const warnings = [...result.warnings];

  if (!input.ingredientCount || input.ingredientCount <= 0) {
    errors.push("Agrega al menos un ingrediente calculable.");
  }

  if (input.hasCalculatedMacros === false) {
    errors.push("No se pudieron calcular macros confiables para esta comida.");
  }

  if (result.meal && result.meal.calories < 0) errors.push("Las calorías calculadas no pueden ser negativas.");
  if (result.meal && (result.meal.protein < 0 || result.meal.carbs < 0 || result.meal.fat < 0)) {
    errors.push("Los macros calculados no pueden ser negativos.");
  }

  if (errors.length > 0) return { errors, warnings };
  return { meal: result.meal, errors, warnings };
}
