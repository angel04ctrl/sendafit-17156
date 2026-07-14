/**
 * Calendar.tsx - Página de calendario semanal
 * 
 * Este documento muestra el calendario semanal de entrenamientos del usuario.
 * Se encarga de:
 * - Mostrar los días de la semana con indicadores de entrenamientos
 * - Visualizar entrenamientos pendientes y completados por día
 * - Soportar vista móvil con carousel y vista desktop con grid
 * - Actualizar en tiempo real cuando se completan entrenamientos
 * - Permitir seleccionar un día para ver sus entrenamientos
 */

import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Forward } from "lucide-react";
import { DashboardMobileCarousel } from "@/components/DashboardMobileCarousel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGenerateWeeklyWorkouts, useWeeklyCalendarWorkouts } from "@/hooks/useBackendApi";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { dayMap } from "@/lib/dayMapping";
import { AdaptiveWorkoutActions } from "@/components/AdaptiveWorkoutActions";

const Calendar = () => {
  // Hook para detectar si es móvil
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const generateWeeklyWorkouts = useGenerateWeeklyWorkouts();
  
  // Estado del día seleccionado
  const [selectedDate, setSelectedDate] = useState(new Date());
  // Estado para mostrar todos los entrenamientos pendientes en móvil
  const [showAllPending, setShowAllPending] = useState(false);
  const repairAttemptedRef = useRef(false);

  // Calcular el inicio de la semana (Lunes) y generar array de 7 días
  const weekStart = startOfWeek(new Date(), { locale: es, weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const twoWeeksEnd = addDays(weekStart, 13); // Cargar datos de 2 semanas

  // Usar el nuevo hook que consulta directamente la tabla workouts
  const { data: workouts = [], isError: workoutsError, isLoading: workoutsLoading } = useWeeklyCalendarWorkouts(
    format(weekDays[0], 'yyyy-MM-dd'),
    format(twoWeeksEnd, 'yyyy-MM-dd'),
    user?.id
  );

  // Obtener el perfil del usuario para saber los días disponibles
  const { data: profile, isError: profileError, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("available_weekdays, assigned_routine_id")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const availableWeekdays = profile?.available_weekdays || [];
  const availableWeekdayNumbers = availableWeekdays
    .map((day) => {
      const dayCode = String(day);
      return dayMap[dayCode] ?? Number(dayCode);
    })
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  const hasCalendarError = workoutsError || profileError;

  useEffect(() => {
    if (!user?.id || !profile?.assigned_routine_id || repairAttemptedRef.current) return;
    if (workoutsLoading || profileLoading || generateWeeklyWorkouts.isPending) return;
    if (workouts.length > 0) return;

    repairAttemptedRef.current = true;
    generateWeeklyWorkouts.mutate({ retries: 1 });
  }, [
    user?.id,
    profile?.assigned_routine_id,
    workoutsLoading,
    profileLoading,
    generateWeeklyWorkouts,
    workouts.length,
  ]);

  // Bloque de suscripción en tiempo real - Escucha cambios en entrenamientos
  // Actualiza automáticamente cuando se marca un entrenamiento como completado
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('calendar-workouts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workouts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // React Query refetch automáticamente
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Función para obtener entrenamientos de una fecha específica (basado en weekday)
  const getWorkoutsForDate = (date: Date) => {
    const jsDay = date.getDay(); // 0=Sunday, 1=Monday, etc.
    const weekday = jsDay === 0 ? 7 : jsDay; // Convert to 1-7 where 1=Monday, 7=Sunday
    const compareDateStr = format(date, 'yyyy-MM-dd');
    
    // Para entrenamientos automáticos: buscar por weekday
    // Para entrenamientos manuales: buscar por scheduled_date exacta
    const matches = workouts.filter((w) => {
      if (w.tipo === 'automatico') {
        return w.weekday === weekday;
      } else {
        return w.scheduled_date === compareDateStr;
      }
    });
    

    return matches.filter((w) => w.scheduled_date === compareDateStr);
  };

  // Función para verificar si un día tiene entrenamientos programados según available_weekdays
  const isScheduledDay = (date: Date) => {
    const jsDay = date.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
    const weekdayNumber = jsDay === 0 ? 7 : jsDay; // Convertir a 1=Lun, 2=Mar, ..., 7=Dom
    return availableWeekdayNumbers.includes(weekdayNumber);
  };
  const currentWeekWorkouts = workouts.filter((workout) =>
    workout.scheduled_date >= format(weekDays[0], 'yyyy-MM-dd')
    && workout.scheduled_date <= format(weekDays[6], 'yyyy-MM-dd'),
  );
  const weeklyStats = {
    planned: currentWeekWorkouts.length,
    completed: currentWeekWorkouts.filter((workout) => workout.completed).length,
    skipped: currentWeekWorkouts.filter((workout) => workout.skipped).length,
    pending: currentWeekWorkouts.filter((workout) => !workout.completed && !workout.skipped).length,
  };
  const weeklyCompletion = weeklyStats.planned > 0
    ? Math.round((weeklyStats.completed / weeklyStats.planned) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-14 sm:pt-16 pb-16 sm:pb-20 px-3 sm:px-4 overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-2 sm:space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">Calendario Semanal</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Visualiza tu planificación de entrenamientos
            </p>
          </div>

          {weeklyStats.planned > 0 && (
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">Progreso semanal</h2>
                  <p className="text-sm text-muted-foreground">{weeklyCompletion}% completado</p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs sm:min-w-[420px]">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-muted-foreground">Plan</p>
                    <p className="text-lg font-bold">{weeklyStats.planned}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2">
                    <p className="text-muted-foreground">Listos</p>
                    <p className="text-lg font-bold text-primary">{weeklyStats.completed}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2">
                    <p className="text-muted-foreground">Saltados</p>
                    <p className="text-lg font-bold text-amber-700">{weeklyStats.skipped}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-muted-foreground">Pendientes</p>
                    <p className="text-lg font-bold">{weeklyStats.pending}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {hasCalendarError && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-2">Estamos presentando problemas con tu agenda</h3>
                  <p className="text-sm text-amber-800">
                    No pudimos cargar tus entrenamientos en este momento. Intenta de nuevo en unos minutos.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Alerta cuando no hay entrenamientos */}
          {!hasCalendarError && workouts.length === 0 && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-2">Aún no tienes entrenamientos</h3>
                  <p className="text-sm text-amber-800">
                    Completa tu perfil y selecciona una rutina para que se generen tus entrenamientos automáticamente.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {isMobile ? (
            <DashboardMobileCarousel
              sections={[
                // Primera división: Días de la semana + entrenamientos pendientes
                <div className="h-full pt-4 px-2 overflow-y-auto" key="week-days">
                  <div className="flex justify-between items-center gap-0.5 mb-4">
                    {weekDays.map((day) => {
                      const isToday = isSameDay(day, new Date());
                      const isSelected = isSameDay(day, selectedDate);
                      const dayWorkouts = getWorkoutsForDate(day);
                      const hasWorkouts = dayWorkouts.length > 0;
                      const isScheduled = isScheduledDay(day);
                      const dayInitial = format(day, "EEEEEE", { locale: es }).toUpperCase();

                      return (
                        <div
                          key={day.toISOString()}
                          className="flex flex-col items-center gap-1.5"
                          onClick={() => setSelectedDate(day)}
                        >
                          <p className="text-[10px] font-semibold text-muted-foreground">
                            {isToday ? "HOY" : dayInitial}
                          </p>
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all relative ${
                              isToday
                                ? "border-primary border-2"
                                : "border border-border"
                            } ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : isScheduled
                                ? "bg-primary/10 border-primary/30"
                                : hasWorkouts
                                ? "bg-primary/20"
                                : "bg-background"
                            }`}
                          >
                            <p className="text-base font-bold">
                              {format(day, "d", { locale: es })}
                            </p>
                            {isScheduled && !isSelected && (
                              <div className="absolute -bottom-1 w-1.5 h-1.5 bg-primary rounded-full" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Entrenamientos pendientes del día seleccionado */}
                  <div className="px-2">
                    <h3 className="text-sm font-semibold mb-3">
                      Entrenamientos Pendientes
                    </h3>
                    {(() => {
                      const pendingWorkouts = getWorkoutsForDate(selectedDate).filter(w => !w.completed && !w.skipped);
                      const hasMoreThan3 = pendingWorkouts.length > 3;
                      const displayedWorkouts = showAllPending ? pendingWorkouts : pendingWorkouts.slice(0, 3);
                      
                      if (pendingWorkouts.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No hay entrenamientos pendientes para este día
                          </p>
                        );
                      }
                      
                      return (
                        <div className={showAllPending ? "overflow-y-auto max-h-[calc(100vh-320px)]" : ""}>
                          <div className="space-y-3">
                            {displayedWorkouts.map((workout) => (
                              <div
                                key={workout.id}
                                className="p-3 bg-muted rounded-lg"
                              >
                                <h4 className="font-semibold text-sm mb-2">{workout.name}</h4>
                                <div className="flex gap-3 text-xs text-muted-foreground">
                                  <span>{workout.duration_minutes} min</span>
                                  <span>~{workout.estimated_calories} kcal</span>
                                  <span className="capitalize">{workout.location}</span>
                                </div>
                                <div className="mt-3">
                                  <AdaptiveWorkoutActions
                                    workout={workout}
                                    weekWorkouts={workouts}
                                    showStart={false}
                                  />
                                </div>
                              </div>
                            ))}
                            {hasMoreThan3 && !showAllPending && (
                              <div
                                onClick={() => setShowAllPending(true)}
                                className="p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors text-center"
                              >
                                <span className="text-xs text-muted-foreground">Ver todos...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>,
                // Segunda división: Entrenamientos completados
                <div className="h-full p-3 overflow-y-auto" key="completed-workouts">
                  <h3 className="text-base font-semibold mb-3">
                    Entrenamientos Completados
                  </h3>
                  {getWorkoutsForDate(selectedDate).filter(w => w.completed).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Los entrenamientos que completes aparecerán aquí
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {getWorkoutsForDate(selectedDate)
                        .filter(w => w.completed)
                        .map((workout) => (
                          <div
                            key={workout.id}
                            className="p-3 bg-primary/10 rounded-lg border border-primary/20"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-sm">{workout.name}</h4>
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                Completado
                              </span>
                            </div>
                            {workout.description && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {workout.description}
                              </p>
                            )}
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>{workout.duration_minutes} min</span>
                              <span>~{workout.estimated_calories} kcal</span>
                              <span className="capitalize">{workout.location}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ]}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2 sm:gap-3">
                {weekDays.map((day) => {
                  const dayWorkouts = getWorkoutsForDate(day);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  const isScheduled = isScheduledDay(day);

                  return (
                    <Card
                      key={day.toISOString()}
                      className={`p-3 cursor-pointer transition-all relative ${
                        isToday ? "border-primary border-2" : ""
                      } ${isSelected ? "bg-primary/5" : ""} ${
                        isScheduled ? "border-primary/30" : ""
                      }`}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className="text-center mb-2">
                        <p className="text-sm font-medium text-muted-foreground uppercase">
                          {format(day, "EEE", { locale: es })}
                        </p>
                        <p className="text-2xl font-bold">
                          {format(day, "d", { locale: es })}
                        </p>
                        {isToday && (
                          <span className="text-xs text-primary font-medium">Hoy</span>
                        )}
                        {isScheduled && (
                          <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
                        )}
                      </div>
                      <div className="space-y-2">
                        {dayWorkouts.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center">
                            Sin entrenamientos
                          </p>
                        ) : (
                          dayWorkouts.map((workout) => (
                            <div
                              key={workout.id}
                              className={`text-xs p-2 rounded ${
                                workout.completed
                                  ? "bg-primary/20 text-primary"
                                  : workout.skipped
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-muted"
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                {workout.completed && (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                {workout.skipped && (
                                  <Forward className="w-3 h-3" />
                                )}
                                <span className="truncate">{workout.name}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {/* Entrenamientos Pendientes */}
                <Card className="p-3 sm:p-4 shadow-card">
                  <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">
                    Entrenamientos Pendientes
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
                  </p>
                  {(() => {
                    const pendingWorkouts = getWorkoutsForDate(selectedDate).filter(w => !w.completed && !w.skipped);
                    
                    if (pendingWorkouts.length === 0) {
                      return (
                        <p className="text-muted-foreground text-center py-6">
                          No hay entrenamientos pendientes para este día
                        </p>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        {pendingWorkouts.map((workout) => (
                          <div
                            key={workout.id}
                            className="p-3 bg-muted rounded-lg"
                          >
                            <h4 className="font-semibold mb-2">{workout.name}</h4>
                            {workout.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {workout.description}
                              </p>
                            )}
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>{workout.duration_minutes} min</span>
                              <span>~{workout.estimated_calories} kcal</span>
                              <span className="capitalize">{workout.location}</span>
                            </div>
                            <div className="mt-3">
                              <AdaptiveWorkoutActions
                                workout={workout}
                                weekWorkouts={workouts}
                                showStart={false}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </Card>

                {/* Entrenamientos Completados */}
                <Card className="p-3 sm:p-4 shadow-card">
                  <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">
                    Entrenamientos Completados
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
                  </p>
                  {(() => {
                    const completedWorkouts = getWorkoutsForDate(selectedDate).filter(w => w.completed);
                    
                    if (completedWorkouts.length === 0) {
                      return (
                        <p className="text-muted-foreground text-center py-6">
                          Los entrenamientos que completes aparecerán aquí
                        </p>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        {completedWorkouts.map((workout) => (
                          <div
                            key={workout.id}
                            className="p-3 bg-primary/10 rounded-lg border border-primary/20"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold">{workout.name}</h4>
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                Completado
                              </span>
                            </div>
                            {workout.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {workout.description}
                              </p>
                            )}
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>{workout.duration_minutes} min</span>
                              <span>~{workout.estimated_calories} kcal</span>
                              <span className="capitalize">{workout.location}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
