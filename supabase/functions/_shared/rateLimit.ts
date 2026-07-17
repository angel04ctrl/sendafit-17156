import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RateLimitOptions {
  userId: string;
  functionName: string;
  hourlyLimit?: number;
  dailyLimit?: number;
}

interface RateLimitResult {
  allowed?: boolean;
  limit?: "hour" | "day";
  retryAfterSeconds?: number;
  hourlyRemaining?: number;
  dailyRemaining?: number;
}

export async function enforceAiRateLimit({
  userId,
  functionName,
  hourlyLimit = 5,
  dailyLimit = 20,
}: RateLimitOptions): Promise<RateLimitResult> {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no esta configurada.");
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
  const { data, error } = await admin.rpc("check_ai_rate_limit", {
    _user_id: userId,
    _function_name: functionName,
    _hourly_limit: hourlyLimit,
    _daily_limit: dailyLimit,
  });

  if (error) throw error;
  return (data || {}) as RateLimitResult;
}

export function rateLimitResponse(limit: RateLimitResult) {
  return {
    error: limit.limit === "day"
      ? "Limite diario de IA alcanzado. Intenta nuevamente manana."
      : "Limite horario de IA alcanzado. Intenta nuevamente en unos minutos.",
    retryAfterSeconds: limit.retryAfterSeconds || (limit.limit === "day" ? 86400 : 3600),
  };
}
