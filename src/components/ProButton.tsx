/**
 * ProButton.tsx - Botón para funciones PRO
 * 
 * Muestra un botón con badge PRO/Activo según feature flags.
 * Si el usuario tiene acceso PRO, ejecuta la acción directamente.
 * Si no, abre el modal de upgrade.
 */

import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LucideIcon, Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { UpgradeModal } from "./UpgradeModal";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

interface ProButtonProps {
  icon: LucideIcon;
  label: string;
  featureTitle: string;
  featureDescription: string;
  features: string[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export const ProButton = ({
  icon: Icon,
  label,
  featureTitle,
  featureDescription,
  features,
  variant = "outline",
  size = "default",
  className = "",
  disabled = false,
  onClick,
}: ProButtonProps) => {
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const { hasProAccess } = useFeatureFlags();

  const handleClick = () => {
    if (disabled) return;
    
    if (hasProAccess) {
      onClick?.();
    } else {
      setUpgradeModalOpen(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`relative gap-2 ${className}`}
        onClick={handleClick}
        disabled={disabled}
      >
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-sm sm:text-base">{label}</span>
        <Badge 
          variant={hasProAccess ? "secondary" : "default"} 
          className="ml-auto gap-1 text-xs"
        >
          {hasProAccess ? (
            <>
              <Sparkles className="w-3 h-3" />
              Activo
            </>
          ) : (
            <>
              <Lock className="w-3 h-3" />
              PRO
            </>
          )}
        </Badge>
      </Button>

      {!hasProAccess && (
        <UpgradeModal
          open={upgradeModalOpen}
          onOpenChange={setUpgradeModalOpen}
          featureTitle={featureTitle}
          featureDescription={featureDescription}
          features={features}
        />
      )}
    </>
  );
};
