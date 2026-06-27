import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar, Dumbbell, Target } from "lucide-react";

interface PlanChangePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  planAction: string;
  onPlanActionChange: (action: string) => void;
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
    planProtection?: {
      isProtected: boolean;
      reason: string;
      planType: string;
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
  perder_peso: "Perder peso",
  aumentar_masa_muscular: "Aumentar masa muscular",
  tonificar: "Tonificar",
  mantener_peso: "Mantener peso",
};

const dayLabels: Record<string, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miercoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sabado",
  D: "Domingo",
};

export function PlanChangePreviewModal({
  open,
  onOpenChange,
  onConfirm,
  planAction,
  onPlanActionChange,
  validationData,
  isLoading,
}: PlanChangePreviewModalProps) {
  if (!validationData) return null;

  const { changes, impact, currentPlan, reason, action, planProtection } = validationData;
  const isProtected = Boolean(planProtection?.isProtected);

  const protectedOptions = [
    ["keep", "Mantener mi plan actual"],
    ["adapt", "Mantener plan y ajustar manualmente despues"],
    ["new_suggested", "Crear nuevo plan sugerido despues"],
    ["archive_replace", "Adaptacion avanzada proximamente"],
  ];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Confirmacion de cambios en tu plan
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {isProtected
              ? "Cambiaste tus dias de entrenamiento. Tu plan actual puede no coincidir con tu nueva disponibilidad. Puedes mantenerlo, crear uno nuevo o adaptarlo manualmente."
              : reason}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 space-y-4">
          {currentPlan && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="mb-2 text-sm font-semibold">Plan actual</h4>
              <p className="text-sm text-muted-foreground">{currentPlan.nombre_plan}</p>
              <div className="mt-2 flex gap-2">
                <Badge variant="outline">{currentPlan.dias_semana} dias/semana</Badge>
                <Badge variant="outline">{goalLabels[currentPlan.objetivo] || currentPlan.objetivo}</Badge>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {changes.goalChanged && (
              <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                <Target className="mt-0.5 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Objetivo de fitness</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">
                      {goalLabels[changes.oldGoal] || changes.oldGoal}
                    </span>
                    <span className="text-sm">a</span>
                    <span className="text-sm font-medium text-primary">
                      {goalLabels[changes.newGoal] || changes.newGoal}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {changes.weekdaysCountChanged && (
              <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                <Dumbbell className="mt-0.5 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Cantidad de dias</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">
                      {changes.oldDaysCount} dias/semana
                    </span>
                    <span className="text-sm">a</span>
                    <span className="text-sm font-medium text-primary">
                      {changes.newDaysCount} dias/semana
                    </span>
                  </div>
                </div>
              </div>
            )}

            {changes.weekdaysChanged && !changes.weekdaysCountChanged && (
              <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                <Calendar className="mt-0.5 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Dias de entrenamiento</p>
                  <div className="mt-1 space-y-1">
                    <div className="flex flex-wrap gap-1">
                      {changes.oldWeekdays.map((day) => (
                        <Badge key={day} variant="outline" className="text-xs line-through">
                          {dayLabels[day] || day}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {changes.newWeekdays.map((day) => (
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

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4" />
              Impacto en tus entrenamientos
            </h4>
            <div className="space-y-1 text-sm">
              {isProtected ? (
                <>
                  <p>No se reemplazara automaticamente tu plan protegido.</p>
                  <p>Tus entrenamientos personalizados, manuales o de IA se conservan en Entrenamientos e Historial.</p>
                </>
              ) : (
                <>
                  {action === "reassign_and_redistribute" && (
                    <p>Se creara un nuevo plan sugerido y se redistribuiran tus entrenamientos pendientes.</p>
                  )}
                  {action === "reassign" && (
                    <p>Se asignara un nuevo plan que se ajusta a tu nuevo objetivo.</p>
                  )}
                  {action === "redistribute" && (
                    <p>Tus entrenamientos se redistribuiran en los nuevos dias seleccionados.</p>
                  )}
                </>
              )}
              {impact.pendingWorkoutsCount > 0 && (
                <p>
                  {impact.pendingWorkoutsCount} entrenamientos pendientes{" "}
                  {isProtected ? "se revisaran antes de cualquier cambio." : "seran actualizados."}
                </p>
              )}
              {impact.completedWorkoutsCount > 0 && (
                <p className="text-muted-foreground">
                  {impact.completedWorkoutsCount} entrenamientos completados se mantendran intactos.
                </p>
              )}
            </div>
          </div>

          {isProtected && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
              <h4 className="mb-2 text-sm font-semibold">Plan protegido</h4>
              <p className="mb-3 text-sm text-muted-foreground">
                {planProtection?.reason || "Tu plan actual puede ser personalizado o creado por IA. No se reemplazara sin confirmacion."}
              </p>
              <div className="space-y-2 text-sm">
                {protectedOptions.map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-md border bg-background p-2">
                    <input
                      type="radio"
                      name="plan-change-action"
                      value={value}
                      checked={planAction === value}
                      onChange={() => onPlanActionChange(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Actualizando..." : "Confirmar cambios"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
