import { useMemo, useState } from "react";
import { CalendarClock, Forward, PlayCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMoveWorkoutToDate, useSkipWorkout } from "@/hooks/useBackendApi";
import { useAuth } from "@/contexts/AuthContext";
import { logAppError } from "@/lib/appErrorLogger";

export type SkipWorkoutReason = "no_time" | "tired" | "pain" | "travel" | "other";

interface AdaptiveWorkoutActionsProps {
  workout: {
    id: string;
    name: string;
    scheduled_date: string;
    completed?: boolean | null;
    skipped?: boolean | null;
  };
  weekWorkouts?: Array<{
    id: string;
    scheduled_date: string;
    completed?: boolean | null;
    skipped?: boolean | null;
  }>;
  onStartWorkout?: () => void;
  size?: "sm" | "default";
  showStart?: boolean;
}

const skipReasonLabels: Record<SkipWorkoutReason, string> = {
  no_time: "Sin tiempo",
  tired: "Cansancio",
  pain: "Dolor o molestia",
  travel: "Viaje",
  other: "Otro",
};

function formatRpcError(error: unknown) {
  const raw = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  } | null | undefined;
  const message = [
    raw?.message,
    raw?.details,
    raw?.hint,
    raw?.code,
    error instanceof Error ? error.message : String(error || ""),
  ].filter(Boolean).join(" ");

  if (message.includes("workout_date_conflict")) return "Ya hay un entrenamiento pendiente en esa fecha.";
  if (message.includes("completed_workout_cannot_move")) return "No puedes mover un entrenamiento completado.";
  if (message.includes("completed_workout_cannot_skip")) return "No puedes saltar un entrenamiento completado.";
  if (message.includes("function") && message.includes("does not exist")) {
    return "Falta aplicar la migracion de calendario adaptativo en Supabase.";
  }
  if (message.includes("permission denied")) return "No tienes permiso para modificar este entrenamiento.";

  return message.trim()
    ? `No se pudo actualizar el calendario: ${message}`
    : "No se pudo actualizar el calendario.";
}

export function AdaptiveWorkoutActions({
  workout,
  weekWorkouts = [],
  onStartWorkout,
  size = "sm",
  showStart = true,
}: AdaptiveWorkoutActionsProps) {
  const { user } = useAuth();
  const [moveOpen, setMoveOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [targetDate, setTargetDate] = useState(workout.scheduled_date);
  const [skipReason, setSkipReason] = useState<SkipWorkoutReason>("no_time");
  const moveMutation = useMoveWorkoutToDate();
  const skipMutation = useSkipWorkout();

  const disabled = !!workout.completed || !!workout.skipped;
  const hasLocalConflict = useMemo(() => {
    return weekWorkouts.some((candidate) =>
      candidate.id !== workout.id
      && candidate.scheduled_date === targetDate
      && candidate.completed !== true
      && candidate.skipped !== true,
    );
  }, [targetDate, weekWorkouts, workout.id]);

  const handleMove = async () => {
    if (!targetDate || targetDate === workout.scheduled_date) {
      setMoveOpen(false);
      return;
    }

    if (hasLocalConflict) {
      toast.error("Ya hay un entrenamiento pendiente en esa fecha");
      return;
    }

    const confirmed = confirm(`Mover "${workout.name}" a ${targetDate}?`);
    if (!confirmed) return;

    try {
      await moveMutation.mutateAsync({ workoutId: workout.id, newDate: targetDate });
      toast.success("Entrenamiento movido");
      setMoveOpen(false);
    } catch (error) {
      console.error("Error moving workout:", error);
      toast.error(formatRpcError(error));
      void logAppError({
        userId: user?.id,
        source: "calendar-move-workout",
        message: error instanceof Error ? error.message : "No se pudo mover entrenamiento",
        severity: "error",
        details: { workoutId: workout.id, fromDate: workout.scheduled_date, toDate: targetDate },
      });
    }
  };

  const handleSkip = async () => {
    const confirmed = confirm(`Marcar "${workout.name}" como saltado?`);
    if (!confirmed) return;

    try {
      await skipMutation.mutateAsync({ workoutId: workout.id, reason: skipReason });
      toast.success("Entrenamiento saltado");
      setSkipOpen(false);
    } catch (error) {
      console.error("Error skipping workout:", error);
      toast.error(formatRpcError(error));
      void logAppError({
        userId: user?.id,
        source: "calendar-skip-workout",
        message: error instanceof Error ? error.message : "No se pudo saltar entrenamiento",
        severity: "error",
        details: { workoutId: workout.id, reason: skipReason },
      });
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {showStart && onStartWorkout && !workout.completed && !workout.skipped && (
          <Button size={size} onClick={onStartWorkout}>
            <PlayCircle className="mr-1.5 h-4 w-4" />
            Abrir
          </Button>
        )}
        <Button
          type="button"
          size={size}
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setTargetDate(workout.scheduled_date);
            setMoveOpen(true);
          }}
        >
          <CalendarClock className="mr-1.5 h-4 w-4" />
          Mover
        </Button>
        <Button
          type="button"
          size={size}
          variant="outline"
          disabled={disabled}
          onClick={() => setSkipOpen(true)}
        >
          <Forward className="mr-1.5 h-4 w-4" />
          Saltar
        </Button>
      </div>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover entrenamiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Entrenamiento</p>
              <p className="font-semibold">{workout.name}</p>
            </div>
            <div className="space-y-2">
              <Label>Nueva fecha</Label>
              <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
              {hasLocalConflict && (
                <p className="text-sm text-destructive">Ya existe un entrenamiento pendiente ese dia.</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setMoveOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleMove} disabled={moveMutation.isPending || hasLocalConflict}>
                Guardar cambio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saltar entrenamiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Se conservara el historial y el entrenamiento quedara marcado como saltado.</p>
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={skipReason} onValueChange={(value) => setSkipReason(value as SkipWorkoutReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(skipReasonLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setSkipOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleSkip} disabled={skipMutation.isPending}>
                Marcar como saltado
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { skipReasonLabels };
