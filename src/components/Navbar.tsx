/**
 * Navbar.tsx - Barra de navegación de la aplicación
 * 
 * Este documento define la navegación principal de SendaFit.
 * Se encarga de:
 * - Mostrar el logo y nombre de la app en la parte superior
 * - Proveer botones de cambio de tema (light/dark) y logout
 * - Mostrar navegación inferior con tabs para las secciones principales
 * - Resaltar la sección activa actual
 * - Ser responsive para mobile y desktop
 */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Calendar, Dumbbell, Apple, UserCircle, Moon, Sun, LogOut, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Componente Navbar
 * Este bloque maneja toda la navegación de la aplicación
 */
export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();

  /**
   * Handler para cerrar sesión
   * Este bloque ejecuta el logout y redirige al usuario a la página de auth
   */
  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  /**
   * Función para verificar si una ruta está activa
   * Compara la ruta actual con la ruta proporcionada
   */
  const isActive = (path: string) => location.pathname === path;

  /**
   * Definición de items de navegación
   * Array con todas las secciones navegables de la app
   */
  const navItems = [
    { path: "/dashboard", icon: Home, label: "Inicio" },
    { path: "/macros", icon: Apple, label: "Macros" },
    { path: "/workouts", icon: Dumbbell, label: "Entrenar" },
    { path: "/calendar", icon: Calendar, label: "Agenda" },
    { path: "/profile", icon: UserCircle, label: "Perfil" },
  ];

  /**
   * Renderizado de la navegación
   * Este bloque construye la barra superior y la navegación inferior
   */
  return (
    <>
      {/* Barra superior - Logo, Tema, Logout */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary/10 via-card to-accent/10 backdrop-blur-xl border-b border-primary/20 shadow-elevated">
        <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Logo y nombre de la app */}
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow transition-transform group-hover:scale-105">
                <Dumbbell className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <span className="text-lg sm:text-xl font-black bg-gradient-primary bg-clip-text text-transparent">
                SendaFit
              </span>
            </Link>

            {/* Botones de acción (Tema y Logout) */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Botón para cambiar tema */}
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 sm:h-10 sm:w-10 hover:bg-primary/10 rounded-xl transition-all">
                {theme === "light" ? <Moon className="w-5 h-5 sm:w-5 sm:h-5" /> : <Sun className="w-5 h-5 sm:w-5 sm:h-5" />}
              </Button>
              {/* Botón para cerrar sesión */}
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 sm:h-10 sm:w-10 hover:bg-destructive/10 rounded-xl transition-all">
                <LogOut className="w-5 h-5 sm:w-5 sm:h-5 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Barra de navegación inferior con tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-card via-card to-card/90 backdrop-blur-xl border-t border-primary/20 shadow-elevated safe-area-bottom">
        <div className="w-full px-2 sm:px-4 py-2">
          <div className="flex justify-around items-center max-w-7xl mx-auto gap-1">
            {/* Mapeo de items de navegación */}
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} className="flex-1 flex justify-center">
                <Button
                  variant={isActive(item.path) ? "default" : "ghost"}
                  size="sm"
                  className={`flex flex-col h-auto py-2 sm:py-2.5 px-2 sm:px-3 gap-1 w-full max-w-[80px] rounded-2xl transition-all ${
                    isActive(item.path) 
                      ? "shadow-glow scale-105" 
                      : "hover:bg-primary/5"
                  }`}
                >
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-semibold truncate">{item.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
};
