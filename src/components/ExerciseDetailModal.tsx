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

interface ExerciseDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: {
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
  // Si no hay ejercicio, no renderizar nada
  if (!exercise) return null;

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
        </div>
      </DialogContent>
    </Dialog>
  );
};
