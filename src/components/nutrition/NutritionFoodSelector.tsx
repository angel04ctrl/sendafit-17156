import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronLeft, Loader2, Search, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useNutritionCatalog, useNutritionCatalogGroup, useRegisterNutritionFood } from "@/hooks/useNutritionCatalog";
import type { NutritionMealType } from "@/integrations/supabase/nutrition-types";
import {
  calculateNutritionSelection,
  getNutritionQuantityWarning,
  NutritionCatalogError,
  type NutritionFoodVariant,
  type NutritionServing,
} from "@/services/nutritionCatalog";

interface NutritionFoodSelectorProps {
  enabled: boolean;
  mealType: NutritionMealType;
  loggedDate: string;
  onRegistered: () => void | Promise<void>;
}

const variantTypeLabels: Record<string, string> = {
  ingredient: "Alimento base",
  prepared_variant: "Preparado",
  component: "Componente",
  composite_food: "Alimento compuesto",
  branded_product: "Producto comercial",
  restaurant_item: "Restaurante",
  supplement: "Suplemento",
  beverage: "Bebida",
  legacy_generic: "Variante general",
  unclassified: "Variante",
};

function variantLabel(variant: NutritionFoodVariant): string {
  const preparation = variant.preparationMethod?.code === "none" ? null : variant.preparationMethod?.name;
  const state = variant.physicalState?.code === "unknown" ? null : variant.physicalState?.name;
  return preparation || state || variantTypeLabels[variant.variantType] || "Variante";
}

function servingDescription(serving: NutritionServing): string {
  const equivalence = serving.grams
    ? `${serving.grams} g`
    : serving.milliliters
      ? `${serving.milliliters} ml`
      : serving.unit.gramsMultiplier
        ? `${serving.quantity * serving.unit.gramsMultiplier} g`
        : null;
  return equivalence ? `${serving.label} (${equivalence})` : serving.label;
}

function formatNutrient(value: number | null | undefined, unit = "g"): string {
  return value === null || value === undefined ? "No disponible" : `${value} ${unit}`;
}

