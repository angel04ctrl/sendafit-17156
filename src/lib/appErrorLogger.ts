import { supabase } from "@/integrations/supabase/client";

interface LogAppErrorInput {
  userId?: string | null;
  source: string;
  message: string;
  severity?: "warning" | "error" | "critical";
  details?: Record<string, unknown>;
  screen?: string;
}

export async function logAppError({
  userId,
  source,
  message,
  severity = "error",
  details = {},
  screen = typeof window !== "undefined" ? window.location.pathname : undefined,
}: LogAppErrorInput) {
  try {
    const { error } = await supabase
      .from("app_error_logs" as any)
      .insert({
        user_id: userId || null,
        source,
        message: message.slice(0, 500),
        severity,
        details,
        screen,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
    if (error) throw error;
  } catch (error) {
    console.warn("Could not write app error log:", error);
  }
}
