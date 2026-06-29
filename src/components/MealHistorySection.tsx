/**
 * MealHistorySection.tsx - Componente para visualizar historial de comidas
 * 
 * Muestra comidas registradas de días anteriores con:
 * - Filtrado por rango de fechas (semana actual, semana anterior, etc.)
 * - Vista por día con resumen de macros
 * - Información detallada de cada comida
 * - Cálculo de totales diarios y semanales
 */

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Flame, Beef, Pizza, Droplet, Trash2, Edit, Copy } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Meal {
  id: string;
  date: string;
  name: string;
  meal_type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealHistorySectionProps {
  meals: Meal[];
  onDeleteMeal: (mealId: string) => void;
  onEditMeal?: (meal: Meal) => void;
  onRepeatMeal?: (meal: Meal, date: string, editBeforeSave?: boolean) => void;
  dailyCalorieGoal?: number;
  dailyProteinGoal?: number;
  isLoading?: boolean;
}

const mealTypeLabels = {
  desayuno: "Desayuno",
  colacion_am: "Colación AM",
  comida: "Almuerzo",
  colacion_pm: "Colación PM",
  cena: "Cena",
};

const getMealTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    desayuno: "bg-amber-100",
    colacion_am: "bg-green-100",
    comida: "bg-red-100",
    colacion_pm: "bg-blue-100",
    cena: "bg-purple-100",
  };
  return colors[type] || "bg-gray-100";
};

