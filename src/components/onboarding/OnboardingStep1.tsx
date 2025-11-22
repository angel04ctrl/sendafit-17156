/**
 * OnboardingStep1.tsx - Paso 1 del onboarding: Datos Personales
 * 
 * Este componente recopila la información básica del usuario.
 * Se encarga de:
 * - Capturar nombre completo del usuario
 * - Solicitar edad (13-120 años)
 * - Seleccionar sexo biológico (masculino/femenino)
 * - Ingresar altura en centímetros
 * - Ingresar peso actual en kilogramos
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OnboardingStep1Props {
  formData: any;
  updateFormData: (data: any) => void;
}

const OnboardingStep1 = ({ formData, updateFormData }: OnboardingStep1Props) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Datos Personales</h2>
        <p className="text-muted-foreground">Cuéntanos un poco sobre ti</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            value={formData.fullName || ""}
            onChange={(e) => updateFormData({ fullName: e.target.value })}
            placeholder="Tu nombre completo"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="age">Edad</Label>
          <Input
            id="age"
            type="number"
            value={formData.age || ""}
            onChange={(e) => updateFormData({ age: parseInt(e.target.value) })}
            placeholder="Tu edad"
            min="13"
            max="120"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Sexo</Label>
          <Select
            value={formData.gender || ""}
            onValueChange={(value) => updateFormData({ gender: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona tu sexo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="femenino">Femenino</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="height">Altura (cm)</Label>
            <Input
              id="height"
              type="number"
              value={formData.height || ""}
              onChange={(e) => updateFormData({ height: parseFloat(e.target.value) })}
              placeholder="170"
              min="100"
              max="250"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Peso (kg)</Label>
            <Input
              id="weight"
              type="number"
              value={formData.weight || ""}
              onChange={(e) => updateFormData({ weight: parseFloat(e.target.value) })}
              placeholder="70"
              min="30"
              max="300"
              required
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep1;
