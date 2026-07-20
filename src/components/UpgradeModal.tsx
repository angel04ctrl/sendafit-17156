import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { PaymentModal } from "./PaymentModal";

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
  const [paymentOpen, setPaymentOpen] = useState(false);

  const openPayment = () => {
    onOpenChange(false);
    setPaymentOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="default" className="gap-1">
                <Sparkles className="h-3 w-3" />
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
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">{feature}</p>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="mb-4 rounded-lg bg-gradient-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">Plan PRO</span>
                  <span className="text-2xl font-bold">
                    $98<span className="text-sm text-muted-foreground"> MXN/mes</span>
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Desbloquea todas las funcionalidades premium y lleva tu entrenamiento al siguiente nivel.
                </p>
              </div>

              <Button className="w-full" size="lg" onClick={openPayment}>
                <Sparkles className="mr-2 h-4 w-4" />
                Actualizar a PRO
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentModal open={paymentOpen} onOpenChange={setPaymentOpen} />
    </>
  );
};
