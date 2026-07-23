/**
 * ExerciseDetailModal.tsx - Modal de detalles de ejercicio.
 *
 * Muestra información técnica, recomendaciones, historial y progresión básica
 * usando metadata profesional cuando está disponible.
 */

import type { ReactNode } from "react";
import { AlertTriangle, Dumbbell, HelpCircle, ListChecks, MapPin, Repeat, ShieldAlert, Target, Timer, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useExerciseProgressSummary } from "@/hooks/useBackendApi";
import { buildProgressionSuggestion } from "@/lib/progression";
import { formatExerciseLevel, toTextArray } from "@/lib/exerciseMetadata";
import { getProgressionContextLabel, PERSONAL_RECORD_HELP, RIR_LABEL, RPE_LABEL } from "@/lib/trainingProgressionCopy";

interface ExerciseDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: {
    id?: string;
    nombre: string;
    descripcion: string;
    grupo_muscular: string;
    nivel: string;
    lugar: string;
    video?: string | null;
    imagen?: string | null;
    series_sugeridas?: number | null;
    repeticiones_sugeridas?: number | null;
    duracion_promedio_segundos?: number | null;
    equipamiento?: string | null;
    musculo_principal?: string | null;
    musculos_secundarios?: string[] | null;
    patron_movimiento?: string | null;
    equipo_requerido?: string[] | null;
    nivel_minimo?: string | null;
    errores_comunes?: string[] | null;
    instrucciones?: string[] | null;
    cues_tecnicos?: string[] | null;
    contraindicaciones?: string[] | null;
    rango_reps_min?: number | null;
    rango_reps_max?: number | null;
    descanso_segundos_min?: number | null;
    descanso_segundos_max?: number | null;
    rir_recomendado?: number | null;
    sustituciones?: string[] | null;
    progresiones?: string[] | null;
    regresiones?: string[] | null;
    estado_calidad?: string | null;
  } | null;
}

function formatSecondsRange(min?: number | null, max?: number | null) {
  if (min && max) return min === max ? `${min}s` : `${min}-${max}s`;
  if (min) return `${min}s`;
  if (max) return `${max}s`;
  return "60-90s";
}

function formatRir(value?: number | null) {
  const rir = value ?? 1;
  return rir >= 5 ? String(rir) : `${rir}-${rir + 1}`;
}

