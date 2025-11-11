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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { useState } from "react";

const cardPaymentSchema = z.object({
  cardName: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(100, "Nombre demasiado largo"),
  cardNumber: z.string()
    .regex(/^\d{16}$/, "El número de tarjeta debe tener 16 dígitos")
    .refine((val) => val.length === 16, "Ingrese 16 dígitos"),
  expiryMonth: z.string().min(1, "Seleccione el mes"),
  expiryYear: z.string().min(1, "Seleccione el año"),
  cvv: z.string()
    .regex(/^\d{3,4}$/, "CVV debe tener 3 o 4 dígitos")
    .min(3, "CVV debe tener al menos 3 dígitos")
    .max(4, "CVV debe tener máximo 4 dígitos"),
  country: z.string().min(1, "Seleccione su país"),
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
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  const monthlyPrice = 10;
  const annualPrice = 108; // $120 con 10% descuento
  const annualPriceBeforeDiscount = 120;
  const discount = annualPriceBeforeDiscount - annualPrice;

  const currentPrice = billingPeriod === "monthly" ? monthlyPrice : annualPrice;

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

  const handleCardSubmit = (data: CardPaymentForm) => {
    console.log("Card payment data:", data, "Billing period:", billingPeriod, "Price:", currentPrice);
    // TODO: Integrar con backend de pagos
  };

  const handlePaypalSubmit = (data: PaypalPaymentForm) => {
    console.log("PayPal payment data:", data, "Billing period:", billingPeriod, "Price:", currentPrice);
    // TODO: Integrar con backend de pagos
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear + i);
  const months = [
    { value: "01", label: "01 - Enero" },
    { value: "02", label: "02 - Febrero" },
    { value: "03", label: "03 - Marzo" },
    { value: "04", label: "04 - Abril" },
    { value: "05", label: "05 - Mayo" },
    { value: "06", label: "06 - Junio" },
    { value: "07", label: "07 - Julio" },
    { value: "08", label: "08 - Agosto" },
    { value: "09", label: "09 - Septiembre" },
    { value: "10", label: "10 - Octubre" },
    { value: "11", label: "11 - Noviembre" },
    { value: "12", label: "12 - Diciembre" },
  ];

  const countries = [
    "México", "España", "Argentina", "Colombia", "Chile", "Perú", "Venezuela", 
    "Ecuador", "Guatemala", "Cuba", "Bolivia", "República Dominicana", "Honduras",
    "Paraguay", "El Salvador", "Nicaragua", "Costa Rica", "Puerto Rico", "Panamá", "Uruguay"
  ];

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
                {billingPeriod === "annual" && (
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
            <RadioGroup value={billingPeriod} onValueChange={(value) => setBillingPeriod(value as "monthly" | "annual")}>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                  <div className="font-medium">Mensual</div>
                  <div className="text-xs text-muted-foreground">$10 MXN/mes</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="annual" id="annual" />
                <Label htmlFor="annual" className="flex-1 cursor-pointer">
                  <div className="font-medium">Anual</div>
                  <div className="text-xs text-muted-foreground">
                    $108 MXN/año <span className="text-green-600 dark:text-green-400 font-medium">(Ahorra 10%)</span>
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {months.map((month) => (
                              <SelectItem key={month.value} value={month.value}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Año" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {years.map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      <FormLabel>País *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione su país" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countries.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pagar ${currentPrice} MXN
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="paypal" className="space-y-4 mt-4">
            <Form {...paypalForm}>
              <form onSubmit={paypalForm.handleSubmit(handlePaypalSubmit)} className="space-y-4">
                <FormField
                  control={paypalForm.control}
                  name="paypalEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email de PayPal *</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="tu-email@example.com" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                  <p>Serás redirigido a PayPal para completar tu pago de forma segura.</p>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  <Wallet className="w-4 h-4 mr-2" />
                  Pagar ${currentPrice} MXN con PayPal
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-center text-muted-foreground mt-4">
          🔒 Pago seguro • Cancela cuando quieras • Sin compromisos
        </p>
      </DialogContent>
    </Dialog>
  );
};
