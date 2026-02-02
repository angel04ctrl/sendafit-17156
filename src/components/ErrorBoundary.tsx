/**
 * ErrorBoundary.tsx - Componente de captura de errores global
 * 
 * Este componente captura errores de renderizado en React para prevenir
 * que toda la aplicación se bloquee por un error en un componente hijo.
 * Se encarga de:
 * - Capturar errores de renderizado en componentes hijos
 * - Mostrar UI de fallback amigable
 * - Permitir reintentar la acción que falló
 * - Logear errores para debugging
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/auth";
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Algo salió mal</h2>
              <p className="text-sm text-muted-foreground">
                Ha ocurrido un error inesperado. Puedes intentar recargar la página o volver al inicio.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="bg-muted p-3 rounded-md overflow-auto max-h-32">
                <p className="text-xs font-mono text-destructive">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button onClick={this.handleRetry} className="w-full gap-2">
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </Button>
              <Button onClick={this.handleReload} variant="outline" className="w-full gap-2">
                <RefreshCw className="w-4 h-4" />
                Recargar página
              </Button>
              <Button onClick={this.handleGoHome} variant="ghost" className="w-full gap-2">
                <Home className="w-4 h-4" />
                Ir al inicio
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
