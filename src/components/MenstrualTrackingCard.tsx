import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Heart, 
  CalendarDays, 
  Plus, 
  Droplets, 
  Sun, 
  Sparkles, 
  Moon,
  TrendingUp,
  Clock,
  Trash2
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  useMenstrualLogs, 
  useMenstrualPhase, 
  useLogPeriod, 
  useDeleteMenstrualLog,
  MenstrualLog 
} from "@/hooks/useMenstrualTracking";

interface PhaseConfig {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
  tips: string[];
}

const phaseConfigs: Record<string, PhaseConfig> = {
  menstrual: {
    name: "Menstrual",
    icon: <Droplets className="w-5 h-5" />,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    description: "Fase de descanso y recuperación",
    tips: [
      "Reduce la intensidad del ejercicio",
      "Prioriza estiramientos y yoga",
      "Aumenta el consumo de hierro"
    ]
  },
  folicular: {
    name: "Folicular",
    icon: <Sun className="w-5 h-5" />,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    description: "Energía en aumento",
    tips: [
      "Ideal para entrenamientos intensos",
      "Prueba nuevos ejercicios",
      "Tu cuerpo recupera más rápido"
    ]
  },
  ovulacion: {
    name: "Ovulación",
    icon: <Sparkles className="w-5 h-5" />,
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "Máxima energía y fuerza",
    tips: [
      "Momento óptimo para PRs",
      "Máxima capacidad de fuerza",
      "Aprovecha para HIIT"
    ]
  },
  lutea: {
    name: "Lútea",
    icon: <Moon className="w-5 h-5" />,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    description: "Preparación para el siguiente ciclo",
    tips: [
      "Reduce intensidad gradualmente",
      "Enfócate en cardio moderado",
      "Aumenta proteínas"
    ]
  }
};

export const MenstrualTrackingCard = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: logs, isLoading: logsLoading } = useMenstrualLogs();
  const { data: phaseInfo, isLoading: phaseLoading } = useMenstrualPhase();
  const logPeriodMutation = useLogPeriod();
  const deleteLogMutation = useDeleteMenstrualLog();

  const handleLogPeriod = async () => {
    if (!selectedDate) {
      toast.error("Selecciona una fecha");
      return;
    }

    try {
      await logPeriodMutation.mutateAsync({
        period_start_date: format(selectedDate, 'yyyy-MM-dd'),
        cycle_length: cycleLength,
        period_length: periodLength,
      });
      toast.success("Periodo registrado correctamente");
      setIsAddDialogOpen(false);
      setSelectedDate(new Date());
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        toast.error("Ya existe un registro para esta fecha");
      } else {
        toast.error("Error al registrar el periodo");
      }
    }
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      await deleteLogMutation.mutateAsync(logId);
      toast.success("Registro eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const currentPhase = phaseInfo?.phase ? phaseConfigs[phaseInfo.phase] : null;
  const isLoading = logsLoading || phaseLoading;

  if (isLoading) {
    return (
      <Card className="bg-card border-border/50">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />
            Ciclo Menstrual
            <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
              PRO
            </Badge>
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="w-4 h-4" />
                Registrar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-rose-500" />
                  Registrar Periodo
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Date Picker */}
                <div className="space-y-2">
                  <Label>Fecha de inicio del periodo</Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {selectedDate ? (
                          format(selectedDate, "PPP", { locale: es })
                        ) : (
                          <span>Selecciona una fecha</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          setIsCalendarOpen(false);
                        }}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Cycle Length */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Duración del ciclo</Label>
                    <span className="text-sm font-medium text-primary">{cycleLength} días</span>
                  </div>
                  <Slider
                    value={[cycleLength]}
                    onValueChange={(value) => setCycleLength(value[0])}
                    min={21}
                    max={40}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Promedio: 28 días (normal: 21-35 días)
                  </p>
                </div>

                {/* Period Length */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Duración del periodo</Label>
                    <span className="text-sm font-medium text-rose-500">{periodLength} días</span>
                  </div>
                  <Slider
                    value={[periodLength]}
                    onValueChange={(value) => setPeriodLength(value[0])}
                    min={2}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                </div>

                <Button 
                  onClick={handleLogPeriod} 
                  className="w-full"
                  disabled={logPeriodMutation.isPending}
                >
                  {logPeriodMutation.isPending ? "Guardando..." : "Guardar Registro"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Phase Display */}
        {currentPhase && phaseInfo ? (
          <div className={cn("rounded-xl p-4", currentPhase.bgColor)}>
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-lg bg-background/80", currentPhase.color)}>
                {currentPhase.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn("font-semibold", currentPhase.color)}>
                    Fase {currentPhase.name}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    Día {phaseInfo.dayOfCycle}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {currentPhase.description}
                </p>
                
                {/* Tips */}
                <div className="space-y-1.5">
                  {currentPhase.tips.map((tip, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs text-foreground/80">
                      <TrendingUp className="w-3 h-3 text-primary flex-shrink-0" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Next Period Prediction */}
            {phaseInfo.nextPeriodDate && (
              <div className="mt-4 pt-3 border-t border-foreground/10 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Próximo periodo: {format(phaseInfo.nextPeriodDate, "d 'de' MMMM", { locale: es })}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl p-6 bg-muted/50 text-center">
            <Droplets className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              No hay registros de ciclo
            </p>
            <p className="text-xs text-muted-foreground">
              Registra tu periodo para ver predicciones y consejos personalizados
            </p>
          </div>
        )}

        {/* Recent Logs */}
        {logs && logs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Historial reciente</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {logs.slice(0, 3).map((log: MenstrualLog) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-rose-400" />
                    <span>{format(new Date(log.period_start_date), "d MMM yyyy", { locale: es })}</span>
                    <span className="text-muted-foreground">({log.cycle_length} días)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteLog(log.id)}
                    disabled={deleteLogMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