export const MealHistorySection = ({
  meals,
  onDeleteMeal,
  onEditMeal,
  onRepeatMeal,
  dailyCalorieGoal = 2000,
  dailyProteinGoal = 150,
  isLoading = false,
}: MealHistorySectionProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState("this-week");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Calcular fechas según el filtro seleccionado
  const dateRange = useMemo(() => {
    const today = new Date();
    let start: Date, end: Date;

    switch (selectedPeriod) {
      case "this-week":
        start = startOfWeek(today, { locale: es, weekStartsOn: 1 });
        end = endOfWeek(today, { locale: es, weekStartsOn: 1 });
        break;
      case "last-week":
        const lastWeekStart = subWeeks(
          startOfWeek(today, { locale: es, weekStartsOn: 1 }),
          1
        );
        start = lastWeekStart;
        end = endOfWeek(lastWeekStart, { locale: es, weekStartsOn: 1 });
        break;
      case "last-7-days":
        start = addDays(today, -7);
        end = today;
        break;
      case "last-30-days":
        start = addDays(today, -30);
        end = today;
        break;
      default:
        start = startOfWeek(today, { locale: es, weekStartsOn: 1 });
        end = endOfWeek(today, { locale: es, weekStartsOn: 1 });
    }

    return { start, end };
  }, [selectedPeriod]);

  // Filtrar y agrupar comidas por fecha
  const groupedMeals = useMemo(() => {
    const startStr = format(dateRange.start, "yyyy-MM-dd");
    const endStr = format(dateRange.end, "yyyy-MM-dd");

    const filtered = meals.filter((meal) => meal.date >= startStr && meal.date <= endStr);

    // Agrupar por fecha
    const grouped: Record<string, Meal[]> = {};
    filtered.forEach((meal) => {
      if (!grouped[meal.date]) {
        grouped[meal.date] = [];
      }
      grouped[meal.date].push(meal);
    });

    return Object.entries(grouped).sort(([dateA], [dateB]) =>
      dateB.localeCompare(dateA)
    );
  }, [meals, dateRange]);

  // Calcular totales por día
  const calculateDayTotals = (dayMeals: Meal[]) => {
    return dayMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  // Calcular totales del período
  const periodTotals = useMemo(() => {
    const allMeals = groupedMeals.flatMap(([, mealsForDay]) => mealsForDay);
    return calculateDayTotals(allMeals);
  }, [groupedMeals]);

  const simpleSummary = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const sevenDaysAgo = format(addDays(new Date(), -6), "yyyy-MM-dd");
    const todayMeals = meals.filter((meal) => meal.date === today);
    const lastSevenMeals = meals.filter((meal) => meal.date >= sevenDaysAgo && meal.date <= today);
    const totalsByDate = lastSevenMeals.reduce<Record<string, ReturnType<typeof calculateDayTotals>>>(
      (acc, meal) => {
        const existing = acc[meal.date] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        acc[meal.date] = {
          calories: existing.calories + meal.calories,
          protein: existing.protein + meal.protein,
          carbs: existing.carbs + meal.carbs,
          fat: existing.fat + meal.fat,
        };
        return acc;
      },
      {}
    );
    const dayTotals = Object.values(totalsByDate);
    const daysWithData = Math.max(dayTotals.length, 1);
    const sevenDayTotals = calculateDayTotals(lastSevenMeals);
    const daysWithinGoal = dayTotals.filter((total) => {
      const lower = dailyCalorieGoal * 0.9;
      const upper = dailyCalorieGoal * 1.1;
      return total.calories >= lower && total.calories <= upper;
    }).length;

    return {
      todayTotals: calculateDayTotals(todayMeals),
      averageCalories: Math.round(sevenDayTotals.calories / daysWithData),
      averageProtein: Math.round(sevenDayTotals.protein / daysWithData),
      daysWithinGoal,
      daysWithData: dayTotals.length,
    };
  }, [meals, dailyCalorieGoal]);

  const toggleDateExpanded = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">Cargando historial...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Historial de Comidas</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Revisa y analiza tu historial de alimentación
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-full sm:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-week">Esta semana</SelectItem>
            <SelectItem value="last-week">Semana anterior</SelectItem>
            <SelectItem value="last-7-days">Últimos 7 días</SelectItem>
            <SelectItem value="last-30-days">Últimos 30 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Hoy</p>
          <p className="text-lg font-bold">{simpleSummary.todayTotals.calories} kcal</p>
          <p className="text-xs text-muted-foreground">{simpleSummary.todayTotals.protein}g proteina</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Promedio 7 dias</p>
          <p className="text-lg font-bold">{simpleSummary.averageCalories} kcal</p>
          <p className="text-xs text-muted-foreground">{simpleSummary.daysWithData} dia(s) con datos</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Proteina promedio</p>
          <p className="text-lg font-bold">{simpleSummary.averageProtein}g</p>
          <p className="text-xs text-muted-foreground">Meta: {dailyProteinGoal}g</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Dias dentro de meta</p>
          <p className="text-lg font-bold">{simpleSummary.daysWithinGoal}</p>
          <p className="text-xs text-muted-foreground">Rango: +/-10%</p>
        </Card>
      </div>

      {groupedMeals.length === 0 ? (
        <Card className="p-4 text-center text-muted-foreground">
          No hay comidas registradas en este período
        </Card>
      ) : (
        <>
          {/* Resumen del período */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <Card className="p-3 sm:p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-medium text-muted-foreground">Calorías</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-orange-700">
                {Math.round(periodTotals.calories)}
              </div>
              <p className="text-xs text-orange-600">{groupedMeals.length} día(s)</p>
            </Card>

            <Card className="p-3 sm:p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <Beef className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-muted-foreground">Proteína</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-red-700">
                {Math.round(periodTotals.protein)}g
              </div>
            </Card>

            <Card className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Pizza className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-muted-foreground">Carbos</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-blue-700">
                {Math.round(periodTotals.carbs)}g
              </div>
            </Card>

            <Card className="p-3 sm:p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <div className="flex items-center gap-2 mb-1">
                <Droplet className="w-4 h-4 text-yellow-600" />
                <span className="text-xs font-medium text-muted-foreground">Grasas</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-yellow-700">
                {Math.round(periodTotals.fat)}g
              </div>
            </Card>
          </div>

          {/* Comidas por día */}
          <div className="space-y-2">
            {groupedMeals.map(([date, dayMeals]) => {
              const dayTotals = calculateDayTotals(dayMeals);
              const dateObj = new Date(date);
              const isExpanded = expandedDates.has(date);

              return (
                <Card key={date} className="overflow-hidden">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleDateExpanded(date)}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between hover:bg-muted p-3 sm:p-4 h-auto"
                      >
                        <div className="text-left flex-1">
                          <h3 className="font-semibold text-sm sm:text-base">
                            {format(dateObj, "EEEE, d 'de' MMMM", { locale: es })}
                          </h3>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{dayMeals.length} comida(s)</span>
                            <span>{dayTotals.calories} kcal</span>
                            <span>{dayTotals.protein}g proteína</span>
                          </div>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t bg-muted/30">
                      <div className="space-y-2">
                        {dayMeals.map((meal) => (
                          <div
                            key={meal.id}
                            className={`p-2 sm:p-3 rounded-lg ${getMealTypeColor(
                              meal.meal_type
                            )} flex justify-between items-start`}
                          >
                            <div className="flex-1">
                              <div className="font-medium text-xs sm:text-sm">
                                {mealTypeLabels[meal.meal_type as keyof typeof mealTypeLabels] ||
                                  meal.meal_type}
                              </div>
                              <div className="text-xs text-gray-700 line-clamp-1">
                                {meal.name}
                              </div>
                              <div className="flex gap-2 text-xs text-gray-600 mt-1">
                                <span>{meal.calories} kcal</span>
                                <span>{meal.protein}g P</span>
                                <span>{meal.carbs}g C</span>
                                <span>{meal.fat}g G</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteMeal(meal.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-auto p-1"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <div className="flex flex-wrap justify-end gap-1">
                              {onEditMeal && (
                                <Button variant="ghost" size="sm" onClick={() => onEditMeal(meal)}>
                                  <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              )}
                              {onRepeatMeal && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRepeatMeal(meal, format(new Date(), "yyyy-MM-dd"))}
                                  >
                                    <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRepeatMeal(meal, format(addDays(new Date(), 1), "yyyy-MM-dd"))}
                                  >
                                    Manana
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRepeatMeal(meal, format(new Date(), "yyyy-MM-dd"), true)}
                                  >
                                    Duplicar
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Totales del día */}
                      <div className="mt-3 pt-3 border-t border-gray-300/50">
                        <div className="grid grid-cols-4 gap-2 text-xs font-semibold">
                          <div>
                            <span className="text-gray-600">Kcal:</span>
                            <div className="text-base text-gray-900">{dayTotals.calories}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Prot:</span>
                            <div className="text-base text-gray-900">{dayTotals.protein}g</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Carbs:</span>
                            <div className="text-base text-gray-900">{dayTotals.carbs}g</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Grasas:</span>
                            <div className="text-base text-gray-900">{dayTotals.fat}g</div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
