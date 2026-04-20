/**
 * PAYMENTS EDGE FUNCTION
 * 
 * Gestiona todo el flujo de pagos y suscripciones PRO de SendaFit
 * Soporta dos proveedores: Stripe y PayPal
 * 
 * MÉTODO DE PAGO:
 * - Stripe Checkout: Redirige al usuario a la página de pago segura de Stripe (hosted checkout)
 * - NO se usa Stripe Elements (formulario embebido) para evitar conflictos de dependencias React
 * 
 * ENDPOINTS:
 * 1. POST /payments/create-checkout-session - Crea sesión de pago Stripe y retorna URL
 * 2. POST /payments/stripe-webhook - Recibe eventos de Stripe (pagos completados, cancelaciones)
 * 3. POST /payments/paypal-confirm - Confirma suscripción PayPal después de aprobación
 * 4. POST /payments/paypal-webhook - Recibe eventos de PayPal (activaciones, cancelaciones)
 * 
 * FLUJO STRIPE:
 * 1. Cliente solicita crear sesión → retorna URL de Stripe Checkout
 * 2. Usuario completa pago en Stripe → webhook checkout.session.completed
 * 3. Se crea registro en user_subscriptions y se actualiza role a 'pro'
 * 
 * SEGURIDAD:
 * - Los webhooks de Stripe verifican firma para autenticidad
 * - No se almacenan datos de tarjeta (manejados por Stripe)
 * - CORS habilitado para permitir llamadas desde el cliente
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Headers CORS para permitir peticiones desde el cliente web
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { pathname } = new URL(req.url);

  try {
    /**
     * ENDPOINT: Create Stripe Checkout Session
     * POST /payments/create-checkout-session
     * 
     * Crea una sesión de Stripe Checkout y retorna la URL para redirigir al usuario.
     * El usuario completa el pago en la página de Stripe (no en nuestra app).
     * 
     * Body: { plan: "mensual" | "anual", userId: string }
     * Returns: { url: string } - URL de la página de pago de Stripe
     */
    if (pathname === "/payments/create-checkout-session" && req.method === "POST") {
      const { plan, userId } = await req.json();

      console.log("Creating Stripe checkout session for user:", userId, "plan:", plan);
      
      // Obtener el origen de la petición para construir las URLs de redirección
      // Necesario porque el usuario regresará a nuestra app después del pago
      const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');
      
      if (!origin) {
        console.error("No origin or referer header found in request");
        return new Response(
          JSON.stringify({ error: "No se pudo determinar la URL de origen" }),
          { 
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("Using origin for redirect URLs:", origin);

      // Definir precios según el plan seleccionado (en centavos MXN para Stripe)
      // Mensual: $98 MXN = 9800 centavos | Anual: $1058 MXN = 105800 centavos (10% descuento)
      const amount = plan === "anual" ? 105800 : 9800;
      
      const successUrl = `${origin}/profile?payment=success`;
      const cancelUrl = `${origin}/profile?payment=canceled`;
      
      console.log("Success URL:", successUrl);
      console.log("Cancel URL:", cancelUrl);
      
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "mxn",
              product_data: {
                name: plan === "anual" ? "SendaFit Pro - Plan Anual" : "SendaFit Pro - Plan Mensual",
                description: plan === "anual" 
                  ? "Suscripción anual con 10% de descuento" 
                  : "Suscripción mensual",
              },
              recurring: {
                interval: plan === "anual" ? "year" : "month",
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId, plan },
      });

      console.log("Stripe session created:", session.id);
      console.log("Redirect URL:", session.url);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * ENDPOINT: Stripe Webhooks
     * POST /payments/stripe-webhook
     * 
     * Recibe eventos de Stripe para mantener sincronizado el estado de suscripciones.
     * Eventos manejados:
     * - checkout.session.completed: Pago inicial exitoso → crea suscripción y actualiza role
     * - invoice.payment_succeeded: Renovación exitosa → actualiza status a active
     * - customer.subscription.deleted: Cancelación → actualiza status a canceled
     * 
     * IMPORTANTE: Verifica la firma del webhook con STRIPE_WEBHOOK_SECRET
     */
    if (pathname === "/payments/stripe-webhook" && req.method === "POST") {
      const sig = req.headers.get("stripe-signature");
      const body = await req.text();

      console.log("=== WEBHOOK RECEIVED ===");

      if (!sig) {
        console.error("ERROR: No stripe-signature header");
        return new Response("No signature", { status: 400 });
      }

      try {
        const event = stripe.webhooks.constructEvent(
          body,
          sig,
          Deno.env.get("STRIPE_WEBHOOK_SECRET")!
        );

        console.log("Webhook event type:", event.type);
        console.log("Webhook event ID:", event.id);

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as unknown;
          const { userId, plan } = session.metadata;

          console.log("=== CHECKOUT COMPLETED ===");
          console.log("User ID:", userId);
          console.log("Plan:", plan);
          console.log("Customer ID:", session.customer);
          console.log("Subscription ID:", session.subscription);
          console.log("Payment status:", session.payment_status);

          // Extraer información de Stripe para almacenar en nuestra base de datos
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          // Crear o actualizar el registro de suscripción en user_subscriptions
          // upsert asegura que no haya duplicados (usa user_id como clave única)
          const { data: subData, error: subError } = await supabase
            .from("user_subscriptions")
            .upsert({
              user_id: userId,
              plan,
              provider: "stripe",
              status: "active",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              last_event: "checkout.session.completed",
              start_date: new Date().toISOString(),
              end_date: plan === "anual" 
                ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }, {
              onConflict: 'user_id',
            });

          if (subError) {
            console.error("ERROR inserting subscription:", subError);
            throw subError;
          }

          console.log("✅ Subscription created/updated");

          // Actualizar el rol del usuario a 'pro' para habilitar funcionalidades premium
          // Se guarda en user_roles para verificación mediante has_role() en RLS policies
          const { data: roleData, error: roleError } = await supabase
            .from("user_roles")
            .upsert({
              user_id: userId,
              role: "pro",
            }, {
              onConflict: 'user_id,role',
            });

          if (roleError) {
            console.error("ERROR updating user role:", roleError);
          } else {
            console.log("✅ User role updated to PRO");
          }

          console.log("=== CHECKOUT PROCESSING COMPLETE ===");
        }

        // Webhook: Pago de renovación exitoso (mensual o anual)
        if (event.type === "invoice.payment_succeeded") {
          const invoice = event.data.object as unknown;
          const subscriptionId = invoice.subscription;

          console.log("Payment succeeded for subscription:", subscriptionId);

          // Actualizar el estado de la suscripción para confirmar que sigue activa
          const { error } = await supabase
            .from("user_subscriptions")
            .update({ 
              status: "active",
              last_event: "invoice.payment_succeeded" 
            })
            .eq("stripe_subscription_id", subscriptionId);

          if (error) {
            console.error("Error updating subscription:", error);
          }
        }

        // Webhook: Suscripción cancelada (por el usuario o por fallo de pago)
        if (event.type === "customer.subscription.deleted") {
          const subscription = event.data.object as unknown;

          console.log("Subscription deleted:", subscription.id);

          // Marcar la suscripción como cancelada y establecer end_date a ahora
          const { error } = await supabase
            .from("user_subscriptions")
            .update({ 
              status: "canceled",
              last_event: "customer.subscription.deleted",
              end_date: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id);

          if (error) {
            console.error("Error canceling subscription:", error);
          }
        }

        return new Response("ok", { 
          status: 200,
          headers: corsHeaders,
        });
      } catch (err) {
        console.error("Error processing webhook:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        return new Response(`Webhook Error: ${errorMessage}`, { 
          status: 400,
          headers: corsHeaders,
        });
      }
    }

    /**
     * ENDPOINT: PayPal Confirmation
     * POST /payments/paypal-confirm
     * 
     * Confirma y activa una suscripción PayPal después de que el usuario la aprueba.
     * Verifica el estado con la API de PayPal antes de activar en nuestra DB.
     * 
     * Body: { subscriptionId: string, userId: string, plan: string }
     * Returns: { success: boolean }
     */
    if (pathname === "/payments/paypal-confirm" && req.method === "POST") {
      const { subscriptionId, userId, plan } = await req.json();

      console.log("Processing PayPal confirmation for user:", userId);

      // Verificar el estado de la suscripción directamente con PayPal API
      // para asegurar que realmente fue aprobada antes de activar en nuestra DB
      const paypalAuth = btoa(
        `${Deno.env.get("PAYPAL_CLIENT_ID")}:${Deno.env.get("PAYPAL_SECRET")}`
      );

      const paypalMode = Deno.env.get("PAYPAL_MODE") || "sandbox";
      const paypalApiUrl = paypalMode === "sandbox"
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com";

      const response = await fetch(
        `${paypalApiUrl}/v1/billing/subscriptions/${subscriptionId}`,
        {
          headers: {
            Authorization: `Basic ${paypalAuth}`,
            "Content-Type": "application/json",
          },
        }
      );

      const subscriptionData = await response.json();

      console.log("PayPal subscription data:", subscriptionData);

      // Solo activar si PayPal confirma que la suscripción está ACTIVE
      if (subscriptionData.status === "ACTIVE") {
        // Crear el registro en user_subscriptions (similar al flujo de Stripe)
        const { error } = await supabase
          .from("user_subscriptions")
          .upsert({
            user_id: userId,
            plan,
            provider: "paypal",
            status: "active",
            paypal_subscription_id: subscriptionId,
            last_event: "subscription.activated",
            start_date: new Date().toISOString(),
            end_date: plan === "anual" 
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (error) {
          console.error("Error inserting PayPal subscription:", error);
          throw error;
        }

        console.log("PayPal subscription activated for user:", userId);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    /**
     * ENDPOINT: PayPal Webhooks
     * POST /payments/paypal-webhook
     * 
     * Recibe eventos de PayPal para mantener sincronizado el estado de suscripciones.
     * Eventos manejados:
     * - BILLING.SUBSCRIPTION.ACTIVATED: Suscripción activada
     * - BILLING.SUBSCRIPTION.CANCELLED: Suscripción cancelada por el usuario
     * - PAYMENT.SALE.COMPLETED: Pago exitoso (renovación)
     */
    if (pathname === "/payments/paypal-webhook" && req.method === "POST") {
      const event = await req.json();

      console.log("PayPal webhook event:", event.event_type);

      if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
        const subscriptionId = event.resource.id;

        console.log("PayPal subscription activated:", subscriptionId);

        const { error } = await supabase
          .from("user_subscriptions")
          .update({ 
            status: "active",
            last_event: "BILLING.SUBSCRIPTION.ACTIVATED" 
          })
          .eq("paypal_subscription_id", subscriptionId);

        if (error) {
          console.error("Error updating PayPal subscription:", error);
        }
      }

      if (event.event_type === "BILLING.SUBSCRIPTION.CANCELLED") {
        const subscriptionId = event.resource.id;

        console.log("PayPal subscription cancelled:", subscriptionId);

        const { error } = await supabase
          .from("user_subscriptions")
          .update({ 
            status: "canceled",
            last_event: "BILLING.SUBSCRIPTION.CANCELLED",
            end_date: new Date().toISOString(),
          })
          .eq("paypal_subscription_id", subscriptionId);

        if (error) {
          console.error("Error canceling PayPal subscription:", error);
        }
      }

      if (event.event_type === "PAYMENT.SALE.COMPLETED") {
        const subscriptionId = event.resource.billing_agreement_id;

        console.log("PayPal payment completed for subscription:", subscriptionId);

        const { error } = await supabase
          .from("user_subscriptions")
          .update({ 
            status: "active",
            last_event: "PAYMENT.SALE.COMPLETED" 
          })
          .eq("paypal_subscription_id", subscriptionId);

        if (error) {
          console.error("Error updating PayPal subscription:", error);
        }
      }

      return new Response("ok", { 
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response("Not found", { 
      status: 404,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error in payments function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
