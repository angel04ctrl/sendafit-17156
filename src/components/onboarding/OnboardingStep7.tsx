/**
 * OnboardingStep7.tsx - Paso 7 del onboarding: Preferencias de App
 * 
 * Este componente final configura preferencias de la aplicación.
 * Se encarga de:
 * - Seleccionar tema de interfaz (claro, oscuro, automático)
 * - Activar/desactivar notificaciones push
 * - Mostrar opción de sincronización con wearables (función PRO)
 * - Solicitar aceptación de términos y condiciones (obligatorio)
 * - Validar aceptación de términos antes de permitir finalizar
 * - Mostrar mensaje informativo sobre creación de plan personalizado
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { UpgradeModal } from "@/components/UpgradeModal";

interface OnboardingStep7Props {
  formData: any;
  updateFormData: (data: any) => void;
}

const OnboardingStep7 = ({ formData, updateFormData }: OnboardingStep7Props) => {
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Preferencias de App</h2>
        <p className="text-muted-foreground">Personaliza tu experiencia</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="theme">Tema de interfaz</Label>
          <Select
            value={formData.theme || "auto"}
            onValueChange={(value) => updateFormData({ theme: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el tema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="dark">Oscuro</SelectItem>
              <SelectItem value="auto">Automático</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="notifications" className="text-base">
              Activar notificaciones
            </Label>
            <p className="text-sm text-muted-foreground">
              Recordatorios y progreso
            </p>
          </div>
          <Switch
            id="notifications"
            checked={formData.notifications ?? true}
            onCheckedChange={(checked) => updateFormData({ notifications: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="wearables" className="text-base">
              Sincronizar con wearables
            </Label>
            <p className="text-sm text-muted-foreground">
              Google Fit, Apple Health, Fitbit
            </p>
          </div>
          <Switch
            id="wearables"
            checked={false}
            onCheckedChange={() => setUpgradeModalOpen(true)}
          />
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={formData.termsAccepted || false}
              onCheckedChange={(checked) => updateFormData({ termsAccepted: checked })}
              required
            />
            <Label htmlFor="terms" className="cursor-pointer font-normal text-sm leading-relaxed">
              Acepto los{" "}
              <a href="/terms" className="text-primary underline">
                términos y condiciones
              </a>{" "}
              y la{" "}
              <a href="/privacy" className="text-primary underline">
                política de privacidad
              </a>
            </Label>
          </div>

          {!formData.termsAccepted && (
            <p className="text-sm text-destructive">
              * Debes aceptar los términos para continuar
            </p>
          )}
        </div>

        <div className="bg-gradient-primary/10 p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium">🎉 ¡Estás a un paso!</p>
          <p className="text-sm text-muted-foreground">
            Una vez completado el registro, la IA SendaFit creará tu plan 
            personalizado de entrenamiento y nutrición.
          </p>
        </div>
      </div>

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        featureTitle="Sincronización con Wearables"
        featureDescription="Conecta tus dispositivos y obtén seguimiento automático de tu actividad física"
        features={[
          "Sincronización con Apple Health, Google Fit y Fitbit",
          "Importación automática de pasos, calorías y ritmo cardíaco",
          "Ajuste dinámico de objetivos según tu actividad diaria",
          "Detección automática de entrenamientos realizados",
          "Análisis de patrones de sueño y recuperación"
        ]}
      />
    </div>
  );
};

export default OnboardingStep7;
