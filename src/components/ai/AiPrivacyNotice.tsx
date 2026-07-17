import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface AiPrivacyNoticeProps {
  type: "food" | "machine" | "coach";
  accepted?: boolean;
  onAcceptedChange?: (accepted: boolean) => void;
  requireCheckbox?: boolean;
}

const copy = {
  food: {
    title: "Aviso de privacidad y nutricion",
    body: "La foto se enviara a un proveedor de IA para estimar alimentos y macros. Las calorias son aproximadas y no sustituyen a un nutriologo.",
    consent: "Acepto enviar esta imagen para analisis IA y revisar la estimacion antes de guardarla.",
  },
  machine: {
    title: "Aviso de seguridad y analisis IA",
    body: "La foto se enviara a un proveedor de IA para identificar la maquina. El resultado puede equivocarse; verifica el equipo y detente si hay dolor.",
    consent: "Acepto enviar esta imagen para analisis IA y verificar la maquina antes de usarla.",
  },
  coach: {
    title: "Coach IA seguro",
    body: "Tus mensajes pueden usar datos de entrenamiento, nutricion y salud de tu perfil para responder. No sustituye a medico, nutriologo ni fisioterapeuta.",
    consent: "Entiendo que el coach IA es orientativo y no reemplaza atencion profesional.",
  },
};

export function AiPrivacyNotice({
  type,
  accepted = false,
  onAcceptedChange,
  requireCheckbox = false,
}: AiPrivacyNoticeProps) {
  const content = copy[type];

  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{content.title}</AlertTitle>
      <AlertDescription>
        <p>{content.body}</p>
        {requireCheckbox && (
          <div className="mt-3 flex items-start gap-2">
            <Checkbox
              id={`ai-consent-${type}`}
              checked={accepted}
              onCheckedChange={(value) => onAcceptedChange?.(value === true)}
              className="mt-0.5"
            />
            <Label htmlFor={`ai-consent-${type}`} className="text-xs leading-relaxed">
              {content.consent}
            </Label>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
