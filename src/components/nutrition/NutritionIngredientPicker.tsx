import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronLeft, Loader2, Plus, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNutritionCatalog, useNutritionCatalogGroup } from "@/hooks/useNutritionCatalog";
import {
  calculateNutritionSelection,
  getNutritionQuantityWarning,
  type NutritionFoodVariant,
  type NutritionServing,
} from "@/services/nutritionCatalog";
import type { RecipeDraftIngredient } from "@/services/nutritionRecipes";

interface NutritionIngredientPickerProps {
  enabled: boolean;
  onAdd: (ingredient: RecipeDraftIngredient) => void;
}

function servingDescription(serving: NutritionServing): string {
  const grams = serving.grams
    ?? (serving.unit.gramsMultiplier ? serving.quantity * serving.unit.gramsMultiplier : null);
  return grams ? `${serving.label} (${grams} g)` : serving.label;
}

function variantDescription(variant: NutritionFoodVariant): string {
  return variant.preparationMethod?.code !== "none"
    ? variant.preparationMethod?.name || "Preparacion"
    : variant.physicalState?.name || "Variante";
}

export function NutritionIngredientPicker({ enabled, onAdd }: NutritionIngredientPickerProps) {
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [servingId, setServingId] = useState<string | null>(null);
  const [quantityText, setQuantityText] = useState("1");

  const catalog = useNutritionCatalog(query, enabled && !groupId);
  const detail = useNutritionCatalogGroup(groupId, enabled && Boolean(groupId));
  const pages = catalog.data?.pages;
  const items = useMemo(() => {
    const unique = new Map<string, NonNullable<typeof pages>[number]["items"][number]>();
    pages?.forEach((page) => page.items.forEach((item) => unique.set(item.id, item)));
    return Array.from(unique.values());
  }, [pages]);

  const variant = useMemo(() => {
    const variants = detail.data?.variants || [];
    return variants.find((item) => item.id === variantId)
      || variants.find((item) => item.isDefault)
      || variants[0]
      || null;
  }, [detail.data, variantId]);
  const servings = useMemo(() => variant?.servings.filter((item) => item.isCalculable) || [], [variant]);
  const serving = useMemo(() => servings.find((item) => item.id === servingId)
    || servings.find((item) => item.isDefault)
    || servings[0]
    || null, [servingId, servings]);

  useEffect(() => {
    if (variant && variant.id !== variantId) setVariantId(variant.id);
  }, [variant, variantId]);
  useEffect(() => {
    if (serving && serving.id !== servingId) setServingId(serving.id);
  }, [serving, servingId]);

  const quantity = Number(quantityText);
  const warning = getNutritionQuantityWarning(quantity);
  const totals = useMemo(() => {
    if (!variant || !serving) return null;
    try {
      return calculateNutritionSelection(variant, serving, quantity);
    } catch {
      return null;
    }
  }, [quantity, serving, variant]);

  const goBack = () => {
    setGroupId(null);
    setVariantId(null);
    setServingId(null);
    setQuantityText("1");
  };

  const addIngredient = () => {
    if (!groupId || !variant || !serving || !totals || quantity <= 0) return;
    const perUnit = calculateNutritionSelection(variant, serving, 1);
    onAdd({
      canonicalGroupId: groupId,
      foodId: variant.id,
      servingId: serving.id,
      foodName: variant.displayName,
      servingLabel: servingDescription(serving),
      quantity,
      gramsPerUnit: perUnit.grams,
      nutrientsPerUnit: {
        energy_kcal: perUnit.calories,
        protein_g: perUnit.protein,
        carbs_g: perUnit.carbs,
        fat_g: perUnit.fat,
        ...(perUnit.fiber === null ? {} : { fiber_g: perUnit.fiber }),
        ...(perUnit.sugar === null ? {} : { sugar_g: perUnit.sugar }),
        ...(perUnit.sodiumMg === null ? {} : { sodium_mg: perUnit.sodiumMg }),
      },
    });
    goBack();
    setQuery("");
  };

  if (groupId) {
    return (
      <div className="space-y-4 rounded-md border p-3">
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={goBack}>
          <ChevronLeft className="size-4" /> Volver al catalogo
        </Button>

        {detail.isLoading && (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" /> Cargando alimento...
          </div>
        )}
        {detail.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              No se pudo cargar el alimento.
              <Button type="button" variant="link" className="ml-1 h-auto p-0" onClick={() => void detail.refetch()}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {detail.data && variant && (
          <div className="space-y-4">
            <div>
              <p className="font-semibold">{detail.data.canonicalName}</p>
              <p className="text-sm text-muted-foreground">Elige la variante y la porcion exactas.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipe-food-variant">Variante</Label>
              <Select value={variant.id} onValueChange={(value) => { setVariantId(value); setServingId(null); }}>
                <SelectTrigger id="recipe-food-variant"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {detail.data.variants.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.displayName} - {variantDescription(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-2">
                <Label htmlFor="recipe-food-serving">Porcion</Label>
                <Select value={serving?.id || ""} onValueChange={setServingId}>
                  <SelectTrigger id="recipe-food-serving"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {servings.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{servingDescription(item)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipe-food-quantity">Cantidad</Label>
                <Input
                  id="recipe-food-quantity"
                  inputMode="decimal"
                  type="number"
                  min="0.001"
                  max="1000"
                  step="0.001"
                  value={quantityText}
                  onChange={(event) => setQuantityText(event.target.value)}
                />
              </div>
            </div>
            {warning && <p className="text-xs text-warning-foreground">{warning}</p>}
            {totals && (
              <div className="grid grid-cols-4 gap-2 rounded-md bg-muted p-3 text-center text-xs">
                <span><strong className="block text-sm">{totals.calories}</strong>kcal</span>
                <span><strong className="block text-sm">{totals.protein} g</strong>proteina</span>
                <span><strong className="block text-sm">{totals.carbs} g</strong>carbs</span>
                <span><strong className="block text-sm">{totals.fat} g</strong>grasa</span>
              </div>
            )}
            <Button type="button" className="w-full gap-2" disabled={!totals || Boolean(warning && quantity > 1000)} onClick={addIngredient}>
              <Plus className="size-4" /> Agregar ingrediente
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar ingrediente"
          className="pl-9"
          placeholder="Buscar ingrediente..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div
        className="max-h-56 space-y-1 overflow-y-auto pr-1"
        role="listbox"
        aria-label="Ingredientes del catalogo"
        onScroll={(event) => {
          const element = event.currentTarget;
          if (element.scrollHeight - element.scrollTop - element.clientHeight < 80
            && catalog.hasNextPage && !catalog.isFetchingNextPage) {
            void catalog.fetchNextPage();
          }
        }}
      >
        {catalog.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Cargando catalogo...</p>}
        {catalog.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              No se pudo cargar el catalogo.
              <Button type="button" variant="link" className="ml-1 h-auto p-0" onClick={() => void catalog.refetch()}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!catalog.isLoading && !catalog.isError && items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No encontramos ingredientes.</p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected="false"
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setGroupId(item.id)}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.variantCount} variante{item.variantCount === 1 ? "" : "s"}</span>
            </span>
            {item.verificationStatus === "verified" && <Check className="size-4 shrink-0 text-success" aria-label="Verificado" />}
          </button>
        ))}
        {catalog.isFetchingNextPage && <Loader2 className="mx-auto my-2 size-4 animate-spin" />}
      </div>
    </div>
  );
}
