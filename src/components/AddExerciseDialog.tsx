import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { HelpCircle } from "lucide-react";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { canAccessExerciseLevel, exerciseLevelOrder, formatExerciseLevel } from "@/lib/exerciseMetadata";

type Exercise = Tables<"exercises">;

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export interface ConfiguredExercise {
  exercise: Exercise;
  series: number;
  repeticiones: number;
  peso: number;
  estimatedCalories: number;
}

interface AddExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddExercise: (exercise: ConfiguredExercise) => void;
  location: string;
}

export const AddExerciseDialog = ({ open, onOpenChange, onAddExercise, location }: AddExerciseDialogProps) => {
  const { user } = useAuth();
  const sb = supabase;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [series, setSeries] = useState("3");
  const [repeticiones, setRepeticiones] = useState("10");
  const [peso, setPeso] = useState("0");
  const [userProfile, setUserProfile] = useState<{weight: number | null, fitness_level: string | null} | null>(null);
  const [estimatedCalories, setEstimatedCalories] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [exerciseDetailOpen, setExerciseDetailOpen] = useState(false);

  const fetchExercises = useCallback(async () => {
    // Traer todos los ejercicios sin filtrar por ubicación.
    const { data } = await sb
      .from("exercises")
      .select("*")
      .order("nombre");
    
    setExercises(data || []);
  }, [sb]);

  const fetchUserProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await sb
      .from("profiles")
      .select("weight, fitness_level")
      .eq("id", user.id)
      .single();
    
    if (data) {
      setUserProfile({
        weight: data.weight,
        fitness_level: data.fitness_level
      });
    }
  }, [user, sb]);

  useEffect(() => {
    fetchExercises();
    fetchUserProfile();
  }, [fetchExercises, fetchUserProfile]);

  const calculateCalories = useCallback(() => {
    if (!selectedExercise || !userProfile?.weight) return 0;

    // Datos base
    const caloriasPorRepeticion = selectedExercise.calorias_por_repeticion || 0.3;
    const userWeight = userProfile.weight;
    const loadWeight = parseFloat(peso) || 0;
    const reps = parseInt(repeticiones) || 1;
    const sets = parseInt(series) || 1;

    // Factor de nivel
    const levelFactor = {
      'principiante': 1.0,
      'intermedio': 1.2,
      'avanzado': 1.5
    }[userProfile.fitness_level as 'principiante' | 'intermedio' | 'avanzado' || 'principiante'] || 1.0;

    // Factor de carga (porcentaje del peso corporal que se está levantando)
    const loadPercentage = loadWeight / userWeight;
    const loadFactor = 1 + (loadPercentage * 0.5); // Ajuste: 50% adicional por cada 100% del peso corporal

    // Calorías ajustadas por repetición
    const adjustedCaloriesPerRep = caloriasPorRepeticion * levelFactor * loadFactor;

    // Total de calorías
    const totalCalories = adjustedCaloriesPerRep * reps * sets;

    return Math.round(totalCalories);
  }, [selectedExercise, series, repeticiones, peso, userProfile]);

  useEffect(() => {
    if (selectedExercise) {
      setEstimatedCalories(calculateCalories());
    }
  }, [selectedExercise, calculateCalories]);

  // Filtrar ejercicios basado en búsqueda y filtros
  const filteredExercises = exercises.filter((exercise) => {
    const normalizedSearchTerm = normalizeSearchText(searchTerm);
    const searchableText = normalizeSearchText([
      exercise.nombre,
      exercise.descripcion,
      exercise.grupo_muscular,
      exercise.musculo_principal || "",
      exercise.patron_movimiento || "",
      ...(exercise.aliases || []),
      ...(exercise.equipo_requerido || []),
    ].join(" "));
    const matchesSearch = normalizedSearchTerm === "" || searchableText.includes(normalizedSearchTerm);
    const matchesMuscleGroup = !muscleGroupFilter || muscleGroupFilter === "all" || exercise.grupo_muscular === muscleGroupFilter;
    
    const matchesLevel = canAccessExerciseLevel(exercise.nivel_minimo || exercise.nivel, levelFilter);
    
    const matchesType = !typeFilter || typeFilter === "all" || exercise.tipo_entrenamiento === typeFilter;
    
    return matchesSearch && matchesMuscleGroup && matchesLevel && matchesType;
  });

  // Obtener valores únicos para los filtros
  const uniqueMuscleGroups = Array.from(new Set(exercises.map(e => e.grupo_muscular))).sort();
  const uniqueLevels = exerciseLevelOrder;
  const uniqueTypes = Array.from(new Set(exercises.map(e => e.tipo_entrenamiento))).sort();

  const handleAdd = () => {
    if (!selectedExercise) return;

    onAddExercise({
      exercise: selectedExercise,
      series: parseInt(series),
      repeticiones: parseInt(repeticiones),
      peso: parseFloat(peso),
      estimatedCalories
    });

    // Reset form
    setSelectedExercise(null);
    setSeries("3");
    setRepeticiones("10");
    setPeso("0");
    setSearchTerm("");
    setMuscleGroupFilter("all");
    setLevelFilter("all");
    setTypeFilter("all");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Agregar Ejercicio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Buscador */}
          <div className="space-y-2">
            <Label>Buscar ejercicio</Label>
            <Input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Grupo muscular</Label>
              <Select value={muscleGroupFilter} onValueChange={setMuscleGroupFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueMuscleGroups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nivel</Label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {formatExerciseLevel(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Tipo de ejercicio</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selector de ejercicio */}
          <div className="space-y-2">
            <Label>Ejercicio ({filteredExercises.length} disponibles)</Label>
            <Select
              value={selectedExercise?.id}
              onValueChange={(value) => {
                const exercise = filteredExercises.find(e => e.id === value);
                setSelectedExercise(exercise || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ejercicio" />
              </SelectTrigger>
              <SelectContent>
                {filteredExercises.map((exercise) => (
                  <SelectItem key={exercise.id} value={exercise.id}>
                    {exercise.nombre} - {exercise.grupo_muscular}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedExercise && (
            <>
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="mb-1 flex min-w-0 items-center gap-1.5">
                  <p className="truncate font-medium">{selectedExercise.nombre}</p>
                  <button
                    type="button"
                    className="shrink-0 rounded-full p-0.5 text-blue-500 transition-colors hover:bg-blue-500/10 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={`Ver información de ${selectedExercise.nombre}`}
                    onClick={() => setExerciseDetailOpen(true)}
                  >
                    <HelpCircle className="h-4 w-4 text-blue-500" />
                  </button>
                </div>
                <p className="text-muted-foreground text-xs">{selectedExercise.descripcion}</p>
                <p className="text-xs mt-2">
                  <span className="font-medium">Grupo muscular:</span> {selectedExercise.grupo_muscular}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Series</Label>
                  <Input
                    type="number"
                    min="1"
                    value={series}
                    onChange={(e) => setSeries(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Repeticiones</Label>
                  <Input
                    type="number"
                    min="1"
                    value={repeticiones}
                    onChange={(e) => setRepeticiones(e.target.value)}
                  />
                </div>
              </div>

              {location === "gimnasio" && (
                <div className="space-y-2">
                  <Label>Peso (kg)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                  />
                </div>
              )}

              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium mb-1">Calorías estimadas</p>
                <p className="text-2xl font-bold text-primary">{estimatedCalories} kcal</p>
              </div>

              <Button onClick={handleAdd} className="w-full">
                Agregar ejercicio
              </Button>
            </>
          )}
        </div>
      </DialogContent>
      <ExerciseDetailModal
        open={exerciseDetailOpen}
        onOpenChange={setExerciseDetailOpen}
        exercise={selectedExercise}
      />
    </Dialog>
  );
};
