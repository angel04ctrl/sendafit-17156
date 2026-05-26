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
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { hydrateQueryCache, subscribeQueryCachePersistence } from "./lib/queryPersistence";

const OnboardingForm = lazy(() => import("./components/onboarding/OnboardingForm"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Macros = lazy(() => import("./pages/Macros"));
const Workouts = lazy(() => import("./pages/Workouts"));
const Calendar = lazy(() => import("./pages/Calendar"));
const CoachChat = lazy(() => import("./pages/CoachChat"));
const Reports = lazy(() => import("./pages/Reports"));
const Profile = lazy(() => import("./pages/Profile"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
      networkMode: "offlineFirst",
      gcTime: 1000 * 60 * 60 * 24 * 14,
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

if (typeof window !== "undefined") {
  hydrateQueryCache(queryClient);
  subscribeQueryCachePersistence(queryClient);
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;

  return <>{children}</>;
};

const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const HomeRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  return <Navigate to={user ? "/dashboard" : "/auth"} replace />;
};

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
              <FeatureFlagsProvider>
              {/* Provider de tooltips para componentes UI */}
              <TooltipProvider>
                {/* Componentes de notificaciones */}
                <Toaster />
                <Sonner />
                
                {/* Definición de todas las rutas de la aplicación */}
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Ruta raíz redirige a autenticación */}
                    <Route path="/" element={<HomeRedirect />} />
                    {/* Ruta de autenticación (login/registro) */}
                    <Route path="/auth" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
                    {/* Ruta de onboarding para nuevos usuarios */}
                    <Route path="/onboarding" element={<OnboardingForm />} />
                    {/* Ruta del dashboard principal */}
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    {/* Ruta de seguimiento de macros/nutrición */}
                    <Route path="/macros" element={<ProtectedRoute><Macros /></ProtectedRoute>} />
                    {/* Ruta de gestión de entrenamientos */}
                    <Route path="/workouts" element={<ProtectedRoute><Workouts /></ProtectedRoute>} />
                    {/* Ruta del calendario de entrenamientos */}
                    <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                    {/* Ruta del coach inteligente */}
                    <Route path="/coach-chat" element={<ProtectedRoute><CoachChat /></ProtectedRoute>} />
                    {/* Ruta de reportes avanzados */}
                    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                    {/* Ruta de actualización de contraseña */}
                    <Route path="/update-password" element={<UpdatePassword />} />
                    {/* Ruta del perfil de usuario */}
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    {/* Ruta 404 para páginas no encontradas */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </TooltipProvider>
              </FeatureFlagsProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
