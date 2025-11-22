import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "./ui/button";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface StripePaymentFormProps {
  billingPeriod: "mensual" | "anual";
  currentPrice: number;
  customerId: string;
  userId: string;
  onSuccess: () => void;
}

export const StripePaymentForm = ({
  billingPeriod,
  currentPrice,
  customerId,
  userId,
  onSuccess,
}: StripePaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Confirm the SetupIntent
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });

      if (confirmError) {
        throw confirmError;
      }

      if (!setupIntent?.payment_method) {
        throw new Error("No se pudo obtener el método de pago");
      }

      // Create subscription with the payment method
      const { data, error } = await supabase.functions.invoke(
        "payments/create-subscription",
        {
          body: {
            plan: billingPeriod,
            userId,
            paymentMethodId: setupIntent.payment_method,
            customerId,
          },
        }
      );

      if (error) throw error;

      if (data?.success) {
        onSuccess();
      } else {
        throw new Error("Error al crear la suscripción");
      }
    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast.error(error.message || "Error al procesar el pago. Intenta de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      
      <Button type="submit" className="w-full" size="lg" disabled={isProcessing || !stripe || !elements}>
        <CreditCard className="w-4 h-4 mr-2" />
        {isProcessing ? "Procesando..." : `Pagar $${currentPrice} MXN`}
      </Button>
    </form>
  );
};
