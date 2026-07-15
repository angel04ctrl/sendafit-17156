import { useMemo, useState, type ElementType } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Dumbbell,
  Flame,
  Target,
  TrendingUp,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useAuth } from "@/contexts/AuthContext";
import { useMonthlyReport } from "@/hooks/useBackendApi";
import type { MonthlyReportDay, MonthlyReportExerciseProgress } from "@/lib/api/backend";

const progressChartConfig = {
  weight: {
    label: "Peso",
    color: "hsl(var(--primary))",
  },
  energy_level: {
    label: "Energia",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig;

const workoutChartConfig = {
  calories_burned: {
    label: "Calorias quemadas",
    color: "hsl(var(--secondary))",
  },
  workouts_completed: {
    label: "Entrenamientos",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const exerciseChartConfig = {
  weight: {
    label: "Peso max.",
    color: "hsl(var(--primary))",
  },
  reps: {
    label: "Reps",
    color: "hsl(var(--secondary))",
  },
} satisfies ChartConfig;

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, month, 0));
  const endDate = end.toISOString().slice(0, 10);

  return { startDate, endDate };
}

function getCurrentWeekRange() {
  const today = new Date();
  return {
    startDate: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    endDate: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

function formatCompactDate(date: string) {
  return format(new Date(`${date}T00:00:00`), "d MMM", { locale: es });
}

function formatNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) return "Sin datos";
  return `${Number(value.toFixed(1)).toLocaleString("es-ES")}${suffix}`;
}

function getChartData(daily: MonthlyReportDay[]) {
  return daily.map((day) => ({
    ...day,
    label: formatCompactDate(day.date),
  }));
}

function getAdherenceLabel(completionRate: number, skipped: number) {
  if (completionRate >= 85) return "Semana muy solida. Mantén el ritmo sin perseguir perfeccion.";
  if (completionRate >= 60) return "Buen avance. Revisa que los dias saltados no se acumulen.";
  if (skipped > 0) return "Semana irregular. Prioriza completar la siguiente sesion programada.";
  return "Aun hay poco dato real. Completa una sesion para activar el reporte.";
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed">
      <p className="px-4 text-center text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

const Reports = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const reportRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const weekRange = useMemo(() => getCurrentWeekRange(), []);
  const { data: report, isLoading, isError } = useMonthlyReport(reportRange);
  const { data: weeklyReport, isLoading: weeklyLoading } = useMonthlyReport(weekRange);
  const [selectedExerciseKey, setSelectedExerciseKey] = useState<string>("");

  const chartData = useMemo(() => getChartData(report?.daily || []), [report?.daily]);
  const exerciseOptions = useMemo(
    () => report?.exercise_progress || [],
    [report?.exercise_progress],
  );
  const selectedExercise: MonthlyReportExerciseProgress | null = useMemo(() => {
    if (!exerciseOptions.length) return null;
    if (!selectedExerciseKey) return exerciseOptions[0];
    return exerciseOptions.find((exercise) => (exercise.exercise_id || exercise.exercise_name) === selectedExerciseKey) || exerciseOptions[0];
  }, [exerciseOptions, selectedExerciseKey]);

  const hasProgressData = chartData.some((day) => day.weight !== null || day.energy_level !== null);
  const hasWorkoutData = chartData.some(
    (day) => day.calories_burned > 0 || day.workouts_completed > 0,
  );

  const weeklyCompletion = weeklyReport?.summary.completion_rate || 0;
  const weeklySkipped = weeklyReport?.totals.workouts_skipped || 0;
  const weeklyScheduled = weeklyReport?.totals.workouts_scheduled || 0;
  const weeklyCompleted = weeklyReport?.totals.workouts_completed || 0;
  const weeklyPending = Math.max(weeklyScheduled - weeklyCompleted - weeklySkipped, 0);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="px-4 pb-24 pt-20">
          <Card className="mx-auto max-w-xl p-4">
            <p className="text-sm text-muted-foreground">Inicia sesion para ver tus reportes.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="overflow-x-hidden px-3 pb-16 pt-14 sm:px-4 sm:pb-20 sm:pt-16">
        <div className="mx-auto max-w-7xl space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="mb-1 text-xl font-bold sm:text-2xl lg:text-3xl">Reportes y Progreso</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Progreso real basado en sesiones, series, comidas y calendario.
              </p>
            </div>

            <div className="w-full space-y-1.5 sm:w-56">
              <Label htmlFor="report-month" className="text-xs">Periodo mensual</Label>
              <Input
                id="report-month"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </div>
          </div>

          <Card className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">Resumen semanal</h2>
                <p className="text-sm text-muted-foreground">
                  {formatCompactDate(weekRange.startDate)} - {formatCompactDate(weekRange.endDate)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4 lg:min-w-[520px]">
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-muted-foreground">Adherencia</p>
                  <p className="text-lg font-bold">{weeklyLoading ? "..." : `${weeklyCompletion}%`}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2">
                  <p className="text-muted-foreground">Completados</p>
                  <p className="text-lg font-bold text-primary">{weeklyCompleted}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-2">
                  <p className="text-muted-foreground">Saltados</p>
                  <p className="text-lg font-bold text-amber-700">{weeklySkipped}</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-muted-foreground">Pendientes</p>
                  <p className="text-lg font-bold">{weeklyPending}</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {getAdherenceLabel(weeklyCompletion, weeklySkipped)}
            </p>
          </Card>

          {isLoading ? (
            <Card className="p-6">
              <p className="animate-pulse text-sm text-muted-foreground">Cargando reporte...</p>
            </Card>
          ) : isError ? (
            <Card className="border-amber-200 bg-amber-50 p-6">
              <p className="text-sm text-amber-800">
                Estamos presentando problemas al cargar tus reportes. Intenta de nuevo en unos minutos.
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                <StatTile
                  icon={Dumbbell}
                  label="Cumplimiento"
                  value={`${report?.summary.completion_rate || 0}%`}
                  hint={`${report?.totals.workouts_completed || 0} de ${report?.totals.workouts_scheduled || 0} sesiones`}
                />
                <StatTile
                  icon={Activity}
                  label="Series reales"
                  value={report?.training.completed_sets || 0}
                  hint={`${formatNumber(report?.training.total_volume || 0, " kg")} volumen`}
                />
                <StatTile
                  icon={Target}
                  label="Proteina media"
                  value={`${report?.training.average_protein || 0}g`}
                  hint={`${report?.training.average_calories || 0} kcal/dia`}
                />
                <StatTile
                  icon={TrendingUp}
                  label="Cambio de peso"
                  value={formatNumber(report?.summary.weight_change, " kg")}
                  hint="Periodo seleccionado"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Peso y energia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hasProgressData ? (
                      <ChartContainer config={progressChartConfig} className="h-[280px] w-full">
                        <LineChart data={chartData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                          <YAxis yAxisId="weight" tickLine={false} axisLine={false} width={34} />
                          <YAxis yAxisId="energy" orientation="right" domain={[0, 10]} tickLine={false} axisLine={false} width={34} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="var(--color-weight)" strokeWidth={2} dot={false} connectNulls />
                          <Line yAxisId="energy" type="monotone" dataKey="energy_level" stroke="var(--color-energy_level)" strokeWidth={2} dot={false} connectNulls />
                        </LineChart>
                      </ChartContainer>
                    ) : (
                      <EmptyChart message="Aun no hay registros de peso o energia para este periodo." />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <BarChart3 className="h-4 w-4 text-secondary" />
                      Entrenamientos y calorias
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hasWorkoutData ? (
                      <ChartContainer config={workoutChartConfig} className="h-[280px] w-full">
                        <BarChart data={chartData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                          <YAxis tickLine={false} axisLine={false} width={42} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="calories_burned" fill="var(--color-calories_burned)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="workouts_completed" fill="var(--color-workouts_completed)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <EmptyChart message="Aun no hay entrenamientos completados para este periodo." />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Dumbbell className="h-4 w-4 text-primary" />
                      Musculos entrenados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report?.training.muscles?.length ? (
                      <div className="space-y-2">
                        {report.training.muscles.slice(0, 8).map((muscle) => (
                          <div key={muscle.muscle} className="flex items-center justify-between rounded-md bg-muted/60 p-3 text-sm">
                            <div>
                              <p className="font-medium capitalize">{muscle.muscle}</p>
                              <p className="text-xs text-muted-foreground">{formatNumber(muscle.volume, " kg")} volumen</p>
                            </div>
                            <span className="rounded-md bg-background px-2 py-1 text-xs font-semibold">{muscle.sets} series</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Completa sesiones con series registradas para ver distribucion muscular.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <CalendarDays className="h-4 w-4 text-accent" />
                      Nutricion del periodo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Calorias consumidas</p>
                        <p className="text-lg font-semibold">{(report?.totals.calories_consumed || 0).toLocaleString("es-ES")}</p>
                      </div>
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Proteina</p>
                        <p className="text-lg font-semibold">{report?.totals.protein || 0}g</p>
                      </div>
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Carbohidratos</p>
                        <p className="text-lg font-semibold">{report?.totals.carbs || 0}g</p>
                      </div>
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Grasas</p>
                        <p className="text-lg font-semibold">{report?.totals.fat || 0}g</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Flame className="h-4 w-4 text-primary" />
                      Progreso por ejercicio
                    </CardTitle>
                    {exerciseOptions.length > 0 && (
                      <div className="w-full sm:w-72">
                        <Select
                          value={selectedExercise?.exercise_id || selectedExercise?.exercise_name || ""}
                          onValueChange={setSelectedExerciseKey}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona ejercicio" />
                          </SelectTrigger>
                          <SelectContent>
                            {exerciseOptions.map((exercise) => (
                              <SelectItem key={exercise.exercise_id || exercise.exercise_name} value={exercise.exercise_id || exercise.exercise_name}>
                                {exercise.exercise_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedExercise ? (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
                      <ChartContainer config={exerciseChartConfig} className="h-[280px] w-full">
                        <LineChart data={selectedExercise.trend.map((point) => ({ ...point, label: formatCompactDate(point.date) }))} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                          <YAxis yAxisId="weight" tickLine={false} axisLine={false} width={42} />
                          <YAxis yAxisId="reps" orientation="right" tickLine={false} axisLine={false} width={34} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="var(--color-weight)" strokeWidth={2} connectNulls />
                          <Line yAxisId="reps" type="monotone" dataKey="reps" stroke="var(--color-reps)" strokeWidth={2} />
                        </LineChart>
                      </ChartContainer>
                      <div className="grid grid-cols-2 gap-2 text-sm xl:grid-cols-1">
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-xs text-muted-foreground">Ultima sesion</p>
                          <p className="font-semibold">{selectedExercise.last_session_date ? formatCompactDate(selectedExercise.last_session_date) : "Sin datos"}</p>
                        </div>
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-xs text-muted-foreground">Mejor peso</p>
                          <p className="font-semibold">{formatNumber(selectedExercise.max_weight, " kg")}</p>
                        </div>
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-xs text-muted-foreground">Series / reps</p>
                          <p className="font-semibold">{selectedExercise.sets} / {selectedExercise.reps}</p>
                        </div>
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-xs text-muted-foreground">Volumen</p>
                          <p className="font-semibold">{formatNumber(selectedExercise.volume, " kg")}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyChart message="Completa series registrando reps y peso para activar progreso por ejercicio." />
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
