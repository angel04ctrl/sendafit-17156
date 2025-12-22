/**
 * OnboardingStep4.tsx - Paso 4 del onboarding: Seguimiento Menstrual
 * 
 * Este componente configura el seguimiento menstrual para usuarias.
 * Solo se muestra para usuarios con género femenino.
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UpgradeModal } from "@/components/UpgradeModal";
import { Badge } from "@/components/ui/badge";
import { DEV_MODE_PRO_ENABLED } from "@/lib/devConfig";
import { Sparkles, Lock } from "lucide-react";

interface OnboardingStep4Props {
  formData: any;
  updateFormData: (data: any) => void;
}

const OnboardingStep4 = ({ formData, updateFormData }: OnboardingStep4Props) => {
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Solo mostrar esta pantalla si el género es femenino
  if (formData.gender !== "femenino") {
    return (
      <div className="space-y-6 animate-fade-in flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Esta sección solo aplica para usuarios femeninos.
          </p>
          <p className="text-sm text-muted-foreground">
            Puedes continuar al siguiente paso.
          </p>
        </div>
      </div>
    );
  }

  const handleMenstrualTrackingChange = (checked: boolean) => {
    if (DEV_MODE_PRO_ENABLED) {
      // En modo desarrollo, permitir cambiar el valor
      updateFormData({ menstrualTracking: checked });
    } else {
      // En producción, mostrar modal de upgrade
      setUpgradeModalOpen(true);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Seguimiento Menstrual</h2>
        <p className="text-muted-foreground">Optimiza tu entrenamiento según tu ciclo</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="menstrualTracking" className="text-base">
                ¿Deseas conectar tu seguimiento menstrual?
              </Label>
              <Badge variant={DEV_MODE_PRO_ENABLED ? "secondary" : "default"} className="text-xs gap-1">
                {DEV_MODE_PRO_ENABLED ? (
                  <><Sparkles className="w-3 h-3" /> DEV</>
                ) : (
                  <><Lock className="w-3 h-3" /> PRO</>
                )}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              La IA ajustará tu entrenamiento según tu ciclo
            </p>
          </div>
          <Switch
            id="menstrualTracking"
            checked={formData.menstrualTracking || false}
            onCheckedChange={handleMenstrualTrackingChange}
          />
        </div>
      </div>

      {!DEV_MODE_PRO_ENABLED && (
        <UpgradeModal
          open={upgradeModalOpen}
          onOpenChange={setUpgradeModalOpen}
          featureTitle="Seguimiento Menstrual"
          featureDescription="Optimiza tu entrenamiento según tu ciclo menstrual con ajustes automáticos de la IA"
          features={[
            "Sincronización automática con apps de seguimiento menstrual",
            "Ajuste del volumen de entrenamiento según fase del ciclo",
            "Recomendaciones de nutrición personalizadas por fase",
            "Predicciones de energía y rendimiento",
            "Alertas inteligentes para días de menor rendimiento"
          ]}
        />
      )}
    </div>
  );
};

export default OnboardingStep4;
