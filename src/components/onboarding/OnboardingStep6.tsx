/**
 * OnboardingStep6.tsx - Paso 6 del onboarding: Progreso Inicial
 * 
 * Este componente captura medidas corporales iniciales para seguimiento.
 * Se encarga de:
 * - Registrar medida de cintura en centímetros (opcional)
 * - Registrar medida de pecho en centímetros (opcional)
 * - Registrar medida de brazos en centímetros (opcional)
 * - Registrar medida de piernas en centímetros (opcional)
 * - Capturar frase motivacional o meta personal (opcional, máx 200 caracteres)
 * - Todas las medidas son opcionales pero útiles para visualizar progreso
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OnboardingStep6Props {
  formData: any;
  updateFormData: (data: any) => void;
}

const OnboardingStep6 = ({ formData, updateFormData }: OnboardingStep6Props) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Progreso Inicial</h2>
        <p className="text-muted-foreground">Medidas de referencia para tu seguimiento</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="waist">Cintura (cm)</Label>
            <Input
              id="waist"
              type="number"
              value={formData.waist || ""}
              onChange={(e) => updateFormData({ waist: parseFloat(e.target.value) })}
              placeholder="80"
              min="40"
              max="200"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chest">Pecho (cm)</Label>
            <Input
              id="chest"
              type="number"
              value={formData.chest || ""}
              onChange={(e) => updateFormData({ chest: parseFloat(e.target.value) })}
              placeholder="95"
              min="50"
              max="200"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="arms">Brazos (cm)</Label>
            <Input
              id="arms"
              type="number"
              value={formData.arms || ""}
              onChange={(e) => updateFormData({ arms: parseFloat(e.target.value) })}
              placeholder="30"
              min="15"
              max="80"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legs">Piernas (cm)</Label>
            <Input
              id="legs"
              type="number"
              value={formData.legs || ""}
              onChange={(e) => updateFormData({ legs: parseFloat(e.target.value) })}
              placeholder="55"
              min="30"
              max="120"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="motivation">Motivación personal o frase meta</Label>
          <Textarea
            id="motivation"
            value={formData.motivation || ""}
            onChange={(e) => updateFormData({ motivation: e.target.value })}
            placeholder="¿Qué te motiva a alcanzar tus metas?"
            rows={4}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">
            {formData.motivation?.length || 0}/200 caracteres
          </p>
        </div>

        <div className="bg-primary/10 p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium">💡 Consejo</p>
          <p className="text-sm text-muted-foreground">
            Estas medidas son opcionales pero te ayudarán a visualizar mejor tu progreso. 
            Puedes actualizarlas más tarde en tu perfil.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep6;
