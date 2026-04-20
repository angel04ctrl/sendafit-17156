/**
 * FoodAnalysisModal.tsx - Modal para análisis de comida con IA (Food Vision)
 * 
 * Permite al usuario:
 * - Tomar foto o subir imagen de comida
 * - Analizar con IA para detectar alimentos
 * - Ver estimación de macronutrientes
 * - Ajustar porciones
 * - Guardar en registro diario de macros
 */

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, Loader2, Check, X, Sparkles, Utensils, Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface FoodItem {
  name: string;
  portion: string;
  confidence: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AnalysisResult {
  foods: FoodItem[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface FoodAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const mealTypes = [
  { value: "desayuno", label: "Desayuno" },
  { value: "colacion_am", label: "Colación AM" },
  { value: "comida", label: "Almuerzo" },
  { value: "colacion_pm", label: "Colación PM" },
  { value: "cena", label: "Cena" },
];

export function FoodAnalysisModal({ open, onOpenChange, onSaved }: FoodAnalysisModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<"capture" | "analyzing" | "results">("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [adjustedFoods, setAdjustedFoods] = useState<FoodItem[]>([]);
  const [mealType, setMealType] = useState("comida");
  const [isSaving, setIsSaving] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!imageFile || !user) return;

    setStep("analyzing");

    try {
      // Convert image to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:image/...;base64, prefix
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(imageFile);
      });

      // Call edge function
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("No session");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-food`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({ imageBase64: base64 }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al analizar");
      }

      const data = await response.json();
      
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        setAdjustedFoods(data.analysis.foods);
        setStep("results");
      } else {
        throw new Error("No se pudieron detectar alimentos");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Error al analizar la imagen");
      setStep("capture");
    }
  };

  const updateFoodPortion = (index: number, multiplier: number) => {
    if (!analysis) return;
    
    const original = analysis.foods[index];
    const updated = [...adjustedFoods];
    updated[index] = {
      ...original,
      calories: Math.round(original.calories * multiplier),
      protein: Math.round(original.protein * multiplier),
      carbs: Math.round(original.carbs * multiplier),
      fat: Math.round(original.fat * multiplier),
      portion: `${multiplier}x ${original.portion}`,
    };
    setAdjustedFoods(updated);
  };

  const calculateTotals = () => {
    return adjustedFoods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.calories,
        protein: acc.protein + food.protein,
        carbs: acc.carbs + food.carbs,
        fat: acc.fat + food.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const saveToMacros = async () => {
    if (!user || adjustedFoods.length === 0) return;

    setIsSaving(true);
    const sb = supabase;

    try {
      // Upload image to storage
      let imageUrl = "";
      if (imageFile) {
        const fileName = `${user.id}/${Date.now()}-${imageFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("ai-analysis-images")
          .upload(fileName, imageFile);

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from("ai-analysis-images")
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      const totals = calculateTotals();
      const today = format(new Date(), "yyyy-MM-dd");

      // Save to food_analysis_logs
      await sb.from("food_analysis_logs").insert({
        user_id: user.id,
        image_url: imageUrl,
        detected_foods: analysis?.foods || [],
        estimated_macros: analysis?.totals || {},
        adjusted_macros: totals,
        saved_to_daily: true,
        analysis_date: today,
      });

      // Save to meals table (integrated with existing macros system)
      const foodNames = adjustedFoods.map(f => f.name).join(", ");
      await sb.from("meals").insert({
        user_id: user.id,
        meal_type: mealType,
        name: `Análisis IA: ${foodNames}`,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        date: today,
      });

      toast.success("Comida guardada en tus macros");
      onOpenChange(false);
      onSaved?.();
      resetState();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const resetState = () => {
    setStep("capture");
    setImagePreview(null);
    setImageFile(null);
    setAnalysis(null);
    setAdjustedFoods([]);
    setMealType("comida");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetState();
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Análisis de Comida con IA
          </DialogTitle>
        </DialogHeader>

        {step === "capture" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Toma una foto o sube una imagen de tu comida para analizar automáticamente los macronutrientes.
            </p>

            {imagePreview ? (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden aspect-video bg-muted">
                  <img
                    src={imagePreview}
                    alt="Vista previa"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Button onClick={analyzeImage} className="w-full gap-2">
                  <Sparkles className="w-4 h-4" />
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
                  className="p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Tomar Foto</span>
                </Card>

                <Card
                  className="p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-secondary-foreground" />
                  </div>
                  <span className="text-sm font-medium">Subir Imagen</span>
                </Card>
              </div>
            )}
          </div>
        )}

        {step === "analyzing" && (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Utensils className="w-8 h-8 text-primary" />
              </div>
              <Loader2 className="w-6 h-6 text-primary absolute -top-1 -right-1 animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium">Analizando comida...</p>
              <p className="text-sm text-muted-foreground">Identificando alimentos y calculando macros</p>
            </div>
          </div>
        )}

        {step === "results" && analysis && (
          <div className="space-y-4">
            {/* Image preview */}
            {imagePreview && (
              <div className="rounded-xl overflow-hidden aspect-video bg-muted">
                <img src={imagePreview} alt="Comida analizada" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Meal type selector */}
            <div className="space-y-2">
              <Label>Guardar como</Label>
              <Select value={mealType} onValueChange={setMealType}>
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

            {/* Detected foods */}
            <div className="space-y-3">
              <h3 className="font-semibold">Alimentos Detectados</h3>
              {adjustedFoods.length === 0 ? (
                <p className="text-sm text-muted-foreground">No se detectaron alimentos</p>
              ) : (
                adjustedFoods.map((food, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{food.name}</p>
                        <p className="text-xs text-muted-foreground">{food.portion}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                            {food.calories} kcal
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            {food.protein}g prot
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {food.carbs}g carbs
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                            {food.fat}g grasa
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => updateFoodPortion(index, 0.5)}
                        >
                          ½
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => updateFoodPortion(index, 1.5)}
                        >
                          1.5
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => updateFoodPortion(index, 2)}
                        >
                          2x
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Totals */}
            {adjustedFoods.length > 0 && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Total</h3>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(() => {
                    const totals = calculateTotals();
                    return (
                      <>
                        <div>
                          <p className="text-lg font-bold">{totals.calories}</p>
                          <p className="text-xs text-muted-foreground">kcal</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold">{totals.protein}g</p>
                          <p className="text-xs text-muted-foreground">proteína</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold">{totals.carbs}g</p>
                          <p className="text-xs text-muted-foreground">carbos</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold">{totals.fat}g</p>
                          <p className="text-xs text-muted-foreground">grasa</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </Card>
            )}

            {/* Actions */}
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
                disabled={isSaving || adjustedFoods.length === 0}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Guardar en Macros
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
