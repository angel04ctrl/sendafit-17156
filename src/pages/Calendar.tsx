import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";
import { DashboardMobileCarousel } from "@/components/DashboardMobileCarousel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkoutsByDate } from "@/hooks/useBackendApi";
import { supabase } from "@/integrations/supabase/client";

const Calendar = () => {
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAllPending, setShowAllPending] = useState(false);

  const weekStart = startOfWeek(new Date(), { locale: es, weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: weekData } = useWorkoutsByDate({
    start_date: format(weekDays[0], 'yyyy-MM-dd'),
    end_date: format(weekDays[6], 'yyyy-MM-dd'),
  });

  const workouts = weekData?.workouts || [];

  // Realtime subscription for workout changes
  useEffect(() => {
    const channel = supabase
      .channel('calendar-workouts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workouts',
        },
        (payload) => {
          console.log('Workout updated in calendar:', payload);
          // Query will auto-refetch due to React Query
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getWorkoutsForDate = (date: Date) => {
    return workouts.filter((w) => {
      // Parse scheduled_date in local timezone to avoid UTC offset issues
      const [year, month, day] = w.scheduled_date.split('-').map(Number);
      const workoutDate = new Date(year, month - 1, day);
      return isSameDay(workoutDate, date);
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">Calendario Semanal</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Visualiza tu planificación de entrenamientos
            </p>
          </div>

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
                            className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                              isToday
                                ? "border-primary border-2"
                                : "border border-border"
                            } ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : hasWorkouts
                                ? "bg-primary/20"
                                : "bg-background"
                            }`}
                          >
                            <p className="text-base font-bold">
                              {format(day, "d", { locale: es })}
                            </p>
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
                      const pendingWorkouts = getWorkoutsForDate(selectedDate).filter(w => !w.completed);
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
                {weekDays.map((day) => {
                  const dayWorkouts = getWorkoutsForDate(day);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);

                  return (
                    <Card
                      key={day.toISOString()}
                      className={`p-4 cursor-pointer transition-all ${
                        isToday ? "border-primary border-2" : ""
                      } ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className="text-center mb-3">
                        <p className="text-sm font-medium text-muted-foreground uppercase">
                          {format(day, "EEE", { locale: es })}
                        </p>
                        <p className="text-2xl font-bold">
                          {format(day, "d", { locale: es })}
                        </p>
                        {isToday && (
                          <span className="text-xs text-primary font-medium">Hoy</span>
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
                                  : "bg-muted"
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                {workout.completed && (
                                  <CheckCircle2 className="w-3 h-3" />
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

              <Card className="p-4 sm:p-6 shadow-card">
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
                  Entrenamientos para {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
                </h3>
                {getWorkoutsForDate(selectedDate).length === 0 ? (
                  <p className="text-muted-foreground">
                    No hay entrenamientos programados para este día
                  </p>
                ) : (
                  <div className="space-y-4">
                    {getWorkoutsForDate(selectedDate).map((workout) => (
                      <div
                        key={workout.id}
                        className="p-4 bg-muted rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold">{workout.name}</h4>
                          {workout.completed && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                              Completado
                            </span>
                          )}
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
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
