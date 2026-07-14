import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Repeat, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  getExerciseSubstitutionCandidates,
  substitutionReasonLabels,
  type Exercise,
  type SubstitutionReason,
} from "@/lib/exerciseSubstitution";
import { useSubstituteWorkoutExercise } from "@/hooks/useBackendApi";

type WorkoutExercise = Tables<"workout_exercises">;

interface ExerciseSubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutExercise: Pick<WorkoutExercise, "id" | "exercise_id" | "name" | "sets" | "reps"> | null;
  workoutLocation?: string | null;
  disabledReason?: string | null;
  onSubstituted?: (updatedExercise: WorkoutExercise) => void;
}

const reasonOptions: SubstitutionReason[] = [
  "machine_busy",
  "pain_discomfort",
  "not_available",
  "preference",
  "app_recommended",
];

export function ExerciseSubstitutionDialog({
  open,
  onOpenChange,
  workoutExercise,
  workoutLocation,
  disabledReason,
  onSubstituted,
}: ExerciseSubstitutionDialogProps) {
  const [exerciseCatalog, setExerciseCatalog] = useState<Exercise[]>([]);
  const [originalExercise, setOriginalExercise] = useState<Exercise | null>(null);
  const [fitnessLevel, setFitnessLevel] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [reason, setReason] = useState<SubstitutionReason>("machine_busy");
  const [loading, setLoading] = useState(false);
  const substituteMutation = useSubstituteWorkoutExercise();

  useEffect(() => {
    if (!open || !workoutExercise) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setSelectedExerciseId("");

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const userId = userData.user?.id;

        const [exerciseResult, profileResult] = await Promise.all([
          supabase
            .from("exercises")
            .select("*")
            .eq("estado_calidad", "curado")
            .order("nombre"),
          userId
            ? supabase.from("profiles").select("fitness_level").eq("id", userId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (exerciseResult.error) throw exerciseResult.error;
        if (profileResult.error) throw profileResult.error;

        const catalog = (exerciseResult.data || []) as Exercise[];
        const original = workoutExercise.exercise_id
          ? catalog.find((exercise) => exercise.id === workoutExercise.exercise_id) || null
          : catalog.find((exercise) => exercise.nombre.toLowerCase() === workoutExercise.name.toLowerCase()) || null;

        if (!cancelled) {
          setExerciseCatalog(catalog);
          setOriginalExercise(original);
          setFitnessLevel(profileResult.data?.fitness_level || null);
        }
      } catch (error) {
        console.error("Error loading substitution options:", error);
        toast.error("No se pudieron cargar sustituciones");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, workoutExercise]);

  const candidates = useMemo(() => {
    if (!originalExercise) return [];
    return getExerciseSubstitutionCandidates({
      original: originalExercise,
      exercises: exerciseCatalog,
      userFitnessLevel: fitnessLevel,
      workoutLocation,
      limit: 8,
    });
  }, [exerciseCatalog, fitnessLevel, originalExercise, workoutLocation]);

  const selectedCandidate = candidates.find((candidate) => candidate.exercise.id === selectedExerciseId);

  const handleSubstitute = async () => {
    if (!workoutExercise || !selectedCandidate) return;

    try {
      const updated = await substituteMutation.mutateAsync({
        workoutExerciseId: workoutExercise.id,
        newExerciseId: selectedCandidate.exercise.id,
        reason,
      });
      toast.success("Ejercicio sustituido");
      onSubstituted?.(updated);
      onOpenChange(false);
    } catch (error) {
      console.error("Error substituting exercise:", error);
      toast.error("No se pudo guardar la sustitucion");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Sustituir ejercicio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Ejercicio actual</p>
            <p className="font-semibold">{workoutExercise?.name || "Sin ejercicio"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Se conserva el volumen: {workoutExercise?.sets || 1} series x {workoutExercise?.reps || 10} reps.
            </p>
          </Card>

          {disabledReason ? (
            <Card className="border-destructive/40 bg-destructive/5 p-4">
              <div className="flex gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{disabledReason}</p>
              </div>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={reason} onValueChange={(value) => setReason(value as SubstitutionReason)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {substitutionReasonLabels[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <Card className="p-4 text-sm text-muted-foreground">Buscando alternativas...</Card>
              ) : !originalExercise ? (
                <Card className="border-warning/40 bg-warning/5 p-4">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                    <p className="text-sm">No se pudo resolver el ejercicio original contra la biblioteca.</p>
                  </div>
                </Card>
              ) : candidates.length === 0 ? (
                <Card className="p-4 text-sm text-muted-foreground">
                  No hay sustituciones equivalentes con las reglas actuales.
                </Card>
              ) : (
                <div className="space-y-2">
                  <Label>Opciones equivalentes</Label>
                  <div className="grid gap-2">
                    {candidates.map((candidate) => {
                      const selected = selectedExerciseId === candidate.exercise.id;
                      return (
                        <button
                          key={candidate.exercise.id}
                          type="button"
                          className={`rounded-lg border p-3 text-left transition-colors ${
                            selected ? "border-primary bg-primary/5" : "hover:bg-muted"
                          }`}
                          onClick={() => setSelectedExerciseId(candidate.exercise.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">{candidate.exercise.nombre}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {candidate.exercise.musculo_principal || candidate.exercise.grupo_muscular}
                                {candidate.exercise.patron_movimiento ? ` - ${candidate.exercise.patron_movimiento}` : ""}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {candidate.matchReasons.slice(0, 3).map((item) => (
                                  <Badge key={item} variant="secondary" className="text-[11px]">
                                    {item}
                                  </Badge>
                                ))}
                              </div>
                              {candidate.cautions.length > 0 && (
                                <p className="mt-2 text-xs text-warning">{candidate.cautions.join(" - ")}</p>
                              )}
                            </div>
                            {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSubstitute}
                  disabled={!selectedCandidate || substituteMutation.isPending}
                >
                  Guardar sustitucion
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