export function NutritionFoodSelector({
  enabled,
  mealType,
  loggedDate,
  onRegistered,
}: NutritionFoodSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedServingId, setSelectedServingId] = useState<string | null>(null);
  const [quantityText, setQuantityText] = useState("1");
  const requestIdRef = useRef<string | null>(null);

  const catalog = useNutritionCatalog(searchQuery, enabled && !selectedGroupId);
  const detail = useNutritionCatalogGroup(selectedGroupId, enabled);
  const registerMeal = useRegisterNutritionFood();
  const catalogPages = catalog.data?.pages;

  const catalogItems = useMemo(() => {
    const byId = new Map<string, NonNullable<typeof catalogPages>[number]["items"][number]>();
    catalogPages?.forEach((page) => page.items.forEach((item) => byId.set(item.id, item)));
    return Array.from(byId.values());
  }, [catalogPages]);

  const selectedVariant = useMemo(() => {
    const variants = detail.data?.variants || [];
    return variants.find((variant) => variant.id === selectedVariantId)
      || variants.find((variant) => variant.isDefault)
      || variants[0]
      || null;
  }, [detail.data, selectedVariantId]);

  const calculableServings = useMemo(
    () => selectedVariant?.servings.filter((serving) => serving.isCalculable) || [],
    [selectedVariant],
  );

  const selectedServing = useMemo(() => {
    return calculableServings.find((serving) => serving.id === selectedServingId)
      || calculableServings.find((serving) => serving.isDefault)
      || calculableServings[0]
      || null;
  }, [calculableServings, selectedServingId]);

  useEffect(() => {
    if (selectedVariant && selectedVariant.id !== selectedVariantId) {
      setSelectedVariantId(selectedVariant.id);
    }
  }, [selectedVariant, selectedVariantId]);

  useEffect(() => {
    if (selectedServing && selectedServing.id !== selectedServingId) {
      setSelectedServingId(selectedServing.id);
    }
  }, [selectedServing, selectedServingId]);

  useEffect(() => {
    requestIdRef.current = null;
  }, [selectedGroupId, selectedVariantId, selectedServingId, quantityText, mealType, loggedDate]);

  useEffect(() => {
    if (!enabled) {
      setSearchQuery("");
      setSelectedGroupId(null);
      setSelectedVariantId(null);
      setSelectedServingId(null);
      setQuantityText("1");
      requestIdRef.current = null;
    }
  }, [enabled]);

  const quantity = Number(quantityText);
  const quantityWarning = getNutritionQuantityWarning(quantity);
  const selectionTotals = useMemo(() => {
    if (!selectedVariant || !selectedServing) return null;
    try {
      return calculateNutritionSelection(selectedVariant, selectedServing, quantity);
    } catch {
      return null;
    }
  }, [quantity, selectedServing, selectedVariant]);

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const nearEnd = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    if (nearEnd && catalog.hasNextPage && !catalog.isFetchingNextPage) {
      void catalog.fetchNextPage();
    }
  };

  const selectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedVariantId(null);
    setSelectedServingId(null);
    setQuantityText("1");
  };

  const goBack = () => {
    setSelectedGroupId(null);
    setSelectedVariantId(null);
    setSelectedServingId(null);
    setQuantityText("1");
  };

  const submitSelection = async () => {
    if (!selectedGroupId || !selectedVariant || !selectedServing || !selectionTotals) {
      toast.error("Selecciona una variante y una porcion validas.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) {
      toast.error("La cantidad debe ser mayor a cero y menor o igual a 1000.");
      return;
    }

    requestIdRef.current ||= crypto.randomUUID();

    try {
      await registerMeal.mutateAsync({
        canonicalGroupId: selectedGroupId,
        foodId: selectedVariant.id,
        servingId: selectedServing.id,
        quantity,
        mealType,
        loggedDate,
        clientRequestId: requestIdRef.current,
      });
      toast.success("Alimento registrado");
      requestIdRef.current = null;
      await onRegistered();
      goBack();
      setSearchQuery("");
    } catch (error) {
      toast.error(error instanceof NutritionCatalogError ? error.message : "No se pudo registrar el alimento.");
    }
  };

  if (selectedGroupId) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={goBack}>
          <ChevronLeft className="size-4" />
          Volver al catalogo
        </Button>

        {detail.isLoading && (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" />
            Cargando variantes y porciones...
          </div>
        )}

        {detail.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {detail.error instanceof Error ? detail.error.message : "No se pudo cargar el alimento."}
              <Button type="button" variant="link" className="ml-1 h-auto p-0" onClick={() => void detail.refetch()}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {detail.data && detail.data.variants.length === 0 && (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>Este alimento no tiene variantes disponibles para registrar.</AlertDescription>
          </Alert>
        )}

        {detail.data && selectedVariant && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">{detail.data.canonicalName}</h3>
              {detail.data.description && <p className="mt-1 text-sm text-muted-foreground">{detail.data.description}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nutrition-variant">Variante o preparacion</Label>
              <Select
                value={selectedVariant.id}
                onValueChange={(value) => {
                  setSelectedVariantId(value);
                  setSelectedServingId(null);
                }}
              >
                <SelectTrigger id="nutrition-variant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {detail.data.variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.displayName} - {variantLabel(variant)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {variantLabel(selectedVariant)}
                {selectedVariant.categories[0]?.name ? ` · ${selectedVariant.categories[0].name}` : ""}
                {selectedVariant.verificationStatus !== "verified" ? " · Datos parcialmente verificados" : ""}
              </p>
            </div>

            {calculableServings.length === 0 ? (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Esta variante no tiene porciones con equivalencia suficiente para calcular nutrientes.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <div className="space-y-2">
                    <Label htmlFor="nutrition-serving">Porcion</Label>
                    <Select value={selectedServing?.id} onValueChange={setSelectedServingId}>
                      <SelectTrigger id="nutrition-serving">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {calculableServings.map((serving) => (
                          <SelectItem key={serving.id} value={serving.id}>
                            {servingDescription(serving)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nutrition-quantity">Cantidad</Label>
                    <Input
                      id="nutrition-quantity"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max="1000"
                      step="0.25"
                      value={quantityText}
                      onChange={(event) => setQuantityText(event.target.value)}
                      aria-invalid={!selectionTotals}
                    />
                  </div>
                </div>

                {quantityWarning && (
                  <p className={cn("text-xs", quantity > 20 && quantity <= 1000 ? "text-warning" : "text-destructive")} role="alert">
                    {quantityWarning}
                  </p>
                )}

                {selectionTotals && (
                  <div className="rounded-md border bg-muted/40 p-3" aria-live="polite">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Total: {selectionTotals.grams} g
                      {selectionTotals.milliliters ? ` · ${selectionTotals.milliliters} ml` : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div><p className="text-xs text-muted-foreground">Calorias</p><p className="font-semibold">{selectionTotals.calories} kcal</p></div>
                      <div><p className="text-xs text-muted-foreground">Proteina</p><p className="font-semibold">{selectionTotals.protein} g</p></div>
                      <div><p className="text-xs text-muted-foreground">Carbohidratos</p><p className="font-semibold">{selectionTotals.carbs} g</p></div>
                      <div><p className="text-xs text-muted-foreground">Grasas</p><p className="font-semibold">{selectionTotals.fat} g</p></div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-2 text-xs text-muted-foreground">
                      <span>Fibra: {formatNutrient(selectionTotals.fiber)}</span>
                      <span>Azucar: {formatNutrient(selectionTotals.sugar)}</span>
                      <span>Sodio: {formatNutrient(selectionTotals.sodiumMg, "mg")}</span>
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full gap-2"
                  disabled={!selectionTotals || registerMeal.isPending || quantity > 1000}
                  onClick={() => void submitSelection()}
                >
                  {registerMeal.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Registrar alimento
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="nutrition-search">Buscar alimento</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="nutrition-search"
            autoFocus
            className="pl-9"
            placeholder="Ej. jitomate, arroz cocido, whey..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div
        className="h-64 overflow-y-auto rounded-md border"
        onScroll={handleListScroll}
        role="listbox"
        aria-label="Catalogo de alimentos"
        aria-busy={catalog.isLoading || catalog.isFetchingNextPage}
      >
        {catalog.isLoading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" />
            Cargando catalogo...
          </div>
        )}

        {catalog.isError && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <AlertCircle className="size-5 text-destructive" />
            <p className="text-sm text-destructive">
              {catalog.error instanceof Error ? catalog.error.message : "No se pudo cargar el catalogo."}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void catalog.refetch()}>
              Reintentar
            </Button>
          </div>
        )}

        {!catalog.isLoading && !catalog.isError && catalogItems.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <Utensils className="size-6" />
            <p className="text-sm">No encontramos alimentos con esa busqueda.</p>
          </div>
        )}

        {catalogItems.map((item) => (
          <button
            type="button"
            key={item.id}
            role="option"
            aria-selected="false"
            className="flex w-full items-start justify-between gap-3 border-b px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            onClick={() => selectGroup(item.id)}
          >
            <span className="min-w-0">
              <span className="block font-medium">{item.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {item.categoryName || "Sin categoria"}
                {item.defaultServingLabel ? ` · ${item.defaultServingLabel}` : ""}
                {item.variantCount > 1 ? ` · ${item.variantCount} variantes` : ""}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {item.caloriesPer100g === null ? "--" : `${item.caloriesPer100g} kcal`}
            </span>
          </button>
        ))}

        {catalog.isFetchingNextPage && (
          <div className="flex items-center justify-center gap-2 p-3 text-xs text-muted-foreground" role="status">
            <Loader2 className="size-3 animate-spin" />
            Cargando mas alimentos...
          </div>
        )}

        {!catalog.hasNextPage && catalogItems.length > 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">Fin de los resultados</p>
        )}
      </div>

      {catalog.data && catalogItems.length > 0 && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {catalogItems.length} de {catalog.data.pages[0]?.total || catalogItems.length} grupos cargados
        </p>
      )}
    </div>
  );
}
