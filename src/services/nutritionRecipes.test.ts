import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

import {
  NutritionRecipeError,
  archiveNutritionRecipe,
  calculateRecipeDraftTotals,
  duplicateNutritionRecipe,
  registerNutritionRecipe,
  saveNutritionRecipe,
  searchNutritionRecipes,
  type RecipeDraftIngredient,
} from "./nutritionRecipes";

const UUIDS = {
  recipe: "00000000-0000-4000-8000-000000000001",
  version: "00000000-0000-4000-8000-000000000002",
  group: "00000000-0000-4000-8000-000000000003",
  food: "00000000-0000-4000-8000-000000000004",
  serving: "00000000-0000-4000-8000-000000000005",
  request: "00000000-0000-4000-8000-000000000006",
  meal: "00000000-0000-4000-8000-000000000007",
};

function ingredient(overrides: Partial<RecipeDraftIngredient> = {}): RecipeDraftIngredient {
  return {
    canonicalGroupId: UUIDS.group,
    foodId: UUIDS.food,
    servingId: UUIDS.serving,
    foodName: "Avena cocida",
    servingLabel: "100 g",
    quantity: 1,
    gramsPerUnit: 100,
    nutrientsPerUnit: {
      energy_kcal: 150,
      protein_g: 10,
      carbs_g: 20,
      fat_g: 5,
      fiber_g: 3,
    },
    ...overrides,
  };
}

describe("calculateRecipeDraftTotals", () => {
  it("suma ingredientes y calcula valores por porcion", () => {
    const totals = calculateRecipeDraftTotals([
      ingredient({ quantity: 2 }),
      ingredient({ quantity: 0.5, gramsPerUnit: 200 }),
    ], 2);

    expect(totals.totalWeightGrams).toBe(300);
    expect(totals.total.energy_kcal).toBe(375);
    expect(totals.perServing.energy_kcal).toBe(187.5);
    expect(totals.perServing.protein_g).toBe(12.5);
    expect(totals.calculationComplete).toBe(true);
  });

  it("usa exclusivamente el peso final indicado para calcular por 100 g", () => {
    const totals = calculateRecipeDraftTotals([ingredient({ quantity: 2 })], 4, 250);
    expect(totals.totalWeightGrams).toBe(200);
    expect(totals.per100g?.energy_kcal).toBe(120);
  });

  it("no inventa valores ausentes ni los convierte en cero", () => {
    const incomplete = ingredient({
      nutrientsPerUnit: { energy_kcal: 100, protein_g: 5, fat_g: 2 },
    });
    const totals = calculateRecipeDraftTotals([incomplete], 1);
    expect(totals.total.carbs_g).toBeUndefined();
    expect(totals.missingNutrientCodes).toEqual(["carbs_g"]);
    expect(totals.calculationComplete).toBe(false);
  });

  it.each([0, -1, Number.NaN, 1001])("rechaza porciones invalidas: %s", (servings) => {
    expect(() => calculateRecipeDraftTotals([ingredient()], servings)).toThrow(NutritionRecipeError);
  });

  it.each([0, -1, Number.NaN, 1001])("rechaza cantidades invalidas: %s", (quantity) => {
    expect(() => calculateRecipeDraftTotals([ingredient({ quantity })], 1)).toThrow(NutritionRecipeError);
  });
});

describe("nutrition recipe RPC service", () => {
  beforeEach(() => rpcMock.mockReset());

  it("pagina y envia la busqueda completa al servidor", async () => {
    rpcMock.mockResolvedValue({
      data: [{
        recipe_id: UUIDS.recipe,
        name: "Avena con platano",
        description: null,
        origin: "user",
        category: "Desayuno",
        difficulty: "facil",
        meal_types: ["desayuno"],
        visibility: "private",
        is_owner: true,
        current_version_id: UUIDS.version,
        version_number: 2,
        servings: 4,
        yield_quantity: 4,
        yield_unit: "porciones",
        prep_time_minutes: 5,
        cook_time_minutes: 10,
        total_time_minutes: 15,
        ingredient_count: 3,
        calculation_complete: false,
        missing_nutrient_codes: ["carbs_g"],
        calories_per_serving: 220,
        protein_per_serving: 12,
        carbs_per_serving: null,
        fat_per_serving: 6,
        total_count: 21,
      }],
      error: null,
    });

    const page = await searchNutritionRecipes({ query: "  plátano  ", offset: 20, pageSize: 20 });
    expect(page.total).toBe(21);
    expect(page.nextOffset).toBeNull();
    expect(page.items[0].carbs_per_serving).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith("search_nutrition_recipes", {
      _query: "plátano",
      _limit: 20,
      _offset: 20,
    });
  });

  it("guarda solo selecciones verificables y no envia macros del cliente", async () => {
    rpcMock.mockResolvedValue({
      data: { recipeId: UUIDS.recipe, recipeVersionId: UUIDS.version, versionNumber: 1, deduplicated: false },
      error: null,
    });

    await saveNutritionRecipe({
      name: "Avena con platano",
      visibility: "private",
      servings: 2,
      tags: [" desayuno "],
      mealTypes: ["desayuno"],
      ingredients: [ingredient()],
      steps: ["Mezcla los ingredientes."],
      clientRequestId: UUIDS.request,
    });

    const payload = rpcMock.mock.calls[0][1]._payload;
    expect(payload.ingredients).toEqual([{
      canonicalGroupId: UUIDS.group,
      foodId: UUIDS.food,
      servingId: UUIDS.serving,
      quantity: 1,
    }]);
    expect(JSON.stringify(payload)).not.toContain("nutrientsPerUnit");
    expect(JSON.stringify(payload)).not.toContain("gramsPerUnit");
  });

  it("registra porciones decimales contra una version exacta", async () => {
    rpcMock.mockResolvedValue({
      data: {
        nutritionMealLogId: UUIDS.meal,
        legacyMealId: UUIDS.meal,
        recipeId: UUIDS.recipe,
        recipeVersionId: UUIDS.version,
        servings: 0.5,
        deduplicated: false,
      },
      error: null,
    });

    await registerNutritionRecipe({
      recipeId: UUIDS.recipe,
      recipeVersionId: UUIDS.version,
      servings: 0.5,
      mealType: "comida",
      loggedDate: "2026-08-03",
      clientRequestId: UUIDS.request,
    });

    expect(rpcMock).toHaveBeenCalledWith("register_nutrition_recipe_meal", expect.objectContaining({
      _recipe_id: UUIDS.recipe,
      _recipe_version_id: UUIDS.version,
      _servings: 0.5,
      _client_request_id: UUIDS.request,
    }));
  });

  it("mantiene idempotencia al duplicar", async () => {
    rpcMock.mockResolvedValue({
      data: { recipeId: UUIDS.recipe, recipeVersionId: UUIDS.version, versionNumber: 1, deduplicated: true },
      error: null,
    });
    const result = await duplicateNutritionRecipe({ recipeId: UUIDS.recipe, clientRequestId: UUIDS.request });
    expect(result.deduplicated).toBe(true);
  });

  it("archiva mediante la operacion centralizada", async () => {
    rpcMock.mockResolvedValue({ data: undefined, error: null });
    await archiveNutritionRecipe(UUIDS.recipe);
    expect(rpcMock).toHaveBeenCalledWith("archive_nutrition_recipe", { _recipe_id: UUIDS.recipe });
  });

  it("no expone errores internos de base de datos", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "internal SQL detail", code: "XX000" } });
    await expect(searchNutritionRecipes()).rejects.toThrow("No se pudo completar la operacion con la receta");
  });
});
