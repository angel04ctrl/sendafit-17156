/**
 * OnboardingForm.tsx - Formulario principal de onboarding
 * 
 * Este componente orquesta todo el proceso de registro y configuración inicial del usuario.
 * Se encarga de:
 * - Gestionar 7 pasos de onboarding con validación en cada paso
 * - Verificar si el usuario ya completó onboarding (redirigir a dashboard)
 * - Verificar si hay registro pendiente en sessionStorage
 * - Calcular macros automáticamente basados en datos del perfil
 * - Crear cuenta de usuario en Supabase Auth
 * - Crear perfil completo en base de datos
 * - Asignar rutina automática al finalizar
 * - Prevenir cierre accidental de ventana durante el proceso
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateMacros, validateProfileData } from "@/lib/macrosCalculator";
import OnboardingStep1 from "./OnboardingStep1";
import OnboardingStep2 from "./OnboardingStep2";
import OnboardingStep3 from "./OnboardingStep3";
import OnboardingStep4 from "./OnboardingStep4";
import OnboardingStep5 from "./OnboardingStep5";
import OnboardingStep6 from "./OnboardingStep6";
import OnboardingStep7 from "./OnboardingStep7";

const OnboardingForm = () => {
  const navigate = useNavigate();
  // Estado del paso actual (1-7)
  const [currentStep, setCurrentStep] = useState(1);
  // Estado de carga durante envío del formulario
  const [loading, setLoading] = useState(false);
  // Estado de verificación inicial del perfil
  const [checkingProfile, setCheckingProfile] = useState(true);
  // Datos acumulados del formulario de onboarding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<any>({});
  const sb = supabase;

  const totalSteps = 7; // Total de pasos en el proceso
  const progress = (currentStep / totalSteps) * 100; // Porcentaje de progreso

  // Bloque de verificación inicial - Verifica estado de onboarding o registro pendiente
  // Evita que usuarios autenticados que ya completaron onboarding vuelvan aquí
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        // Verificar si hay usuario autenticado
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Usuario ya autenticado, verificar onboarding
          const { data: profile } = await sb
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.onboarding_completed) {
            // Ya completó onboarding, ir a dashboard
            navigate("/dashboard", { replace: true });
            return;
          }
          // Si no completó onboarding, permitir continuar (usuario autenticado sin perfil completo)
          setCheckingProfile(false);
          return;
        }
        
        // No hay usuario autenticado, verificar si hay registro pendiente
        const pendingReg = sessionStorage.getItem('pendingRegistration');
        if (!pendingReg) {
          // No hay usuario ni registro pendiente - redirigir a auth
          toast.error("Debes registrarte primero");
          navigate("/auth", { replace: true });
          return;
        }
        
        // Hay registro pendiente, permitir continuar (flujo normal de registro)
        setCheckingProfile(false);
      } catch (error: unknown) {
        console.error("Error checking onboarding status:", error);
        toast.error("Error al verificar tu registro. Por favor vuelve a intentarlo.");
        navigate("/auth", { replace: true });
        setCheckingProfile(false);
      }
    };

    checkOnboardingStatus();
  }, [navigate, sb]);

  // Bloque de prevención de cierre - Evita que el usuario pierda su progreso
  // Muestra advertencias si intenta cerrar la ventana durante el registro
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentStep > 0) {
        e.preventDefault();
        e.returnValue = "¿Estás segura de salir? Perderás tu progreso y deberás registrarte nuevamente.";
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && currentStep > 0 && currentStep < totalSteps) {
        toast.warning("⚠️ No cierres la app hasta completar tu registro");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentStep, totalSteps]);

  if (checkingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando formulario...</p>
      </div>
    );
  }

  // Función helper para actualizar datos del formulario de forma incremental
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateFormData = (data: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFormData((prev: any) => ({ ...prev, ...data }));
  };

  // Función de validación por paso - Verifica que cada paso tenga datos completos
  // Retorna true si el paso actual está validado correctamente
  const validateStep = () => {
    switch (currentStep) {
      case 1: // Validar datos personales
        if (!formData.fullName || !formData.age || !formData.gender || !formData.height || !formData.weight) {
          toast.error("Por favor completa todos los campos obligatorios");
          return false;
        }
        break;
      case 2:
        if (!formData.primaryGoal || !formData.fitnessLevel) {
          toast.error("Por favor completa tu objetivo y nivel");
          return false;
        }
        if (!formData.trainingTypes || formData.trainingTypes.length === 0) {
          toast.error("Por favor selecciona al menos un tipo de entrenamiento");
          return false;
        }
        if (!formData.availableDays) {
          toast.error("Por favor indica cuántos días por semana puedes entrenar");
          return false;
        }
        if (!formData.sessionDuration) {
          toast.error("Por favor indica la duración de tus sesiones");
          return false;
        }
        if (!formData.availableWeekdays || formData.availableWeekdays.length === 0) {
          toast.error("Por favor selecciona los días específicos disponibles para entrenar");
          return false;
        }
        if (formData.availableWeekdays.length < formData.availableDays) {
          toast.error(`Debes seleccionar al menos ${formData.availableDays} días específicos`);
          return false;
        }
        break;
      case 3:
        if (!formData.healthConditions || formData.healthConditions.length === 0) {
          toast.error("Por favor selecciona al menos una opción en condiciones de salud");
          return false;
        }
        break;
      case 5:
        if (!formData.dietaryPreferences || formData.dietaryPreferences.length === 0) {
          toast.error("Por favor selecciona al menos una preferencia alimenticia");
          return false;
        }
        if (!formData.sleepHours) {
          toast.error("Por favor indica tus horas de sueño promedio");
          return false;
        }
        if (!formData.stressLevel) {
          toast.error("Por favor indica tu nivel de estrés percibido");
          return false;
        }
        break;
      case 7:
        if (!formData.termsAccepted) {
          toast.error("Debes aceptar los términos y condiciones para continuar");
          return false;
        }
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Función principal de envío - Ejecuta todo el proceso de creación de cuenta
  // Incluye: crear usuario, calcular macros, crear perfil, asignar rutina
  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    setLoading(true);
    try {
      // PASO 1: Verificar si hay un usuario ya autenticado
      const { data: { user: existingUser } } = await supabase.auth.getUser();
      
      let userId: string;
      let userFullName: string;

      if (existingUser) {
        // Usuario ya existe, solo crear/actualizar perfil
        userId = existingUser.id;
        userFullName = formData.fullName || existingUser.user_metadata?.full_name || existingUser.email?.split('@')[0] || 'Usuario';
        
        console.log("Usuario autenticado encontrado, actualizando perfil:", userId);
      } else {
        // No hay usuario autenticado, verificar registro pendiente
        const pendingRegString = sessionStorage.getItem('pendingRegistration');
        
        if (!pendingRegString) {
          toast.error("Error: No hay registro pendiente. Redirigiendo a la página de registro...", {
            duration: 3000,
          });
          setTimeout(() => {
            navigate("/auth", { replace: true });
          }, 1500);
          return;
        }

        const pendingReg = JSON.parse(pendingRegString);
        
        // Crear usuario nuevo en Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: pendingReg.email,
          password: pendingReg.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: pendingReg.fullName,
            },
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("No se pudo crear el usuario");
        
        userId = authData.user.id;
        userFullName = formData.fullName || pendingReg.fullName;
        
        console.log("Nuevo usuario creado:", userId);
      }

      // PASO 2: Calcular macros automáticamente basados en el perfil
      let calculatedMacros = null;
      
      if (validateProfileData({
        gender: formData.gender,
        age: formData.age,
        weight: formData.weight,
        height: formData.height,
        availableDays: formData.availableDays,
        fitnessLevel: formData.fitnessLevel,
        fitnessGoal: formData.primaryGoal
      })) {
        calculatedMacros = calculateMacros({
          gender: formData.gender,
          age: formData.age,
          weight: formData.weight,
          height: formData.height,
          availableDays: formData.availableDays || 3,
          fitnessLevel: formData.fitnessLevel,
          fitnessGoal: formData.primaryGoal
        });
        
        console.log("Macros calculados automáticamente:", calculatedMacros);
      }

      // PASO 3: Crear o actualizar el perfil completo en la base de datos
      const { error: profileError } = await sb
        .from("profiles")
        .upsert({
          id: userId,
          full_name: userFullName,
          age: formData.age,
          gender: formData.gender,
          height: formData.height,
          weight: formData.weight,
          fitness_level: formData.fitnessLevel,
          fitness_goal: formData.primaryGoal,
          primary_goal: formData.primaryGoal,
          training_types: formData.trainingTypes || [],
          available_days_per_week: formData.availableDays,
          available_weekdays: formData.availableWeekdays || [],
          session_duration_minutes: formData.sessionDuration,
          health_conditions: formData.healthConditions || [],
          current_medications: formData.medications,
          injuries_limitations: formData.injuries,
          menstrual_tracking_enabled: formData.menstrualTracking || false,
          menstrual_tracking_app: formData.trackingApp,
          menstrual_auto_sync: formData.autoSync || false,
          dietary_preferences: formData.dietaryPreferences || [],
          allergies_restrictions: formData.allergies,
          current_calorie_intake: formData.currentCalories,
          average_sleep_hours: formData.sleepHours,
          stress_level: formData.stressLevel,
          initial_measurements: {
            waist: formData.waist,
            chest: formData.chest,
            arms: formData.arms,
            legs: formData.legs
          },
          motivation_phrase: formData.motivation,
          theme_preference: formData.theme || 'auto',
          notifications_enabled: formData.notifications ?? true,
          wearables_sync_enabled: formData.wearables || false,
          terms_accepted: formData.termsAccepted,
          // Asignar los macros calculados automáticamente
          daily_calorie_goal: calculatedMacros?.dailyCalories || 2000,
          daily_protein_goal: calculatedMacros?.protein || 150,
          daily_carbs_goal: calculatedMacros?.carbs || 200,
          daily_fat_goal: calculatedMacros?.fat || 50,
          onboarding_completed: false // Será completado por la función de backend
        });

      if (profileError) {
        console.error("Error al crear perfil:", profileError);
        throw profileError;
      }

      // PASO 4: Crear el rol de usuario (si no existe)
      const { error: roleError } = await sb
        .from("user_roles")
        .insert({
          user_id: userId,
          role: 'user'
        });

      if (roleError) {
        // Ignorar error si el rol ya existe (código 23505 es violación de unique constraint)
        if (roleError.code !== '23505') {
          console.error("Error al crear rol de usuario:", roleError);
          throw roleError;
        }
      }

      // Limpiar datos temporales
      sessionStorage.removeItem('pendingRegistration');

      // PASO 5: Asignar rutina automáticamente basada en el perfil
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No se encontró una sesión autenticada para asignar la rutina.");

        const { data: routineData, error: routineError } = await supabase.functions.invoke('assign-routine', {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (routineError) {
          console.error("Error al asignar rutina:", routineError);
          toast.warning("Cuenta creada, pero hubo un error al asignar tu rutina. Puedes asignarla después desde el dashboard.");
        } else {
          console.log("Rutina asignada:", routineData);
          toast.success(`¡Cuenta creada! Se te asignó el plan: ${routineData.plan?.nombre_plan || 'personalizado'} 🎉`);
        }
      } catch (error) {
        console.error("Error al llamar a la función de asignar rutina:", error);
        toast.warning("Cuenta creada exitosamente. Puedes configurar tu rutina desde el dashboard.");
      }

      navigate("/dashboard");
    } catch (error: unknown) {
      console.error("Error en handleSubmit:", error);
      
      const err = error as Error & { code?: string };
      // Determinar el mensaje de error específico
      let errorMessage = "Hubo un error al completar tu registro";
      
      if (err?.message?.includes("already registered") || err?.message?.includes("User already registered")) {
        errorMessage = "Este correo ya está registrado. Serás redirigida a la página de inicio de sesión";
      } else if (err?.message?.includes("Invalid email")) {
        errorMessage = "El formato del correo electrónico no es válido";
      } else if (err?.message?.includes("Password")) {
        errorMessage = "La contraseña no cumple con los requisitos mínimos";
      } else if (err?.code === "23505") {
        errorMessage = "Este usuario ya existe en el sistema";
      } else if (err?.message?.includes("profiles")) {
        errorMessage = "Error al crear tu perfil. Verifica que todos los datos sean correctos";
      } else if (err?.message?.includes("permission denied") || err?.message?.includes("RLS")) {
        errorMessage = "Error de permisos al crear tu cuenta. Por favor, intenta nuevamente";
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
      
      // Limpiar datos temporales
      sessionStorage.removeItem('pendingRegistration');
      
      // Redirigir a la página de autenticación
      setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  // Función para renderizar el paso actual - Switch entre los 7 componentes
  const renderStep = () => {
    const stepProps = { formData, updateFormData };
    
    switch (currentStep) {
      case 1: return <OnboardingStep1 {...stepProps} />; // Datos personales
      case 2: return <OnboardingStep2 {...stepProps} />; // Objetivos y nivel
      case 3: return <OnboardingStep3 {...stepProps} />; // Salud y condiciones
      case 4: return <OnboardingStep4 {...stepProps} />; // Ciclo menstrual (opcional)
      case 5: return <OnboardingStep5 {...stepProps} />; // Nutrición y hábitos
      case 6: return <OnboardingStep6 {...stepProps} />; // Medidas iniciales
      case 7: return <OnboardingStep7 {...stepProps} />; // Preferencias y términos
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-lg space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Paso {currentStep} de {totalSteps}
            </p>
            <p className="text-sm font-medium">{Math.round(progress)}%</p>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="bg-card border rounded-lg p-4 sm:p-6 min-h-[450px] sm:min-h-[500px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>
          
          {currentStep < totalSteps ? (
            <Button onClick={handleNext} className="flex-1">
              Siguiente
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !formData.termsAccepted}
              className="flex-1"
            >
              {loading ? "Guardando..." : "Finalizar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingForm;
