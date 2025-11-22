/**
 * ProButton.tsx - Botón para funciones PRO
 * 
 * Este documento define un botón especial que promociona funciones premium.
 * Se encarga de:
 * - Mostrar un botón con badge "PRO"
 * - Abrir modal de upgrade al hacer clic
 * - Mostrar información sobre la función premium
 * - Incentivar al usuario a actualizar su plan
 */

import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LucideIcon, Lock } from "lucide-react";
import { useState } from "react";
import { UpgradeModal } from "./UpgradeModal";

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
}

/**
 * Componente ProButton
 * Este bloque renderiza un botón promocional que abre el modal de upgrade
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
}: ProButtonProps) => {
  /**
   * Estado del modal de upgrade
   * Controla la visibilidad del modal de actualización a PRO
   */
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  /**
   * Renderizado del botón y modal
   * Este bloque muestra el botón PRO y el modal asociado
   */
  return (
    <>
      {/* Botón PRO con badge de candado */}
      <Button
        variant={variant}
        size={size}
        className={`relative gap-2 ${className}`}
        onClick={() => !disabled && setUpgradeModalOpen(true)}
        disabled={disabled}
      >
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-sm sm:text-base">{label}</span>
        <Badge variant="default" className="ml-auto gap-1 text-xs">
          <Lock className="w-3 h-3" />
          PRO
        </Badge>
      </Button>

      {/* Modal de upgrade con detalles de la función PRO */}
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        featureTitle={featureTitle}
        featureDescription={featureDescription}
        features={features}
      />
    </>
  );
};
