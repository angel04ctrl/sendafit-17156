/**
 * FeatureFlagsContext.tsx - Sistema centralizado de feature flags
 * 
 * Combina tres niveles de flags:
 * 1. Global (app_config table) - flags que aplican a todos los usuarios
 * 2. User (user_settings table) - flags per-user (is_pro, dev_mode)
 * 3. Runtime (local) - UI-only flags para desarrollo
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──────────────────────────────────────────────

interface GlobalFlags {
  aiEnabled: boolean;
  foodAIEnabled: boolean;
  gymAIEnabled: boolean;
  coachAIEnabled: boolean;
}

interface UserFlags {
  isPro: boolean;
  devMode: boolean;
}

interface RuntimeFlags {
  mockAIResponses: boolean;
  showDevTools: boolean;
}

interface FeatureFlagsState {
  global: GlobalFlags;
  user: UserFlags;
  runtime: RuntimeFlags;
  loading: boolean;
  /** Check if a feature should render: global flag ON + (pro OR devMode) */
  canAccess: (globalFlag: keyof GlobalFlags) => boolean;
  /** Check if user has pro-level access (pro OR devMode) */
  hasProAccess: boolean;
  /** Toggle a runtime flag */
  setRuntimeFlag: (key: keyof RuntimeFlags, value: boolean) => void;
}

// ── Defaults (SAFE MODE) ──────────────────────────────

const DEFAULT_GLOBAL: GlobalFlags = {
  aiEnabled: false,
  foodAIEnabled: false,
  gymAIEnabled: false,
  coachAIEnabled: false,
};

const DEFAULT_USER: UserFlags = {
  isPro: false,
  devMode: false,
};

const DEFAULT_RUNTIME: RuntimeFlags = {
  mockAIResponses: false,
  showDevTools: false,
};

// ── Context ───────────────────────────────────────────

const FeatureFlagsContext = createContext<FeatureFlagsState | undefined>(undefined);

export const FeatureFlagsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [global, setGlobal] = useState<GlobalFlags>(DEFAULT_GLOBAL);
  const [userFlags, setUserFlags] = useState<UserFlags>(DEFAULT_USER);
  const [runtime, setRuntime] = useState<RuntimeFlags>(DEFAULT_RUNTIME);
  const [loading, setLoading] = useState(true);

  // Load global flags from app_config
  const loadGlobalFlags = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("app_config")
        .select("key, value");

      if (error) {
        console.error("[FeatureFlags] Error loading global flags:", error);
        return;
      }

      if (data) {
        const flags: Record<string, boolean> = {};
        for (const row of data) {
          flags[row.key] = row.value;
        }
        setGlobal({
          aiEnabled: flags.aiEnabled ?? false,
          foodAIEnabled: flags.foodAIEnabled ?? false,
          gymAIEnabled: flags.gymAIEnabled ?? false,
          coachAIEnabled: flags.coachAIEnabled ?? false,
        });
      }
    } catch (e) {
      console.error("[FeatureFlags] Failed to load global flags:", e);
    }
  }, []);

  // Load user flags from user_settings
  const loadUserFlags = useCallback(async () => {
    if (!user?.id) {
      setUserFlags(DEFAULT_USER);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from("user_settings")
        .select("is_pro, dev_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[FeatureFlags] Error loading user flags:", error);
        return;
      }

      if (data) {
        setUserFlags({
          isPro: data.is_pro ?? false,
          devMode: data.dev_mode ?? false,
        });
      } else {
        // No record yet — create one
        await (supabase as any)
          .from("user_settings")
          .insert({ user_id: user.id })
          .single();
        setUserFlags(DEFAULT_USER);
      }
    } catch (e) {
      console.error("[FeatureFlags] Failed to load user flags:", e);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadGlobalFlags();
      setLoading(false);
    };
    load();
  }, [loadGlobalFlags]);

  // Load user flags when user changes
  useEffect(() => {
    loadUserFlags();
  }, [loadUserFlags]);

  // Also check subscription status to derive isPro
  useEffect(() => {
    if (!user?.id) return;

    const checkSubscription = async () => {
      try {
        const { data } = await (supabase as any)
          .from("user_subscriptions")
          .select("status, plan")
          .eq("user_id", user.id)
          .eq("status", "active")
          .eq("plan", "pro")
          .maybeSingle();

        if (data) {
          setUserFlags(prev => ({ ...prev, isPro: true }));
        }
      } catch (e) {
        // Non-critical
      }
    };

    checkSubscription();
  }, [user?.id]);

  const hasProAccess = userFlags.isPro || userFlags.devMode;

  const canAccess = useCallback(
    (globalFlag: keyof GlobalFlags): boolean => {
      // Global flag must be on AND user must have pro access
      return global[globalFlag] && hasProAccess;
    },
    [global, hasProAccess]
  );

  const setRuntimeFlag = useCallback((key: keyof RuntimeFlags, value: boolean) => {
    setRuntime(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <FeatureFlagsContext.Provider
      value={{
        global,
        user: userFlags,
        runtime,
        loading,
        canAccess,
        hasProAccess,
        setRuntimeFlag,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = (): FeatureFlagsState => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    // Safe fallback when used outside provider (prevents crashes)
    return {
      global: DEFAULT_GLOBAL,
      user: DEFAULT_USER,
      runtime: DEFAULT_RUNTIME,
      loading: false,
      canAccess: () => false,
      hasProAccess: false,
      setRuntimeFlag: () => {},
    };
  }
  return context;
};
