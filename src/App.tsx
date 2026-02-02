/**
 * App.tsx - Componente raíz de la aplicación SendaFit
 * 
 * Este documento es el punto de entrada principal de la aplicación.
 * Se encarga de:
 * - Configurar el enrutamiento de la aplicación con React Router
 * - Envolver la app con providers necesarios (Query, Theme, Auth)
 * - Definir todas las rutas disponibles
 * - Configurar componentes de notificaciones (Toaster, Sonner)
 * - Manejar errores globales con ErrorBoundary
 */

import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import OnboardingForm from "./components/onboarding/OnboardingForm";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Macros from "./pages/Macros";
import Workouts from "./pages/Workouts";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

/**
 * Componente de loading para Suspense
 */
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <p className="text-muted-foreground animate-pulse">Cargando...</p>
  </div>
);

/**
 * Configuración del cliente de React Query
 * Este bloque configura las opciones por defecto para las consultas de datos:
 * - retry: 1 intento de reintentar solicitudes fallidas
 * - refetchOnWindowFocus: false para no refrescar datos automáticamente al enfocar la ventana
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Componente principal App
 * Este bloque define la estructura principal de la aplicación con todos los providers
 * y rutas necesarias
 */
const App = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        {/* Provider de React Query para gestión de estado del servidor */}
        <QueryClientProvider client={queryClient}>
          {/* Provider de tema para modo claro/oscuro */}
          <ThemeProvider>
            {/* Provider de autenticación para gestión de usuarios */}
            <AuthProvider>
              {/* Provider de tooltips para componentes UI */}
              <TooltipProvider>
                {/* Componentes de notificaciones */}
                <Toaster />
                <Sonner />
                
                {/* Definición de todas las rutas de la aplicación */}
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Ruta raíz redirige a autenticación */}
                    <Route path="/" element={<Navigate to="/auth" replace />} />
                    {/* Ruta de autenticación (login/registro) */}
                    <Route path="/auth" element={<Auth />} />
                    {/* Ruta de onboarding para nuevos usuarios */}
                    <Route path="/onboarding" element={<OnboardingForm />} />
                    {/* Ruta del dashboard principal */}
                    <Route path="/dashboard" element={<Dashboard />} />
                    {/* Ruta de seguimiento de macros/nutrición */}
                    <Route path="/macros" element={<Macros />} />
                    {/* Ruta de gestión de entrenamientos */}
                    <Route path="/workouts" element={<Workouts />} />
                    {/* Ruta del calendario de entrenamientos */}
                    <Route path="/calendar" element={<Calendar />} />
                    {/* Ruta del perfil de usuario */}
                    <Route path="/profile" element={<Profile />} />
                    {/* Ruta 404 para páginas no encontradas */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </TooltipProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