function MetadataList({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  if (!items.length) return null;

  return (
    <Card className="p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export const ExerciseDetailModal = ({ open, onOpenChange, exercise }: ExerciseDetailModalProps) => {
  const { data: progressSummary, isLoading: progressLoading } = useExerciseProgressSummary(
    open ? { exerciseId: exercise?.id, exerciseName: exercise?.nombre } : undefined,
  );

  if (!exercise) return null;

  const primaryMuscle = exercise.musculo_principal || exercise.grupo_muscular;
  const secondaryMuscles = toTextArray(exercise.musculos_secundarios);
  const equipment = toTextArray(exercise.equipo_requerido).length
    ? toTextArray(exercise.equipo_requerido)
    : toTextArray(exercise.equipamiento || "");
  const instructions = toTextArray(exercise.instrucciones);
  const cues = toTextArray(exercise.cues_tecnicos);
  const commonErrors = toTextArray(exercise.errores_comunes);
  const contraindications = toTextArray(exercise.contraindicaciones);
  const substitutions = toTextArray(exercise.sustituciones).filter((item) => item !== exercise.nombre).slice(0, 4);
  const progressions = toTextArray(exercise.progresiones);
  const regressions = toTextArray(exercise.regresiones);
  const repsMin = exercise.rango_reps_min || Math.max(1, (exercise.repeticiones_sugeridas || 10) - 2);
  const repsMax = exercise.rango_reps_max || (exercise.repeticiones_sugeridas || 10) + 2;
  const isCardio = exercise.tipo_entrenamiento?.toLowerCase().includes("cardio")
    || exercise.patron_movimiento?.toLowerCase().includes("cardio");
  const isTimedExercise = !!exercise.duracion_promedio_segundos && !exercise.rango_reps_min && !exercise.rango_reps_max;

  const progressionSuggestion = buildProgressionSuggestion({
    progress: progressSummary,
    targetReps: exercise.repeticiones_sugeridas || repsMax,
    targetSets: exercise.series_sugeridas || 1,
    targetWeight: null,
    hasStableExerciseId: !!exercise.id,
  });
  const progressionContextLabel = getProgressionContextLabel(progressionSuggestion.confidence);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{exercise.nombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {exercise.video ? (
            <div className="aspect-video overflow-hidden rounded-lg bg-muted">
              <video src={exercise.video} controls className="h-full w-full object-cover" poster={exercise.imagen || undefined}>
                Tu navegador no soporta el elemento de video.
              </video>
            </div>
          ) : exercise.imagen ? (
            <div className="aspect-video overflow-hidden rounded-lg bg-muted">
              <img src={exercise.imagen} alt={exercise.nombre} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
              <Dumbbell className="h-20 w-20 text-muted-foreground" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <Target className="h-3 w-3" />
              {primaryMuscle}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              {formatExerciseLevel(exercise.nivel_minimo || exercise.nivel)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3 w-3" />
              {exercise.lugar === "casa"
                ? "Casa"
                : exercise.lugar === "gimnasio"
                  ? "Gimnasio"
                  : exercise.lugar === "piscina"
                    ? "Piscina"
                    : exercise.lugar === "cualquiera"
                      ? "Casa o gym"
                      : "Exterior"}
            </Badge>
            {exercise.estado_calidad && (
              <Badge variant="outline" className="capitalize">
                {exercise.estado_calidad}
              </Badge>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{isCardio || isTimedExercise ? "Duracion recomendada" : "Rango recomendado"}</p>
              <p className="mt-1 font-semibold">
                {isCardio || isTimedExercise
                  ? `${Math.round((exercise.duracion_promedio_segundos || 1200) / 60)} min`
                  : `${exercise.series_sugeridas || 3} x ${repsMin}-${repsMax}`}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Descanso</p>
              <p className="mt-1 font-semibold">{formatSecondsRange(exercise.descanso_segundos_min, exercise.descanso_segundos_max)}</p>
            </Card>
            {!isCardio && !isTimedExercise && exercise.rir_recomendado !== null && (
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{RIR_LABEL} sugeridas</p>
                <p className="mt-1 font-semibold">{formatRir(exercise.rir_recomendado)}</p>
              </Card>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">Músculos trabajados</h3>
              <Card className="p-4">
                <p className="text-sm">
                  <span className="font-medium">Principal:</span> {primaryMuscle}
                </p>
                {secondaryMuscles.length > 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Secundarios:</span> {secondaryMuscles.join(", ")}
                  </p>
                )}
                {exercise.patron_movimiento && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Patrón:</span> {exercise.patron_movimiento.replaceAll("_", " ")}
                  </p>
                )}
              </Card>
            </div>

            {equipment.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold">Equipo requerido</h3>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">{equipment.join(", ")}</p>
                </Card>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Descripcion</h3>
            <Card className="p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{exercise.descripcion}</p>
            </Card>
          </div>

          {instructions.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">Tecnica paso a paso</h3>
              <Card className="p-4">
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {instructions.map((instruction, index) => (
                    <li key={instruction} className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <MetadataList title="Cues tecnicos" icon={<ListChecks className="h-4 w-4 text-primary" />} items={cues} />
            <MetadataList title="Errores comunes" icon={<AlertTriangle className="h-4 w-4 text-warning" />} items={commonErrors} />
            <MetadataList title="Contraindicaciones" icon={<ShieldAlert className="h-4 w-4 text-destructive" />} items={contraindications} />
            <MetadataList title="Progresiones" icon={<TrendingUp className="h-4 w-4 text-primary" />} items={progressions} />
            <MetadataList title="Regresiones" icon={<ListChecks className="h-4 w-4 text-primary" />} items={regressions} />
          </div>

          {substitutions.length > 0 && (
            <MetadataList title="Sustituciones sugeridas" icon={<Repeat className="h-4 w-4 text-primary" />} items={substitutions} />
          )}

          <div>
            <h3 className="mb-2 font-semibold">Historial real</h3>
            <Card className="p-4 bg-muted/40">
              {progressLoading ? (
                <p className="text-sm text-muted-foreground">Cargando historial...</p>
              ) : progressSummary && progressSummary.sessions.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        Record personal
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="rounded-full text-muted-foreground hover:text-foreground" aria-label={PERSONAL_RECORD_HELP}>
                                <HelpCircle className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>{PERSONAL_RECORD_HELP}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </p>
                      <p className="font-semibold">
                        {progressSummary.prs.maxWeight !== null ? `${progressSummary.prs.maxWeight} kg` : "Sin dato"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reps con mayor peso</p>
                      <p className="font-semibold">{progressSummary.prs.maxRepsAtMaxWeight || "Sin dato"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mejor volumen</p>
                      <p className="font-semibold">{Math.round(progressSummary.prs.maxVolume)} kg</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {progressSummary.sessions.slice(0, 5).map((session) => (
                      <div key={session.sessionId} className="rounded-lg border bg-background p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-medium">
                            {new Date(session.startedAt).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">Volumen: {Math.round(session.totalVolume)} kg</p>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {session.sets.map((set) => (
                            <div key={`${session.sessionId}-${set.setNumber}`} className="text-sm text-muted-foreground">
                              Serie {set.setNumber}: {set.weight || 0} kg x {set.reps || 0}
                              {set.rir !== null ? ` | ${RIR_LABEL}: ${set.rir}` : ""}
                              {set.rpe !== null ? ` | ${RPE_LABEL}: ${set.rpe}/10` : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aún no hay sesiones completadas para este ejercicio.</p>
              )}
            </Card>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <Timer className="h-4 w-4" />
              Sugerencia de progresión
            </h3>
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{progressionSuggestion.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{progressionSuggestion.reason}</p>
                </div>
                <Badge variant="outline">{progressionContextLabel}</Badge>
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
                  <span className="font-medium">{progressionSuggestion.suggestedReps ?? exercise.repeticiones_sugeridas ?? 10}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
