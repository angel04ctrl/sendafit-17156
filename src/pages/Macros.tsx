/**
 * Macros.tsx - Página de seguimiento de macros nutricionales
 * 
 * Este documento gestiona el seguimiento de nutrición del usuario.
 * Se encarga de:
 * - Mostrar resumen de macros del día (calorías, proteínas, carbos, grasas)
 * - Registrar comidas desde base de datos de alimentos
 * - Registrar comidas manualmente con valores personalizados
 * - Calcular porciones y macros automáticamente
 * - Eliminar comidas registradas
 * - Agrupar comidas por tipo (desayuno, colaciones, almuerzo, cena)
 * - Identificar comidas con IA usando cámara (función PRO)
 * - Adaptar vista móvil con carousel y vista desktop con grid
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, Edit, Plus, Trash2, Search, Camera, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ProButton } from "@/components/ProButton";
import { StatCard } from "@/components/StatCard";
import { Flame, Pizza, Beef, Droplet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DashboardMobileCarousel } from "@/components/DashboardMobileCarousel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FoodAnalysisModal } from "@/components/ai/FoodAnalysisModal";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useMealsHistory } from "@/hooks/useBackendApi";
import { MealHistorySection } from "@/components/MealHistorySection";
import { useQueryClient } from "@tanstack/react-query";
import { validateCalculatedMealInput, validateMealInput } from "@/lib/mealValidation";
import {
  calculateMacrosByGrams,
  normalizeFoodNutrition,
  sumMacroTotals,
  type MacroTotals,
} from "@/lib/nutritionCalculator";

type Meal = {
  id: string;
  user_id: string;
  date: string;
  name: string;
  meal_type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const mealTypes = [
  { value: "desayuno", label: "Desayuno" },
  { value: "colacion_am", label: "Colación AM" },
  { value: "comida", label: "Almuerzo" },
  { value: "colacion_pm", label: "Colación PM" },
  { value: "cena", label: "Cena" },
];

const Macros = () => {
  const { user } = useAuth();
  const { canAccess } = useFeatureFlags();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const sb = supabase;
  
  // Obtener todas las comidas para el historial
  const { data: allMeals = [] } = useMealsHistory(undefined, undefined, user?.id);
  
  const [meals, setMeals] = useState<Meal[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [foods, setFoods] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [foodGrams, setFoodGrams] = useState("100");
  const [customServings, setCustomServings] = useState("1");
  const [customGramsPerServing, setCustomGramsPerServing] = useState("100");
  const [foodAnalysisOpen, setFoodAnalysisOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const [formData, setFormData] = useState({
    meal_type: "desayuno",
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    date: today,
  });

  const selectedFoodNutrition = useMemo(() => {
    if (!selectedFood) return null;
    return normalizeFoodNutrition(selectedFood);
  }, [selectedFood]);

  const selectedFoodMacros = useMemo(() => {
    if (!selectedFood) return null;
    return calculateMacrosByGrams(selectedFood, Number(foodGrams) || 0);
  }, [selectedFood, foodGrams]);

  const customMealMacros = useMemo<MacroTotals>(() => {
    const servings = Number(customServings) || 0;
    return {
      calories: Math.round((Number(formData.calories) || 0) * servings),
      protein: Math.round((Number(formData.protein) || 0) * servings),
      carbs: Math.round((Number(formData.carbs) || 0) * servings),
      fat: Math.round((Number(formData.fat) || 0) * servings),
    };
  }, [customServings, formData.calories, formData.protein, formData.carbs, formData.fat]);

  const fetchFoods = useCallback(async () => {
    const { data } = await sb
      .from("foods")
      .select("*")
      .order("nombre", { ascending: true });
    
    setFoods(data || []);
  }, [sb]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: profileData } = await sb
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    const { data: mealsData } = await sb
      .from("meals")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("created_at", { ascending: false });

    setMeals(mealsData || []);
  }, [user, sb, today]);

  const refreshMeals = useCallback(async () => {
    await fetchData();
    await queryClient.invalidateQueries({ queryKey: ["meals-history"] });
  }, [fetchData, queryClient]);

  useEffect(() => {
    fetchData();
    fetchFoods();
  }, [fetchData, fetchFoods]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    const gramsPerServing = Number(customGramsPerServing);
    const servings = Number(customServings);
    if (!Number.isFinite(gramsPerServing) || gramsPerServing <= 0) {
      toast.error("Los gramos por porcion deben ser mayores a cero.");
      return;
    }
    if (!Number.isFinite(servings) || servings <= 0) {
      toast.error("La cantidad de porciones debe ser mayor a cero.");
      return;
    }

    const validation = validateCalculatedMealInput({
      ...formData,
      calories: customMealMacros.calories,
      protein: customMealMacros.protein,
      carbs: customMealMacros.carbs,
      fat: customMealMacros.fat,
      ingredientCount: 1,
      hasCalculatedMacros: customMealMacros.calories > 0,
    });
    if (!validation.meal) {
      toast.error(validation.errors[0] || "Revisa los datos de la comida");
      return;
    }

    validation.warnings.forEach((warning) => toast.warning(warning));

    const payload = {
      meal_type: validation.meal.meal_type as any,
      name: validation.meal.name,
      calories: validation.meal.calories,
      protein: validation.meal.protein,
      carbs: validation.meal.carbs,
      fat: validation.meal.fat,
      date: validation.meal.date,
    };

    const { data: savedMeal, error } = editingMeal
      ? await sb
        .from("meals")
        .update(payload)
        .eq("id", editingMeal.id)
        .eq("user_id", user.id)
        .select("id")
        .single()
      : await sb.from("meals").insert([{ user_id: user.id, ...payload }]).select("id").single();

    if (error) {
      toast.error(editingMeal ? "Error al actualizar comida" : "Error al registrar comida");
      return;
    }

    const mealId = savedMeal?.id || editingMeal?.id;
    if (mealId) {
      await sb.from("meal_ingredients" as any).delete().eq("meal_id", mealId).eq("user_id", user.id);
      await sb.from("meal_ingredients" as any).insert([{
        meal_id: mealId,
        user_id: user.id,
        ingredient_name: validation.meal.name,
        source: "user_custom",
        is_verified: false,
        quantity: servings,
        unit: "serving",
        grams: gramsPerServing * servings,
        calories: validation.meal.calories,
        protein: validation.meal.protein,
        carbs: validation.meal.carbs,
        fat: validation.meal.fat,
        metadata: {
          gramsPerServing,
          caloriesPerServing: Number(formData.calories) || 0,
          proteinPerServing: Number(formData.protein) || 0,
          carbsPerServing: Number(formData.carbs) || 0,
          fatPerServing: Number(formData.fat) || 0,
        },
      }]).then(({ error: ingredientError }) => {
        if (ingredientError) console.warn("meal_ingredients insert skipped:", ingredientError.message);
      });
    }

    toast.success(editingMeal ? "Comida actualizada" : "Comida registrada");
    resetForm();
    refreshMeals();
  };

  const handleSubmitFromDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFood) {
      toast.error("Selecciona un alimento");
      return;
    }

    if (!user) return;

    const grams = Number(foodGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      toast.error("Los gramos deben ser mayores a cero.");
      return;
    }
    
    const normalizedFood = normalizeFoodNutrition(selectedFood);
    const calculatedMacros = calculateMacrosByGrams(selectedFood, grams);
    const validation = validateCalculatedMealInput({
      meal_type: formData.meal_type,
      name: `${normalizedFood.name} (${grams} g)`,
      calories: calculatedMacros.calories,
      protein: calculatedMacros.protein,
      carbs: calculatedMacros.carbs,
      fat: calculatedMacros.fat,
      date: formData.date,
      ingredientCount: 1,
      hasCalculatedMacros: calculatedMacros.calories > 0,
    });

    if (!validation.meal) {
      toast.error(validation.errors[0] || "No se pudo calcular esta comida.");
      return;
    }

    validation.warnings.forEach((warning) => toast.warning(warning));

    const portion = `${grams} g`;
    const { data: savedMeal, error } = await sb.from("meals").insert([{
      user_id: user.id,
      meal_type: validation.meal.meal_type as any,
      name: `${selectedFood.nombre} (${portion} × ${selectedFood.racion}${selectedFood.unidad})`,
      calories: validation.meal.calories,
      protein: validation.meal.protein,
      carbs: validation.meal.carbs,
      fat: validation.meal.fat,
      date: validation.meal.date,
    }]).select("id").single();

    if (error) {
      toast.error("Error al registrar comida");
      return;
    }

    await sb.from("meal_ingredients" as any).insert([{
      meal_id: savedMeal.id,
      user_id: user.id,
      food_id: selectedFood.id,
      ingredient_name: normalizedFood.name,
      source: selectedFood.source || "food_database",
      is_verified: Boolean(selectedFood.is_verified),
      quantity: grams,
      unit: "g",
      grams,
      calories: validation.meal.calories,
      protein: validation.meal.protein,
      carbs: validation.meal.carbs,
      fat: validation.meal.fat,
      fiber: calculatedMacros.fiber,
      sugar: calculatedMacros.sugar,
      sodium_mg: calculatedMacros.sodiumMg,
      metadata: {
        fdcId: selectedFood.fdc_id,
        sourceLicense: selectedFood.source_license,
        servingUnit: normalizedFood.servingUnit,
        gramsPerServing: normalizedFood.gramsPerServing,
      },
    }]).then(({ error: ingredientError }) => {
      if (ingredientError) console.warn("meal_ingredients insert skipped:", ingredientError.message);
    });

    toast.success("Comida registrada");
    resetForm();
    refreshMeals();
  };

  const resetForm = () => {
    setOpen(false);
    setEditingMeal(null);
    setFormData({
      meal_type: "desayuno",
      name: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      date: today,
    });
    setSelectedFood(null);
    setFoodGrams("100");
    setCustomServings("1");
    setCustomGramsPerServing("100");
    setSearchQuery("");
  };

  const openEditMeal = (meal: Meal) => {
    setEditingMeal(meal);
    setSelectedFood(null);
    setSearchQuery("");
    setFoodGrams("100");
    setCustomServings("1");
    setCustomGramsPerServing("100");
    setFormData({
      meal_type: meal.meal_type,
      name: meal.name,
      calories: String(meal.calories),
      protein: String(meal.protein),
      carbs: String(meal.carbs),
      fat: String(meal.fat),
      date: meal.date,
    });
    setOpen(true);
  };

  const duplicateMeal = async (meal: Meal, date: string, editBeforeSave = false) => {
    if (editBeforeSave) {
      setEditingMeal(null);
      setSelectedFood(null);
      setSearchQuery("");
      setFoodGrams("100");
      setCustomServings("1");
      setCustomGramsPerServing("100");
      setFormData({
        meal_type: meal.meal_type,
        name: meal.name,
        calories: String(meal.calories),
        protein: String(meal.protein),
        carbs: String(meal.carbs),
        fat: String(meal.fat),
        date,
      });
      setOpen(true);
      return;
    }

    const validation = validateMealInput({ ...meal, date });
    if (!validation.meal || !user) {
      toast.error(validation.errors[0] || "No se pudo repetir la comida");
      return;
    }

    const { error } = await sb.from("meals").insert([{
      user_id: user.id,
      meal_type: validation.meal.meal_type as any,
      name: validation.meal.name,
      calories: validation.meal.calories,
      protein: validation.meal.protein,
      carbs: validation.meal.carbs,
      fat: validation.meal.fat,
      date: validation.meal.date,
    }]);

    if (error) {
      toast.error("Error al repetir comida");
      return;
    }

    toast.success("Comida repetida");
    refreshMeals();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;

    const { error } = await sb.from("meals").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      toast.error("Error al eliminar");
      return;
    }

    toast.success("Comida eliminada");
    refreshMeals();
  };

  const renderMealActions = (meal: Meal) => (
    <div className="flex flex-wrap justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={() => openEditMeal(meal)} title="Editar comida">
        <Edit className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => duplicateMeal(meal, today)} title="Repetir hoy">
        <Copy className="w-4 h-4" />
        Hoy
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => duplicateMeal(meal, format(new Date(Date.now() + 24 * 60 * 60 * 1000), "yyyy-MM-dd"))}
      >
        Manana
      </Button>
      <Button variant="ghost" size="sm" onClick={() => duplicateMeal(meal, today, true)}>
        Duplicar
      </Button>
      <Button variant="ghost" size="icon" onClick={() => handleDelete(meal.id)} title="Eliminar comida">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const mealsByType = mealTypes.map((type) => ({
    ...type,
    meals: meals.filter((m) => m.meal_type === type.value),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-14 sm:pt-16 pb-16 sm:pb-20 px-3 sm:px-4 overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-2 sm:space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">Seguimiento de Macros</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Registra tus comidas y mantén el control de tu nutrición
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="default" className="gap-2 w-full sm:w-auto">
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-sm sm:text-base">Registrar Comida</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingMeal ? "Editar Comida" : "Registrar Comida"}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Comida</Label>
                    <Select
                      value={formData.meal_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, meal_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mealTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>

                  <Tabs defaultValue={editingMeal ? "manual" : "database"} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="database" disabled={Boolean(editingMeal)}>
                        <Search className="w-4 h-4 mr-2" />
                        Base de Datos
                      </TabsTrigger>
                      <TabsTrigger value="manual">
                        <Plus className="w-4 h-4 mr-2" />
                        Manual
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="database" className="space-y-4">
                      <form onSubmit={handleSubmitFromDatabase} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Buscar Alimento</Label>
                          <Command className="rounded-lg border">
                            <CommandInput 
                              placeholder="Busca un alimento..." 
                              value={searchQuery}
                              onValueChange={setSearchQuery}
                            />
                            <CommandList className="max-h-[200px]">
                              <CommandEmpty>No se encontraron alimentos.</CommandEmpty>
                              <CommandGroup>
                                {foods
                                  .filter((food) =>
                                    food.nombre.toLowerCase().includes(searchQuery.toLowerCase())
                                  )
                                  .slice(0, 10)
                                  .map((food) => (
                                    <CommandItem
                                      key={food.id}
                                      value={food.nombre}
                                      onSelect={() => {
                                        setSelectedFood(food);
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">{food.nombre}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {food.calorias} kcal · {food.proteinas}g prot · {food.carbohidratos}g carbs · {food.grasas}g grasa
                                          <span className="ml-2">({food.racion}{food.unidad})</span>
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </div>

                        {selectedFood && (
                          <Card className="p-4 bg-muted">
                            <div className="space-y-3">
                              <div>
                                <p className="font-semibold text-lg">{selectedFoodNutrition?.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Porción base: {selectedFood.racion}{selectedFood.unidad}
                                </p>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Gramos estimados</Label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={foodGrams}
                                  onChange={(e) => setFoodGrams(e.target.value)}
                                  placeholder="Ej: 100, 150, 250"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Corrige cantidades para mejorar la estimacion. Los macros se recalculan automaticamente.
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                                <div>
                                  <p className="text-xs text-muted-foreground">Calorías</p>
                                  <p className="text-lg font-bold">
                                    {selectedFoodMacros?.calories || 0} kcal
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Proteína</p>
                                  <p className="text-lg font-bold">
                                    {selectedFoodMacros?.protein || 0}g
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Carbohidratos</p>
                                  <p className="text-lg font-bold">
                                    {selectedFoodMacros?.carbs || 0}g
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Grasas</p>
                                  <p className="text-lg font-bold">
                                    {selectedFoodMacros?.fat || 0}g
                                  </p>
                                </div>
                              </div>
                            </div>
                          </Card>
                        )}

                        <Button type="submit" className="w-full" disabled={!selectedFood}>
                          Registrar Alimento
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent value="manual" className="space-y-4">
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Nombre del Alimento</Label>
                          <Input
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            required
                          />
                        </div>
                        <Card className="border-amber-200 bg-amber-50 p-3">
                          <p className="text-sm text-amber-900">
                            Correccion manual avanzada: captura valores por porcion. Esta correccion puede afectar la precision de tus reportes.
                          </p>
                        </Card>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Porciones</Label>
                            <Input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={customServings}
                              onChange={(e) => setCustomServings(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Gramos por porcion</Label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={customGramsPerServing}
                              onChange={(e) => setCustomGramsPerServing(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Calorías</Label>
                            <Input
                              type="number"
                              value={formData.calories}
                              onChange={(e) =>
                                setFormData({ ...formData, calories: e.target.value })
                              }
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Proteína (g)</Label>
                            <Input
                              type="number"
                              value={formData.protein}
                              onChange={(e) =>
                                setFormData({ ...formData, protein: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Carbohidratos (g)</Label>
                            <Input
                              type="number"
                              value={formData.carbs}
                              onChange={(e) =>
                                setFormData({ ...formData, carbs: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Grasas (g)</Label>
                            <Input
                              type="number"
                              value={formData.fat}
                              onChange={(e) =>
                                setFormData({ ...formData, fat: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <Card className="p-3">
                          <p className="text-xs text-muted-foreground">Macros finales calculados</p>
                          <p className="text-sm font-medium">
                            {customMealMacros.calories} kcal · {customMealMacros.protein}g proteina · {customMealMacros.carbs}g carbs · {customMealMacros.fat}g grasa
                          </p>
                        </Card>
                        <Button type="submit" className="w-full">
                          {editingMeal ? "Guardar cambios" : "Registrar"}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </div>
              </DialogContent>
              </Dialog>
              
              {canAccess("foodAIEnabled") ? (
                <Button 
                  variant="outline" 
                  className="gap-2 w-full sm:w-auto"
                  onClick={() => setFoodAnalysisOpen(true)}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm sm:text-base">Análisis IA</span>
                </Button>
              ) : (
              <ProButton
                icon={Camera}
                label="Análisis IA"
                featureTitle="Identificación de Comida con IA"
                featureDescription="Analiza fotos de tus comidas y obtén información nutricional instantánea"
                features={[
                  "Escanea cualquier plato con tu cámara",
                  "Estimación automática de calorías y macros",
                  "Reconocimiento de ingredientes",
                  "Sugerencias de porciones",
                  "Historial de análisis con fotos"
                ]}
                onClick={() => setFoodAnalysisOpen(true)}
                className="w-full sm:w-auto"
              />
              )}
              
              <FoodAnalysisModal
                open={foodAnalysisOpen}
                onOpenChange={setFoodAnalysisOpen}
                onSaved={refreshMeals}
              />
            </div>
          </div>

          {isMobile ? (
            <DashboardMobileCarousel
              sections={[
                // Primera división: Stats en cuadros
                <div className="h-full flex flex-col justify-start pt-6 px-4" key="stats">
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <StatCard
                      title="Calorías"
                      value={totals.calories}
                      subtitle={`Meta: ${profile?.daily_calorie_goal || 2000}`}
                      icon={Flame}
                      variant="primary"
                      className="h-[135px]"
                    />
                    <StatCard
                      title="Proteína"
                      value={`${totals.protein}g`}
                      subtitle={`Meta: ${profile?.daily_protein_goal || 150}g`}
                      icon={Beef}
                      variant="secondary"
                      className="h-[135px]"
                    />
                    <StatCard
                      title="Carbohidratos"
                      value={`${totals.carbs}g`}
                      subtitle={`Meta: ${profile?.daily_carbs_goal || 200}g`}
                      icon={Pizza}
                      className="h-[135px]"
                    />
                    <StatCard
                      title="Grasas"
                      value={`${totals.fat}g`}
                      subtitle={`Meta: ${profile?.daily_fat_goal || 50}g`}
                      icon={Droplet}
                      className="h-[135px]"
                    />
                  </div>
                </div>,
                // Segunda división: Meals con acordeón
                <div className="h-full p-3 overflow-y-auto" key="meals">
                  {mealsByType.filter(type => type.meals.length > 0).length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <Card className="p-6 shadow-card text-center">
                        <p className="text-base text-muted-foreground">
                          Los alimentos que registres apareceran aqui :D
                        </p>
                      </Card>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-2">
                      {mealsByType
                        .filter((type) => type.meals.length > 0)
                        .map((type) => (
                          <AccordionItem key={type.value} value={type.value} className="border rounded-lg px-3 bg-card shadow-card">
                            <AccordionTrigger className="hover:no-underline py-3">
                              <h3 className="text-base font-semibold">{type.label}</h3>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pb-2">
                                {type.meals.map((meal) => (
                                  <div
                                    key={meal.id}
                                    className="flex items-center justify-between p-2.5 bg-muted rounded-lg"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate text-sm">{meal.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {meal.calories} kcal · {meal.protein}g prot · {meal.carbs}g carbs · {meal.fat}g grasa
                                      </p>
                                    </div>
                                    <div className="ml-2 flex-shrink-0">
                                      {renderMealActions(meal)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                    </Accordion>
                  )}
                </div>
              ]}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                <StatCard
                  title="Calorías"
                  value={totals.calories}
                  subtitle={`Meta: ${profile?.daily_calorie_goal || 2000}`}
                  icon={Flame}
                  variant="primary"
                />
                <StatCard
                  title="Proteína"
                  value={`${totals.protein}g`}
                  subtitle={`Meta: ${profile?.daily_protein_goal || 150}g`}
                  icon={Beef}
                  variant="secondary"
                />
                <StatCard
                  title="Carbohidratos"
                  value={`${totals.carbs}g`}
                  subtitle={`Meta: ${profile?.daily_carbs_goal || 200}g`}
                  icon={Pizza}
                />
                <StatCard
                  title="Grasas"
                  value={`${totals.fat}g`}
                  subtitle={`Meta: ${profile?.daily_fat_goal || 50}g`}
                  icon={Droplet}
                />
              </div>

              <div className="space-y-6">
                {mealsByType.map((type) => (
                  <Card key={type.value} className="p-6 shadow-card">
                    <h3 className="text-xl font-semibold mb-4">{type.label}</h3>
                    {type.meals.length === 0 ? (
                      <p className="text-muted-foreground">
                        No has registrado nada para {type.label.toLowerCase()}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {type.meals.map((meal) => (
                          <div
                            key={meal.id}
                            className="flex items-center justify-between p-4 bg-muted rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{meal.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {meal.calories} kcal · {meal.protein}g proteína · {meal.carbs}g
                                carbos · {meal.fat}g grasa
                              </p>
                            </div>
                            {renderMealActions(meal)}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}

                {/* Historial de comidas */}
                <div className="mt-8 pt-8 border-t">
                  <MealHistorySection 
                    meals={allMeals}
                    onDeleteMeal={handleDelete}
                    onEditMeal={openEditMeal}
                    onRepeatMeal={(meal, date, editBeforeSave) => duplicateMeal(meal as Meal, date, editBeforeSave)}
                    dailyCalorieGoal={profile?.daily_calorie_goal || 2000}
                    dailyProteinGoal={profile?.daily_protein_goal || 150}
                    isLoading={false}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Macros;
