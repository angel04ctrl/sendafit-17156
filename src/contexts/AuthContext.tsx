/**
 * AuthContext.tsx - Contexto de autenticación
 * 
 * Este documento gestiona el estado de autenticación global de la aplicación.
 * Se encarga de:
 * - Mantener el estado del usuario y sesión activos
 * - Escuchar cambios en el estado de autenticación (login/logout)
 * - Validar que el usuario existe en la base de datos
 * - Limpiar sesión si hay errores de permisos
 * - Proveer función de cierre de sesión
 */

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Estado del usuario autenticado
  const [user, setUser] = useState<User | null>(null);
  // Estado de la sesión activa
  const [session, setSession] = useState<Session | null>(null);
  // Estado de carga inicial
  const [loading, setLoading] = useState(true);

  // Bloque de efecto principal - Configura listener de cambios de auth y verifica sesión
  useEffect(() => {
    let mounted = true;

    // Configurar listener de cambios de autenticación PRIMERO
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        try {
          // Manejar evento de cierre de sesión
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }

          // Actualizar estado de sesión y usuario
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        } catch (error) {
          console.error('Error in auth state change handler:', error);
          setLoading(false);
        }
      }
    );

    // Función para verificar sesión existente y validar usuario en BD
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          // Limpiar sesión inválida
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        if (session?.user && mounted) {
          // Verificar que el usuario existe en la tabla profiles
          // Esto previene errores 403 cuando el usuario fue eliminado de la BD
          const { error: userError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle();

          if (userError || !mounted) {
            // Si hay error o el usuario no existe, limpiar sesión
            console.error('User validation error:', userError);
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          } else {
            setSession(session);
            setUser(session.user);
          }
        } else {
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Session check error:', error);
        // En caso de error, limpiar todo
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Función para cerrar sesión del usuario
  // La navegación a la página de login debe ser manejada por el componente que la invoca
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Sesión cerrada correctamente");
    } catch (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
