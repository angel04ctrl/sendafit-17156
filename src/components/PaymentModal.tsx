import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CreditCard, Wallet, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const cardPaymentSchema = z.object({
  cardName: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(100, "Nombre demasiado largo"),
  cardNumber: z.string()
    .regex(/^\d{16}$/, "El número de tarjeta debe tener 16 dígitos")
    .refine((val) => val.length === 16, "Ingrese 16 dígitos"),
  expiryMonth: z.string()
    .regex(/^(0[1-9]|1[0-2])$/, "Ingrese mes válido (01-12)")
    .length(2, "Ingrese 2 dígitos"),
  expiryYear: z.string()
    .regex(/^\d{4}$/, "Ingrese año válido (4 dígitos)")
    .refine((val) => parseInt(val) >= new Date().getFullYear(), "Año debe ser actual o futuro"),
  cvv: z.string()
    .regex(/^\d{3,4}$/, "CVV debe tener 3 o 4 dígitos")
    .min(3, "CVV debe tener al menos 3 dígitos")
    .max(4, "CVV debe tener máximo 4 dígitos"),
  country: z.string().optional(),
});

const paypalPaymentSchema = z.object({
  paypalEmail: z.string()
    .email("Ingrese un email válido")
    .min(1, "El email es obligatorio"),
});

type CardPaymentForm = z.infer<typeof cardPaymentSchema>;
type PaypalPaymentForm = z.infer<typeof paypalPaymentSchema>;

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
  const annualPrice = 1058; // $1176 with 10% discount
  const annualPriceBeforeDiscount = 1176;
  const discount = annualPriceBeforeDiscount - annualPrice;

  const currentPrice = billingPeriod === "mensual" ? monthlyPrice : annualPrice;

  const cardForm = useForm<CardPaymentForm>({
    resolver: zodResolver(cardPaymentSchema),
    defaultValues: {
      cardName: "",
      cardNumber: "",
      expiryMonth: "",
      expiryYear: "",
      cvv: "",
      country: "",
    },
  });

  const paypalForm = useForm<PaypalPaymentForm>({
    resolver: zodResolver(paypalPaymentSchema),
    defaultValues: {
      paypalEmail: "",
    },
  });

  const handleCardSubmit = async (data: CardPaymentForm) => {
    if (!user) {
      toast.error("Debes iniciar sesión para continuar");
      return;
    }

    setIsProcessing(true);
    try {
      toast.info("Redirigiendo a la pasarela de pago...");
      
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
        // Redirect to Stripe checkout
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

  const handlePaypalSubmit = (data: PaypalPaymentForm) => {
    if (!user) {
      toast.error("Debes iniciar sesión para continuar");
      return;
    }
    // PayPal is handled by the PayPal button integration
    console.log("PayPal email:", data.paypalEmail);
  };

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

    // Clear previous buttons
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
            <Form {...cardForm}>
              <form onSubmit={cardForm.handleSubmit(handleCardSubmit)} className="space-y-4">
                <FormField
                  control={cardForm.control}
                  name="cardName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del titular *</FormLabel>
                      <FormControl>
                        <Input placeholder="Como aparece en la tarjeta" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cardForm.control}
                  name="cardNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de tarjeta *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="1234 5678 9012 3456" 
                          maxLength={16}
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={cardForm.control}
                    name="expiryMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mes *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="11" 
                            maxLength={2}
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={cardForm.control}
                    name="expiryYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Año *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="2030" 
                            maxLength={4}
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={cardForm.control}
                    name="cvv"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CVV *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="123" 
                            maxLength={4}
                            type="password"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={cardForm.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>País (opcional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="México" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg" disabled={isProcessing}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  {isProcessing ? "Procesando..." : `Pagar $${currentPrice} MXN`}
                </Button>
              </form>
            </Form>
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
