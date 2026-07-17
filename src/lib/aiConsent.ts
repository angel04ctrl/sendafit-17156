import { supabase } from "@/integrations/supabase/client";

export async function recordAiConsent(userId?: string | null) {
  if (!userId) return;

  const { error } = await supabase
    .from("profiles")
    .update({
      ai_consent_accepted: true,
      ai_consent_accepted_at: new Date().toISOString(),
      ai_consent_version: "sprint-14-v1",
    } as any)
    .eq("id", userId);

  if (error) {
    console.warn("Could not persist AI consent:", error.message);
  }
}
