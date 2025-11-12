import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Create Stripe checkout session
    if (pathname === "/payments/create-checkout-session" && req.method === "POST") {
      const { plan, userId } = await req.json();

      console.log("Creating Stripe checkout session for user:", userId, "plan:", plan);

      // Define prices based on plan (in centavos MXN)
      const amount = plan === "anual" ? 105800 : 9800; // 98 MXN mensual, 1058 MXN anual
      
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
        success_url: `${req.headers.get('origin')}/profile?payment=success`,
        cancel_url: `${req.headers.get('origin')}/profile?payment=canceled`,
        metadata: { userId, plan },
      });

      console.log("Stripe session created:", session.id);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle Stripe webhooks
    if (pathname === "/payments/stripe-webhook" && req.method === "POST") {
      const sig = req.headers.get("stripe-signature");
      const body = await req.text();

      if (!sig) {
        return new Response("No signature", { status: 400 });
      }

      try {
        const event = stripe.webhooks.constructEvent(
          body,
          sig,
          Deno.env.get("STRIPE_WEBHOOK_SECRET")!
        );

        console.log("Stripe webhook event:", event.type);

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as any;
          const { userId, plan } = session.metadata;

          console.log("Processing checkout completion for user:", userId);

          // Get customer and subscription info
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          // Insert or update subscription
          const { error } = await supabase
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

          if (error) {
            console.error("Error inserting subscription:", error);
            throw error;
          }

          console.log("Subscription activated for user:", userId);
        }

        if (event.type === "invoice.payment_succeeded") {
          const invoice = event.data.object as any;
          const subscriptionId = invoice.subscription;

          console.log("Payment succeeded for subscription:", subscriptionId);

          // Update subscription status
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

        if (event.type === "customer.subscription.deleted") {
          const subscription = event.data.object as any;

          console.log("Subscription deleted:", subscription.id);

          // Update subscription status to canceled
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
        return new Response(`Webhook Error: ${err.message}`, { 
          status: 400,
          headers: corsHeaders,
        });
      }
    }

    // Handle PayPal confirmation
    if (pathname === "/payments/paypal-confirm" && req.method === "POST") {
      const { subscriptionId, userId, plan } = await req.json();

      console.log("Processing PayPal confirmation for user:", userId);

      // Verify subscription with PayPal
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

      if (subscriptionData.status === "ACTIVE") {
        // Insert or update subscription
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

    // Handle PayPal webhooks
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
