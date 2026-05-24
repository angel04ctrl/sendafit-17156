import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3, CalendarDays, Dumbbell, Flame, TrendingUp, Zap } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useAuth } from "@/contexts/AuthContext";
import { useMonthlyReport } from "@/hooks/useBackendApi";
import type { MonthlyReportDay } from "@/lib/api/backend";

const progressChartConfig = {
  weight: {
    label: "Peso",
    color: "hsl(var(--primary))",
  },
  energy_level: {
    label: "Energía",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig;

const workoutChartConfig = {
  calories_burned: {
    label: "Calorías quemadas",
    color: "hsl(var(--secondary))",
  },
  workouts_completed: {
    label: "Entrenamientos",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, month, 0));
  const endDate = end.toISOString().slice(0, 10);

  return { startDate, endDate };
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

const Reports = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const reportRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const { data: report, isLoading, isError } = useMonthlyReport(reportRange);
  const chartData = useMemo(() => getChartData(report?.daily || []), [report?.daily]);

  const hasProgressData = chartData.some((day) => day.weight !== null || day.energy_level !== null);
  const hasWorkoutData = chartData.some(
    (day) => day.calories_burned > 0 || day.workouts_completed > 0,
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-20 pb-24 px-4">
          <Card className="max-w-xl mx-auto p-4">
            <p className="text-sm text-muted-foreground">
              Inicia sesión para ver tus reportes.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-14 sm:pt-16 pb-16 sm:pb-20 px-3 sm:px-4 overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">
                Reportes Mensuales
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Analiza tu progreso, energía, entrenamientos y nutrición.
              </p>
            </div>

            <div className="w-full sm:w-56 space-y-1.5">
              <Label htmlFor="report-month" className="text-xs">
                Mes
              </Label>
              <Input
                id="report-month"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </div>
          </div>

          <FeatureGate feature="advanced_stats">
            {isLoading ? (
              <Card className="p-6">
                <p className="text-sm text-muted-foreground animate-pulse">
                  Cargando reporte...
                </p>
              </Card>
            ) : isError ? (
              <Card className="p-6 border-amber-200 bg-amber-50">
                <p className="text-sm text-amber-800">
                  Estamos presentando problemas al cargar tus reportes. Intenta de nuevo en unos minutos.
                </p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  <Card className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Dumbbell className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium">Cumplimiento</span>
                    </div>
                    <p className="text-2xl font-bold">{report?.summary.completion_rate || 0}%</p>
                    <p className="text-xs text-muted-foreground">
                      {report?.totals.workouts_completed || 0} de {report?.totals.workouts_scheduled || 0}
                    </p>
                  </Card>

                  <Card className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Flame className="w-4 h-4 text-secondary" />
                      <span className="text-xs font-medium">Calorías</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {(report?.totals.calories_burned || 0).toLocaleString("es-ES")}
                    </p>
                    <p className="text-xs text-muted-foreground">Quemadas</p>
                  </Card>

                  <Card className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Zap className="w-4 h-4 text-accent" />
                      <span className="text-xs font-medium">Energía media</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatNumber(report?.summary.average_energy_level, "/10")}
                    </p>
                    <p className="text-xs text-muted-foreground">Según registros</p>
                  </Card>

                  <Card className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium">Cambio de peso</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatNumber(report?.summary.weight_change, " kg")}
                    </p>
                    <p className="text-xs text-muted-foreground">Periodo seleccionado</p>
                  </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        Peso y energía
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {hasProgressData ? (
                        <ChartContainer config={progressChartConfig} className="h-[280px] w-full">
                          <LineChart data={chartData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              minTickGap={24}
                            />
                            <YAxis yAxisId="weight" tickLine={false} axisLine={false} width={34} />
                            <YAxis yAxisId="energy" orientation="right" domain={[0, 10]} tickLine={false} axisLine={false} width={34} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line
                              yAxisId="weight"
                              type="monotone"
                              dataKey="weight"
                              stroke="var(--color-weight)"
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                            />
                            <Line
                              yAxisId="energy"
                              type="monotone"
                              dataKey="energy_level"
                              stroke="var(--color-energy_level)"
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                            />
                          </LineChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center rounded-md border border-dashed">
                          <p className="text-sm text-muted-foreground text-center px-4">
                            Aún no hay registros de peso o energía para este mes.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-secondary" />
                        Entrenamientos y calorías
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {hasWorkoutData ? (
                        <ChartContainer config={workoutChartConfig} className="h-[280px] w-full">
                          <BarChart data={chartData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              minTickGap={24}
                            />
                            <YAxis tickLine={false} axisLine={false} width={42} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="calories_burned" fill="var(--color-calories_burned)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="workouts_completed" fill="var(--color-workouts_completed)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center rounded-md border border-dashed">
                          <p className="text-sm text-muted-foreground text-center px-4">
                            Aún no hay entrenamientos completados para este mes.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-accent" />
                      Resumen nutricional
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Calorías consumidas</p>
                        <p className="text-lg font-semibold">
                          {(report?.totals.calories_consumed || 0).toLocaleString("es-ES")}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Proteína</p>
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
              </>
            )}
          </FeatureGate>
        </div>
      </div>
    </div>
  );
};

export default Reports;
