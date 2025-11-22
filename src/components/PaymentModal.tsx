import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CreditCard, Wallet, Sparkles } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { StripePaymentForm } from "./StripePaymentForm";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PaymentModal = ({ open, onOpenChange }: PaymentModalProps) => {
  const [billingPeriod, setBillingPeriod] = useState<"mensual" | "anual">("mensual");
  const [clientSecret, setClientSecret] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();

  const monthlyPrice = 98;
  const annualPrice = 1058;
  const annualPriceBeforeDiscount = 1176;
  const discount = annualPriceBeforeDiscount - annualPrice;

  const currentPrice = billingPeriod === "mensual" ? monthlyPrice : annualPrice;

  // Create SetupIntent when modal opens or billing period changes
  useEffect(() => {
    if (!open || !user) return;

    const createSetupIntent = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "payments/create-setup-intent",
          {
            body: {
              plan: billingPeriod,
              userId: user.id,
            },
          }
        );

        if (error) throw error;

        setClientSecret(data.clientSecret);
        setCustomerId(data.customerId);
      } catch (error: any) {
        console.error("Error creating setup intent:", error);
        toast.error("Error al inicializar el pago");
      } finally {
        setIsLoading(false);
      }
    };

    createSetupIntent();
  }, [open, user, billingPeriod]);

  // Load PayPal SDK
  useEffect(() => {
    if (!open) return;

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || ""}&vault=true&intent=subscription&currency=MXN`;
    script.async = true;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [open]);

  // Initialize PayPal buttons
  useEffect(() => {
    if (!paypalLoaded || !open || !user) return;

    const container = document.getElementById("paypal-button-container");
    if (!container) return;

    container.innerHTML = "";

    const planId = billingPeriod === "mensual" 
      ? import.meta.env.VITE_PAYPAL_PLAN_ID_MONTHLY 
      : import.meta.env.VITE_PAYPAL_PLAN_ID_ANNUAL;

    if (!planId) {
      console.error("PayPal plan ID not configured");
      return;
    }

    (window as any).paypal
      .Buttons({
        style: {
          shape: "rect",
          color: "gold",
          layout: "vertical",
          label: "subscribe",
        },
        createSubscription: function (data: any, actions: any) {
          return actions.subscription.create({
            plan_id: planId,
          });
        },
        onApprove: async function (data: any) {
          setIsProcessing(true);
          try {
            const { error } = await supabase.functions.invoke(
              "payments/paypal-confirm",
              {
                body: {
                  subscriptionId: data.subscriptionID,
                  userId: user.id,
                  plan: billingPeriod,
                },
              }
            );

            if (error) throw error;

            toast.success("¡Suscripción activada exitosamente!");
            onOpenChange(false);
            window.location.reload();
          } catch (error) {
            console.error("Error confirming PayPal subscription:", error);
            toast.error("Error al confirmar la suscripción");
          } finally {
            setIsProcessing(false);
          }
        },
        onError: function (err: any) {
          console.error("PayPal error:", err);
          toast.error("Error al procesar el pago con PayPal");
        },
      })
      .render("#paypal-button-container");
  }, [paypalLoaded, billingPeriod, open, user, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle className="text-xl">Actualizar a Plan PRO</DialogTitle>
          </div>
          <DialogDescription>
            Desbloquea todas las funcionalidades premium
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mb-4">
          <div className="bg-gradient-card p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">Plan PRO</span>
              <div className="text-right">
                <span className="text-2xl font-bold">
                  ${currentPrice} <span className="text-sm text-muted-foreground">MXN</span>
                </span>
                {billingPeriod === "anual" && (
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Ahorra ${discount} MXN
                  </div>
                )}
              </div>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Análisis avanzado con IA</li>
              <li>✓ Chat con entrenador virtual 24/7</li>
              <li>✓ Planes personalizados avanzados</li>
              <li>✓ Estadísticas detalladas</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Periodo de facturación</Label>
            <RadioGroup value={billingPeriod} onValueChange={(value) => setBillingPeriod(value as "mensual" | "anual")}>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="mensual" id="mensual" />
                <Label htmlFor="mensual" className="flex-1 cursor-pointer">
                  <div className="font-medium">Mensual</div>
                  <div className="text-xs text-muted-foreground">$98 MXN/mes</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="anual" id="anual" />
                <Label htmlFor="anual" className="flex-1 cursor-pointer">
                  <div className="font-medium">Anual</div>
                  <div className="text-xs text-muted-foreground">
                    $1,058 MXN/año <span className="text-green-600 dark:text-green-400 font-medium">(Ahorra 10%)</span>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <Tabs defaultValue="card" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="card" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Tarjeta
            </TabsTrigger>
            <TabsTrigger value="paypal" className="gap-2">
              <Wallet className="w-4 h-4" />
              PayPal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="card" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Cargando formulario de pago...</p>
              </div>
            ) : clientSecret && user ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "hsl(var(--primary))",
                      colorBackground: "hsl(var(--background))",
                      colorText: "hsl(var(--foreground))",
                      colorDanger: "hsl(var(--destructive))",
                      fontFamily: "system-ui, sans-serif",
                      borderRadius: "0.5rem",
                    },
                  },
                  locale: "es",
                }}
              >
                <StripePaymentForm
                  billingPeriod={billingPeriod}
                  currentPrice={currentPrice}
                  customerId={customerId}
                  userId={user.id}
                  onSuccess={() => {
                    toast.success("¡Suscripción activada exitosamente!");
                    onOpenChange(false);
                    window.location.reload();
                  }}
                />
              </Elements>
            ) : null}
          </TabsContent>

          <TabsContent value="paypal" className="space-y-4 mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Haz clic en el botón de PayPal para continuar con tu suscripción de ${currentPrice} MXN
              </p>
              
              <div id="paypal-button-container" className="w-full min-h-[150px]">
                {!paypalLoaded && (
                  <div className="flex items-center justify-center h-[150px]">
                    <p className="text-sm text-muted-foreground">Cargando PayPal...</p>
                  </div>
                )}
              </div>

              {isProcessing && (
                <p className="text-sm text-center text-muted-foreground">
                  Procesando tu suscripción...
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-center text-muted-foreground mt-4">
          🔒 Pago seguro • Cancela cuando quieras • Sin compromisos
        </p>
      </DialogContent>
    </Dialog>
  );
};
