/**
 * FoodAnalysisModal.tsx - Modal para análisis de comida con IA.
 */

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Check, Flame, Loader2, Sparkles, Upload, Utensils, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { calculateCaloriesFromMacros, validateMealInput } from "@/lib/mealValidation";

type MealType = "desayuno" | "colacion_am" | "comida" | "colacion_pm" | "cena";
type ConfidenceScore = "alta" | "media" | "baja";

interface DetectedIngredient {
  name: string;
  estimatedWeightGrams: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface MealMacros {
  calories: number;
  protein: number;
  carbohydrates: number;
  fats: number;
}

interface AnalysisResult {
  dishName: string;
  estimatedTotalWeightGrams: number;
  confidenceScore: ConfidenceScore;
  macros: MealMacros;
  detectedIngredients: DetectedIngredient[];
  coachFeedback: string;
}

interface FoodAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const emptyMacros: MealMacros = {
  calories: 0,
  protein: 0,
  carbohydrates: 0,
  fats: 0,
};

const mealTypes: { value: MealType; label: string }[] = [
  { value: "desayuno", label: "Desayuno" },
  { value: "colacion_am", label: "Colacion AM" },
  { value: "comida", label: "Comida" },
  { value: "colacion_pm", label: "Colacion PM" },
  { value: "cena", label: "Cena" },
];

const confidenceLabels: Record<ConfidenceScore, string> = {
  alta: "Confianza alta",
  media: "Confianza media",
  baja: "Confianza baja",
};

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function normalizeAnalysis(value: unknown): AnalysisResult {
  const source = value as Partial<AnalysisResult>;
  const rawMacros = source.macros || emptyMacros;
  const confidence = source.confidenceScore === "alta" || source.confidenceScore === "media" || source.confidenceScore === "baja"
    ? source.confidenceScore
    : "media";

  return {
    dishName: String(source.dishName || "Comida analizada").trim(),
    estimatedTotalWeightGrams: toNumber(source.estimatedTotalWeightGrams),
    confidenceScore: confidence,
    macros: {
      calories: toNumber(rawMacros.calories),
      protein: toNumber(rawMacros.protein),
      carbohydrates: toNumber(rawMacros.carbohydrates),
      fats: toNumber(rawMacros.fats),
    },
    detectedIngredients: Array.isArray(source.detectedIngredients)
      ? source.detectedIngredients.map((ingredient) => ({
        name: String(ingredient.name || "Ingrediente").trim(),
        estimatedWeightGrams: toNumber(ingredient.estimatedWeightGrams),
        protein: toNumber(ingredient.protein),
        carbs: toNumber(ingredient.carbs),
        fats: toNumber(ingredient.fats),
      }))
      : [],
    coachFeedback: String(source.coachFeedback || "Revisa los valores estimados y ajustalos antes de registrar esta comida.").trim(),
  };
}

export function FoodAnalysisModal({ open, onOpenChange, onSaved }: FoodAnalysisModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"capture" | "analyzing" | "results">("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [editedDishName, setEditedDishName] = useState("");
  const [editedMacros, setEditedMacros] = useState<MealMacros>(emptyMacros);
  const [editedIngredients, setEditedIngredients] = useState<DetectedIngredient[]>([]);
  const [mealType, setMealType] = useState<MealType>("comida");
  const [isSaving, setIsSaving] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Imagen invalida. Usa JPG, PNG o WebP.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("La imagen es demasiado grande. Usa una imagen menor a 6 MB.");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const updateMacro = (key: keyof MealMacros, value: string) => {
    setEditedMacros((current) => ({
      ...current,
      [key]: toNumber(value),
    }));
  };

  const updateIngredient = (index: number, key: keyof DetectedIngredient, value: string) => {
    setEditedIngredients((current) => {
      const next = current.map((ingredient, ingredientIndex) => {
        if (ingredientIndex !== index) return ingredient;
        if (key === "estimatedWeightGrams") {
          const nextWeight = toNumber(value);
          const previousWeight = ingredient.estimatedWeightGrams || 1;
          const factor = previousWeight > 0 ? nextWeight / previousWeight : 1;
          return {
            ...ingredient,
            estimatedWeightGrams: nextWeight,
            protein: toNumber(ingredient.protein * factor),
            carbs: toNumber(ingredient.carbs * factor),
            fats: toNumber(ingredient.fats * factor),
          };
        }
        return {
          ...ingredient,
          [key]: key === "name" ? value : toNumber(value),
        };
      });

      const macroTotals = next.reduce(
        (acc, ingredient) => ({
          protein: acc.protein + ingredient.protein,
          carbohydrates: acc.carbohydrates + ingredient.carbs,
          fats: acc.fats + ingredient.fats,
        }),
        { protein: 0, carbohydrates: 0, fats: 0 },
      );

      setEditedMacros({
        calories: calculateCaloriesFromMacros(macroTotals.protein, macroTotals.carbohydrates, macroTotals.fats),
        protein: macroTotals.protein,
        carbohydrates: macroTotals.carbohydrates,
        fats: macroTotals.fats,
      });

      return next;
    });
  };

  const analyzeImage = async () => {
    if (!imageFile || !user) return;

    setStep("analyzing");

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(imageFile);
      });

      const { data, error } = await supabase.functions.invoke("analyze-meal", {
        body: {
          imageBase64: base64,
          mimeType: imageFile.type || "image/jpeg",
        },
      });

      if (error) {
        const functionError = error as { message?: string; context?: Response };
        const body = functionError.context instanceof Response
          ? await functionError.context.json().catch(() => null)
          : null;
        throw new Error(body?.error || functionError.message || "Error al analizar");
      }

      const responseAnalysis = data?.analysis || data;
      if (!responseAnalysis) {
        throw new Error("No se pudo analizar la comida");
      }

      const normalized = normalizeAnalysis(responseAnalysis);
      setAnalysis(normalized);
      setEditedDishName(normalized.dishName);
      setEditedMacros(normalized.macros);
      setEditedIngredients(normalized.detectedIngredients);
      setStep("results");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Error al analizar la imagen");
      setStep("capture");
    }
  };

  const saveToMacros = async () => {
    if (!user || !analysis) return;

    setIsSaving(true);

    try {
      const validation = validateMealInput({
        meal_type: mealType,
        name: editedDishName || "Comida analizada con IA",
        calories: editedMacros.calories,
        protein: editedMacros.protein,
        carbs: editedMacros.carbohydrates,
        fat: editedMacros.fats,
        date: format(new Date(), "yyyy-MM-dd"),
      });

      if (!validation.meal) {
        toast.error(validation.errors[0] || "Revisa los macros antes de guardar.");
        setIsSaving(false);
        return;
      }

      validation.warnings.forEach((warning) => toast.warning(warning));

      let imagePath = "";
      if (imageFile) {
        const extension = imageFile.name.split(".").pop() || "jpg";
        const fileName = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("ai-analysis-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;
        if (!uploadData?.path) throw new Error("No se pudo guardar la imagen.");
        imagePath = uploadData.path;
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const adjustedMacros = {
        calories: validation.meal.calories,
        protein: validation.meal.protein,
        carbs: validation.meal.carbs,
        fat: validation.meal.fat,
      };

      await supabase.from("food_analysis_logs").insert({
        user_id: user.id,
        image_url: imagePath,
        detected_foods: editedIngredients,
        estimated_macros: analysis.macros,
        adjusted_macros: {
          ...adjustedMacros,
          dishName: validation.meal.name,
          mealType,
          editedIngredients,
        },
        saved_to_daily: true,
        analysis_date: today,
      });

      const { data: savedMeal, error: mealInsertError } = await supabase.from("meals").insert({
        user_id: user.id,
        meal_type: mealType,
        name: validation.meal.name,
        calories: adjustedMacros.calories,
        protein: adjustedMacros.protein,
        carbs: adjustedMacros.carbs,
        fat: adjustedMacros.fat,
        date: today,
      }).select("id").single();

      if (mealInsertError) throw mealInsertError;

      if (savedMeal?.id && editedIngredients.length > 0) {
        await supabase.from("meal_ingredients" as any).insert(
          editedIngredients.map((ingredient) => ({
            meal_id: savedMeal.id,
            user_id: user.id,
            ingredient_name: ingredient.name,
            source: "ai_estimated",
            is_verified: false,
            quantity: ingredient.estimatedWeightGrams,
            unit: "g",
            grams: ingredient.estimatedWeightGrams,
            calories: calculateCaloriesFromMacros(ingredient.protein, ingredient.carbs, ingredient.fats),
            protein: ingredient.protein,
            carbs: ingredient.carbs,
            fat: ingredient.fats,
            metadata: {
              confidenceScore: analysis.confidenceScore,
              foodBaseLinked: false,
            },
          })),
        ).then(({ error: ingredientError }) => {
          if (ingredientError) console.warn("meal_ingredients insert skipped:", ingredientError.message);
        });
      }

      toast.success("Comida registrada en tu historial");
      onOpenChange(false);
      onSaved?.();
      resetState();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Error al guardar la comida");
    } finally {
      setIsSaving(false);
    }
  };

  const resetState = () => {
    setStep("capture");
    setImagePreview(null);
    setImageFile(null);
    setAnalysis(null);
    setEditedDishName("");
    setEditedMacros(emptyMacros);
    setEditedIngredients([]);
    setMealType("comida");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetState();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Analisis de Comida con IA
          </DialogTitle>
        </DialogHeader>

        {step === "capture" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Toma una foto o sube una imagen de tu comida para analizar automáticamente los macronutrientes.
              La imagen se procesa con IA y el resultado es una estimación que puedes corregir antes de guardar.
            </p>

            {imagePreview ? (
              <div className="flex flex-col gap-4">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                  <img
                    src={imagePreview}
                    alt="Vista previa"
                    className="h-full w-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <Button onClick={analyzeImage} className="w-full gap-2">
                  <Sparkles className="size-4" />
                  Analizar Comida
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                <Card
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 p-6 transition-colors hover:bg-muted/50"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <Camera className="size-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Tomar Foto</span>
                </Card>

                <Card
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 p-6 transition-colors hover:bg-muted/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-secondary/10">
                    <Upload className="size-6 text-secondary-foreground" />
                  </div>
                  <span className="text-sm font-medium">Subir Imagen</span>
                </Card>
              </div>
            )}
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="relative">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Utensils className="size-8 text-primary" />
              </div>
              <Loader2 className="absolute -right-1 -top-1 size-6 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">Analizando comida...</p>
              <p className="text-sm text-muted-foreground">Identificando alimentos y calculando macros</p>
            </div>
          </div>
        )}

        {step === "results" && analysis && (
          <div className="flex flex-col gap-4">
            {imagePreview && (
              <div className="aspect-video overflow-hidden rounded-xl bg-muted">
                <img src={imagePreview} alt="Comida analizada" className="h-full w-full object-cover" />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-name">Nombre del plato</Label>
              <Input
                id="dish-name"
                value={editedDishName}
                onChange={(event) => setEditedDishName(event.target.value)}
                placeholder="Nombre del plato"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Card className="p-3">
                <p className="text-muted-foreground">Peso estimado</p>
                <p className="text-lg font-semibold">{analysis.estimatedTotalWeightGrams} g</p>
              </Card>
              <Card className="p-3">
                <p className="text-muted-foreground">Confianza</p>
                <p className="text-lg font-semibold">{confidenceLabels[analysis.confidenceScore]}</p>
              </Card>
            </div>

            <Card className="border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                La foto es una estimación; confirma las porciones antes de guardar.
              </p>
            </Card>

            <div className="flex flex-col gap-2">
              <Label>Momento del día</Label>
              <Select value={mealType} onValueChange={(value) => setMealType(value as MealType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mealTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="border-primary/20 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Flame className="size-5 text-primary" />
                <h3 className="font-semibold">Macros recalculados</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="calories">Calorias</Label>
                  <Input
                    id="calories"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={editedMacros.calories}
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="protein">Proteinas</Label>
                  <Input
                    id="protein"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={editedMacros.protein}
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="carbohydrates">Carbohidratos</Label>
                  <Input
                    id="carbohydrates"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={editedMacros.carbohydrates}
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fats">Grasas</Label>
                  <Input
                    id="fats"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={editedMacros.fats}
                    readOnly
                  />
                </div>
              </div>
            </Card>

            <div className="flex flex-col gap-3">
              <h3 className="font-semibold">Ingredientes detectados</h3>
              {editedIngredients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No se detectaron ingredientes con suficiente claridad.</p>
              ) : (
                editedIngredients.map((ingredient, index) => (
                  <Card key={`${ingredient.name}-${index}`} className="p-3">
                    <div className="grid gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                        <div className="flex flex-col gap-1">
                          <Label>Ingrediente</Label>
                          <Input
                            value={ingredient.name}
                            onChange={(event) => updateIngredient(index, "name", event.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>Porcion (g)</Label>
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={ingredient.estimatedWeightGrams}
                            onChange={(event) => updateIngredient(index, "estimatedWeightGrams", event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <Label>Prot</Label>
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={ingredient.protein}
                            readOnly
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>Carbs</Label>
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={ingredient.carbs}
                            readOnly
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>Grasa</Label>
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={ingredient.fats}
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <Card className="border-primary/20 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h3 className="font-semibold">Coach de Bolsillo</h3>
              </div>
              <p className="text-sm text-muted-foreground">{analysis.coachFeedback}</p>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("capture");
                  setImagePreview(null);
                  setImageFile(null);
                }}
              >
                Nueva Foto
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={saveToMacros}
                disabled={isSaving || !editedDishName.trim()}
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Registrar en mi Historial
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
