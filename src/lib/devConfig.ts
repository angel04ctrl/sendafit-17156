/**
 * devConfig.ts - Configuración de desarrollo
 * 
 * Este archivo contiene flags temporales para desarrollo.
 * IMPORTANTE: Cambiar estos valores a false antes de producción.
 */

/**
 * DEV_MODE_PRO_ENABLED
 * 
 * Cuando está en TRUE: Todas las funciones PRO están desbloqueadas para todos los usuarios
 * Cuando está en FALSE: Las funciones PRO requieren suscripción activa
 * 
 * TODO: Cambiar a FALSE antes de lanzar a producción
 */
export const DEV_MODE_PRO_ENABLED = true;

/**
 * Helper para verificar si el usuario tiene acceso PRO
 * Usa este helper en lugar de verificar directamente el rol
 * 
 * @param isProUser - El estado real de suscripción del usuario
 * @param hasDevOverride - Override de desarrollo activo desde BD (opcional)
 * @returns true si el usuario puede acceder a funciones PRO
 */
export function hasProAccess(isProUser: boolean = false, hasDevOverride: boolean = false): boolean {
  // Capa de override: si DEV_MODE global está activo O si tiene override personal → acceso Pro
  if (DEV_MODE_PRO_ENABLED || hasDevOverride) {
    return true;
  }
  // Lógica legacy intacta: verificar suscripción real
  return isProUser;
}

/**
 * Logging básico para uso de override (solo desarrollo)
 */
export function logDevOverrideAccess(userId: string, route: string): void {
  if (DEV_MODE_PRO_ENABLED) {
    console.log(`[DEV_OVERRIDE] userId: ${userId}, timestamp: ${new Date().toISOString()}, route: ${route}`);
  }
}
