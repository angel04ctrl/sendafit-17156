/**
 * utils.ts - Utilidades generales de la aplicación
 * 
 * Este documento proporciona funciones auxiliares reutilizables.
 * Se encarga de:
 * - Combinar clases de Tailwind CSS de forma inteligente
 * - Resolver conflictos de clases CSS
 * - Facilitar el uso de clases condicionales
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Función cn (className)
 * Este bloque combina múltiples clases CSS usando clsx y resuelve conflictos con twMerge.
 * Muy útil para componentes con clases condicionales y variantes.
 * 
 * Ejemplo: cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
