/**
 * FeatureGate.tsx - Declarative feature gating component
 * 
 * Wraps children and only renders them when the required flags are met.
 * Shows a fallback (locked state / CTA) when conditions fail.
 */

import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

interface FeatureGateProps {
  /** Global flag that must be enabled */
  flag?: "aiEnabled" | "foodAIEnabled" | "gymAIEnabled" | "coachAIEnabled";
  /** Only require pro access (no global flag check) */
  requirePro?: boolean;
  /** Custom fallback UI */
  fallback?: React.ReactNode;
  /** Hide entirely instead of showing fallback */
  hideWhenLocked?: boolean;
  children: React.ReactNode;
}

const DefaultFallback = ({ label }: { label?: string }) => (
  <Card className="p-4 border-dashed border-2 border-muted-foreground/20 flex items-center justify-center gap-2">
    <Lock className="w-4 h-4 text-muted-foreground" />
    <span className="text-sm text-muted-foreground">
      {label || "Función PRO"}
    </span>
    <Badge variant="secondary" className="text-xs">PRO</Badge>
  </Card>
);

export const FeatureGate = ({
  flag,
  requirePro = false,
  fallback,
  hideWhenLocked = false,
  children,
}: FeatureGateProps) => {
  const { canAccess, hasProAccess } = useFeatureFlags();

  let allowed = true;

  if (flag) {
    allowed = canAccess(flag);
  } else if (requirePro) {
    allowed = hasProAccess;
  }

  if (allowed) {
    return <>{children}</>;
  }

  if (hideWhenLocked) {
    return null;
  }

  return <>{fallback || <DefaultFallback label={flag} />}</>;
};
