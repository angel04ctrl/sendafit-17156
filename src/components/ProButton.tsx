/**
 * ProButton.tsx - Botón para funciones PRO
 * 
 * Este documento define un botón especial que promociona funciones premium.
 * Se encarga de:
 * - Mostrar un botón con badge "PRO"
 * - En modo desarrollo: ejecutar la función directamente
 * - En producción: abrir modal de upgrade al hacer clic
 * - Mostrar información sobre la función premium
 * - Incentivar al usuario a actualizar su plan
 */

import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LucideIcon, Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { UpgradeModal } from "./UpgradeModal";
import { DEV_MODE_PRO_ENABLED } from "@/lib/devConfig";

/**
 * Interfaz de props del componente ProButton
 * Define todos los parámetros configurables del botón PRO
 */
interface ProButtonProps {
  icon: LucideIcon;          // Icono que acompaña al botón
  label: string;             // Texto del botón
  featureTitle: string;      // Título de la función PRO en el modal
  featureDescription: string; // Descripción de la función PRO
  features: string[];        // Lista de características incluidas
  variant?: "default" | "outline" | "ghost"; // Estilo del botón
  size?: "default" | "sm" | "lg";           // Tamaño del botón
  className?: string;        // Clases CSS adicionales
  disabled?: boolean;        // Estado deshabilitado
  onClick?: () => void;      // Función a ejecutar cuando está desbloqueado
}

/**
 * Componente ProButton
 * Este bloque renderiza un botón promocional que abre el modal de upgrade
 * o ejecuta la función directamente si DEV_MODE_PRO_ENABLED está activo
 */
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
  /**
   * Estado del modal de upgrade
   * Controla la visibilidad del modal de actualización a PRO
   */
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  /**
   * Handler de clic
   * En modo dev ejecuta la función, en producción abre el modal
   */
  const handleClick = () => {
    if (disabled) return;
    
    if (DEV_MODE_PRO_ENABLED) {
      // Modo desarrollo: ejecutar la función directamente
      onClick?.();
    } else {
      // Producción: mostrar modal de upgrade
      setUpgradeModalOpen(true);
    }
  };

  /**
   * Renderizado del botón y modal
   * Este bloque muestra el botón PRO y el modal asociado
   */
  return (
    <>
      {/* Botón PRO con badge */}
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
          variant={DEV_MODE_PRO_ENABLED ? "secondary" : "default"} 
          className="ml-auto gap-1 text-xs"
        >
          {DEV_MODE_PRO_ENABLED ? (
            <>
              <Sparkles className="w-3 h-3" />
              DEV
            </>
          ) : (
            <>
              <Lock className="w-3 h-3" />
              PRO
            </>
          )}
        </Badge>
      </Button>

      {/* Modal de upgrade con detalles de la función PRO (solo en producción) */}
      {!DEV_MODE_PRO_ENABLED && (
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
