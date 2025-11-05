import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Dumbbell, Target, AlertCircle } from "lucide-react";

interface PlanChangePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  validationData: {
    action: string;
    reason: string;
    changes: {
      goalChanged: boolean;
      weekdaysCountChanged: boolean;
      weekdaysChanged: boolean;
      oldGoal: string;
      newGoal: string;
      oldWeekdays: string[];
      newWeekdays: string[];
      oldDaysCount: number;
      newDaysCount: number;
    };
    impact: {
      affectedWorkoutsCount: number;
      completedWorkoutsCount: number;
      pendingWorkoutsCount: number;
    };
    currentPlan?: {
      nombre_plan: string;
      dias_semana: number;
      objetivo: string;
    };
  } | null;
  isLoading: boolean;
}

const goalLabels: Record<string, string> = {
  'perder_peso': 'Perder peso',
  'aumentar_masa_muscular': 'Aumentar masa muscular',
  'tonificar': 'Tonificar',
  'mantener_peso': 'Mantener peso',
};

const dayLabels: Record<string, string> = {
  'L': 'Lunes',
  'M': 'Martes',
  'X': 'Miércoles',
  'J': 'Jueves',
  'V': 'Viernes',
  'S': 'Sábado',
  'D': 'Domingo',
};

export function PlanChangePreviewModal({
  open,
  onOpenChange,
  onConfirm,
  validationData,
  isLoading
}: PlanChangePreviewModalProps) {
  if (!validationData) return null;

  const { changes, impact, currentPlan, reason, action } = validationData;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Confirmación de cambios en tu plan
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {reason}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 my-4">
          {/* Current Plan Info */}
          {currentPlan && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 text-sm">Plan actual</h4>
              <p className="text-sm text-muted-foreground">{currentPlan.nombre_plan}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{currentPlan.dias_semana} días/semana</Badge>
                <Badge variant="outline">{goalLabels[currentPlan.objetivo] || currentPlan.objetivo}</Badge>
              </div>
            </div>
          )}

          {/* Changes Summary */}
          <div className="space-y-3">
            {changes.goalChanged && (
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <Target className="h-5 w-5 mt-0.5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Objetivo de fitness</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground line-through">
                      {goalLabels[changes.oldGoal] || changes.oldGoal}
                    </span>
                    <span className="text-sm">→</span>
                    <span className="text-sm font-medium text-primary">
                      {goalLabels[changes.newGoal] || changes.newGoal}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {changes.weekdaysCountChanged && (
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <Dumbbell className="h-5 w-5 mt-0.5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Cantidad de días</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground line-through">
                      {changes.oldDaysCount} días/semana
                    </span>
                    <span className="text-sm">→</span>
                    <span className="text-sm font-medium text-primary">
                      {changes.newDaysCount} días/semana
                    </span>
                  </div>
                </div>
              </div>
            )}

            {changes.weekdaysChanged && !changes.weekdaysCountChanged && (
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <Calendar className="h-5 w-5 mt-0.5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Días de entrenamiento</p>
                  <div className="space-y-1 mt-1">
                    <div className="flex flex-wrap gap-1">
                      {changes.oldWeekdays.map(day => (
                        <Badge key={day} variant="outline" className="text-xs line-through">
                          {dayLabels[day] || day}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-sm">↓</span>
                    <div className="flex flex-wrap gap-1">
                      {changes.newWeekdays.map(day => (
                        <Badge key={day} variant="default" className="text-xs">
                          {dayLabels[day] || day}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Impact */}
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Impacto en tus entrenamientos
            </h4>
            <div className="space-y-1 text-sm">
              {action === 'reassign_and_redistribute' && (
                <p>• Se creará un nuevo plan personalizado y se redistribuirán tus entrenamientos</p>
              )}
              {action === 'reassign' && (
                <p>• Se asignará un nuevo plan que se ajusta a tu nuevo objetivo</p>
              )}
              {action === 'redistribute' && (
                <p>• Tus entrenamientos se redistribuirán en los nuevos días seleccionados</p>
              )}
              {impact.pendingWorkoutsCount > 0 && (
                <p>• {impact.pendingWorkoutsCount} entrenamientos pendientes serán actualizados</p>
              )}
              {impact.completedWorkoutsCount > 0 && (
                <p className="text-muted-foreground">
                  • {impact.completedWorkoutsCount} entrenamientos completados se mantendrán intactos
                </p>
              )}
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Actualizando...' : 'Confirmar cambios'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
