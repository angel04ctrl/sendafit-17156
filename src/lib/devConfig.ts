/**
 * devConfig.ts - Legacy compatibility layer
 * 
 * DEPRECATED: Use FeatureFlagsContext instead.
 * This file is kept for backward compatibility only.
 * The DEV_MODE_PRO_ENABLED flag is no longer the source of truth.
 * Feature access is now controlled by:
 *   1. app_config table (global flags)
 *   2. user_settings table (per-user flags)
 *   3. FeatureFlagsContext (runtime)
 */

/** @deprecated Use useFeatureFlags().hasProAccess instead */
export const DEV_MODE_PRO_ENABLED = false;

/** @deprecated Use useFeatureFlags().hasProAccess instead */
export function hasProAccess(isProUser: boolean = false, hasDevOverride: boolean = false): boolean {
  if (hasDevOverride) return true;
  return isProUser;
}

/** @deprecated No longer used */
export function logDevOverrideAccess(userId: string, route: string): void {
  // No-op
}
