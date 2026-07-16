import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, BookOpen, Camera, Dumbbell, Loader2, Plus, Replace, Save, Sparkles, Target, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { optimizeImageFile } from "@/lib/imageOptimization";

interface PossibleExercise {
  name: string;
  catalogExerciseId?: string | null;
  confidence?: number;
  reason?: string;
}

interface MachineAnalysis {
  machineName: string;
  confidenceScore: number;
  uncertaintyReason: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  setupSteps: string[];
  executionSteps: string[];
  commonMistakes: string[];
  safetyWarnings: string[];
  recommendedSets: number;
  recommendedReps: string;
  recommendedRestSeconds: number;
  possibleExercises: PossibleExercise[];
  notSureFallback: string;
}

interface GymMachineScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fitnessLevel?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  todayWorkouts?: any[];
  onWorkoutChanged?: () => void;
}

const loadingMessages = [
  "Subiendo imagen segura...",
  "Analizando biomecanica...",
  "Estimando confianza...",
  "Preparando acciones...",
];

const MAX_ORIGINAL_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_OPTIMIZED_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function confidenceLabel(score: number) {
  if (score >= 0.8) return "Confianza alta";
  if (score >= 0.6) return "Confianza media";
  return "Confianza baja";
}

function confidenceVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 0.8) return "default";
  if (score >= 0.6) return "secondary";
  return "destructive";
}

function parseReps(reps: string) {
  const numbers = reps.match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
  if (numbers.length === 0) return 10;
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}

async function getFunctionErrorMessage(error: unknown) {
  const maybeError = error as { message?: string; context?: Response };
  if (maybeError.context instanceof Response) {
    const body = await maybeError.context.json().catch(() => null);
    if (body?.error) return String(body.error);
  }
  return maybeError.message || "No se pudo completar la solicitud.";
}

