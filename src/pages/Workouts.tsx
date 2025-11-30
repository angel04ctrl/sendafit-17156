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

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, CheckCircle2, Circle, Trash2, ChevronDown, Scan, Library, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AddExerciseDialog } from "@/components/AddExerciseDialog";
import { useCompleteWorkout, useTodaysWorkouts } from "@/hooks/useBackendApi";
import { ProButton } from "@/components/ProButton";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";

interface ConfiguredExercise {
  exercise: {
    id: string;
    nombre: string;
    descripcion: string;
  };
  series: number;
  repeticiones: number;
  peso: number;
  estimatedCalories: number;
}

const Workouts = () => {
  const { user } = useAuth();
  const sb = supabase as any;
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [exerciseDetailOpen, setExerciseDetailOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [configuredExercises, setConfiguredExercises] = useState<ConfiguredExercise[]>([]);
  const [otherDaysOpen, setOtherDaysOpen] = useState(false);
  const completeWorkoutMutation = useCompleteWorkout();
  
  // Use backend API for today's workouts
  const { data: todaysData, refetch: refetchTodays } = useTodaysWorkouts();
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    name: "",
    location: "casa",
    scheduled_date: getTodayDate(),
  });

  useEffect(() => {
    fetchData();
  }, [user]);

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
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch profile with assigned routine
      const { data: profileData } = await sb
        .from("profiles")
        .select("assigned_routine_id, available_weekdays")
        .eq("id", user.id)
        .single();

      console.log('Workouts - Perfil del usuario:', {
        available_weekdays: profileData?.available_weekdays,
        assigned_routine_id: profileData?.assigned_routine_id,
      });

      setProfile(profileData);

      // Fetch workouts for the current plan only
      const { data, error } = await sb
        .from("workouts")
        .select("*, workout_exercises(*)")
        .eq("user_id", user.id)
        .order("scheduled_date", { ascending: false });

      if (error) {
        console.error("Error fetching workouts:", error);
        return;
      }

      setWorkouts(data || []);
    } catch (error) {
      console.error("Error in fetchData:", error);
    }
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
        user_id: user?.id!,
        name: formData.name,
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

  const toggleComplete = async (id: string, completed: boolean) => {
    try {
      await completeWorkoutMutation.mutateAsync({
        workoutId: id,
        completed: !completed,
      });
      
      toast.success(!completed ? "¡Entrenamiento completado!" : "Marcado como pendiente");
      refetchTodays();
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const deleteWorkout = async (id: string) => {
    const { error } = await sb
      .from("workouts")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Error al eliminar entrenamiento");
      return;
    }

    toast.success("Entrenamiento eliminado");
    fetchData();
  };

  const today = getTodayDate();
  
  // Use backend data for today's workouts
  const todayWorkouts = todaysData?.workouts || [];
  
  console.log('Workouts - Entrenamientos de hoy:', {
    count: todayWorkouts.length,
    workouts: todayWorkouts.map(w => ({ 
      name: w.name, 
      weekday: w.weekday, 
      scheduled_date: w.scheduled_date,
      plan_id: w.plan_id,
    })),
  });
  
  // Filter "other days" workouts to only show current plan's workouts
  const otherDaysWorkouts = workouts.filter((w) => {
    // Exclude today's workouts
    if (w.scheduled_date === today) return false;
    
    // Only show workouts from the current plan (or manual workouts)
    if (w.tipo === 'manual') return true;
    if (!profile?.assigned_routine_id) return true;
    
    return w.plan_id === profile.assigned_routine_id;
  });
  
  // Filtros por ubicación para el día actual
  const todayHome = todayWorkouts.filter((w) => w.location === "casa");
  const todayGym = todayWorkouts.filter((w) => w.location === "gimnasio");
  const todayOutdoor = todayWorkouts.filter((w) => w.location === "exterior");

  const WorkoutList = ({ workouts, isToday = false }: { workouts: any[]; isToday?: boolean }) => (
    <div className="space-y-2 sm:space-y-3">
      {workouts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay entrenamientos registrados</p>
      ) : (
        workouts.map((workout) => (
          <Card
            key={workout.id}
            className={`p-3 sm:p-4 shadow-card transition-all ${
              workout.completed ? "bg-primary/5 border-primary/20" : ""
            }`}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 sm:gap-3">
                <button 
                  onClick={() => toggleComplete(workout.id, workout.completed)}
                  className="flex-shrink-0 mt-0.5"
                >
                  {workout.completed ? (
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  ) : (
                    <Circle className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  {(() => {
                    const dateStr = isToday ? today : workout.scheduled_date;
                    const [year, month, day] = dateStr.split('-').map(Number);
                    const localDate = new Date(year, month - 1, day);
                    const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
                    const baseName = workout.name.replace(/\s-\s(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)$/i, '');
                    const displayName = `${baseName} - ${days[localDate.getDay()]}`;
                    return (
                      <h3 className="font-semibold text-sm sm:text-base break-words">{displayName}</h3>
                    );
                  })()}
                  {workout.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                      {workout.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-1">
                    <span className="flex-shrink-0">{workout.duration_minutes} min</span>
                    <span className="flex-shrink-0">~{workout.estimated_calories} kcal</span>
                    <span className="capitalize flex-shrink-0">{workout.location}</span>
                  </div>
                  
                  {/* Show exercises */}
                  {workout.workout_exercises && workout.workout_exercises.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {workout.workout_exercises.map((ex: any) => (
                        <Button
                          key={ex.id}
                          variant="ghost"
                          size="sm"
                          className="h-auto py-1 px-2 text-xs justify-start w-full hover:bg-muted"
                          onClick={() => {
                            setSelectedExercise({
                              nombre: ex.name,
                              descripcion: ex.notes || 'Sin descripción disponible',
                              grupo_muscular: 'General',
                              nivel: 'B',
                              lugar: workout.location,
                              series_sugeridas: ex.sets,
                              repeticiones_sugeridas: ex.reps,
                            });
                            setExerciseDetailOpen(true);
                          }}
                        >
                          <Info className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{ex.name} - {ex.sets}×{ex.reps}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteWorkout(workout.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );

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
                          <div key={index} className="p-3 bg-muted rounded-lg flex items-start justify-between">
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
                <TabsList className="grid w-full grid-cols-4 h-auto">
                  <TabsTrigger value="all" className="text-xs sm:text-sm py-2">Todos</TabsTrigger>
                  <TabsTrigger value="casa" className="text-xs sm:text-sm py-2">Casa</TabsTrigger>
                  <TabsTrigger value="gimnasio" className="text-xs sm:text-sm py-2">Gimnasio</TabsTrigger>
                  <TabsTrigger value="exterior" className="text-xs sm:text-sm py-2">Exterior</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-3 sm:mt-4">
                  <WorkoutList workouts={todayWorkouts} isToday />
                </TabsContent>
                <TabsContent value="casa" className="mt-3 sm:mt-4">
                  <WorkoutList workouts={todayHome} isToday />
                </TabsContent>
                <TabsContent value="gimnasio" className="mt-3 sm:mt-4">
                  <WorkoutList workouts={todayGym} isToday />
                </TabsContent>
                <TabsContent value="exterior" className="mt-3 sm:mt-4">
                  <WorkoutList workouts={todayOutdoor} isToday />
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
                              <button onClick={() => toggleComplete(workout.id, workout.completed)}>
                                {workout.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-primary" />
                                ) : (
                                  <Circle className="w-5 h-5 text-muted-foreground" />
                                )}
                              </button>
                              <div>
                                {(() => {
                                  const [year, month, day] = workout.scheduled_date.split('-').map(Number);
                                  const localDate = new Date(year, month - 1, day);
                                  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
                                  const baseName = workout.name.replace(/\s-\s(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)$/i, '');
                                  const displayName = `${baseName} - ${days[localDate.getDay()]}`;
                                  return (
                                    <>
                                      <h4 className="font-medium text-sm">{displayName}</h4>
                                      <p className="text-xs text-muted-foreground">{format(localDate, "d 'de' MMMM, yyyy")}</p>
                                    </>
                                  );
                                })()}
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
                            onClick={() => deleteWorkout(workout.id)}
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
