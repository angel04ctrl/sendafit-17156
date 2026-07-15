/**
 * Dashboard.tsx - Página principal del dashboard
 * 
 * Este documento muestra el resumen principal de la aplicación del usuario.
 * Se encarga de:
 * - Mostrar estadísticas de calorías, proteínas, ejercicio y nivel
 * - Visualizar progreso de macros diarios
 * - Listar entrenamientos del día (completados y pendientes)
 * - Mostrar el gestor de rutinas con plan asignado
 * - Ofrecer funciones PRO (análisis avanzado, consejos)
 * - Adaptar vista móvil con carousel y vista desktop con grid
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/StatCard";
import { Flame, Activity, Target, TrendingUp, BarChart3, Dumbbell, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ProButton } from "@/components/ProButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { RoutineManager } from "@/components/RoutineManager";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardMobileCarousel } from "@/components/DashboardMobileCarousel";
import { useTodaysWorkouts, useWeeklyWorkouts } from "@/hooks/useBackendApi";

type DashboardWorkoutSummary = {
  completed?: boolean | null;
  skipped?: boolean | null;
};

const Dashboard = () => {
  // Hook de autenticación
  const { user } = useAuth();
  const navigate = useNavigate();
  const sb = supabase as any;
  // Estados de datos del usuario
  const [profile, setProfile] = useState<any>(null);
  const [todayMacros, setTodayMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  
  // Hook para obtener entrenamientos del día desde backend API
  const { data: todaysData } = useTodaysWorkouts();
  const weekStart = useMemo(
    () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [],
  );
  const { data: weeklyWorkouts = [] } = useWeeklyWorkouts(user?.id, weekStart);
  const todayWorkouts = todaysData?.workouts || [];
  const completedToday = todayWorkouts.filter((workout) => workout.completed).length;
  const pendingToday = todayWorkouts.filter((workout) => !workout.completed);
  const nextWorkout = pendingToday[0];
  const goToReports = () => navigate("/reports");
  const showSecondaryDashboardCards = location.search.includes("showSecondaryDashboardCards=true");

  // Bloque de carga inicial - Obtiene perfil del usuario y comidas del día
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Obtener perfil del usuario
        const { data: profileData } = await sb
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();



        setProfile(profileData);

        const today = format(new Date(), "yyyy-MM-dd");

        // Obtener comidas del día
        const { data: mealsData } = await sb
          .from("meals")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", today);

        if (mealsData) {
          const totals = mealsData.reduce(
            (acc: any, meal: any) => ({
              calories: acc.calories + meal.calories,
              protein: acc.protein + meal.protein,
              carbs: acc.carbs + meal.carbs,
              fat: acc.fat + meal.fat,
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );
          setTodayMacros(totals);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Realtime subscription for workouts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dashboard-workouts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workouts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // React Query will auto-refetch
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Esperar a que se determine el tamaño de pantalla en la primera carga
  if (loading || isMobile === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-28 px-4">
          <div className="container mx-auto flex items-center justify-center">
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  const caloriesProgress = profile
    ? (todayMacros.calories / profile.daily_calorie_goal) * 100
    : 0;
  const proteinProgress = profile
    ? (todayMacros.protein / profile.daily_protein_goal) * 100
    : 0;
  const weeklyWorkoutList = weeklyWorkouts as DashboardWorkoutSummary[];
  const plannedWeek = weeklyWorkoutList.length;
  const completedWeek = weeklyWorkoutList.filter((workout) => workout.completed).length;
  const skippedWeek = weeklyWorkoutList.filter((workout) => workout.skipped).length;
  const pendingWeek = Math.max(plannedWeek - completedWeek - skippedWeek, 0);
  const weeklyProgress = plannedWeek > 0 ? Math.round((completedWeek / plannedWeek) * 100) : 0;
  const calorieGoal = profile?.daily_calorie_goal || 2000;
  const proteinGoal = profile?.daily_protein_goal || 150;
  const caloriesPending = Math.max(calorieGoal - todayMacros.calories, 0);
  const proteinPending = Math.max(proteinGoal - todayMacros.protein, 0);
  const proteinCompletion = proteinGoal > 0 ? todayMacros.protein / proteinGoal : 0;
  const calorieCompletion = calorieGoal > 0 ? todayMacros.calories / calorieGoal : 0;
  const macroPriority = proteinCompletion <= calorieCompletion
    ? {
        label: "Proteína pendiente",
        value: `${Math.round(proteinPending)}g`,
        hint: proteinPending > 0 ? "Prioriza una comida alta en proteína." : "Meta de proteína cubierta.",
      }
    : {
        label: "Calorías pendientes",
        value: `${Math.round(caloriesPending)} kcal`,
        hint: caloriesPending > 0 ? "Ajusta tu siguiente comida sin improvisar." : "Meta calórica cubierta.",
      };
  const usefulAlert = nextWorkout
    ? `Hoy toca ${nextWorkout.name}. Abre Entrenar para completar la sesión.`
    : pendingWeek > 0
      ? "No hay pendiente hoy, pero aún tienes sesiones esta semana."
      : "Semana despejada. Revisa reportes o registra tu siguiente comida.";
  const dashboardFocusCard = (
    <Card className="p-3 sm:p-4 shadow-card">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold">Progreso semanal</h3>
            <span className="text-sm font-bold text-primary">{weeklyProgress}%</span>
          </div>
          <Progress value={weeklyProgress} className="h-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            {completedWeek} listos · {skippedWeek} saltados · {pendingWeek} pendientes
          </p>
        </div>

        <div className="rounded-lg bg-muted/70 p-3">
          <p className="text-xs text-muted-foreground">{macroPriority.label}</p>
          <p className="text-xl font-bold">{macroPriority.value}</p>
          <p className="text-xs text-muted-foreground">{macroPriority.hint}</p>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="mb-1 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold">Alerta útil</p>
          </div>
          <p className="text-xs text-muted-foreground">{usefulAlert}</p>
        </div>
      </div>
    </Card>
  );

  // Secciones para el carrusel móvil
  const sections = [
    // Sección 1: Stats + Progreso
    <div key="stats" className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Calorías"
          value={todayMacros.calories}
          subtitle={`Meta: ${profile?.daily_calorie_goal || 2000} kcal`}
          icon={Flame}
          variant="primary"
        />
        <StatCard
          title="Proteína"
          value={`${todayMacros.protein}g`}
          subtitle={`Meta: ${profile?.daily_protein_goal || 150}g`}
          icon={Target}
          variant="secondary"
        />
        <StatCard
          title="Ejercicio"
          value={todayWorkouts.length}
          subtitle={`${completedToday} completados`}
          icon={Activity}
        />
        <StatCard
          title="Nivel"
          value={profile?.fitness_level || "Principiante"}
          subtitle={profile?.fitness_goal || "Mantener peso"}
          icon={TrendingUp}
        />
      </div>
      <Card className="p-4 shadow-card">
        <h3 className="text-lg font-semibold mb-3">Progreso de Calorías</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Consumidas</span>
              <span className="text-sm text-muted-foreground">
                {todayMacros.calories} / {profile?.daily_calorie_goal || 2000} kcal
              </span>
            </div>
            <Progress value={Math.min(caloriesProgress, 100)} className="h-3" />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Proteína</span>
              <span className="text-sm text-muted-foreground">
                {todayMacros.protein}g / {profile?.daily_protein_goal || 150}g
              </span>
            </div>
            <Progress value={Math.min(proteinProgress, 100)} className="h-3" />
          </div>
        </div>
      </Card>
    </div>,

    <div key="weekly-focus" className="space-y-4">
      {dashboardFocusCard}
    </div>,

    <Card key="next-action" className="p-4 shadow-card h-full flex flex-col justify-center">
      <h3 className="text-lg font-semibold mb-2">Próxima acción</h3>
      {nextWorkout ? (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Tu siguiente entrenamiento es {nextWorkout.name}.
          </p>
          <Button className="w-full" onClick={() => navigate("/workouts")}>
            Ir a entrenar
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            No tienes entrenamiento pendiente hoy. Revisa tu semana o registra comida.
          </p>
          <div className="grid gap-2">
            <Button onClick={() => navigate("/workouts?tab=semana")}>
              Ver rutina semanal
            </Button>
            <Button variant="outline" onClick={() => navigate("/macros")}>
              Registrar comida
            </Button>
          </div>
        </>
      )}
    </Card>,

    // Sección 2: Análisis Avanzado PRO
    showSecondaryDashboardCards && <Card key="advanced-analytics" className="p-4 shadow-card bg-gradient-card h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Análisis Avanzado</h3>
        <Badge variant="default" className="gap-1">
          <TrendingUp className="w-3 h-3" />
          PRO
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Consulta progreso real. Las funciones avanzadas no implementadas se muestran como próximamente.
      </p>
      <div className="space-y-2">
        <ProButton
          icon={BarChart3}
          label="Ver progreso real"
          featureTitle="Reportes de progreso"
          featureDescription="Visualiza datos disponibles de entrenamientos, macros, peso y progreso por ejercicio."
          features={[
            "Evolución de peso y energía",
            "Adherencia semanal y mensual",
            "Progreso por ejercicio basado en sesiones",
            "PDF avanzado: próximamente",
            "Análisis por fotos: próximamente"
          ]}
          variant="outline"
          className="w-full"
          onClick={goToReports}
        />
        <ProButton
          icon={TrendingUp}
          label="Reportes Mensuales"
          featureTitle="Reportes Mensuales"
          featureDescription="Consulta un resumen mensual de entrenamientos, calorías, energía, peso y macros."
          features={[
            "Resumen mensual de cumplimiento",
            "Tendencias de peso y energía",
            "Calorías quemadas y consumidas",
            "Totales de macros del periodo"
          ]}
          variant="outline"
          className="w-full"
          onClick={goToReports}
        />
      </div>
    </Card>,

    // Sección 3: Entrenamientos de Hoy
    <Card key="workouts" className="p-4 shadow-card h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-3">Entrenamientos de Hoy</h3>
      {todayWorkouts.length === 0 ? (
        <p className="text-muted-foreground">No hay entrenamientos programados para hoy</p>
      ) : (
        <div className="space-y-3 flex-1 overflow-auto">
          {todayWorkouts.map((workout) => (
            <div
              key={workout.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div>
                <p className="font-medium">{workout.name}</p>
                <p className="text-sm text-muted-foreground">
                  {workout.duration_minutes} min · {workout.estimated_calories} kcal
                </p>
              </div>
              {workout.completed && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                  Completado
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>,

    // Sección 4: Gestor de Rutinas
    showSecondaryDashboardCards && <div key="routine-manager" className="h-full overflow-hidden">
      <RoutineManager />
    </div>,

    // Sección 5: Consejos del Día
    <Card key="tips" className="p-4 shadow-card bg-gradient-card h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-3">Consejos del Día</h3>
      <div className="space-y-3 flex-1">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            💧
          </div>
          <div>
            <p className="font-medium">Mantente hidratada</p>
            <p className="text-sm text-muted-foreground">
              Bebe al menos 2 litros de agua durante el día
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            🥗
          </div>
          <div>
            <p className="font-medium">Alimentación balanceada</p>
            <p className="text-sm text-muted-foreground">
              Incluye proteínas, carbohidratos y grasas saludables en cada comida
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            😊
          </div>
          <div>
            <p className="font-medium">Bienestar emocional</p>
            <p className="text-sm text-muted-foreground">
              Dedica 10 minutos al día para meditar o relajarte
            </p>
          </div>
        </div>
      </div>
    </Card>,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-14 sm:pt-16 pb-16 sm:pb-20 px-3 sm:px-4 overflow-x-hidden">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-3">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">
            ¡Hola, {profile?.full_name || "Usuario"}!
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>

        {/* Vista móvil: Carrusel */}
        {isMobile ? (
          <DashboardMobileCarousel sections={sections} />
        ) : (
          /* Vista desktop: Layout normal */
          <div className="max-w-7xl mx-auto space-y-2 sm:space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              <StatCard
                title="Calorías"
                value={todayMacros.calories}
                subtitle={`Meta: ${profile?.daily_calorie_goal || 2000} kcal`}
                icon={Flame}
                variant="primary"
              />
              <StatCard
                title="Proteína"
                value={`${todayMacros.protein}g`}
                subtitle={`Meta: ${profile?.daily_protein_goal || 150}g`}
                icon={Target}
                variant="secondary"
              />
              <StatCard
                title="Ejercicio"
                value={todayWorkouts.length}
                subtitle={`${completedToday} completados`}
                icon={Activity}
              />
              <StatCard
                title="Nivel"
                value={profile?.fitness_level || "Principiante"}
                subtitle={profile?.fitness_goal || "Mantener peso"}
                icon={TrendingUp}
              />
            </div>

            {dashboardFocusCard}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
              <Card className="p-3 sm:p-4 shadow-card">
                <h3 className="text-base sm:text-lg font-semibold mb-2">Progreso de Calorías</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Consumidas</span>
                      <span className="text-sm text-muted-foreground">
                        {todayMacros.calories} / {profile?.daily_calorie_goal || 2000} kcal
                      </span>
                    </div>
                    <Progress value={Math.min(caloriesProgress, 100)} className="h-3" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Proteína</span>
                      <span className="text-sm text-muted-foreground">
                        {todayMacros.protein}g / {profile?.daily_protein_goal || 150}g
                      </span>
                    </div>
                    <Progress value={Math.min(proteinProgress, 100)} className="h-3" />
                  </div>
                </div>
              </Card>

              <Card className="p-3 sm:p-4 shadow-card">
                <h3 className="text-base sm:text-lg font-semibold mb-2">Entrenamientos de Hoy</h3>
                {todayWorkouts.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-muted-foreground">No hay entrenamientos programados para hoy</p>
                    <Button variant="outline" onClick={() => navigate("/workouts?tab=semana")}>
                      Ver rutina semanal
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayWorkouts.map((workout) => (
                      <div
                        key={workout.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{workout.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {workout.duration_minutes} min · {workout.estimated_calories} kcal
                          </p>
                        </div>
                        {workout.completed && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            Completado
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card className="p-3 sm:p-4 shadow-card">
              <h3 className="text-base sm:text-lg font-semibold mb-2">Próxima acción recomendada</h3>
              {nextWorkout ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{nextWorkout.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {nextWorkout.duration_minutes} min · {nextWorkout.estimated_calories} kcal
                    </p>
                  </div>
                  <Button onClick={() => navigate("/workouts")}>
                    Ir a entrenar
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Revisa tu semana o registra tu siguiente comida.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => navigate("/workouts?tab=semana")}>
                      Ver semana
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/macros")}>
                      Registrar comida
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {showSecondaryDashboardCards && <RoutineManager />}

            {showSecondaryDashboardCards && <Card className="p-3 sm:p-4 shadow-card bg-gradient-card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base sm:text-lg font-semibold">Análisis Avanzado</h3>
                <Badge variant="default" className="gap-1">
                  <TrendingUp className="w-3 h-3" />
                  PRO
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Consulta progreso real. Las funciones avanzadas no implementadas se muestran como próximamente.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ProButton
                  icon={BarChart3}
                  label="Ver progreso real"
                  featureTitle="Reportes de progreso"
                  featureDescription="Visualiza datos disponibles de entrenamientos, macros, peso y progreso por ejercicio."
                  features={[
                    "Evolución de peso y energía",
                    "Adherencia semanal y mensual",
                    "Progreso por ejercicio basado en sesiones",
                    "PDF avanzado: próximamente",
                    "Análisis por fotos: próximamente"
                  ]}
                  variant="outline"
                  className="w-full"
                  onClick={goToReports}
                />
                <ProButton
                  icon={TrendingUp}
                  label="Reportes Mensuales"
                  featureTitle="Reportes Mensuales"
                  featureDescription="Consulta un resumen mensual de entrenamientos, calorías, energía, peso y macros."
                  features={[
                    "Resumen mensual de cumplimiento",
                    "Tendencias de peso y energía",
                    "Calorías quemadas y consumidas",
                    "Totales de macros del periodo"
                  ]}
                  variant="outline"
                  className="w-full"
                  onClick={goToReports}
                />
              </div>
            </Card>}

            <Card className="p-3 sm:p-4 shadow-card bg-gradient-card">
              <h3 className="text-base sm:text-lg font-semibold mb-2">Consejos del Día</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    💧
                  </div>
                  <div>
                    <p className="font-medium">Mantente hidratada</p>
                    <p className="text-sm text-muted-foreground">
                      Bebe al menos 2 litros de agua durante el día
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    🥗
                  </div>
                  <div>
                    <p className="font-medium">Alimentación balanceada</p>
                    <p className="text-sm text-muted-foreground">
                      Incluye proteínas, carbohidratos y grasas saludables en cada comida
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    😊
                  </div>
                  <div>
                    <p className="font-medium">Bienestar emocional</p>
                    <p className="text-sm text-muted-foreground">
                      Dedica 10 minutos al día para meditar o relajarte
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
