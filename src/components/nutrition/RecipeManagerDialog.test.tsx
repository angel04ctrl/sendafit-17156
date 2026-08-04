import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useRecipes: vi.fn(),
  useRecipe: vi.fn(),
  save: vi.fn(),
  duplicate: vi.fn(),
  archive: vi.fn(),
  register: vi.fn(),
}));

vi.mock("@/hooks/useNutritionRecipes", () => ({
  useNutritionRecipes: mocks.useRecipes,
  useNutritionRecipe: mocks.useRecipe,
  useSaveNutritionRecipe: () => ({ mutateAsync: mocks.save, isPending: false }),
  useDuplicateNutritionRecipe: () => ({ mutateAsync: mocks.duplicate, isPending: false }),
  useArchiveNutritionRecipe: () => ({ mutateAsync: mocks.archive, isPending: false }),
  useRegisterNutritionRecipe: () => ({ mutateAsync: mocks.register, isPending: false }),
}));

vi.mock("@/components/nutrition/NutritionIngredientPicker", () => ({
  NutritionIngredientPicker: ({ onAdd }: { onAdd: (value: unknown) => void }) => (
    <button type="button" onClick={() => onAdd({
      canonicalGroupId: "00000000-0000-4000-8000-000000000003",
      foodId: "00000000-0000-4000-8000-000000000004",
      servingId: "00000000-0000-4000-8000-000000000005",
      foodName: "Avena cocida",
      servingLabel: "100 g",
      quantity: 1,
      gramsPerUnit: 100,
      nutrientsPerUnit: { energy_kcal: 150, protein_g: 10, carbs_g: 20, fat_g: 5 },
    })}>Agregar avena de prueba</button>
  ),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { RecipeManagerDialog } from "./RecipeManagerDialog";

function recipeSummary() {
  return {
    recipe_id: "00000000-0000-4000-8000-000000000001",
    name: "Avena con platano",
    description: "Desayuno simple",
    origin: "user",
    category: "Desayuno",
    difficulty: "facil",
    meal_types: ["desayuno"],
    visibility: "private",
    is_owner: true,
    current_version_id: "00000000-0000-4000-8000-000000000002",
    version_number: 1,
    servings: 2,
    yield_quantity: 2,
    yield_unit: "porciones",
    prep_time_minutes: 5,
    cook_time_minutes: 0,
    total_time_minutes: 5,
    ingredient_count: 2,
    calculation_complete: true,
    missing_nutrient_codes: [],
    calories_per_serving: 220,
    protein_per_serving: 12,
    carbs_per_serving: 30,
    fat_per_serving: 6,
    total_count: 1,
  };
}

function renderManager() {
  return render(
    <RecipeManagerDialog
      open
      onOpenChange={vi.fn()}
      mealType="comida"
      loggedDate="2026-08-03"
      onRegistered={vi.fn()}
    />,
  );
}

describe("RecipeManagerDialog", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.useRecipes.mockReturnValue({
      data: { pages: [{ items: [recipeSummary()], total: 1, offset: 0, nextOffset: null }] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });
    mocks.useRecipe.mockReturnValue({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() });
    mocks.save.mockResolvedValue({
      recipeId: "00000000-0000-4000-8000-000000000001",
      recipeVersionId: "00000000-0000-4000-8000-000000000002",
      versionNumber: 1,
      deduplicated: false,
    });
  });

  it("muestra el listado resumido sin cargar ingredientes ni pasos", () => {
    renderManager();
    expect(screen.getByRole("button", { name: /Avena con platano/i })).toBeInTheDocument();
    expect(screen.getByText("2 ingredientes · 2 porciones · 5 min")).toBeInTheDocument();
  });

  it("muestra estados de carga, vacio y error", () => {
    mocks.useRecipes.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    const { unmount } = renderManager();
    expect(screen.getByText("Cargando recetas...")).toBeInTheDocument();
    unmount();

    mocks.useRecipes.mockReturnValueOnce({
      data: { pages: [{ items: [], total: 0, offset: 0, nextOffset: null }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderManager();
    expect(screen.getByText("Aun no tienes recetas")).toBeInTheDocument();
  });

  it("crea una receta con ingrediente exacto, pasos y calculo preview", async () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: /Nueva receta/i }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Avena casera" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar avena de prueba" }));
    fireEvent.change(screen.getByLabelText("Paso 1"), { target: { value: "Mezcla y cocina." } });

    expect(screen.getByText("Avena cocida")).toBeInTheDocument();
    expect(screen.getAllByText("150").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Crear receta" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      name: "Avena casera",
      servings: 1,
      steps: ["Mezcla y cocina."],
      ingredients: [expect.objectContaining({ foodName: "Avena cocida", quantity: 1 })],
    }));
  });
});
