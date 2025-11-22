/**
 * PAYMENT MODAL COMPONENT
 * 
 * Modal para que los usuarios actualicen su cuenta a Plan PRO.
 * Soporta dos métodos de pago:
 * 1. Stripe (Tarjeta de crédito/débito) - Redirige a Stripe Checkout
 * 2. PayPal - SDK embebido con botones de suscripción
 * 
 * FLUJO STRIPE:
 * 1. Usuario selecciona plan (mensual/anual) y hace clic en "Pagar con Tarjeta"
 * 2. Se llama a la edge function "payments/create-checkout-session"
 * 3. Se recibe una URL y se redirige al usuario a Stripe Checkout
 * 4. Stripe maneja todo el flujo de pago (NO se usa Stripe Elements)
 * 5. Después del pago, Stripe redirige de vuelta a /profile?payment=success
 * 
 * FLUJO PAYPAL:
 * 1. Usuario selecciona plan y hace clic en botón PayPal
 * 2. Se abre popup de PayPal para aprobar suscripción
 * 3. Al aprobar, se llama a "payments/paypal-confirm" para activar
 * 4. Se recarga la página para mostrar el nuevo estado PRO
 * 
 * NOTA TÉCNICA:
 * No se usa Stripe Elements (formulario de pago embebido) porque causaba
 * conflictos de versiones de React. Stripe Checkout es igualmente seguro
 * y no requiere manejar datos de tarjeta en el cliente.
 */

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

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PaymentModal = ({ open, onOpenChange }: PaymentModalProps) => {
  const [billingPeriod, setBillingPeriod] = useState<"mensual" | "anual">("mensual");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const { user } = useAuth();

  const monthlyPrice = 98;
  const annualPrice = 1058;
  const annualPriceBeforeDiscount = 1176;
  const discount = annualPriceBeforeDiscount - annualPrice;

  const currentPrice = billingPeriod === "mensual" ? monthlyPrice : annualPrice;

  /**
   * Inicia el proceso de pago con Stripe Checkout
   * 
   * 1. Llama a la edge function para crear una sesión de checkout
   * 2. Recibe una URL de Stripe
   * 3. Redirige al usuario a esa URL (página de pago de Stripe)
   * 4. El usuario completa el pago en Stripe
   * 5. Stripe envía webhook a nuestro backend
   * 6. El usuario es redirigido de vuelta a /profile?payment=success
   */
  const handleStripePayment = async () => {
    if (!user) {
      toast.error("Debes iniciar sesión para continuar");
      return;
    }

    setIsProcessing(true);
    try {
      toast.info("Redirigiendo a la pasarela de pago segura...");
      
      const { data: functionData, error } = await supabase.functions.invoke(
        "payments/create-checkout-session",
        {
          body: {
            plan: billingPeriod,
            userId: user.id,
          },
        }
      );

      if (error) {
        console.error("Error from function:", error);
        throw error;
      }

      if (functionData?.url) {
        // Redirigir al usuario a la página de pago segura de Stripe
        // Stripe manejará la recopilación de datos de tarjeta de forma segura
        window.location.href = functionData.url;
      } else {
        throw new Error("No URL returned from payment service");
      }
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      toast.error(error.message || "Error al procesar el pago. Intenta de nuevo.");
      setIsProcessing(false);
    }
  };

  /**
   * Carga el SDK de PayPal dinámicamente cuando se abre el modal
   * Se configura con el client-id desde variables de entorno
   */
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

  /**
   * Inicializa los botones de PayPal después de que el SDK se carga
   * Configura el flujo de suscripción con el plan_id correspondiente
   */
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
            Desbloquea todas las funcionalidades premium con pago 100% seguro
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
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="mb-2">✓ Formulario de pago seguro de Stripe</p>
                <p className="mb-2">✓ Encriptación de extremo a extremo</p>
                <p>✓ Sin guardar datos de tarjeta en nuestros servidores</p>
              </div>
              
              <Button 
                onClick={handleStripePayment} 
                className="w-full" 
                size="lg" 
                disabled={isProcessing}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {isProcessing ? "Procesando..." : `Pagar $${currentPrice} MXN con Tarjeta`}
              </Button>
            </div>
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
          🔒 Pago 100% seguro con Stripe • Cancela cuando quieras • Sin compromisos
        </p>
      </DialogContent>
    </Dialog>
  );
};
