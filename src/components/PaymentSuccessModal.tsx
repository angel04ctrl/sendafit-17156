import { Dialog, DialogContent } from "./ui/dialog";
import { Button } from "./ui/button";
import { CheckCircle2, Sparkles, MessageSquare, BarChart3, Dumbbell, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PaymentSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PaymentSuccessModal = ({ open, onOpenChange }: PaymentSuccessModalProps) => {
  const navigate = useNavigate();

  const handleContinue = () => {
    onOpenChange(false);
    // Limpiar parámetros de URL y recargar página para refrescar el estado PRO
    // Esto asegura que todos los componentes vean el nuevo estado
    window.location.href = "/profile";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="relative">
            <div className="absolute inset-0 animate-ping">
              <CheckCircle2 className="w-16 h-16 text-green-500 opacity-75" />
            </div>
            <CheckCircle2 className="w-16 h-16 text-green-500 relative" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              ¡Pago Exitoso!
            </h2>
            <p className="text-muted-foreground">
              Tu suscripción al Plan PRO ha sido activada
            </p>
          </div>

          <div className="w-full bg-gradient-card rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg mb-4">Beneficios Desbloqueados</h3>
            
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Chat con Entrenador IA 24/7</p>
                  <p className="text-sm text-muted-foreground">Asesoría personalizada en tiempo real</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Análisis Avanzado con IA</p>
                  <p className="text-sm text-muted-foreground">Estadísticas detalladas de tu progreso</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Dumbbell className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Planes Personalizados Avanzados</p>
                  <p className="text-sm text-muted-foreground">Rutinas adaptadas a tus objetivos</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Seguimiento Premium</p>
                  <p className="text-sm text-muted-foreground">Métricas avanzadas y reportes semanales</p>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleContinue} className="w-full" size="lg">
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
