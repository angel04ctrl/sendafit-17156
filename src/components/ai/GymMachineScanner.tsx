/**
 * GymMachineScanner.tsx - Escáner de máquinas de gimnasio con IA
 * 
 * Permite al usuario:
 * - Tomar foto o subir imagen de una máquina de gym
 * - Identificar la máquina con IA
 * - Ver músculos trabajados, instrucciones y tips
 * - Guardar en historial de consultas
 */

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Camera, Upload, Loader2, Dumbbell, Target, BookOpen, AlertCircle, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MachineAnalysis {
  machineName: string;
  machineType: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  usageInstructions: string[];
  postureTips: string[];
  relatedExercises: Array<{
    name: string;
    description: string;
  }>;
  confidence: number;
}

interface GymMachineScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GymMachineScanner({ open, onOpenChange }: GymMachineScannerProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<"capture" | "analyzing" | "results">("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<MachineAnalysis | null>(null);

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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-gym-machine`,
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
        setStep("results");

        // Save to history
        await saveToHistory(data.analysis);
      } else {
        throw new Error("No se pudo identificar la máquina");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Error al analizar la imagen");
      setStep("capture");
    }
  };

  const saveToHistory = async (analysisData: MachineAnalysis) => {
    if (!user || !imageFile) return;

    try {
      // Upload image to storage
      const fileName = `${user.id}/${Date.now()}-machine.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ai-analysis-images")
        .upload(fileName, imageFile);

      let imageUrl = "";
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from("ai-analysis-images")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      // Save to machine_scan_history
      const sb = supabase as any;
      await sb.from("machine_scan_history").insert({
        user_id: user.id,
        image_url: imageUrl,
        machine_name: analysisData.machineName,
        machine_type: analysisData.machineType,
        primary_muscles: analysisData.primaryMuscles,
        secondary_muscles: analysisData.secondaryMuscles,
        usage_instructions: analysisData.usageInstructions.join("\n"),
        posture_tips: analysisData.postureTips.join("\n"),
        related_exercises: analysisData.relatedExercises,
      });
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  const resetState = () => {
    setStep("capture");
    setImagePreview(null);
    setImageFile(null);
    setAnalysis(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetState();
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            Identificar Máquina de Gym
          </DialogTitle>
        </DialogHeader>

        {step === "capture" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Toma una foto de cualquier máquina de gimnasio y obtén instrucciones de uso detalladas.
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
                  Identificar Máquina
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
                <Dumbbell className="w-8 h-8 text-primary" />
              </div>
              <Loader2 className="w-6 h-6 text-primary absolute -top-1 -right-1 animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium">Identificando máquina...</p>
              <p className="text-sm text-muted-foreground">Analizando imagen y buscando información</p>
            </div>
          </div>
        )}

        {step === "results" && analysis && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Image preview */}
              {imagePreview && (
                <div className="rounded-xl overflow-hidden aspect-video bg-muted">
                  <img src={imagePreview} alt="Máquina" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Machine name and type */}
              <div>
                <h2 className="text-xl font-bold">{analysis.machineName}</h2>
                <Badge variant="secondary" className="mt-1">{analysis.machineType}</Badge>
                {analysis.confidence < 0.7 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Identificación con baja confianza
                  </p>
                )}
              </div>

              {/* Muscles */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Músculos Trabajados</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Principales</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.primaryMuscles.map((muscle, i) => (
                        <Badge key={i} variant="default">{muscle}</Badge>
                      ))}
                    </div>
                  </div>
                  {analysis.secondaryMuscles.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Secundarios</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.secondaryMuscles.map((muscle, i) => (
                          <Badge key={i} variant="outline">{muscle}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Usage instructions */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Cómo Usarla</h3>
                </div>
                <ol className="space-y-2 text-sm">
                  {analysis.usageInstructions.map((instruction, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                        {i + 1}
                      </span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </Card>

              {/* Posture tips */}
              {analysis.postureTips.length > 0 && (
                <Card className="p-4 border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold">Consejos de Postura</h3>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {analysis.postureTips.map((tip, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Related exercises */}
              {analysis.relatedExercises.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Ejercicios Relacionados</h3>
                  <div className="space-y-2">
                    {analysis.relatedExercises.map((exercise, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/50">
                        <p className="font-medium text-sm">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">{exercise.description}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Actions */}
              <Button
                variant="outline"
                className="w-full"
                onClick={resetState}
              >
                Escanear Otra Máquina
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
