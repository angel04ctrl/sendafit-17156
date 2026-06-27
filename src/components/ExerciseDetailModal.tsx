/**
 * ExerciseDetailModal.tsx - Modal de detalles de ejercicio
 * 
 * Este componente muestra información detallada de un ejercicio específico.
 * Se encarga de:
 * - Mostrar video o imagen del ejercicio
 * - Visualizar información del ejercicio (grupo muscular, nivel, lugar)
 * - Mostrar recomendaciones de series y repeticiones
 * - Indicar equipamiento necesario
 * - Mostrar descripción detallada del ejercicio
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Target, MapPin, TrendingUp } from "lucide-react";
import { useExerciseProgressSummary } from "@/hooks/useBackendApi";
import { buildProgressionSuggestion } from "@/lib/progression";

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
    video?: string;
    imagen?: string;
    series_sugeridas?: number;
    repeticiones_sugeridas?: number;
    equipamiento?: string;
  } | null;
}

export const ExerciseDetailModal = ({ open, onOpenChange, exercise }: ExerciseDetailModalProps) => {
  const { data: progressSummary, isLoading: progressLoading } = useExerciseProgressSummary(
    open ? { exerciseId: exercise?.id, exerciseName: exercise?.nombre } : undefined,
  );

  // Si no hay ejercicio, no renderizar nada
  if (!exercise) return null;

  const progressionSuggestion = buildProgressionSuggestion({
    progress: progressSummary,
    targetReps: exercise.repeticiones_sugeridas || 10,
    targetSets: exercise.series_sugeridas || 1,
    targetWeight: null,
    hasStableExerciseId: !!exercise.id,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{exercise.nombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bloque de video o imagen del ejercicio */}
          {exercise.video ? (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <video 
                src={exercise.video} 
                controls 
                className="w-full h-full object-cover"
                poster={exercise.imagen}
              >
                Tu navegador no soporta el elemento de video.
              </video>
            </div>
          ) : exercise.imagen ? (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <img 
                src={exercise.imagen} 
                alt={exercise.nombre}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <Dumbbell className="w-20 h-20 text-muted-foreground" />
            </div>
          )}

          {/* Bloque de badges informativos - Grupo muscular, nivel y lugar */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <Target className="w-3 h-3" />
              {exercise.grupo_muscular}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <TrendingUp className="w-3 h-3" />
              {exercise.nivel === 'B' ? 'Principiante' : exercise.nivel === 'I' ? 'Intermedio' : 'Avanzado'}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <MapPin className="w-3 h-3" />
              {exercise.lugar === 'casa' ? 'Casa' : exercise.lugar === 'gimnasio' ? 'Gimnasio' : 'Exterior'}
            </Badge>
          </div>

          {/* Bloque de recomendaciones - Series y repeticiones sugeridas */}
          {(exercise.series_sugeridas || exercise.repeticiones_sugeridas) && (
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h3 className="font-semibold mb-2">Recomendación</h3>
              <div className="flex gap-4 text-sm">
                {exercise.series_sugeridas && (
                  <div>
                    <span className="text-muted-foreground">Series: </span>
                    <span className="font-medium">{exercise.series_sugeridas}</span>
                  </div>
                )}
                {exercise.repeticiones_sugeridas && (
                  <div>
                    <span className="text-muted-foreground">Repeticiones: </span>
                    <span className="font-medium">{exercise.repeticiones_sugeridas}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Bloque de equipamiento necesario */}
          {exercise.equipamiento && (
            <div>
              <h3 className="font-semibold mb-2">Equipamiento necesario</h3>
              <p className="text-muted-foreground">{exercise.equipamiento}</p>
            </div>
          )}

          {/* Bloque de descripción detallada del ejercicio */}
          <div>
            <h3 className="font-semibold mb-2">Descripción</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {exercise.descripcion}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Historial real</h3>
            <Card className="p-4 bg-muted/40">
              {progressLoading ? (
                <p className="text-sm text-muted-foreground">Cargando historial...</p>
              ) : progressSummary && progressSummary.sessions.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Mayor peso</p>
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
                          <p className="text-sm text-muted-foreground">
                            Volumen: {Math.round(session.totalVolume)} kg
                          </p>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {session.sets.map((set) => (
                            <div key={`${session.sessionId}-${set.setNumber}`} className="text-sm text-muted-foreground">
                              Serie {set.setNumber}: {set.weight || 0} kg x {set.reps || 0}
                              {set.rir !== null ? ` | RIR ${set.rir}` : ""}
                              {set.rpe !== null ? ` | RPE ${set.rpe}` : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aun no hay sesiones completadas para este ejercicio.
                </p>
              )}
            </Card>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Sugerencia de progresion</h3>
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{progressionSuggestion.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{progressionSuggestion.reason}</p>
                </div>
                <Badge variant="outline">
                  Confianza {progressionSuggestion.confidence === "high" ? "alta" : progressionSuggestion.confidence === "medium" ? "media" : "baja"}
                </Badge>
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
