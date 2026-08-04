import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  ChefHat,
  Copy,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NutritionIngredientPicker } from "@/components/nutrition/NutritionIngredientPicker";
import {
  useArchiveNutritionRecipe,
  useDuplicateNutritionRecipe,
  useNutritionRecipe,
  useNutritionRecipes,
  useRegisterNutritionRecipe,
  useSaveNutritionRecipe,
} from "@/hooks/useNutritionRecipes";
import type { NutritionMealType } from "@/integrations/supabase/nutrition-types";
import {
  calculateRecipeDraftTotals,
  NutritionRecipeError,
  recipeDetailToDraft,
  type NutritionRecipeDetail,
  type NutritionRecipeDraft,
  type NutritionRecipeSummary,
  type RecipeDraftIngredient,
} from "@/services/nutritionRecipes";

type ManagerView = "list" | "detail" | "editor";
type EditableDraft = Omit<NutritionRecipeDraft, "clientRequestId">;

interface RecipeManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealType: NutritionMealType;
  loggedDate: string;
  onRegistered: () => void | Promise<void>;
}

const emptyDraft = (): EditableDraft => ({
  name: "",
  description: "",
  category: "",
  visibility: "private",
  servings: 1,
  yieldQuantity: 1,
  yieldUnit: "receta",
  finalWeightGrams: undefined,
  finalVolumeMilliliters: undefined,
  prepTimeMinutes: 0,
  cookTimeMinutes: 0,
  notes: "",
  tags: [],
  mealTypes: [],
  ingredients: [],
  steps: [""],
});

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nutrient(nutrients: Record<string, { perServing: number }>, code: string): number | null {
  return nutrients[code]?.perServing ?? null;
}

function totalNutrient(nutrients: Record<string, { total: number }>, code: string): number | null {
  return nutrients[code]?.total ?? null;
}

function per100gNutrient(nutrients: Record<string, { per100g: number | null }>, code: string): number | null {
  return nutrients[code]?.per100g ?? null;
}

function macroText(value: number | null, digits = 1): string {
  return value === null ? "No disponible" : `${value.toFixed(digits)} g`;
}

function calorieText(value: number | null): string {
  return value === null ? "No disponible" : `${Math.round(value)}`;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {message}
        <Button type="button" variant="link" className="ml-1 h-auto p-0" onClick={onRetry}>Reintentar</Button>
      </AlertDescription>
    </Alert>
  );
}