export function GymMachineScanner({
  open,
  onOpenChange,
  fitnessLevel,
  todayWorkouts = [],
  onWorkoutChanged,
}: GymMachineScannerProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"capture" | "analyzing" | "results">("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<MachineAnalysis | null>(null);
  const [scanHistoryId, setScanHistoryId] = useState<string | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [targetWorkoutId, setTargetWorkoutId] = useState<string>("");
  const [targetWorkoutExerciseId, setTargetWorkoutExerciseId] = useState<string>("");
  const [selectedExerciseName, setSelectedExerciseName] = useState<string>("");
  const [isSavingAction, setIsSavingAction] = useState(false);

  const pendingTodayWorkouts = useMemo(
    () => todayWorkouts.filter((workout) => workout.completed !== true && workout.skipped !== true),
    [todayWorkouts],
  );

  const selectedWorkout = pendingTodayWorkouts.find((workout) => workout.id === targetWorkoutId);
  const selectedPossibleExercise = analysis?.possibleExercises.find((exercise) => exercise.name === selectedExerciseName)
    || analysis?.possibleExercises[0]
    || null;
  const lowConfidence = (analysis?.confidenceScore || 0) < 0.7;
  const canReplace = Boolean(selectedWorkout && targetWorkoutExerciseId && selectedPossibleExercise?.catalogExerciseId && !lowConfidence);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Imagen invalida. Usa JPG, PNG o WebP.");
      return;
    }

    if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
      toast.error("La imagen es demasiado grande. Usa una imagen menor a 12 MB.");
      return;
    }

    const optimizedFile = await optimizeImageFile(file, {
      maxDimension: 1600,
      quality: 0.82,
      outputType: "image/jpeg",
    });

    if (optimizedFile.size > MAX_OPTIMIZED_IMAGE_BYTES) {
      toast.error("No se pudo reducir la imagen lo suficiente. Prueba con otra foto.");
      return;
    }

    setImageFile(optimizedFile);
    const reader = new FileReader();
    reader.onload = (readerEvent) => setImagePreview(readerEvent.target?.result as string);
    reader.readAsDataURL(optimizedFile);
  };

  const analyzeImage = async () => {
    if (!imageFile || !user) return;

    setStep("analyzing");
    setLoadingIndex(0);

    const loadingTimer = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingMessages.length);
    }, 1400);

    try {
      const extension = imageFile.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/${crypto.randomUUID()}-machine.${extension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ai-analysis-images")
        .upload(fileName, imageFile, {
          contentType: imageFile.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      if (!uploadData?.path) throw new Error("No se pudo guardar la imagen.");

      const { data: signedData, error: signedError } = await supabase.storage
        .from("ai-analysis-images")
        .createSignedUrl(fileName, 60 * 10);

      if (signedError || !signedData?.signedUrl) {
        throw signedError || new Error("No se pudo preparar la imagen.");
      }

      const { data, error } = await supabase.functions.invoke("analyze-machine", {
        body: {
          imageUrl: signedData.signedUrl,
          fitness_level: fitnessLevel || "principiante",
        },
      });

      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (!data?.success || !data.analysis) {
        throw new Error("No se pudo identificar la maquina.");
      }

      setAnalysis(data.analysis);
      setSelectedExerciseName(data.analysis.possibleExercises?.[0]?.name || "");
      setTargetWorkoutId(pendingTodayWorkouts[0]?.id || "");
      setTargetWorkoutExerciseId(pendingTodayWorkouts[0]?.workout_exercises?.[0]?.id || "");
      setStep("results");
      const historyId = await saveToHistory(uploadData.path, data.analysis);
      setScanHistoryId(historyId);
    } catch (error) {
      console.error("Machine analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Error al analizar la imagen");
      setStep("capture");
    } finally {
      window.clearInterval(loadingTimer);
    }
  };

  const saveToHistory = async (imagePath: string, analysisData: MachineAnalysis) => {
    if (!user) return null;

    try {
      const relatedExercises = analysisData.possibleExercises.map((exercise) => ({
        name: exercise.name,
        exercise_id: exercise.catalogExerciseId || null,
        confidence: exercise.confidence ?? analysisData.confidenceScore,
        description: exercise.reason || "Sugerido por analisis de maquina",
      }));

      const { data, error } = await supabase
        .from("machine_scan_history")
        .insert({
          user_id: user.id,
          image_url: imagePath,
          machine_name: analysisData.machineName,
          machine_type: analysisData.primaryMuscles[0] || null,
          primary_muscles: analysisData.primaryMuscles,
          secondary_muscles: analysisData.secondaryMuscles,
          usage_instructions: [...analysisData.setupSteps, ...analysisData.executionSteps].join("\n"),
          posture_tips: analysisData.safetyWarnings.join("\n"),
          related_exercises: relatedExercises,
          confidence_score: analysisData.confidenceScore,
          uncertainty_reason: analysisData.uncertaintyReason,
          setup_steps: analysisData.setupSteps,
          execution_steps: analysisData.executionSteps,
          common_mistakes: analysisData.commonMistakes,
          safety_warnings: analysisData.safetyWarnings,
          recommended_sets: analysisData.recommendedSets,
          recommended_reps: analysisData.recommendedReps,
          recommended_rest_seconds: analysisData.recommendedRestSeconds,
          possible_exercises: relatedExercises,
          not_sure_fallback: analysisData.notSureFallback,
        })
        .select("id")
        .maybeSingle();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error("Error saving machine scan history:", error);
      return null;
    }
  };

  const addToTodayWorkout = async () => {
    if (!analysis || !selectedWorkout) {
      toast.error("Selecciona un entrenamiento de hoy.");
      return;
    }

    setIsSavingAction(true);
    try {
      const exerciseName = selectedPossibleExercise?.name || analysis.machineName;
      const orderIndex = (selectedWorkout.workout_exercises?.length || 0) + 1;
      const { error } = await supabase.from("workout_exercises").insert({
        workout_id: selectedWorkout.id,
        exercise_id: selectedPossibleExercise?.catalogExerciseId || null,
        name: exerciseName,
        sets: analysis.recommendedSets,
        reps: parseReps(analysis.recommendedReps),
        rest_seconds: analysis.recommendedRestSeconds,
        target_rir: 2,
        order_index: orderIndex,
        notes: `Agregado desde escaneo IA: ${analysis.machineName}. Verifica la maquina antes de usarla.`,
      });

      if (error) throw error;
      toast.success("Ejercicio agregado al entrenamiento de hoy.");
      onWorkoutChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar el ejercicio.");
    } finally {
      setIsSavingAction(false);
    }
  };

  const replaceWorkoutExercise = async () => {
    if (!selectedPossibleExercise?.catalogExerciseId || !targetWorkoutExerciseId) {
      toast.error("Selecciona una alternativa enlazada al catalogo.");
      return;
    }

    setIsSavingAction(true);
    try {
      const { error } = await supabase.rpc("substitute_workout_exercise", {
        _workout_exercise_id: targetWorkoutExerciseId,
        _new_exercise_id: selectedPossibleExercise.catalogExerciseId,
        _reason: "app_recommended",
      });

      if (error) throw error;
      toast.success("Ejercicio reemplazado con alternativa validada.");
      onWorkoutChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reemplazar el ejercicio.");
    } finally {
      setIsSavingAction(false);
    }
  };

  const saveFavorite = async () => {
    if (!analysis || !user) return;

    setIsSavingAction(true);
    try {
      const favoriteExercise = selectedPossibleExercise || analysis.possibleExercises[0];
      const { error } = await supabase.from("machine_exercise_favorites").insert({
        user_id: user.id,
        machine_scan_id: scanHistoryId,
        machine_name: analysis.machineName,
        exercise_name: favoriteExercise?.name || analysis.machineName,
        exercise_id: favoriteExercise?.catalogExerciseId || null,
        primary_muscles: analysis.primaryMuscles,
        secondary_muscles: analysis.secondaryMuscles,
        recommended_sets: analysis.recommendedSets,
        recommended_reps: analysis.recommendedReps,
        recommended_rest_seconds: analysis.recommendedRestSeconds,
        confidence_score: analysis.confidenceScore,
      });

      if (error) throw error;
      toast.success("Maquina guardada como favorita.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar favorito.");
    } finally {
      setIsSavingAction(false);
    }
  };

  const resetState = () => {
    setStep("capture");
    setImagePreview(null);
    setImageFile(null);
    setAnalysis(null);
    setScanHistoryId(null);
    setLoadingIndex(0);
    setTargetWorkoutId("");
    setTargetWorkoutExerciseId("");
    setSelectedExerciseName("");
  };

  const renderList = (items: string[], empty = "Sin datos suficientes.") => (
    items.length > 0 ? (
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ) : <p className="text-sm text-muted-foreground">{empty}</p>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetState();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            Identificar maquina de gym
          </DialogTitle>
        </DialogHeader>

        {step === "capture" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Toma una foto clara de la maquina. Verifica el nombre antes de usarla y detente si sientes dolor.
            </p>

            {imagePreview ? (
              <div className="space-y-4">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <img src={imagePreview} alt="Vista previa" className="h-full w-full object-cover" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={analyzeImage} className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />
                  Identificar maquina
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

                <Card className="flex cursor-pointer flex-col items-center justify-center gap-3 p-6 transition-colors hover:bg-muted/50" onClick={() => cameraInputRef.current?.click()}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Camera className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Tomar foto</span>
                </Card>

                <Card className="flex cursor-pointer flex-col items-center justify-center gap-3 p-6 transition-colors hover:bg-muted/50" onClick={() => fileInputRef.current?.click()}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
                    <Upload className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <span className="text-sm font-medium">Subir imagen</span>
                </Card>
              </div>
            )}
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Dumbbell className="h-8 w-8 text-primary" />
              </div>
              <Loader2 className="absolute -right-1 -top-1 h-6 w-6 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">{loadingMessages[loadingIndex]}</p>
              <p className="text-sm text-muted-foreground">Esto puede tardar unos segundos</p>
            </div>
          </div>
        )}

        {step === "results" && analysis && (
          <ScrollArea className="max-h-[calc(100dvh-8rem)] sm:max-h-[70vh]">
            <div className="space-y-4 pr-2 sm:pr-4">
              {imagePreview && (
                <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                  <img src={imagePreview} alt="Maquina analizada" className="h-full w-full object-cover" />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{analysis.machineName}</h2>
                  <Badge variant={confidenceVariant(analysis.confidenceScore)}>
                    {confidenceLabel(analysis.confidenceScore)} {Math.round(analysis.confidenceScore * 100)}%
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.primaryMuscles.map((muscle) => (
                    <Badge key={muscle} variant="secondary" className="gap-1">
                      <Target className="h-3 w-3" />
                      {muscle}
                    </Badge>
                  ))}
                </div>
              </div>

              {lowConfidence && (
                <Card className="border-amber-300 bg-amber-50 p-3 text-amber-950">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold">No estoy completamente seguro.</p>
                      <p>{analysis.uncertaintyReason || analysis.notSureFallback}</p>
                      <p className="mt-1">Toma otra foto donde se vea la etiqueta de la maquina y verifica el nombre antes de usarla.</p>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Prescripcion sugerida</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="font-semibold">{analysis.recommendedSets}</p>
                    <p className="text-xs text-muted-foreground">series</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="font-semibold">{analysis.recommendedReps}</p>
                    <p className="text-xs text-muted-foreground">reps</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="font-semibold">{analysis.recommendedRestSeconds}s</p>
                    <p className="text-xs text-muted-foreground">descanso</p>
                  </div>
                </div>
              </Card>

              <Tabs defaultValue="technique">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="technique">Tecnica</TabsTrigger>
                  <TabsTrigger value="mistakes">Errores</TabsTrigger>
                  <TabsTrigger value="alternatives">Alternativas</TabsTrigger>
                  <TabsTrigger value="actions">Acciones</TabsTrigger>
                </TabsList>

                <TabsContent value="technique" className="mt-3 space-y-3">
                  <Card className="p-4">
                    <h3 className="mb-3 font-semibold">Ajuste</h3>
                    {renderList(analysis.setupSteps)}
                  </Card>
                  <Card className="p-4">
                    <h3 className="mb-3 font-semibold">Ejecucion</h3>
                    {renderList(analysis.executionSteps)}
                  </Card>
                  <Card className="p-4">
                    <h3 className="mb-3 font-semibold">Seguridad</h3>
                    {renderList(analysis.safetyWarnings)}
                  </Card>
                </TabsContent>

                <TabsContent value="mistakes" className="mt-3">
                  <Card className="p-4">
                    <h3 className="mb-3 font-semibold">Errores comunes</h3>
                    {renderList(analysis.commonMistakes)}
                  </Card>
                </TabsContent>

                <TabsContent value="alternatives" className="mt-3">
                  <Card className="p-4">
                    <h3 className="mb-3 font-semibold">Ejercicios posibles</h3>
                    <div className="space-y-2">
                      {analysis.possibleExercises.map((exercise) => (
                        <button
                          key={exercise.name}
                          type="button"
                          onClick={() => setSelectedExerciseName(exercise.name)}
                          className={`w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/60 ${selectedExerciseName === exercise.name ? "border-primary bg-primary/5" : "bg-background"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{exercise.name}</span>
                            {exercise.catalogExerciseId ? <Badge variant="secondary">catalogo</Badge> : <Badge variant="outline">sin enlace</Badge>}
                          </div>
                          {exercise.reason && <p className="mt-1 text-xs text-muted-foreground">{exercise.reason}</p>}
                        </button>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="actions" className="mt-3 space-y-3">
                  <Card className="space-y-3 p-4">
                    <h3 className="font-semibold">Agregar a entrenamiento de hoy</h3>
                    {pendingTodayWorkouts.length > 0 ? (
                      <>
                        <Select value={targetWorkoutId} onValueChange={setTargetWorkoutId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona entrenamiento" />
                          </SelectTrigger>
                          <SelectContent>
                            {pendingTodayWorkouts.map((workout) => (
                              <SelectItem key={workout.id} value={workout.id}>{workout.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button className="w-full gap-2" onClick={addToTodayWorkout} disabled={isSavingAction || lowConfidence}>
                          <Plus className="h-4 w-4" />
                          Agregar a entrenamiento de hoy
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay entrenamientos pendientes para hoy.</p>
                    )}
                  </Card>

                  <Card className="space-y-3 p-4">
                    <h3 className="font-semibold">Reemplazar ejercicio actual</h3>
                    {selectedWorkout?.workout_exercises?.length ? (
                      <>
                        <Select value={targetWorkoutExerciseId} onValueChange={setTargetWorkoutExerciseId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Ejercicio a reemplazar" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedWorkout.workout_exercises.map((exercise: { id: string; name: string }) => (
                              <SelectItem key={exercise.id} value={exercise.id}>{exercise.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button className="w-full gap-2" variant="outline" onClick={replaceWorkoutExercise} disabled={isSavingAction || !canReplace}>
                          <Replace className="h-4 w-4" />
                          Reemplazar con alternativa validada
                        </Button>
                        {!selectedPossibleExercise?.catalogExerciseId && (
                          <p className="text-xs text-muted-foreground">El reemplazo requiere una alternativa enlazada al catalogo.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Selecciona un entrenamiento con ejercicios para reemplazar.</p>
                    )}
                  </Card>

                  <Button variant="secondary" className="w-full gap-2" onClick={saveFavorite} disabled={isSavingAction}>
                    <Save className="h-4 w-4" />
                    Guardar como ejercicio favorito
                  </Button>
                </TabsContent>
              </Tabs>

              <Button variant="outline" className="w-full" onClick={resetState}>
                Escanear otra maquina
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
