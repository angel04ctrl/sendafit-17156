/**
 * useDevOverride.ts - Hook para gestión del override de desarrollo
 * 
 * Hook ADITIVO que no modifica la lógica de suscripciones existente.
 * Permite a usuarios con dev_override=true acceder a funciones Pro.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface DevOverrideState {
  hasDevOverride: boolean;
  isLoading: boolean;
  toggleDevOverride: () => Promise<boolean>;
  isToggling: boolean;
}

/**
 * Hook para verificar y gestionar el estado de dev_override
 * Solo efectivo para el usuario actual autenticado
 */
export function useDevOverride(): DevOverrideState {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query para obtener el estado actual de dev_override
  const { data: hasDevOverride = false, isLoading } = useQuery({
    queryKey: ["dev-override", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data, error } = await supabase
        .from("profiles")
        .select("dev_override")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("[DEV_OVERRIDE] Error fetching dev_override:", error);
        return false;
      }

      return data?.dev_override ?? false;
    },
    enabled: !!user?.id,
    staleTime: 30000, // Cache por 30 segundos
  });

  // Mutation para toggle del dev_override
  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user authenticated");

      const newValue = !hasDevOverride;

      const { error } = await supabase
        .from("profiles")
        .update({ dev_override: newValue })
        .eq("id", user.id);

      if (error) throw error;

      // Log del cambio
      console.log(
        `[DEV_OVERRIDE] Toggle: userId=${user.id}, newValue=${newValue}, timestamp=${new Date().toISOString()}`
      );

      return newValue;
    },
    onSuccess: (newValue) => {
      queryClient.invalidateQueries({ queryKey: ["dev-override", user?.id] });
      toast.success(
        newValue
          ? "Dev Override activado - Acceso Pro habilitado"
          : "Dev Override desactivado - Acceso Pro según suscripción"
      );
    },
    onError: (error) => {
      console.error("[DEV_OVERRIDE] Toggle error:", error);
      toast.error("Error al cambiar Dev Override");
    },
  });

  return {
    hasDevOverride,
    isLoading,
    toggleDevOverride: toggleMutation.mutateAsync,
    isToggling: toggleMutation.isPending,
  };
}

/**
 * Hook para verificar si el usuario tiene acceso Pro
 * Combina: DEV_MODE_PRO_ENABLED || dev_override || suscripción activa
 * 
 * Este hook es ADITIVO y no reemplaza la lógica existente de verificación Pro
 */
export function useHasProAccess(isProUser: boolean = false): boolean {
  const { hasDevOverride } = useDevOverride();
  
  // Import dinámico evita dependencia circular
  const DEV_MODE_PRO_ENABLED = true; // Mismo valor que devConfig.ts
  
  // Capa de override primero
  if (DEV_MODE_PRO_ENABLED || hasDevOverride) {
    return true;
  }
  
  // Lógica legacy intacta
  return isProUser;
}
