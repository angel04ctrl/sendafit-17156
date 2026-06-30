import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Clock, HelpCircle, Plus, SkipForward, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import {
  useCancelWorkoutSession,
  useExerciseProgressSummary,
  useFinishWorkoutSession,
  useSaveProgressionSuggestion,
  useSaveWorkoutSessionSet,
  useWorkoutSessionSets,
} from "@/hooks/useBackendApi";
import type { WorkoutSession } from "@/lib/api/backend";
import { buildProgressionSuggestion } from "@/lib/progression";

interface WorkoutExercise {
  id: string;
  exercise_id?: string | null;
  name: string;
  sets: number | null;
  reps: number | null;
  notes?: string | null;
}

interface ActiveWorkoutProps {
  workout: {
    id: string;
    name: string;
    duration_minutes?: number | null;
    workout_exercises?: WorkoutExercise[] | null;
  };
  session: WorkoutSession;
  onClose: () => void;
}

const DEFAULT_REST_SECONDS = 60;

const SESSION_FEELING_OPTIONS = [
  { label: "Me sentí fuerte", value: "strong" },
  { label: "Normal", value: "normal" },
  { label: "Me sentí cansado", value: "tired" },
  { label: "Dolor/molestia", value: "pain" },
] as const;

function extractTargetWeight(notes?: string | null) {
  if (!notes) return null;
  const match = notes.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function ActiveWorkout({ workout, session, onClose }: ActiveWorkoutProps) {
  const exercises = workout.workout_exercises || [];
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [actualReps, setActualReps] = useState("");
  const [actualWeight, setActualWeight] = useState("");
  const [rir, setRir] = useState("");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionFeeling, setSessionFeeling] = useState<"" | "strong" | "normal" | "tired" | "pain">("");
  const [painNotes, setPainNotes] = useState("");
  const [weightEdited, setWeightEdited] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [exerciseDetailOpen, setExerciseDetailOpen] = useState(false);
  const [selectedExerciseDetail, setSelectedExerciseDetail] = useState<any | null>(null);
  const [summary, setSummary] = useState<null | {
    durationSeconds: number;
    completedExercises: number;
    completedSets: number;
    volume: number;
    comparison: string;
    sessionFeeling: string;
    notes: string;
  }>(null);

  const currentExercise = exercises[currentExerciseIndex];
  const targetSets = Math.max(1, currentExercise?.sets || 1);
  const targetReps = currentExercise?.reps || 10;
  const targetWeight = extractTargetWeight(currentExercise?.notes);

  const saveSetMutation = useSaveWorkoutSessionSet();
  const saveProgressionSuggestionMutation = useSaveProgressionSuggestion();
  const finishSessionMutation = useFinishWorkoutSession();
  const cancelSessionMutation = useCancelWorkoutSession();
  const { data: completedSets = [] } = useWorkoutSessionSets(session.id);
  const { data: exerciseProgress } = useExerciseProgressSummary({
    exerciseId: currentExercise?.exercise_id,
    exerciseName: currentExercise?.name,
  });

  useEffect(() => {
    if (restSeconds <= 0) return;

    const interval = window.setInterval(() => {
      setRestSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [restSeconds]);

  const completedSetKeys = useMemo(() => {
    return new Set(
      completedSets
        .filter((set) => set.completed)
        .map((set) => `${set.workout_exercise_id}-${set.set_number}`),
    );
  }, [completedSets]);

  const currentExerciseCompletedSets = currentExercise
    ? Array.from({ length: targetSets }, (_, index) => index + 1).filter((setNumber) =>
        completedSetKeys.has(`${currentExercise.id}-${setNumber}`),
      )
    : [];
  const nextIncompleteSetNumber = currentExercise
    ? Array.from({ length: targetSets }, (_, index) => index + 1).find((setNumber) =>
        !completedSetKeys.has(`${currentExercise.id}-${setNumber}`),
      )
    : 1;
  const currentExerciseDone = currentExercise ? currentExerciseCompletedSets.length >= targetSets : false;
  const activeSetNumber = currentExerciseDone
    ? targetSets
    : Math.min(targetSets, Math.max(currentSetNumber, nextIncompleteSetNumber || currentSetNumber));
  const activeSetCompleted = currentExercise
    ? completedSetKeys.has(`${currentExercise.id}-${activeSetNumber}`)
    : false;

  const totalTargetSets = exercises.reduce((total, exercise) => total + Math.max(1, exercise.sets || 1), 0);
  const completedSetCount = completedSets.filter((set) => set.completed).length;
  const progress = totalTargetSets > 0 ? (completedSetCount / totalTargetSets) * 100 : 0;
  const completedExerciseCount = exercises.filter((exercise) => {
    const setCount = Math.max(1, exercise.sets || 1);
    return Array.from({ length: setCount }, (_, index) => index + 1).every((setNumber) =>
      completedSetKeys.has(`${exercise.id}-${setNumber}`),
    );
  }).length;
  const volume = completedSets.reduce((total, set) => {
    return total + ((set.actual_weight || 0) * (set.actual_reps || 0));
  }, 0);
  const lastSession = exerciseProgress?.lastSession || null;
  const progressionSuggestion = useMemo(() => {
    return buildProgressionSuggestion({
      progress: exerciseProgress,
      targetReps,
      targetSets,
      targetWeight,
      hasStableExerciseId: !!currentExercise?.exercise_id,
      currentSessionFeeling: sessionFeeling,
    });
  }, [currentExercise?.exercise_id, exerciseProgress, sessionFeeling, targetReps, targetSets, targetWeight]);
  const lastWeight = progressionSuggestion.suggestedWeight ?? lastSession?.sets.find((set) => set.weight !== null)?.weight ?? null;
  const displayedWeight = actualWeight || (!weightEdited && lastWeight !== null ? String(lastWeight) : "");
  const lastSessionLabel = lastSession
    ? `${lastSession.maxWeight || 0} kg x ${lastSession.sets.map((set) => set.reps || 0).join(", ")}`
    : null;
  const currentExerciseVolume = currentExercise
    ? completedSets
        .filter((set) => set.workout_exercise_id === currentExercise.id && set.completed)
        .reduce((total, set) => total + ((set.actual_weight || 0) * (set.actual_reps || 0)), 0)
    : 0;
  const currentExerciseComparison = (() => {
    if (!lastSession || currentExerciseVolume <= 0) return "Aún no hay una sesión anterior comparable.";
    if (currentExerciseVolume > lastSession.totalVolume) return "Mejoró frente a la última sesión de este ejercicio.";
    if (currentExerciseVolume === lastSession.totalVolume) return "Igualó la última sesión de este ejercicio.";
    return "Bajó frente a la última sesión de este ejercicio.";
  })();

  const resetInputsForNextSet = () => {
    setActualReps("");
    setActualWeight("");
    setWeightEdited(false);
    setRir("");
    setRpe("");
  };

  const openExerciseDetails = async (exercise: WorkoutExercise) => {
    try {
      if (!exercise.exercise_id && import.meta.env.DEV) {
        console.warn("[Sprint 4.1] ActiveWorkout exercise has no exercise_id; using snapshot fallback.", {
          workoutId: workout.id,
          workoutExerciseId: exercise.id,
          exerciseName: exercise.name,
        });
      }

      const query = supabase.from("exercises").select("*");
      const { data, error } = exercise.exercise_id
        ? await query.eq("id", exercise.exercise_id).maybeSingle()
        : await query.ilike("nombre", exercise.name.trim()).maybeSingle();

      if (error || !data) {
        toast.error("No se encontró información de este ejercicio");
        return;
      }

      setSelectedExerciseDetail(data);
      setExerciseDetailOpen(true);
    } catch (error) {
      console.error("Error loading exercise detail:", error);
      toast.error("No se pudo abrir la ayuda del ejercicio");
    }
  };

  const handleCompleteSet = async () => {
    if (!currentExercise) return;
    if (currentExerciseDone) {
      toast.info("Este ejercicio ya esta completado");
      return;
    }

    const reps = Number(actualReps || targetReps);
    const weightInput = displayedWeight;
    const weight = weightInput ? Number(weightInput) : targetWeight;

    if (!Number.isFinite(reps) || reps < 0) {
      toast.error("Ingresa reps válidas");
      return;
    }

    if (weightInput && (!Number.isFinite(weight) || Number(weight) < 0)) {
      toast.error("Ingresa un peso válido");
      return;
    }

    try {
      await saveSetMutation.mutateAsync({
        session_id: session.id,
        workout_exercise_id: currentExercise.id,
        exercise_id: currentExercise.exercise_id || null,
        exercise_name_snapshot: currentExercise.name,
        workout_exercise_name_snapshot: currentExercise.name,
        set_number: activeSetNumber,
        target_reps: targetReps,
        actual_reps: reps,
        target_weight: targetWeight,
        actual_weight: weight,
        rir: rir ? Number(rir) : null,
        rpe: rpe ? Number(rpe) : null,
        rest_seconds: DEFAULT_REST_SECONDS,
        completed: true,
      });

      if (currentExerciseCompletedSets.length === 0) {
        saveProgressionSuggestionMutation.mutate({
          exercise_id: currentExercise.exercise_id || null,
          exercise_name_snapshot: currentExercise.name,
          source: currentExercise.exercise_id ? "exercise_id" : progressionSuggestion.source,
          workout_session_id: session.id,
          previous_weight: progressionSuggestion.previousWeight,
          previous_reps: progressionSuggestion.previousReps,
          suggested_action: progressionSuggestion.action,
          suggested_weight: progressionSuggestion.suggestedWeight,
          suggested_reps: progressionSuggestion.suggestedReps,
          confidence: progressionSuggestion.confidence,
          reason: progressionSuggestion.reason,
          based_on_session_id: progressionSuggestion.basedOnSessionId,
        });
      }

      toast.success(`Serie ${activeSetNumber} guardada`);
      setRestSeconds(DEFAULT_REST_SECONDS);

      if (activeSetNumber < targetSets) setCurrentSetNumber(activeSetNumber + 1);
      resetInputsForNextSet();
    } catch (error) {
      console.error("Error saving set:", error);
      toast.error("No se pudo guardar la serie");
    }
  };

  const goToExercise = (index: number) => {
    setCurrentExerciseIndex(index);
    setCurrentSetNumber(1);
    resetInputsForNextSet();
  };

  const goToNextExercise = () => {
    if (currentExerciseIndex >= exercises.length - 1) return;
    goToExercise(currentExerciseIndex + 1);
  };

  const handleFinish = async () => {
    try {
      const selectedFeelingLabel = SESSION_FEELING_OPTIONS.find((option) => option.value === sessionFeeling)?.label;
      const finalNotes = [selectedFeelingLabel, notes.trim()].filter(Boolean).join(" | ");
      const result = await finishSessionMutation.mutateAsync({
        sessionId: session.id,
        workoutId: workout.id,
        startedAt: session.started_at,
        notes: finalNotes,
        sessionFeeling: sessionFeeling || null,
        painNotes: sessionFeeling === "pain" ? painNotes : null,
        userNotes: notes.trim() || null,
      });

      setSummary({
        durationSeconds: result.session.duration_seconds || 0,
        completedExercises: completedExerciseCount,
        completedSets: completedSetCount,
        volume,
        comparison: currentExerciseComparison,
        sessionFeeling: selectedFeelingLabel || "",
        notes: notes.trim(),
      });
      toast.success("Entrenamiento finalizado");
    } catch (error) {
      console.error("Error finishing session:", error);
      toast.error("No se pudo finalizar el entrenamiento");
    }
  };

  const handleCancel = async () => {
    if (!confirm("¿Cancelar esta sesión? No se marcará el entrenamiento como completado.")) return;

    try {
      await cancelSessionMutation.mutateAsync(session.id);
      toast.info("Sesión cancelada");
      onClose();
    } catch (error) {
      console.error("Error cancelling session:", error);
      toast.error("No se pudo cancelar la sesión");
    }
  };

  if (summary) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumen del entrenamiento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Duración</p>
              <p className="text-xl font-semibold">{formatDuration(summary.durationSeconds)}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Ejercicios</p>
              <p className="text-xl font-semibold">{summary.completedExercises}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Series</p>
              <p className="text-xl font-semibold">{summary.completedSets}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Volumen aprox.</p>
              <p className="text-xl font-semibold">{Math.round(summary.volume)} kg</p>
            </div>
            <div className="rounded-lg bg-muted p-3 sm:col-span-2">
              <p className="text-sm text-muted-foreground">Comparacion</p>
              <p className="font-medium">{summary.comparison}</p>
            </div>
            {(summary.sessionFeeling || summary.notes) && (
              <div className="rounded-lg bg-muted p-3 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="font-medium">{[summary.sessionFeeling, summary.notes].filter(Boolean).join(" - ")}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Button className="w-full" onClick={onClose}>
          Volver a Entrenar
        </Button>
      </div>
    );
  }

  if (!currentExercise) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Este entrenamiento no tiene ejercicios configurados.</p>
          <Button className="mt-4" onClick={onClose}>Volver</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ExerciseDetailModal
        open={exerciseDetailOpen}
        onOpenChange={setExerciseDetailOpen}
        exercise={selectedExerciseDetail}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 px-0" onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h2 className="text-xl font-bold">{workout.name}</h2>
          <p className="text-sm text-muted-foreground">
            {completedSetCount} de {totalTargetSets} series completadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={cancelSessionMutation.isPending}>
            <XCircle className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={handleFinish} disabled={finishSessionMutation.isPending || completedSetCount === 0}>
            Finalizar
          </Button>
        </div>
      </div>

      <Progress value={Math.min(progress, 100)} className="h-3" />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ejercicios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {exercises.map((exercise, index) => {
              const exerciseSets = Math.max(1, exercise.sets || 1);
              const done = Array.from({ length: exerciseSets }, (_, setIndex) => setIndex + 1).filter((setNumber) =>
                completedSetKeys.has(`${exercise.id}-${setNumber}`),
              ).length;

              return (
                <button
                  key={exercise.id}
                  type="button"
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    index === currentExerciseIndex ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}
                  onClick={() => goToExercise(index)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{exercise.name}</span>
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted-foreground/10 hover:text-primary"
                        aria-label={`Ver ayuda de ${exercise.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openExerciseDetails(exercise);
                        }}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                      {done === exerciseSets ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{done}/{exerciseSets} series</p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col gap-1 text-lg">
                <span className="flex items-center gap-2">
                  {currentExercise.name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openExerciseDetails(currentExercise)}
                    aria-label={`Ver ayuda de ${currentExercise.name}`}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {currentExerciseDone ? "Ejercicio completado" : `Serie ${activeSetNumber} de ${targetSets} - objetivo ${targetReps} reps`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-lg bg-muted p-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Última vez</p>
                  <p className="font-medium">{lastSessionLabel || "Sin historial aún"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mayor peso</p>
                  <p className="font-medium">
                    {exerciseProgress?.prs.maxWeight !== null && exerciseProgress?.prs.maxWeight !== undefined
                      ? `${exerciseProgress.prs.maxWeight} kg`
                      : "Sin PR"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mejor volumen</p>
                  <p className="font-medium">{Math.round(exerciseProgress?.prs.maxVolume || 0)} kg</p>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Sugerencia para hoy</p>
                    <p className="mt-1 text-sm text-muted-foreground">{progressionSuggestion.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={progressionSuggestion.action === "blocked_pain" ? "destructive" : "secondary"}>
                      {progressionSuggestion.label}
                    </Badge>
                    <Badge variant="outline">
                      Confianza {progressionSuggestion.confidence === "high" ? "alta" : progressionSuggestion.confidence === "medium" ? "media" : "baja"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Peso sugerido: </span>
                    <span className="font-medium">
                      {progressionSuggestion.suggestedWeight !== null ? `${progressionSuggestion.suggestedWeight} kg` : "Sin peso"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reps sugeridas: </span>
                    <span className="font-medium">{progressionSuggestion.suggestedReps ?? targetReps}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label>Reps</Label>
                  <Input
                    type="number"
                    min={0}
                    value={actualReps}
                    onChange={(event) => setActualReps(event.target.value)}
                    placeholder={String(targetReps)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Peso kg</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={displayedWeight}
                    onChange={(event) => {
                      setWeightEdited(true);
                      setActualWeight(event.target.value);
                    }}
                    placeholder={targetWeight ? String(targetWeight) : "0"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>RIR</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={rir}
                    onChange={(event) => setRir(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>RPE</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={rpe}
                    onChange={(event) => setRpe(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={handleCompleteSet}
                  disabled={saveSetMutation.isPending || activeSetCompleted || currentExerciseDone}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {currentExerciseDone ? "Ejercicio completado" : activeSetCompleted ? "Serie guardada" : "Completar serie"}
                </Button>
                <Button variant="outline" onClick={goToNextExercise} disabled={currentExerciseIndex >= exercises.length - 1}>
                  <SkipForward className="mr-2 h-4 w-4" />
                  Siguiente ejercicio
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Timer className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{restSeconds > 0 ? formatDuration(restSeconds) : "Descanso listo"}</p>
                  <p className="text-sm text-muted-foreground">Descanso recomendado: {DEFAULT_REST_SECONDS}s</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setRestSeconds((current) => current + 30)}>
                  <Plus className="mr-1 h-4 w-4" />
                  30s
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRestSeconds(0)}>
                  <Clock className="mr-1 h-4 w-4" />
                  Saltar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <Label>Notas de la sesión</Label>
              <div className="grid gap-2 sm:grid-cols-4">
                {SESSION_FEELING_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={sessionFeeling === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSessionFeeling((current) => current === option.value ? "" : option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {sessionFeeling === "pain" && (
                <Input
                  value={painNotes}
                  onChange={(event) => setPainNotes(event.target.value)}
                  placeholder="Describe la molestia o zona de dolor"
                />
              )}
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Como te sentiste, ajustes o molestias relevantes"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
