/**
 * useDevOverride.ts - Legacy compatibility hook
 * 
 * DEPRECATED: Use useFeatureFlags() from FeatureFlagsContext instead.
 * Kept for backward compatibility.
 */

import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

interface DevOverrideState {
  hasDevOverride: boolean;
  isLoading: boolean;
  toggleDevOverride: () => Promise<boolean>;
  isToggling: boolean;
}

/** @deprecated Use useFeatureFlags() instead */
export function useDevOverride(): DevOverrideState {
  const { user: userFlags } = useFeatureFlags();

  return {
    hasDevOverride: userFlags.devMode,
    isLoading: false,
    toggleDevOverride: async () => !userFlags.devMode,
    isToggling: false,
  };
}

/** @deprecated Use useFeatureFlags().hasProAccess instead */
export function useHasProAccess(isProUser: boolean = false): boolean {
  const { hasProAccess } = useFeatureFlags();
  return hasProAccess || isProUser;
}
