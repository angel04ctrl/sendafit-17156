/**
 * OnboardingStep2.tsx - Paso 2 del onboarding: Objetivos y Nivel
 * 
 * Este componente define el plan de entrenamiento del usuario.
 * Se encarga de:
 * - Seleccionar objetivo principal (bajar grasa, ganar masa, etc.)
 * - Definir nivel de fitness (principiante, intermedio, avanzado)
 * - Elegir tipos de entrenamiento preferidos (gimnasio, casa, funcional, etc.)
 * - Especificar días por semana disponibles para entrenar
 * - Definir duración de sesiones de entrenamiento
 * - Seleccionar días específicos de la semana para entrenar
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface OnboardingStep2Props {
  formData: any;
  updateFormData: (data: any) => void;
}

const trainingOptions = [
  { id: "gimnasio", label: "Gimnasio" },
  { id: "casa", label: "Casa" },
  { id: "funcional", label: "Funcional" },
  { id: "cardio", label: "Cardio" },
  { id: "mixto", label: "Mixto" }
];

const OnboardingStep2 = ({ formData, updateFormData }: OnboardingStep2Props) => {
  // Función para agregar/quitar tipos de entrenamiento de la selección
  const toggleTrainingType = (type: string) => {
    const current = formData.trainingTypes || [];
    const updated = current.includes(type)
      ? current.filter((t: string) => t !== type)
      : [...current, type];
    updateFormData({ trainingTypes: updated });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Objetivos y Nivel</h2>
        <p className="text-muted-foreground">Define tu plan de entrenamiento</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="primaryGoal">Objetivo principal *</Label>
          <Select
            value={formData.primaryGoal || ""}
            onValueChange={(value) => updateFormData({ primaryGoal: value })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona tu objetivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bajar_grasa">Bajar grasa</SelectItem>
              <SelectItem value="ganar_masa">Ganar masa muscular</SelectItem>
              <SelectItem value="mantener_peso">Mantener peso</SelectItem>
              <SelectItem value="rendimiento">Mejorar rendimiento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fitnessLevel">Nivel actual *</Label>
          <Select
            value={formData.fitnessLevel || ""}
            onValueChange={(value) => updateFormData({ fitnessLevel: value })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona tu nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="principiante">Principiante</SelectItem>
              <SelectItem value="intermedio">Intermedio</SelectItem>
              <SelectItem value="avanzado">Avanzado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Tipo de entrenamiento preferido *</Label>
          {trainingOptions.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox
                id={option.id}
                checked={formData.trainingTypes?.includes(option.id) || false}
                onCheckedChange={() => toggleTrainingType(option.id)}
              />
              <Label htmlFor={option.id} className="cursor-pointer font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="availableDays">Días por semana *</Label>
            <Select
              value={formData.availableDays?.toString() || ""}
              onValueChange={(value) => updateFormData({ availableDays: parseInt(value) })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Días" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day} {day === 1 ? "día" : "días"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionDuration">Duración (min) *</Label>
            <Input
              id="sessionDuration"
              type="number"
              value={formData.sessionDuration || ""}
              onChange={(e) => updateFormData({ sessionDuration: parseInt(e.target.value) })}
              placeholder="60"
              min="15"
              max="180"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Días específicos disponibles *</Label>
          <p className="text-xs text-muted-foreground">
            Selecciona los días de la semana que tienes disponibles para entrenar
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 1, label: "Lunes" },
              { id: 2, label: "Martes" },
              { id: 3, label: "Miércoles" },
              { id: 4, label: "Jueves" },
              { id: 5, label: "Viernes" },
              { id: 6, label: "Sábado" },
              { id: 7, label: "Domingo" }
            ].map((day) => (
              <div key={day.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`day-${day.id}`}
                  checked={formData.availableWeekdays?.includes(day.id) || false}
                  onCheckedChange={() => {
                    const current = formData.availableWeekdays || [];
                    const updated = current.includes(day.id)
                      ? current.filter((d: number) => d !== day.id)
                      : [...current, day.id].sort((a: number, b: number) => a - b);
                    updateFormData({ availableWeekdays: updated });
                  }}
                />
                <Label htmlFor={`day-${day.id}`} className="cursor-pointer font-normal">
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep2;
