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
 * @returns true si el usuario puede acceder a funciones PRO
 */
export function hasProAccess(isProUser: boolean = false): boolean {
  return DEV_MODE_PRO_ENABLED || isProUser;
}
