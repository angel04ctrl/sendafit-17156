/**
 * RoutineManager.tsx - Componente gestor de rutinas
 * 
 * Este componente muestra la rutina asignada al usuario y sus estadísticas de progreso.
 * Se encarga de:
 * - Mostrar estadísticas de entrenamientos, racha y cambio de peso
 * - Visualizar la rutina actual con sus ejercicios por día
 * - Permitir expandir/colapsar ejercicios de cada día
 * - Adaptarse a móvil y desktop con diseño responsivo
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Dumbbell, TrendingUp, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  useUserRoutine,
  useProgressStats
} from "@/hooks/useBackendApi";
import { planDayToName } from "@/lib/dayMapping";

export function RoutineManager() {
  // Hook para obtener la rutina asignada al usuario
  const { data: routineData, isLoading: isLoadingRoutine } = useUserRoutine();
  
  // Hook para obtener estadísticas de progreso (últimos 30 días)
  const { data: statsData } = useProgressStats(30);

  // Mostrar spinner de carga mientras se obtiene la rutina
  if (isLoadingRoutine) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3 h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-3 pt-2 sm:px-4 sm:pt-3">
        <h1 className="text-lg sm:text-2xl font-bold">Gestor de Rutinas</h1>
      </div>

      {/* Bloque de tarjetas de estadísticas - Entrenamientos, racha y peso */}
      {statsData?.stats && (
        <div className="grid gap-2 grid-cols-3 shrink-0 px-3 sm:px-4">
          {/* Card de total de entrenamientos */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Entrenamientos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-lg sm:text-2xl font-bold">{statsData.stats.total_workouts ?? 0}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">30 días</p>
            </CardContent>
          </Card>

          {/* Card de racha de días consecutivos */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Racha
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-lg sm:text-2xl font-bold">{statsData.stats.workout_streak ?? 0}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">días</p>
            </CardContent>
          </Card>

          {/* Card de cambio de peso */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Peso
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="flex items-center gap-1">
                <div className="text-lg sm:text-2xl font-bold">
                  {(statsData.stats.weight_change ?? 0) > 0 ? '+' : ''}
                  {(statsData.stats.weight_change ?? 0).toFixed(1)}
                </div>
                <TrendingUp className={`h-3 w-3 sm:h-4 sm:w-4 ${(statsData.stats.weight_change ?? 0) > 0 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">kg</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bloque de rutina actual - Muestra detalles del plan asignado */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4">
        {routineData?.routine ? (
          <Card className="shadow-sm h-full flex flex-col">
            {/* Header de la rutina con nombre, descripción y badges */}
            <CardHeader className="p-3 sm:p-4 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg truncate">{routineData.routine.nombre_plan}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm line-clamp-2">{routineData.routine.descripcion_plan}</CardDescription>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-xs shrink-0 mb-1">{routineData.routine.lugar}</Badge>
                  <Badge variant="outline" className="text-xs shrink-0 capitalize">{routineData.routine.nivel}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-3 sm:p-4 pt-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm shrink-0">
                <div>
                  <span className="text-muted-foreground">Objetivo:</span>
                  <span className="ml-2 font-medium capitalize">{routineData.routine.objetivo?.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Frecuencia:</span>
                  <span className="ml-2 font-medium">{routineData.routine.dias_semana} días/sem</span>
                </div>
              </div>

              {/* Bloque de distribución semanal - Lista de ejercicios por día colapsables */}
              {routineData.routine.days && Object.keys(routineData.routine.days).length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm sm:text-base shrink-0">Distribución Semanal:</h4>
                  <div className="space-y-2">
                    {/* Mapear cada día de la semana con sus ejercicios */}
                    {Object.entries(routineData.routine.days).map(([day, exercises]: [string, any[]]) => (
                       <Collapsible key={day} className="space-y-1">
                        {/* Trigger para expandir/colapsar día */}
                        <CollapsibleTrigger className="w-full flex justify-between items-center p-2 bg-muted rounded-md text-left hover:bg-muted/80 transition-colors">
                          <span className="font-medium text-sm">{planDayToName(parseInt(day))}: {exercises[0]?.grupo_muscular || 'Variado'}</span>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        {/* Contenido colapsable con lista de ejercicios */}
                        <CollapsibleContent className="overflow-hidden">
                          <ul className="space-y-1.5 p-2 border rounded-md bg-card/50 max-h-60 overflow-y-auto">
                            {exercises.map((exercise: any, idx: number) => (
                              <li key={`${day}-${exercise.id}-${idx}`} className="flex items-center gap-2 text-xs sm:text-sm py-1">
                                <Dumbbell className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
                                <span className="flex-1 truncate">{exercise.nombre}</span>
                                <span className="text-muted-foreground text-xs shrink-0">
                                  ({exercise.series_sugeridas || 3}x{exercise.repeticiones_sugeridas || 10})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No se encontraron ejercicios para este plan.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm h-full flex items-center justify-center">
            <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
              <Dumbbell className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No hay rutina asignada</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Completa el proceso de onboarding para obtener tu rutina personalizada
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
