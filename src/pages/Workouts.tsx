/**
 * Workouts.tsx - Página de gestión de entrenamientos
 * 
 * Este documento gestiona todos los entrenamientos del usuario.
 * Se encarga de:
 * - Mostrar entrenamientos del día por ubicación (casa, gimnasio, exterior)
 * - Listar entrenamientos de otros días del plan actual
 * - Crear nuevos entrenamientos personalizados con ejercicios
 * - Marcar entrenamientos como completados/pendientes
 * - Eliminar entrenamientos
 * - Agregar ejercicios desde base de datos o escanear productos (PRO)
 * - Actualizar en tiempo real al completar entrenamientos
 */

import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, CheckCircle2, Circle, Trash2, ChevronDown, Scan, Library, Info, Dumbbell, CalendarDays, Timer, Flame, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { AddExerciseDialog, type ConfiguredExercise } from "@/components/AddExerciseDialog";
import { useCompleteWorkout, useTodaysWorkouts } from "@/hooks/useBackendApi";
import { ProButton } from "@/components/ProButton";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const getTodayDate = () => format(new Date(), "yyyy-MM-dd");

const WorkoutList = ({ workouts, isToday = false, completingWorkout, handleCompleteWorkout, handleStartWorkout, handleDeleteWorkout }: { 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workouts: any[]; 
  isToday?: boolean;
  completingWorkout: string | null;
  handleCompleteWorkout: (id: string, completed: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleStartWorkout: (workout: any) => void;
  handleDeleteWorkout: (id: string) => void;
}) => (
  <div className="space-y-2 sm:space-y-3">
    {workouts.length === 0 ? (
      <div className="text-center py-6 sm:py-8 text-muted-foreground border-2 border-dashed rounded-xl">
        <Dumbbell className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
        <p className="text-xs sm:text-sm">No hay entrenamientos</p>
      </div>
    ) : (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      workouts.map((workout: any) => (
        <Card 
          key={workout.id} 
          className={`transition-all overflow-hidden border-2 group ${
            workout.completed 
              ? 'bg-muted/50 border-muted-foreground/30 shadow-none' 
              : 'bg-card border-primary/20 hover:border-primary/40 shadow-sm hover:shadow-md'
          }`}
        >
          <CardHeader className="p-3 sm:p-4 pb-2">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                <Checkbox
                  checked={workout.completed}
                  onCheckedChange={() => handleCompleteWorkout(workout.id, workout.completed)}
                  disabled={completingWorkout === workout.id}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <CardTitle className={`text-sm sm:text-base flex items-center gap-2 truncate ${
                    workout.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                  }`}>
                    {workout.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    {format(new Date(workout.scheduled_date), "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                </div>
              </div>
              <Badge variant={workout.completed ? "secondary" : "default"} className="capitalize text-[10px] sm:text-xs shrink-0">
                {workout.location}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs text-muted-foreground mb-3 sm:mb-4 bg-muted/30 p-2 rounded-lg">
              <div className="flex items-center gap-1">
                <Timer className="h-3 w-3 sm:h-4 sm:w-4 text-primary/70" />
                <span>{workout.duration_minutes} min</span>
              </div>
              <div className="flex items-center gap-1">
                <Flame className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500/70" />
                <span>{workout.estimated_calories} kcal</span>
              </div>
            </div>

            {workout.workout_exercises && workout.workout_exercises.length > 0 && (
              <div className="space-y-1 mb-3 sm:mb-4 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {workout.workout_exercises.map((exercise: any) => (
                  <div key={exercise.id} className="text-xs sm:text-sm flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-muted/50">
                    <span className={`truncate ${workout.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {exercise.name}
                    </span>
                    <span className="text-muted-foreground font-medium shrink-0 bg-background px-2 py-0.5 rounded shadow-sm border">
                      {exercise.sets}×{exercise.reps}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-4">
              {!workout.completed && (
                <Button 
                  className="w-full sm:flex-1 text-xs sm:text-sm font-medium shadow-sm transition-all hover:scale-[1.02]"
                  onClick={() => handleStartWorkout(workout)}
                >
                  <PlayCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Iniciar
                </Button>
              )}
              <Button 
                variant="outline"
                className={`w-full sm:flex-none text-xs sm:text-sm border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 ${!workout.completed ? 'sm:w-auto' : ''}`}
                onClick={() => handleDeleteWorkout(workout.id)}
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Eliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))
    )}
  </div>
);

const Workouts = () => {
  const { user } = useAuth();
  const sb = supabase;
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [upcomingWorkouts, setUpcomingWorkouts] = useState<any[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [configuredExercises, setConfiguredExercises] = useState<any[]>([]);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [exerciseDetailOpen, setExerciseDetailOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [otherDaysOpen, setOtherDaysOpen] = useState(false);
  const completeWorkoutMutation = useCompleteWorkout();
  
  const [formData, setFormData] = useState({
    name: "",
    location: "casa",
    scheduled_date: getTodayDate(),
  });
  const [open, setOpen] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [completingWorkout, setCompletingWorkout] = useState<string | null>(null);

  // Use backend API for today's workouts
  const { data: todaysData, refetch: refetchTodays } = useTodaysWorkouts();

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: profileData } = await sb
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profileData);

      const today = getTodayDate();
      const { data: upcoming } = await sb
        .from("workouts")
        .select("*, workout_exercises(*)")
        .eq("user_id", user.id)
        .gte("scheduled_date", today)
        .order("scheduled_date", { ascending: true });
      
      setUpcomingWorkouts(upcoming || []);
    } catch (err) {
      console.error(err);
    }
  }, [user, sb]);

  useEffect(() => {
    fetchData();
  }, [user, fetchData]);

  // Realtime subscription for workouts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('workouts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workouts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Workout changed:', payload);
          refetchTodays();
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData, refetchTodays]);

  const fetchExercisesForDay = async (dayOfWeek: string, location: string) => {
    const query = sb.from("workout_exercises").select("*");
    // @ts-expect-error: deeply nested instantiation
    const { data } = await query
      .eq("workout_id", upcomingWorkouts[0]?.id)
      .eq("location", location);

    return data;
  };

  const handleAddExercise = (exercise: ConfiguredExercise) => {
    setConfiguredExercises([...configuredExercises, exercise]);
  };

  const handleRemoveExercise = (index: number) => {
    setConfiguredExercises(configuredExercises.filter((_, i) => i !== index));
  };

  const getTotalCalories = () => {
    return configuredExercises.reduce((total, ex) => total + ex.estimatedCalories, 0);
  };

  const getTotalDuration = () => {
    // Estimamos 3 segundos por repetición + 60 segundos de descanso entre series
    const totalSeconds = configuredExercises.reduce((total, ex) => {
      const repTime = ex.repeticiones * ex.series * 3;
      const restTime = (ex.series - 1) * 60;
      return total + repTime + restTime;
    }, 0);
    return Math.round(totalSeconds / 60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (configuredExercises.length === 0) {
      toast.error("Agrega al menos un ejercicio");
      return;
    }

    const totalCalories = getTotalCalories();
    const totalDuration = getTotalDuration();

    console.log('Fecha seleccionada en el formulario:', formData.scheduled_date);

    const { data: workoutData, error: workoutError } = await sb
      .from("workouts")
      .insert([{
        user_id: user.id,
        name: formData.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        location: formData.location as any,
        estimated_calories: totalCalories,
        duration_minutes: totalDuration,
        scheduled_date: formData.scheduled_date,
        completed: false,
      }])
      .select()
      .single();

    console.log('Workout guardado:', workoutData);
    console.log('Fecha guardada en DB:', workoutData?.scheduled_date);

    if (workoutError) {
      toast.error("Error al crear entrenamiento");
      return;
    }

    // Insertar ejercicios
    const exercisesToInsert = configuredExercises.map(ex => ({
      workout_id: workoutData.id,
      name: ex.exercise.nombre,
      sets: ex.series,
      reps: ex.repeticiones,
      notes: ex.peso > 0 ? `Peso: ${ex.peso}kg` : undefined
    }));

    const { error: exercisesError } = await sb
      .from("workout_exercises")
      .insert(exercisesToInsert);

    if (exercisesError) {
      toast.error("Error al agregar ejercicios");
      return;
    }

    toast.success("Entrenamiento creado");
    setOpen(false);
    setFormData({
      name: "",
      location: "casa",
      scheduled_date: getTodayDate(),
    });
    setConfiguredExercises([]);
    refetchTodays(); // Refetch today's workouts
    fetchData();
  };

  const handleCompleteWorkout = async (id: string, completed: boolean) => {
    try {
      await completeWorkoutMutation.mutateAsync({
        workoutId: id,
        completed: !completed,
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartWorkout = (workout: Record<string, unknown>) => {
    // Implementar navegación a página de entrenamiento activo si existe
    toast.info(`Iniciando entrenamiento: ${workout.name}`);
  };

  const handleDeleteWorkout = async (id: string) => {
    if (!confirm("¿Eliminar entrenamiento?")) return;
    try {
      const { error } = await sb.from("workouts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Entrenamiento eliminado");
      fetchData();
      refetchTodays();
    } catch (e) {
      toast.error("Error al eliminar");
    }
  };

  const today = getTodayDate();
  
  // Use backend data for today's workouts
  const todayWorkouts = todaysData?.workouts || [];
  
  // Calculate today's weekday (1=Lunes, 7=Domingo)
  const todayWeekday = (() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  })();
  
  // Weekday names mapping
  const weekdayNames: Record<number, string> = {
    1: 'Lunes', 2: 'Martes', 3: 'Miércoles',
    4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
  };
  
  console.log('Workouts - Entrenamientos de hoy:', {
    count: todayWorkouts.length,
    todayWeekday,
    workouts: todayWorkouts.map(w => ({ 
      name: w.name, 
      weekday: w.weekday, 
      scheduled_date: w.scheduled_date,
      plan_id: w.plan_id,
    })),
  });
  
  // Filter "other days" workouts to show workouts from other days of the week
  const otherDaysWorkouts = upcomingWorkouts.filter((w) => {
    // For automatic workouts: exclude by weekday of today
    if (w.tipo === 'automatico') {
      if (w.weekday === todayWeekday) return false;
      // Only show workouts from the current plan
      if (profile?.assigned_routine_id && w.plan_id !== profile.assigned_routine_id) {
        return false;
      }
      return true;
    }
    
    // For manual workouts: exclude by scheduled_date of today
    if (w.tipo === 'manual' && w.scheduled_date === today) return false;
    
    return true;
  });
  
  // Filtros por ubicación para el día actual
  const todayHome = todayWorkouts.filter((w) => w.location === "casa");
  const todayGym = todayWorkouts.filter((w) => w.location === "gimnasio");
  const todayOutdoor = todayWorkouts.filter((w) => w.location === "exterior");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-14 sm:pt-16 pb-16 sm:pb-20 px-3 sm:px-4 overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-2 sm:space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">Entrenamientos</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Planifica y registra tus rutinas de ejercicio
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="default" className="gap-2 w-full sm:w-auto">
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-sm sm:text-base">Nuevo Entrenamiento</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Crear Entrenamiento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: Rutina de Piernas"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Ubicación</Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => setFormData({ ...formData, location: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casa">Casa</SelectItem>
                        <SelectItem value="gimnasio">Gimnasio</SelectItem>
                        <SelectItem value="exterior">Exterior</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha Programada</Label>
                    <Input
                      type="date"
                      value={formData.scheduled_date}
                      onChange={(e) =>
                        setFormData({ ...formData, scheduled_date: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Ejercicios</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExerciseDialogOpen(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Agregar Ejercicio
                      </Button>
                    </div>

                    {configuredExercises.length === 0 ? (
                      <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                        No hay ejercicios agregados
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {configuredExercises.map((ex, index) => (
                          <div key={`${ex.exercise.id}-${index}`} className="p-3 bg-muted rounded-lg flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{ex.exercise.nombre}</p>
                              <p className="text-sm text-muted-foreground">
                                {ex.series} series × {ex.repeticiones} reps
                                {ex.peso > 0 && ` • ${ex.peso}kg`}
                              </p>
                              <p className="text-sm text-primary font-medium">
                                ~{ex.estimatedCalories} kcal
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveExercise(index)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {configuredExercises.length > 0 && (
                      <div className="p-4 bg-primary/10 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total Estimado:</span>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">
                              {getTotalCalories()} kcal
                            </p>
                            <p className="text-sm text-muted-foreground">
                              ~{getTotalDuration()} minutos
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full">
                    Crear Entrenamiento
                  </Button>
                </form>
              </DialogContent>
              </Dialog>
              
              <ProButton
                icon={Scan}
                label="Identificar Máquinas IA"
                featureTitle="Identificación de Máquinas con IA"
                featureDescription="Escanea equipos de gimnasio y obtén guías de uso instantáneas"
                features={[
                  "Identifica cualquier máquina del gym",
                  "Instrucciones de uso paso a paso",
                  "Músculos que trabaja cada máquina",
                  "Ejercicios alternativos similares",
                  "Historial de máquinas escaneadas"
                ]}
                className="w-full sm:w-auto"
              />
              
              <ProButton
                icon={Library}
                label="Biblioteca Premium"
                featureTitle="Biblioteca Premium de Ejercicios"
                featureDescription="Accede a miles de ejercicios con videos y tutoriales profesionales"
                features={[
                  "Más de 1000+ ejercicios con videos HD",
                  "Tutoriales paso a paso",
                  "Filtros avanzados por músculo/equipo",
                  "Guías de técnica correcta",
                  "Ejercicios progresivos por nivel"
                ]}
                className="w-full sm:w-auto"
              />
            </div>
          </div>

          <AddExerciseDialog
            open={exerciseDialogOpen}
            onOpenChange={setExerciseDialogOpen}
            onAddExercise={handleAddExercise}
            location={formData.location}
          />

          <ExerciseDetailModal
            open={exerciseDetailOpen}
            onOpenChange={setExerciseDetailOpen}
            exercise={selectedExercise}
          />

          <div className="space-y-4 sm:space-y-6">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">Entrenamientos de Hoy</h2>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="w-full grid grid-cols-4 bg-muted/50 p-1">
                  <TabsTrigger value="all" className="text-xs sm:text-sm">Todos</TabsTrigger>
                  <TabsTrigger value="casa" className="text-xs sm:text-sm">Casa</TabsTrigger>
                  <TabsTrigger value="gimnasio" className="text-xs sm:text-sm">Gym</TabsTrigger>
                  <TabsTrigger value="exterior" className="text-xs sm:text-sm">Outdoor</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-3 sm:mt-4">
                  <WorkoutList 
                    workouts={todayWorkouts} 
                    isToday 
                    completingWorkout={completingWorkout}
                    handleCompleteWorkout={handleCompleteWorkout}
                    handleStartWorkout={handleStartWorkout}
                    handleDeleteWorkout={handleDeleteWorkout}
                  />
                </TabsContent>
                <TabsContent value="casa" className="mt-3 sm:mt-4">
                  <WorkoutList 
                    workouts={todayHome} 
                    isToday 
                    completingWorkout={completingWorkout}
                    handleCompleteWorkout={handleCompleteWorkout}
                    handleStartWorkout={handleStartWorkout}
                    handleDeleteWorkout={handleDeleteWorkout}
                  />
                </TabsContent>
                <TabsContent value="gimnasio" className="mt-3 sm:mt-4">
                  <WorkoutList 
                    workouts={todayGym} 
                    isToday 
                    completingWorkout={completingWorkout}
                    handleCompleteWorkout={handleCompleteWorkout}
                    handleStartWorkout={handleStartWorkout}
                    handleDeleteWorkout={handleDeleteWorkout}
                  />
                </TabsContent>
                <TabsContent value="exterior" className="mt-3 sm:mt-4">
                  <WorkoutList 
                    workouts={todayOutdoor} 
                    isToday 
                    completingWorkout={completingWorkout}
                    handleCompleteWorkout={handleCompleteWorkout}
                    handleStartWorkout={handleStartWorkout}
                    handleDeleteWorkout={handleDeleteWorkout}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {otherDaysWorkouts.length > 0 && (
              <Card className="p-4 bg-muted/30">
                <Collapsible open={otherDaysOpen} onOpenChange={setOtherDaysOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between hover:bg-transparent p-0 h-auto mb-2"
                    >
                      <div>
                        <h3 className="text-lg font-medium">Ver otros días...</h3>
                        <p className="text-sm text-muted-foreground text-left">
                          {otherDaysWorkouts.length} entrenamientos guardados recientemente
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 transition-transform duration-200 ${
                          otherDaysOpen ? "rotate-180" : ""
                        }`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mt-4">
                    {otherDaysWorkouts.slice(0, 5).map((workout) => (
                      <Card
                        key={workout.id}
                        className={`p-4 ${
                          workout.completed ? "bg-primary/5 border-primary/20" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <button onClick={() => handleCompleteWorkout(workout.id, workout.completed)}>
                                {workout.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-primary" />
                                ) : (
                                  <Circle className="w-5 h-5 text-muted-foreground" />
                                )}
                              </button>
                              <div>
                                <h4 className="font-medium text-sm">{workout.name}</h4>
                              </div>
                            </div>
                            <div className="flex gap-3 ml-7 text-xs text-muted-foreground">
                              <span>{workout.duration_minutes} min</span>
                              <span>~{workout.estimated_calories} kcal</span>
                              <span className="capitalize">{workout.location}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWorkout(workout.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Workouts;
