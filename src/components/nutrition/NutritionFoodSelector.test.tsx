import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMocks = vi.hoisted(() => ({
  useCatalog: vi.fn(),
  useGroup: vi.fn(),
  useRegister: vi.fn(),
}));

vi.mock("@/hooks/useNutritionCatalog", () => ({
  useNutritionCatalog: hookMocks.useCatalog,
  useNutritionCatalogGroup: hookMocks.useGroup,
  useRegisterNutritionFood: hookMocks.useRegister,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { NutritionFoodSelector } from "./NutritionFoodSelector";

function card(index: number) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: `Alimento ${index}`,
    description: null,
    defaultFoodId: "00000000-0000-4000-8000-000000000900",
    defaultFoodName: `Alimento ${index}`,
    foodKind: "ingredient",
    variantCount: 1,
    categoryName: "General",
    brandName: null,
    caloriesPer100g: 100,
    proteinPer100g: 1,
    carbsPer100g: 2,
    fatPer100g: 3,
    defaultServingId: null,
    defaultServingLabel: "100 g",
    defaultServingQuantity: 100,
    defaultServingGrams: 100,
    defaultServingMilliliters: null,
    verificationStatus: "verified",
    isCommon: false,
  };
}

function catalogState(items = Array.from({ length: 12 }, (_, index) => card(index + 1))) {
  return {
    data: { pages: [{ items, total: 235, offset: 0, nextOffset: 24 }] },
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  };
}

function renderSelector() {
  return render(
    <NutritionFoodSelector
      enabled
      mealType="comida"
      loggedDate="2026-08-03"
      onRegistered={vi.fn()}
    />,
  );
}

describe("NutritionFoodSelector catalog states", () => {
  beforeEach(() => {
    hookMocks.useCatalog.mockReset();
    hookMocks.useGroup.mockReset();
    hookMocks.useRegister.mockReset();
    hookMocks.useCatalog.mockReturnValue(catalogState());
    hookMocks.useGroup.mockReturnValue({ data: null, isLoading: false, isError: false });
    hookMocks.useRegister.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it("muestra alimentos inmediatamente y supera el límite legacy de nueve", () => {
    renderSelector();
    expect(screen.getAllByRole("option")).toHaveLength(12);
  });

  it("deduplica grupos repetidos entre páginas", () => {
    const duplicate = card(1);
    hookMocks.useCatalog.mockReturnValue({
      ...catalogState(),
      data: {
        pages: [
          { items: [duplicate, card(2)], total: 2, offset: 0, nextOffset: 2 },
          { items: [duplicate], total: 2, offset: 2, nextOffset: null },
        ],
      },
      hasNextPage: false,
    });
    renderSelector();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("muestra el estado de carga inicial", () => {
    hookMocks.useCatalog.mockReturnValue({ ...catalogState([]), data: undefined, isLoading: true });
    renderSelector();
    expect(screen.getByText("Cargando catalogo...")).toBeInTheDocument();
  });

  it("muestra un estado vacío para una búsqueda sin coincidencias", () => {
    hookMocks.useCatalog.mockReturnValue({
      ...catalogState([]),
      data: { pages: [{ items: [], total: 0, offset: 0, nextOffset: null }] },
      hasNextPage: false,
    });
    renderSelector();
    expect(screen.getByText("No encontramos alimentos con esa busqueda.")).toBeInTheDocument();
  });

  it("muestra error comprensible y permite reintentar", () => {
    const refetch = vi.fn();
    hookMocks.useCatalog.mockReturnValue({
      ...catalogState([]),
      data: undefined,
      isError: true,
      error: new Error("No se pudo cargar el catalogo de alimentos."),
      refetch,
    });
    renderSelector();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("solicita la siguiente página al llegar al final del scroll", () => {
    const fetchNextPage = vi.fn();
    hookMocks.useCatalog.mockReturnValue({ ...catalogState(), fetchNextPage });
    renderSelector();
    const list = screen.getByRole("listbox");
    Object.defineProperties(list, {
      scrollHeight: { value: 300, configurable: true },
      clientHeight: { value: 100, configurable: true },
      scrollTop: { value: 150, configurable: true },
    });
    fireEvent.scroll(list);
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it("informa cuántos grupos se cargaron del total", () => {
    renderSelector();
    expect(screen.getByText("12 de 235 grupos cargados")).toBeInTheDocument();
  });

  it("expone un buscador etiquetado y actualiza la consulta", () => {
    renderSelector();
    fireEvent.change(screen.getByLabelText("Buscar alimento"), { target: { value: "salmón" } });
    expect(hookMocks.useCatalog).toHaveBeenLastCalledWith("salmón", true);
  });
});
