import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

import {
  NutritionCatalogError,
  calculateNutritionSelection,
  getNutritionCatalogGroup,
  getNutritionQuantityWarning,
  registerNutritionFoodSelection,
  searchNutritionCatalog,
  type NutritionFoodVariant,
  type NutritionServing,
} from "./nutritionCatalog";

const UUIDS = {
  group: "00000000-0000-4000-8000-000000000001",
  food: "00000000-0000-4000-8000-000000000002",
  serving: "00000000-0000-4000-8000-000000000003",
  unit: "00000000-0000-4000-8000-000000000004",
  request: "00000000-0000-4000-8000-000000000005",
  meal: "00000000-0000-4000-8000-000000000006",
  ingredient: "00000000-0000-4000-8000-000000000007",
};

function serving(overrides: Partial<NutritionServing> = {}): NutritionServing {
  return {
    id: UUIDS.serving,
    label: "100 g",
    quantity: 100,
    grams: 100,
    milliliters: null,
    isDefault: true,
    verificationStatus: "verified",
    isCalculable: true,
    unit: {
      id: UUIDS.unit,
      code: "g",
      name: "gramo",
      dimension: "mass",
      gramsMultiplier: 1,
      millilitersMultiplier: null,
    },
    ...overrides,
  };
}

function variant(overrides: Partial<NutritionFoodVariant> = {}): NutritionFoodVariant {
  return {
    id: UUIDS.food,
    displayName: "Huevo hervido",
    canonicalName: "Huevo hervido",
    description: "Huevo entero hervido.",
    foodKind: "prepared_variant",
    verificationStatus: "verified",
    isVerified: true,
    isDefault: true,
    variantType: "prepared_variant",
    physicalState: { code: "solid", name: "Sólido" },
    preparationMethod: { code: "boiled", name: "Hervido" },
    brandName: null,
    categories: [],
    servings: [serving()],
    nutrients: {
      energy_kcal: { name: "Energía", unit: "kcal", amountPer100g: 150, verificationStatus: "verified" },
      protein_g: { name: "Proteína", unit: "g", amountPer100g: 12, verificationStatus: "verified" },
      carbs_g: { name: "Carbohidratos", unit: "g", amountPer100g: 2, verificationStatus: "verified" },
      fat_g: { name: "Grasas", unit: "g", amountPer100g: 10, verificationStatus: "verified" },
      fiber_g: { name: "Fibra", unit: "g", amountPer100g: 0, verificationStatus: "verified" },
      sodium_mg: { name: "Sodio", unit: "mg", amountPer100g: 120, verificationStatus: "verified" },
    },
    ...overrides,
  };
}

describe("calculateNutritionSelection", () => {
  it("calcula nutrientes para una porción de 100 g", () => {
    expect(calculateNutritionSelection(variant(), serving(), 1)).toMatchObject({
      grams: 100,
      calories: 150,
      protein: 12,
      carbs: 2,
      fat: 10,
    });
  });

  it("acepta cantidades decimales", () => {
    const result = calculateNutritionSelection(variant(), serving({ grams: 40, quantity: 1 }), 2.5);
    expect(result.grams).toBe(100);
    expect(result.calories).toBe(150);
  });

  it("usa el multiplicador en gramos almacenado cuando la porción no trae gramos", () => {
    const result = calculateNutritionSelection(variant(), serving({ grams: null, quantity: 30 }), 2);
    expect(result.grams).toBe(60);
    expect(result.protein).toBe(7.2);
  });

  it("conserva la equivalencia explícita en mililitros", () => {
    const result = calculateNutritionSelection(variant(), serving({ milliliters: 250 }), 2);
    expect(result.milliliters).toBe(500);
  });

  it("usa el multiplicador de mililitros almacenado", () => {
    const liquidServing = serving({
      quantity: 250,
      milliliters: null,
      unit: { ...serving().unit, code: "ml", dimension: "volume", millilitersMultiplier: 1 },
    });
    expect(calculateNutritionSelection(variant(), liquidServing, 0.5).milliliters).toBe(125);
  });

  it("mantiene null para nutrientes no reportados", () => {
    const result = calculateNutritionSelection(variant(), serving(), 1);
    expect(result.sugar).toBeNull();
    expect(result.fiber).toBe(0);
  });

  it("calcula micronutrientes opcionales cuando existen", () => {
    expect(calculateNutritionSelection(variant(), serving({ grams: 50 }), 1).sodiumMg).toBe(60);
  });

  it.each([0, -1, Number.NaN, 1001])("rechaza una cantidad inválida: %s", (quantity) => {
    expect(() => calculateNutritionSelection(variant(), serving(), quantity)).toThrow(NutritionCatalogError);
  });

  it("rechaza porciones sin equivalencia de masa registrada", () => {
    const invalid = serving({
      grams: null,
      unit: { ...serving().unit, gramsMultiplier: null },
    });
    expect(() => calculateNutritionSelection(variant(), invalid, 1)).toThrow("equivalencia verificable");
  });

  it("rechaza alimentos sin los cuatro nutrientes principales", () => {
    const incomplete = variant({ nutrients: { ...variant().nutrients, protein_g: undefined! } });
    expect(() => calculateNutritionSelection(incomplete, serving(), 1)).toThrow("suficientes datos nutricionales");
  });
});

