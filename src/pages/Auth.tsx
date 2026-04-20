/**
 * Auth.tsx - Página de autenticación
 * 
 * Este documento gestiona el proceso de login y registro de usuarios.
 * Se encarga de:
 * - Mostrar formularios de inicio de sesión y registro
 * - Validar datos de email y contraseña con Zod
 * - Autenticar usuarios existentes con Supabase Auth
 * - Guardar datos de registro temporal para completar onboarding
 * - Redirigir a dashboard si completó onboarding, o a onboarding si no
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Dumbbell } from "lucide-react";
import heroImage from "@/assets/hero-fitness.jpg";
import { z } from "zod";

// Esquema de validación de datos de autenticación con Zod
const authSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  fullName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").optional(),
});

const Auth = () => {
  const navigate = useNavigate();
  // Estado de carga para deshabilitar botones durante el proceso
  const [loading, setLoading] = useState(false);
  // Estados del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Bloque de inicio de sesión - Autentica usuario existente
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar datos con Zod
      const validation = authSchema.parse({ email, password });
      
      // Autenticar con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validation.email,
        password: validation.password,
      });

      if (error) throw error;
      
      // Verificar si el usuario completó el onboarding
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", data.user.id)
          .maybeSingle();

        // Redirigir según estado de onboarding
        if (profile?.onboarding_completed) {
          toast.success("¡Bienvenida de vuelta!");
          navigate("/dashboard");
        } else {
          toast.info("Por favor completa tu perfil");
          navigate("/onboarding");
        }
      }
    } catch (error: unknown) {
      // Manejar errores de validación o autenticación
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        const err = error as Error;
        toast.error(err.message || "Error al iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  };

  // Bloque de registro - Guarda datos temporales y redirige a onboarding
  // No crea la cuenta aquí, se crea al completar el onboarding
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar datos con Zod
      const validation = authSchema.parse({ email, password, fullName });
      
      // Guardar datos en sessionStorage para usarlos en onboarding
      sessionStorage.setItem('pendingRegistration', JSON.stringify({
        email: validation.email,
        password: validation.password,
        fullName: validation.fullName,
      }));
      
      toast.success("¡Perfecto! Ahora completa tu perfil");
      navigate("/onboarding");
    } catch (error: unknown) {
      // Manejar errores de validación
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        const err = error as Error;
        toast.error(err.message || "Error al validar datos");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Right side - Auth Forms - Now full width for mobile */}
      <div className="w-full flex items-center justify-center p-4 sm:p-8 flex-1">
        <div className="w-full max-w-md space-y-4 sm:space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                <Dumbbell className="w-10 h-10 sm:w-12 sm:h-12 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              SendaFit
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Tu entrenadora personal móvil</p>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <Card>
                <CardHeader>
                  <CardTitle>Bienvenida de vuelta</CardTitle>
                  <CardDescription>
                    Ingresa tus credenciales para continuar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Contraseña</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Iniciando..." : "Iniciar Sesión"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card>
                <CardHeader>
                  <CardTitle>Crear cuenta</CardTitle>
                  <CardDescription>
                    Únete a la comunidad SendaFit
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nombre completo</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Tu nombre"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Contraseña</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Creando cuenta..." : "Crear Cuenta"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;
