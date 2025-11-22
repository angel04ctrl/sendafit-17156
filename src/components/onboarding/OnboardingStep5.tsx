/**
 * OnboardingStep5.tsx - Paso 5 del onboarding: Nutrición y Hábitos
 * 
 * Este componente recopila información sobre alimentación y estilo de vida.
 * Se encarga de:
 * - Seleccionar preferencias alimenticias (vegano, vegetariano, keto, normal, paleo)
 * - Registrar alergias o restricciones alimentarias (opcional)
 * - Ingresar consumo calórico actual estimado (opcional)
 * - Especificar horas de sueño promedio por noche
 * - Evaluar nivel de estrés percibido (escala 1-5)
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

interface OnboardingStep5Props {
  formData: any;
  updateFormData: (data: any) => void;
}

const dietaryOptions = [
  { id: "vegano", label: "Vegano" },
  { id: "vegetariano", label: "Vegetariano" },
  { id: "keto", label: "Keto" },
  { id: "normal", label: "Normal" },
  { id: "paleo", label: "Paleo" }
];

const OnboardingStep5 = ({ formData, updateFormData }: OnboardingStep5Props) => {
  // Función para agregar/quitar preferencias alimenticias
  // Permite múltiples selecciones simultáneas
  const toggleDietaryPreference = (pref: string) => {
    const current = formData.dietaryPreferences || [];
    const updated = current.includes(pref)
      ? current.filter((p: string) => p !== pref)
      : [...current, pref];
    updateFormData({ dietaryPreferences: updated });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Nutrición y Hábitos</h2>
        <p className="text-muted-foreground">Tu alimentación y estilo de vida</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <Label>Preferencias alimenticias *</Label>
          {dietaryOptions.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox
                id={option.id}
                checked={formData.dietaryPreferences?.includes(option.id) || false}
                onCheckedChange={() => toggleDietaryPreference(option.id)}
              />
              <Label htmlFor={option.id} className="cursor-pointer font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="allergies">Alergias o restricciones (opcional)</Label>
          <Textarea
            id="allergies"
            value={formData.allergies || ""}
            onChange={(e) => updateFormData({ allergies: e.target.value })}
            placeholder="Ej: Intolerancia a la lactosa, alergia al maní"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentCalories">Consumo calórico actual (opcional)</Label>
          <Input
            id="currentCalories"
            type="number"
            value={formData.currentCalories || ""}
            onChange={(e) => updateFormData({ currentCalories: parseInt(e.target.value) })}
            placeholder="2000"
            min="800"
            max="5000"
          />
          <p className="text-xs text-muted-foreground">
            Si no lo sabes, lo calcularemos por ti
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sleepHours">Horas de sueño promedio por noche *</Label>
          <Input
            id="sleepHours"
            type="number"
            step="0.5"
            value={formData.sleepHours || ""}
            onChange={(e) => updateFormData({ sleepHours: parseFloat(e.target.value) })}
            placeholder="7.5"
            min="3"
            max="12"
            required
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="stressLevel">
            Nivel de estrés percibido *: {formData.stressLevel || 3}
          </Label>
          <Slider
            id="stressLevel"
            min={1}
            max={5}
            step={1}
            value={[formData.stressLevel || 3]}
            onValueChange={([value]) => updateFormData({ stressLevel: value })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Bajo</span>
            <span>Medio</span>
            <span>Alto</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep5;