function RecipeList({
  onSelect,
  onCreate,
}: {
  onSelect: (recipeId: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const recipes = useNutritionRecipes(query);
  const pages = recipes.data?.pages;
  const items = useMemo(() => {
    const unique = new Map<string, NutritionRecipeSummary>();
    pages?.forEach((page) => page.items.forEach((recipe) => unique.set(recipe.recipe_id, recipe)));
    return Array.from(unique.values());
  }, [pages]);
  const total = pages?.[0]?.total || 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar receta"
            className="pl-9"
            placeholder="Buscar por nombre o ingrediente..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button type="button" className="gap-2" onClick={onCreate}>
          <Plus className="size-4" /> Nueva receta
        </Button>
      </div>

      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
        onScroll={(event) => {
          const element = event.currentTarget;
          if (element.scrollHeight - element.scrollTop - element.clientHeight < 100
            && recipes.hasNextPage && !recipes.isFetchingNextPage) {
            void recipes.fetchNextPage();
          }
        }}
      >
        {recipes.isLoading && (
          <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando recetas...
          </div>
        )}
        {recipes.isError && (
          <ErrorState
            message={recipes.error instanceof Error ? recipes.error.message : "No se pudieron cargar las recetas."}
            onRetry={() => void recipes.refetch()}
          />
        )}
        {!recipes.isLoading && !recipes.isError && items.length === 0 && (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-md border border-dashed text-center">
            <BookOpen className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">{query ? "No encontramos recetas" : "Aun no tienes recetas"}</p>
              <p className="text-sm text-muted-foreground">Crea una receta con alimentos exactos del catalogo.</p>
            </div>
          </div>
        )}
        {items.map((recipe) => (
          <button
            key={recipe.recipe_id}
            type="button"
            className="grid w-full grid-cols-[1fr_auto] gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onSelect(recipe.recipe_id)}
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="truncate">{recipe.name}</strong>
                <Badge variant="outline">{recipe.is_owner ? "Mi receta" : "Receta del sistema"}</Badge>
                {recipe.category && <Badge variant="secondary">{recipe.category}</Badge>}
              </span>
              {recipe.description && <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">{recipe.description}</span>}
              <span className="mt-1 block text-xs text-muted-foreground">
                {recipe.ingredient_count} ingredientes · {recipe.servings} porciones · {recipe.total_time_minutes} min
              </span>
            </span>
            <span className="grid grid-cols-2 gap-x-3 text-right text-xs text-muted-foreground">
              <span><strong className="block text-sm text-foreground">{calorieText(recipe.calories_per_serving)}</strong>{recipe.calories_per_serving === null ? "" : "kcal"}</span>
              <span><strong className="block text-sm text-foreground">{macroText(recipe.protein_per_serving, 0)}</strong>proteina</span>
            </span>
          </button>
        ))}
        {recipes.isFetchingNextPage && <Loader2 className="mx-auto my-3 size-5 animate-spin" />}
      </div>
      {items.length > 0 && <p className="text-xs text-muted-foreground">{items.length} de {total} recetas cargadas</p>}
    </div>
  );
}

function RecipeDetailView({
  detail,
  mealType,
  loggedDate,
  onBack,
  onEdit,
  onArchived,
  onDuplicated,
  onRegistered,
}: {
  detail: NutritionRecipeDetail;
  mealType: NutritionMealType;
  loggedDate: string;
  onBack: () => void;
  onEdit: () => void;
  onArchived: () => void;
  onDuplicated: (recipeId: string) => void;
  onRegistered: () => void | Promise<void>;
}) {
  const [servingsText, setServingsText] = useState("1");
  const register = useRegisterNutritionRecipe();
  const duplicate = useDuplicateNutritionRecipe();
  const archive = useArchiveNutritionRecipe();
  const registrationRequest = useRef<string | null>(null);
  const servings = Number(servingsText);

  const registerRecipe = async () => {
    if (!Number.isFinite(servings) || servings <= 0 || servings > 1000) {
      toast.error("Escribe una cantidad valida de porciones.");
      return;
    }
    registrationRequest.current ||= crypto.randomUUID();
    try {
      await register.mutateAsync({
        recipeId: detail.id,
        recipeVersionId: detail.currentVersionId,
        servings,
        mealType,
        loggedDate,
        clientRequestId: registrationRequest.current,
      });
      registrationRequest.current = null;
      toast.success("Receta registrada en tu comida");
      await onRegistered();
    } catch (error) {
      toast.error(error instanceof NutritionRecipeError ? error.message : "No se pudo registrar la receta.");
    }
  };

  const duplicateRecipe = async () => {
    try {
      const result = await duplicate.mutateAsync({ recipeId: detail.id, clientRequestId: crypto.randomUUID() });
      toast.success("Receta duplicada");
      onDuplicated(result.recipeId);
    } catch (error) {
      toast.error(error instanceof NutritionRecipeError ? error.message : "No se pudo duplicar la receta.");
    }
  };

  const archiveRecipe = async () => {
    try {
      await archive.mutateAsync(detail.id);
      toast.success("Receta archivada");
      onArchived();
    } catch (error) {
      toast.error(error instanceof NutritionRecipeError ? error.message : "No se pudo archivar la receta.");
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={onBack}>
            <ArrowLeft className="size-4" /> Recetas
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={duplicate.isPending} onClick={duplicateRecipe}>
              {duplicate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />} Duplicar
            </Button>
            {detail.isOwner && (
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onEdit}>
                <Edit3 className="size-4" /> Editar
              </Button>
            )}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">{detail.name}</h3>
            <Badge variant="outline">v{detail.version.versionNumber}</Badge>
          </div>
          {detail.description && <p className="mt-1 text-sm text-muted-foreground">{detail.description}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{detail.version.servings} porciones</span>
            {detail.category && <span>{detail.category}</span>}
            {detail.difficulty && <span>Dificultad {detail.difficulty}</span>}
            {detail.version.finalWeightGrams && <span>{Math.round(detail.version.finalWeightGrams)} g de rendimiento final</span>}
            {detail.version.prepTimeMinutes !== null && <span>{detail.version.prepTimeMinutes} min preparacion</span>}
            {detail.version.cookTimeMinutes !== null && <span>{detail.version.cookTimeMinutes} min coccion</span>}
          </div>
        </div>

        {!detail.version.calculationComplete && (
          <Alert>
            <AlertDescription>
              Informacion nutricional parcialmente disponible. Faltan: {detail.version.missingNutrientCodes.join(", ")}.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 rounded-md bg-muted p-3">
          <p className="text-xs font-medium text-muted-foreground">Por porcion</p>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <span><strong className="block text-base">{calorieText(nutrient(detail.nutrients, "energy_kcal"))}</strong>{nutrient(detail.nutrients, "energy_kcal") === null ? "" : "kcal"}</span>
            <span><strong className="block text-base">{macroText(nutrient(detail.nutrients, "protein_g"))}</strong>proteina</span>
            <span><strong className="block text-base">{macroText(nutrient(detail.nutrients, "carbs_g"))}</strong>carbs</span>
            <span><strong className="block text-base">{macroText(nutrient(detail.nutrients, "fat_g"))}</strong>grasa</span>
          </div>
          <p className="border-t pt-2 text-xs text-muted-foreground">
            Receta completa: {calorieText(totalNutrient(detail.nutrients, "energy_kcal"))}{totalNutrient(detail.nutrients, "energy_kcal") === null ? "" : " kcal"} · {macroText(totalNutrient(detail.nutrients, "protein_g"))} proteina · {macroText(totalNutrient(detail.nutrients, "carbs_g"))} carbs · {macroText(totalNutrient(detail.nutrients, "fat_g"))} grasa
          </p>
          {detail.version.finalWeightGrams && (
            <p className="border-t pt-2 text-xs text-muted-foreground">
              Por 100 g finales: {calorieText(per100gNutrient(detail.nutrients, "energy_kcal"))}{per100gNutrient(detail.nutrients, "energy_kcal") === null ? "" : " kcal"} · {macroText(per100gNutrient(detail.nutrients, "protein_g"))} proteina · {macroText(per100gNutrient(detail.nutrients, "carbs_g"))} carbs · {macroText(per100gNutrient(detail.nutrients, "fat_g"))} grasa
            </p>
          )}
        </div>

        <section>
          <h4 className="mb-2 flex items-center gap-2 font-semibold"><Utensils className="size-4" /> Ingredientes</h4>
          <div className="divide-y rounded-md border">
            {detail.ingredients.map((ingredient) => (
              <div key={ingredient.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span>{ingredient.foodName}<span className="block text-xs text-muted-foreground">{ingredient.servingLabel}</span></span>
                <span className="shrink-0 text-right">{ingredient.quantity} porciones<span className="block text-xs text-muted-foreground">{Math.round(ingredient.grams)} g · {Math.round(ingredient.nutrients.energy_kcal?.amount || 0)} kcal</span></span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-2 font-semibold"><ChefHat className="size-4" /> Preparacion</h4>
          <ol className="space-y-2">
            {detail.steps.map((step) => (
              <li key={step.id} className="grid grid-cols-[1.75rem_1fr] gap-2 text-sm">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{step.stepNumber}</span>
                <span className="pt-1">{step.instruction}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="sticky bottom-0 space-y-2 border-t bg-background py-3">
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <div>
              <Label htmlFor="recipe-register-servings" className="sr-only">Porciones</Label>
              <Input
                id="recipe-register-servings"
                type="number"
                min="0.001"
                max="1000"
                step="0.001"
                value={servingsText}
                onChange={(event) => { setServingsText(event.target.value); registrationRequest.current = null; }}
              />
            </div>
            <Button type="button" className="gap-2" disabled={register.isPending || !detail.version.calculationComplete} onClick={registerRecipe}>
              {register.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Registrar porciones
            </Button>
          </div>
          {detail.isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
                  <Archive className="size-4" /> Archivar receta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archivar receta</AlertDialogTitle>
                  <AlertDialogDescription>Dejara de aparecer en tu biblioteca. El historial registrado se conserva.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction disabled={archive.isPending} onClick={archiveRecipe}>Archivar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

function RecipeEditor({
  initial,
  onCancel,
  onSaved,
  onDirtyChange,
}: {
  initial: EditableDraft;
  onCancel: () => void;
  onSaved: (recipeId: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<EditableDraft>(initial);
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const [replacementIndex, setReplacementIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const save = useSaveNutritionRecipe();
  const requestId = useRef<string | null>(null);
  const totals = useMemo(() => {
    try {
      return calculateRecipeDraftTotals(draft.ingredients, draft.servings, draft.finalWeightGrams);
    } catch {
      return null;
    }
  }, [draft.finalWeightGrams, draft.ingredients, draft.servings]);

  const initialSignature = useMemo(() => JSON.stringify({ initial, tags: initial.tags.join(", ") }), [initial]);
  const currentSignature = useMemo(() => JSON.stringify({ initial: draft, tags: tagText }), [draft, tagText]);
  const isDirty = initialSignature !== currentSignature;

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const updateIngredient = (index: number, changes: Partial<RecipeDraftIngredient>) => {
    requestId.current = null;
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) => (
        ingredientIndex === index ? { ...ingredient, ...changes } : ingredient
      )),
    }));
  };

  const moveIngredient = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= draft.ingredients.length) return;
    const ingredients = [...draft.ingredients];
    [ingredients[index], ingredients[next]] = [ingredients[next], ingredients[index]];
    requestId.current = null;
    setDraft((current) => ({ ...current, ingredients }));
    setAnnouncement(`Ingrediente movido a la posicion ${next + 1}.`);
  };

  const addIngredient = (ingredient: RecipeDraftIngredient) => {
    requestId.current = null;
    if (replacementIndex !== null) {
      setDraft((current) => ({
        ...current,
        ingredients: current.ingredients.map((item, index) => index === replacementIndex ? ingredient : item),
      }));
      setAnnouncement(`Ingrediente ${replacementIndex + 1} reemplazado por ${ingredient.foodName}.`);
      setReplacementIndex(null);
      return;
    }
    setDraft((current) => {
      const existingIndex = current.ingredients.findIndex((item) => (
        item.foodId === ingredient.foodId && item.servingId === ingredient.servingId
      ));
      if (existingIndex < 0) return { ...current, ingredients: [...current.ingredients, ingredient] };
      return {
        ...current,
        ingredients: current.ingredients.map((item, index) => index === existingIndex
          ? { ...item, quantity: item.quantity + ingredient.quantity }
          : item),
      };
    });
    setAnnouncement(`${ingredient.foodName} agregado a la receta.`);
  };

  const updateStep = (index: number, value: string) => {
    requestId.current = null;
    setDraft((current) => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? value : step) }));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[next]] = [steps[next], steps[index]];
    requestId.current = null;
    setDraft((current) => ({ ...current, steps }));
    setAnnouncement(`Paso movido a la posicion ${next + 1}.`);
  };

  const submit = async () => {
    const cleanSteps = draft.steps.map((step) => step.trim()).filter(Boolean);
    if (!draft.name.trim()) return toast.error("Escribe un nombre para la receta.");
    if (!Number.isFinite(draft.servings) || draft.servings <= 0 || draft.servings > 1000) return toast.error("Escribe una cantidad valida de porciones.");
    if (draft.finalWeightGrams !== undefined && (!Number.isFinite(draft.finalWeightGrams) || draft.finalWeightGrams <= 0)) return toast.error("El peso final debe ser mayor a cero.");
    if (draft.finalVolumeMilliliters !== undefined && (!Number.isFinite(draft.finalVolumeMilliliters) || draft.finalVolumeMilliliters <= 0)) return toast.error("El volumen final debe ser mayor a cero.");
    if (draft.ingredients.length === 0) return toast.error("Agrega al menos un ingrediente.");
    if (draft.ingredients.some((ingredient) => !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0)) return toast.error("Revisa las cantidades de los ingredientes.");
    if (cleanSteps.length === 0) return toast.error("Agrega al menos un paso de preparacion.");

    requestId.current ||= crypto.randomUUID();
    try {
      const result = await save.mutateAsync({
        ...draft,
        tags: tagText.split(",").map((tag) => tag.trim()).filter(Boolean),
        steps: cleanSteps,
        clientRequestId: requestId.current,
      });
      requestId.current = null;
      toast.success(draft.recipeId ? "Nueva version publicada" : "Receta creada");
      onSaved(result.recipeId);
    } catch (error) {
      toast.error(error instanceof NutritionRecipeError ? error.message : "No se pudo guardar la receta.");
    }
  };

  const perServing = totals?.perServing || {};
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="space-y-5 pb-2">
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={onCancel}>
          <ArrowLeft className="size-4" /> Cancelar
        </Button>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="recipe-name">Nombre</Label>
            <Input id="recipe-name" maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="recipe-description">Descripcion</Label>
            <Textarea id="recipe-description" maxLength={2000} rows={2} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-category">Categoria</Label>
            <Input id="recipe-category" maxLength={80} value={draft.category || ""} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Desayuno, plato fuerte..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-difficulty">Dificultad</Label>
            <Select value={draft.difficulty || "none"} onValueChange={(value) => setDraft({ ...draft, difficulty: value === "none" ? undefined : value as EditableDraft["difficulty"] })}>
              <SelectTrigger id="recipe-difficulty"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sin especificar</SelectItem><SelectItem value="facil">Facil</SelectItem><SelectItem value="intermedia">Intermedia</SelectItem><SelectItem value="avanzada">Avanzada</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-servings">Porciones</Label>
            <Input id="recipe-servings" type="number" min="0.001" max="1000" step="0.001" value={draft.servings} onChange={(event) => setDraft({ ...draft, servings: Number(event.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-visibility">Visibilidad</Label>
            <Input id="recipe-visibility" value="Privada" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-yield">Rendimiento</Label>
            <Input id="recipe-yield" type="number" min="0.001" step="0.001" value={draft.yieldQuantity ?? ""} onChange={(event) => setDraft({ ...draft, yieldQuantity: numberOrUndefined(event.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-yield-unit">Unidad de rendimiento</Label>
            <Input id="recipe-yield-unit" maxLength={60} value={draft.yieldUnit || ""} onChange={(event) => setDraft({ ...draft, yieldUnit: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-final-weight">Peso final conocido (g)</Label>
            <Input id="recipe-final-weight" type="number" min="0.001" step="0.001" value={draft.finalWeightGrams ?? ""} onChange={(event) => setDraft({ ...draft, finalWeightGrams: numberOrUndefined(event.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-final-volume">Volumen final conocido (ml)</Label>
            <Input id="recipe-final-volume" type="number" min="0.001" step="0.001" value={draft.finalVolumeMilliliters ?? ""} onChange={(event) => setDraft({ ...draft, finalVolumeMilliliters: numberOrUndefined(event.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-prep-time">Preparacion (min)</Label>
            <Input id="recipe-prep-time" type="number" min="0" max="10080" value={draft.prepTimeMinutes ?? ""} onChange={(event) => setDraft({ ...draft, prepTimeMinutes: numberOrUndefined(event.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-cook-time">Coccion (min)</Label>
            <Input id="recipe-cook-time" type="number" min="0" max="10080" value={draft.cookTimeMinutes ?? ""} onChange={(event) => setDraft({ ...draft, cookTimeMinutes: numberOrUndefined(event.target.value) })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="recipe-tags">Etiquetas separadas por coma</Label>
            <Input id="recipe-tags" maxLength={500} value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="desayuno, rapido" />
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Tipos de comida</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {([
                ["desayuno", "Desayuno"],
                ["colacion_am", "Colacion AM"],
                ["comida", "Comida"],
                ["colacion_pm", "Colacion PM"],
                ["cena", "Cena"],
              ] as const).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.mealTypes.includes(value)}
                    onCheckedChange={(checked) => setDraft((current) => ({
                      ...current,
                      mealTypes: checked
                        ? [...current.mealTypes, value]
                        : current.mealTypes.filter((mealType) => mealType !== value),
                    }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <section className="space-y-3">
          <div>
            <h4 className="font-semibold">Ingredientes</h4>
            <p className="text-sm text-muted-foreground">Cada ingrediente usa una variante y porcion exactas del catalogo.</p>
          </div>
          {draft.ingredients.length > 0 && (
            <div className="divide-y rounded-md border">
              {draft.ingredients.map((ingredient, index) => (
                <div key={`${ingredient.foodId}-${ingredient.servingId}-${index}`} className="grid gap-2 p-3 sm:grid-cols-[1fr_7rem_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ingredient.foodName}</p>
                    <p className="truncate text-xs text-muted-foreground">{ingredient.servingLabel} · {Math.round((ingredient.nutrientsPerUnit.energy_kcal || 0) * ingredient.quantity)} kcal</p>
                  </div>
                  <div>
                    <Label htmlFor={`ingredient-quantity-${index}`} className="sr-only">Cantidad</Label>
                    <Input id={`ingredient-quantity-${index}`} type="number" min="0.001" max="1000" step="0.001" value={ingredient.quantity} onChange={(event) => updateIngredient(index, { quantity: Number(event.target.value) })} />
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant={replacementIndex === index ? "secondary" : "ghost"} size="icon" title="Cambiar variante o porcion" onClick={() => { setReplacementIndex(index); setAnnouncement(`Selecciona el reemplazo del ingrediente ${index + 1}.`); }}><Edit3 className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" disabled={index === 0} title="Subir" onClick={() => moveIngredient(index, -1)}><ArrowUp className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" disabled={index === draft.ingredients.length - 1} title="Bajar" onClick={() => moveIngredient(index, 1)}><ArrowDown className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" title="Quitar" onClick={() => { setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) })); setReplacementIndex(null); setAnnouncement(`${ingredient.foodName} eliminado.`); }}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {replacementIndex !== null && (
            <Alert>
              <AlertDescription>El siguiente ingrediente sustituira a {draft.ingredients[replacementIndex]?.foodName}.</AlertDescription>
            </Alert>
          )}
          <NutritionIngredientPicker enabled onAdd={addIngredient} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold">Pasos de preparacion</h4>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => { setDraft((current) => ({ ...current, steps: [...current.steps, ""] })); setAnnouncement("Paso agregado."); }}><Plus className="size-4" /> Paso</Button>
          </div>
          {draft.steps.map((step, index) => (
            <div key={index} className="grid grid-cols-[1.75rem_1fr_auto] gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs">{index + 1}</span>
              <Textarea aria-label={`Paso ${index + 1}`} rows={2} maxLength={2000} value={step} onChange={(event) => updateStep(index, event.target.value)} />
              <div className="flex flex-col">
                <Button type="button" variant="ghost" size="icon" disabled={index === 0} title="Subir paso" onClick={() => moveStep(index, -1)}><ArrowUp className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon" disabled={index === draft.steps.length - 1} title="Bajar paso" onClick={() => moveStep(index, 1)}><ArrowDown className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon" disabled={draft.steps.length === 1} title="Quitar paso" onClick={() => { setDraft((current) => ({ ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) })); setAnnouncement(`Paso ${index + 1} eliminado.`); }}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </section>

        <div className="rounded-md bg-muted p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">Por porcion</span>
            <span className="text-muted-foreground">{totals?.totalWeightGrams || 0} g totales</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <span><strong className="block text-sm">{Math.round(perServing.energy_kcal || 0)}</strong>kcal</span>
            <span><strong className="block text-sm">{(perServing.protein_g || 0).toFixed(1)} g</strong>proteina</span>
            <span><strong className="block text-sm">{(perServing.carbs_g || 0).toFixed(1)} g</strong>carbs</span>
            <span><strong className="block text-sm">{(perServing.fat_g || 0).toFixed(1)} g</strong>grasa</span>
          </div>
          {totals?.per100g && (
            <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
              Por 100 g finales: {Math.round(totals.per100g.energy_kcal || 0)} kcal · {(totals.per100g.protein_g || 0).toFixed(1)} g proteina
            </p>
          )}
          {totals && !totals.calculationComplete && (
            <p className="mt-2 text-xs text-warning-foreground">Informacion parcialmente disponible: faltan {totals.missingNutrientCodes.join(", ")}.</p>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background py-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="button" className="gap-2" disabled={save.isPending} onClick={submit}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <ChefHat className="size-4" />}
            {draft.recipeId ? "Publicar nueva version" : "Crear receta"}
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">{announcement}</p>
      </div>
    </div>
  );
}

export function RecipeManagerDialog({
  open,
  onOpenChange,
  mealType,
  loggedDate,
  onRegistered,
}: RecipeManagerDialogProps) {
  const [view, setView] = useState<ManagerView>("list");
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<EditableDraft>(emptyDraft());
  const [editorDirty, setEditorDirty] = useState(false);
  const detail = useNutritionRecipe(recipeId, open && view === "detail");

  const selectRecipe = (selectedId: string) => {
    setEditorDirty(false);
    setRecipeId(selectedId);
    setView("detail");
  };

  const closeOrReset = (nextOpen: boolean) => {
    if (!nextOpen && view === "editor" && editorDirty
      && !window.confirm("Tienes cambios sin guardar. ¿Quieres salir de todos modos?")) {
      return;
    }
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setView("list");
      setRecipeId(null);
      setEditorDraft(emptyDraft());
      setEditorDirty(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeOrReset}>
      <DialogContent className="flex h-[min(92dvh,54rem)] w-[calc(100vw-1rem)] max-w-5xl flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex items-center gap-2"><BookOpen className="size-5" /> Recetas</DialogTitle>
          <DialogDescription>
            Crea recetas calculadas, conserva sus versiones y registra porciones sin alterar tu historial.
          </DialogDescription>
        </DialogHeader>

        {view === "list" && (
          <RecipeList
            onSelect={selectRecipe}
            onCreate={() => { setEditorDraft(emptyDraft()); setEditorDirty(false); setView("editor"); }}
          />
        )}

        {view === "detail" && detail.isLoading && (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando receta...</div>
        )}
        {view === "detail" && detail.isError && (
          <ErrorState message={detail.error instanceof Error ? detail.error.message : "No se pudo cargar la receta."} onRetry={() => void detail.refetch()} />
        )}
        {view === "detail" && detail.data && (
          <RecipeDetailView
            detail={detail.data}
            mealType={mealType}
            loggedDate={loggedDate}
            onBack={() => { setRecipeId(null); setView("list"); }}
            onEdit={() => { setEditorDraft(recipeDetailToDraft(detail.data)); setEditorDirty(false); setView("editor"); }}
            onArchived={() => { setRecipeId(null); setView("list"); }}
            onDuplicated={selectRecipe}
            onRegistered={onRegistered}
          />
        )}

        {view === "editor" && (
          <RecipeEditor
            key={`${editorDraft.recipeId || "new"}-${recipeId || "none"}`}
            initial={editorDraft}
            onCancel={() => {
              if (editorDirty && !window.confirm("Tienes cambios sin guardar. ¿Quieres salir de todos modos?")) return;
              setEditorDirty(false);
              setView(editorDraft.recipeId ? "detail" : "list");
            }}
            onSaved={selectRecipe}
            onDirtyChange={setEditorDirty}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
