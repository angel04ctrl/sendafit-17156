import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Upload, Loader2, Dumbbell, Target, BookOpen, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MachineAnalysis {
  machineName: string;
  primaryMuscle: string;
  setupSteps: string[];
  exercises: {
    principiante: string[];
    intermedio: string[];
    avanzado: string[];
  };
}

interface GymMachineScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fitnessLevel?: string | null;
}

const loadingMessages = [
  "Subiendo imagen segura...",
  "Analizando biomecanica...",
  "Identificando grupo muscular...",
  "Preparando recomendaciones...",
];

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function GymMachineScanner({ open, onOpenChange, fitnessLevel }: GymMachineScannerProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"capture" | "analyzing" | "results">("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<MachineAnalysis | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(0);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
    reader.onload = (readerEvent) => setImagePreview(readerEvent.target?.result as string);
    reader.readAsDataURL(file);
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

      if (error) throw error;
      if (!data?.success || !data.analysis) {
        throw new Error("No se pudo identificar la máquina.");
      }

      setAnalysis(data.analysis);
      setStep("results");
      await saveToHistory(uploadData.path, data.analysis);
    } catch (error) {
      console.error("Machine analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Error al analizar la imagen");
      setStep("capture");
    } finally {
      window.clearInterval(loadingTimer);
    }
  };

  const saveToHistory = async (imagePath: string, analysisData: MachineAnalysis) => {
    if (!user) return;

    try {
      const relatedExercises = Object.entries(analysisData.exercises).flatMap(([level, exercises]) =>
        exercises.map((name) => ({ name, description: `Nivel ${level}` })),
      );

      await supabase.from("machine_scan_history").insert({
        user_id: user.id,
        image_url: imagePath,
        machine_name: analysisData.machineName,
        machine_type: analysisData.primaryMuscle,
        primary_muscles: [analysisData.primaryMuscle],
        secondary_muscles: [],
        usage_instructions: analysisData.setupSteps.join("\n"),
        posture_tips: "Verifica el nombre de la máquina antes de usarla. Si sientes dolor, detente.",
        related_exercises: relatedExercises,
      });
    } catch (error) {
      console.error("Error saving machine scan history:", error);
    }
  };

  const resetState = () => {
    setStep("capture");
    setImagePreview(null);
    setImageFile(null);
    setAnalysis(null);
    setLoadingIndex(0);
  };

  const renderExerciseList = (items: string[]) => (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetState();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            Identificar máquina de gym
          </DialogTitle>
        </DialogHeader>

        {step === "capture" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Toma una foto clara de la máquina para recibir ajustes, técnica y ejercicios por nivel.
              La imagen se procesa con IA; la identificación puede equivocarse y no sustituye la guía de un profesional.
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
                  Identificar máquina
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Camera className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Tomar foto</span>
                </Card>

                <Card
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 p-6 transition-colors hover:bg-muted/50"
                  onClick={() => fileInputRef.current?.click()}
                >
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
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 pr-4">
              {imagePreview && (
                <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                  <img src={imagePreview} alt="Máquina analizada" className="h-full w-full object-cover" />
                </div>
              )}

              <div>
                <h2 className="text-xl font-bold">{analysis.machineName}</h2>
                <Badge variant="secondary" className="mt-1 gap-1">
                  <Target className="h-3 w-3" />
                  {analysis.primaryMuscle}
                </Badge>
              </div>

              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Ajuste y ejecución</h3>
                </div>
                <ol className="space-y-2 text-sm">
                  {analysis.setupSteps.map((stepText, index) => (
                    <li key={`${stepText}-${index}`} className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </span>
                      <span>{stepText}</span>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card className="p-4">
                <h3 className="mb-3 font-semibold">Ejercicios sugeridos</h3>
                <Tabs defaultValue="principiante">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="principiante">Inicial</TabsTrigger>
                    <TabsTrigger value="intermedio">Medio</TabsTrigger>
                    <TabsTrigger value="avanzado">Avanzado</TabsTrigger>
                  </TabsList>
                  <TabsContent value="principiante" className="mt-3">
                    {renderExerciseList(analysis.exercises.principiante)}
                  </TabsContent>
                  <TabsContent value="intermedio" className="mt-3">
                    {renderExerciseList(analysis.exercises.intermedio)}
                  </TabsContent>
                  <TabsContent value="avanzado" className="mt-3">
                    {renderExerciseList(analysis.exercises.avanzado)}
                  </TabsContent>
                </Tabs>
              </Card>

              <Button variant="outline" className="w-full" onClick={resetState}>
                Escanear otra máquina
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
