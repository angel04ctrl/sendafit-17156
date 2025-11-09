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
    fetchWorkouts();
  }, [user]);

  const fetchWorkouts = async () => {
    if (!user) return;

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
    fetchWorkouts();
  };

  const toggleComplete = async (id: string, completed: boolean) => {
    try {
      await completeWorkoutMutation.mutateAsync({
        workoutId: id,
        completed: !completed,
      });
      
      toast.success(!completed ? "¡Entrenamiento completado!" : "Marcado como pendiente");
      refetchTodays();
      fetchWorkouts();
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
    fetchWorkouts();
  };

  const today = getTodayDate();
  
  // Use backend data for today's workouts
  const todayWorkouts = todaysData?.workouts || [];
  const otherDaysWorkouts = workouts.filter((w) => w.scheduled_date !== today);
  
  // Filtros por ubicación para el día actual
  const todayHome = todayWorkouts.filter((w) => w.location === "casa");
  const todayGym = todayWorkouts.filter((w) => w.location === "gimnasio");
  const todayOutdoor = todayWorkouts.filter((w) => w.location === "exterior");

  const WorkoutList = ({ workouts }: { workouts: any[] }) => (
    <div className="space-y-4">
      {workouts.length === 0 ? (
        <p className="text-muted-foreground">No hay entrenamientos registrados</p>
      ) : (
        workouts.map((workout) => (
          <Card
            key={workout.id}
            className={`p-6 shadow-card transition-all ${
              workout.completed ? "bg-primary/5 border-primary/20" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={() => toggleComplete(workout.id, workout.completed)}>
                    {workout.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground" />
                    )}
                  </button>
                  <div>
                    <h3 className="text-lg font-semibold">{workout.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(workout.scheduled_date), "d 'de' MMMM, yyyy")}
                    </p>
                  </div>
                </div>
                {workout.description && (
                  <p className="text-sm text-muted-foreground ml-9 mb-2">
                    {workout.description}
                  </p>
                )}
                <div className="flex gap-4 ml-9 text-sm text-muted-foreground">
                  <span>{workout.duration_minutes} min</span>
                  <span>~{workout.estimated_calories} kcal</span>
                  <span className="capitalize">{workout.location}</span>
                </div>
                
                {/* Show exercises with clickable details */}
                {workout.workout_exercises && workout.workout_exercises.length > 0 && (
                  <div className="ml-9 mt-2 space-y-1">
                    {workout.workout_exercises.map((ex: any) => (
                      <Button
                        key={ex.id}
                        variant="ghost"
                        size="sm"
                        className="h-auto py-1 px-2 text-xs justify-start"
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
                        <Info className="w-3 h-3 mr-1" />
                        {ex.name} - {ex.sets}x{ex.reps}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteWorkout(workout.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">Entrenamientos</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
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

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Entrenamientos de Hoy</h2>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-auto">
                  <TabsTrigger value="all" className="text-xs sm:text-sm py-2">Todos</TabsTrigger>
                  <TabsTrigger value="casa" className="text-xs sm:text-sm py-2">Casa</TabsTrigger>
                  <TabsTrigger value="gimnasio" className="text-xs sm:text-sm py-2">Gimnasio</TabsTrigger>
                  <TabsTrigger value="exterior" className="text-xs sm:text-sm py-2">Exterior</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-6">
                  <WorkoutList workouts={todayWorkouts} />
                </TabsContent>
                <TabsContent value="casa" className="mt-6">
                  <WorkoutList workouts={todayHome} />
                </TabsContent>
                <TabsContent value="gimnasio" className="mt-6">
                  <WorkoutList workouts={todayGym} />
                </TabsContent>
                <TabsContent value="exterior" className="mt-6">
                  <WorkoutList workouts={todayOutdoor} />
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
                                <h4 className="font-medium text-sm">{workout.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(workout.scheduled_date), "d 'de' MMMM, yyyy")}
                                </p>
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