describe("quantity warnings", () => {
  it("advierte sobre cantidades altas sin bloquearlas", () => {
    expect(getNutritionQuantityWarning(21)).toContain("muy alta");
  });

  it("bloquea cantidades fuera del límite", () => {
    expect(getNutritionQuantityWarning(1001)).toContain("limite");
    expect(getNutritionQuantityWarning(0)).toContain("mayor a cero");
  });
});

describe("nutrition catalog RPC service", () => {
  beforeEach(() => rpcMock.mockReset());

  it("pagina el catálogo completo sin limitarlo a nueve elementos", async () => {
    const rows = Array.from({ length: 24 }, (_, index) => ({
      canonical_group_id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
      canonical_name: `Alimento ${index + 1}`,
      group_description: null,
      default_food_id: UUIDS.food,
      default_food_name: `Alimento ${index + 1}`,
      food_kind: "ingredient",
      variant_count: 1,
      category_name: "General",
      brand_name: null,
      calories_per_100g: 100,
      protein_per_100g: 1,
      carbs_per_100g: 2,
      fat_per_100g: 3,
      default_serving_id: UUIDS.serving,
      default_serving_label: "100 g",
      default_serving_quantity: 100,
      default_serving_grams: 100,
      default_serving_milliliters: null,
      verification_status: "verified",
      is_common: false,
      total_count: 235,
    }));
    rpcMock.mockResolvedValue({ data: rows, error: null });

    const page = await searchNutritionCatalog({ pageSize: 24 });
    expect(page.items).toHaveLength(24);
    expect(page.total).toBe(235);
    expect(page.nextOffset).toBe(24);
  });

  it("envía la búsqueda al servidor sobre el catálogo completo", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await searchNutritionCatalog({ query: "  salmón  ", offset: 48 });
    expect(rpcMock).toHaveBeenCalledWith("search_nutrition_catalog", {
      _query: "salmón",
      _limit: 24,
      _offset: 48,
    });
  });

  it("valida el contrato de variantes antes de entregarlo a la UI", async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: UUIDS.group,
        canonicalName: "Huevo",
        description: null,
        defaultFoodId: UUIDS.food,
        status: "active",
        variants: [variant()],
      },
      error: null,
    });
    const result = await getNutritionCatalogGroup(UUIDS.group);
    expect(result.variants[0].preparationMethod?.name).toBe("Hervido");
  });

  it("registra IDs concretos y una clave idempotente", async () => {
    rpcMock.mockResolvedValue({
      data: {
        nutritionMealLogId: UUIDS.meal,
        nutritionMealLogItemId: UUIDS.ingredient,
        legacyMealId: UUIDS.meal,
        canonicalGroupId: UUIDS.group,
        foodId: UUIDS.food,
        servingId: UUIDS.serving,
        quantity: 1.5,
        consumedGrams: 150,
        consumedMilliliters: null,
        deduplicated: false,
      },
      error: null,
    });

    const result = await registerNutritionFoodSelection({
      canonicalGroupId: UUIDS.group,
      foodId: UUIDS.food,
      servingId: UUIDS.serving,
      quantity: 1.5,
      mealType: "comida",
      loggedDate: "2026-08-03",
      clientRequestId: UUIDS.request,
    });

    expect(result.foodId).toBe(UUIDS.food);
    expect(rpcMock).toHaveBeenCalledWith("register_nutrition_food_meal", expect.objectContaining({
      _food_id: UUIDS.food,
      _serving_id: UUIDS.serving,
      _client_request_id: UUIDS.request,
    }));
  });

  it("no expone errores técnicos de Supabase al usuario", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "database exploded", code: "XX000" } });
    await expect(searchNutritionCatalog()).rejects.toThrow("No se pudo completar la operacion nutricional");
  });
});
