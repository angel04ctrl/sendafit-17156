/**
 * NotFound.tsx - Página de error 404
 * 
 * Este documento maneja las rutas no encontradas (404).
 * Se encarga de:
 * - Mostrar un mensaje de error amigable al usuario
 * - Registrar en consola las rutas inválidas para debugging
 * - Proveer un enlace para regresar al inicio
 */

import { useLocation } from "react-router-dom";
import { useEffect } from "react";

/**
 * Componente NotFound
 * Este bloque renderiza la página 404 y registra errores de navegación
 */
const NotFound = () => {
  const location = useLocation();

  /**
   * Efecto para registrar errores 404
   * Este bloque registra en consola cada intento de acceso a una ruta no existente
   */
  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  /**
   * Renderizado de la interfaz 404
   * Este bloque muestra un mensaje de error y un enlace para volver al inicio
   */
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <a href="/" className="text-blue-500 underline hover:text-blue-700">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
