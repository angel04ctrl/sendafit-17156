import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Sparkles, Check } from "lucide-react";
import { Badge } from "./ui/badge";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureTitle: string;
  featureDescription: string;
  features: string[];
}

export const UpgradeModal = ({
  open,
  onOpenChange,
  featureTitle,
  featureDescription,
  features,
}: UpgradeModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default" className="gap-1">
              <Sparkles className="w-3 h-3" />
              PRO
            </Badge>
            <DialogTitle className="text-xl">{featureTitle}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {featureDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div key={`feature-${index}-${feature.slice(0, 10)}`} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">{feature}</p>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="bg-gradient-card p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Plan PRO</span>
                <span className="text-2xl font-bold">$4.99<span className="text-sm text-muted-foreground">/mes</span></span>
              </div>
              <p className="text-sm text-muted-foreground">
                Desbloquea todas las funcionalidades premium y lleva tu entrenamiento al siguiente nivel
              </p>
            </div>

            <Button className="w-full" size="lg">
              <Sparkles className="w-4 h-4 mr-2" />
              Actualizar a PRO
            </Button>
            
            <p className="text-xs text-center text-muted-foreground mt-3">
              Próximamente disponible
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
