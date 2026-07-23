/**
 * OnboardingForm.tsx - Formulario principal de onboarding
 * 
 * Este componente orquesta todo el proceso de registro y configuraciÃ³n inicial del usuario.
 * Se encarga de:
 * - Gestionar 7 pasos de onboarding con validaciÃ³n en cada paso
 * - Verificar si el usuario ya completÃ³ onboarding (redirigir a dashboard)
 * - Verificar si hay registro pendiente en sessionStorage
 * - Calcular macros automÃ¡ticamente basados en datos del perfil
 * - Crear cuenta de usuario en Supabase Auth
 * - Crear perfil completo en base de datos
 * - Asignar rutina automÃ¡tica al finalizar
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
import { getSpanishAuthErrorMessage } from "@/lib/authErrors";

const OnboardingForm = () => {
  const navigate = useNavigate();
  // Estado del paso actual (1-7)
  const [currentStep, setCurrentStep] = useState(1);
  // Estado de carga durante envÃ­o del formulario
  const [loading, setLoading] = useState(false);
  // Estado de verificaciÃ³n inicial del perfil
  const [checkingProfile, setCheckingProfile] = useState(true);
  // Datos acumulados del formulario de onboarding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<any>({});
  const sb = supabase;

  const getPendingOnboardingName = () => {
    try {
      const pendingProfile = sessionStorage.getItem("pendingOnboardingProfile");
      return pendingProfile ? (JSON.parse(pendingProfile)?.fullName as string | undefined) : undefined;
    } catch {
      sessionStorage.removeItem("pendingOnboardingProfile");
      return undefined;
    }
  };

  const totalSteps = 7; // Total de pasos en el proceso
  const progress = (currentStep / totalSteps) * 100; // Porcentaje de progreso

  // Bloque de verificaciÃ³n inicial - Verifica estado de onboarding o registro pendiente
  // Evita que usuarios autenticados que ya completaron onboarding vuelvan aquÃ­
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        // Verificar si hay usuario autenticado
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const pendingFullName = getPendingOnboardingName();
          const metadataFullName = user.user_metadata?.full_name as string | undefined;
          const initialFullName = pendingFullName || metadataFullName;
          if (initialFullName) {
            setFormData((prev: any) => ({ ...prev, fullName: prev.fullName || initialFullName }));
          }

          // Usuario ya autenticado, verificar onboarding
          const { data: profile } = await sb
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.onboarding_completed) {
            // Ya completÃ³ onboarding, ir a dashboard
            navigate("/dashboard", { replace: true });
            return;
          }
          // Si no completÃ³ onboarding, permitir continuar (usuario autenticado sin perfil completo)
          setCheckingProfile(false);
          return;
        }
        
        toast.error("Inicia sesiÃ³n para completar tu perfil.");
        navigate("/auth", { replace: true });
        return;
      } catch (error: unknown) {
        console.error("Error checking onboarding status:", error);
        toast.error("Error al verificar tu registro. Por favor vuelve a intentarlo.");
        navigate("/auth", { replace: true });
        setCheckingProfile(false);
      }
    };

    checkOnboardingStatus();
  }, [navigate, sb]);

  // Bloque de prevenciÃ³n de cierre - Evita que el usuario pierda su progreso
  // Muestra advertencias si intenta cerrar la ventana durante el registro
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentStep > 0) {
        e.preventDefault();
        e.returnValue = "Â¿EstÃ¡s segura de salir? PerderÃ¡s tu progreso y deberÃ¡s registrarte nuevamente.";
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && currentStep > 0 && currentStep < totalSteps) {
        toast.warning("âš ï¸ No cierres la app hasta completar tu registro");
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

  // FunciÃ³n helper para actualizar datos del formulario de forma incremental
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateFormData = (data: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFormData((prev: any) => ({ ...prev, ...data }));
  };

  // FunciÃ³n de validaciÃ³n por paso - Verifica que cada paso tenga datos completos
  // Retorna true si el paso actual estÃ¡ validado correctamente
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
          toast.error("Por favor indica cuÃ¡ntos dÃ­as por semana puedes entrenar");
          return false;
        }
        if (!formData.sessionDuration) {
          toast.error("Por favor indica la duraciÃ³n de tus sesiones");
          return false;
        }
        if (!formData.availableWeekdays || formData.availableWeekdays.length === 0) {
          toast.error("Por favor selecciona los dÃ­as especÃ­ficos disponibles para entrenar");
          return false;
        }
        if (formData.availableWeekdays.length < formData.availableDays) {
          toast.error(`Debes seleccionar al menos ${formData.availableDays} dÃ­as especÃ­ficos`);
          return false;
        }
        break;
      case 3:
        if (!formData.healthConditions || formData.healthConditions.length === 0) {
          toast.error("Por favor selecciona al menos una opciÃ³n en condiciones de salud");
          return false;
        }
        break;
      case 5:
        if (!formData.dietaryPreferences || formData.dietaryPreferences.length === 0) {
          toast.error("Por favor selecciona al menos una preferencia alimenticia");
          return false;
        }
        if (!formData.sleepHours) {
          toast.error("Por favor indica tus horas de sueÃ±o promedio");
          return false;
        }
        if (!formData.stressLevel) {
          toast.error("Por favor indica tu nivel de estrÃ©s percibido");
          return false;
        }
        break;
      case 7:
        if (!formData.termsAccepted) {
          toast.error("Debes aceptar los tÃ©rminos y condiciones para continuar");
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

  // FunciÃ³n principal de envÃ­o - Ejecuta todo el proceso de creaciÃ³n de cuenta
  // Incluye: crear usuario, calcular macros, crear perfil, asignar rutina
  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    setLoading(true);
    try {
      // PASO 1: Verificar si hay un usuario ya autenticado
      const { data: { user: existingUser } } = await supabase.auth.getUser();

      if (!existingUser) {
        toast.error("Tu sesion expiro. Inicia sesion para completar tu perfil.");
        navigate("/auth", { replace: true });
        return;
      }

      const userId = existingUser.id;
      const userFullName =
        formData.fullName ||
        existingUser.user_metadata?.full_name ||
        existingUser.email?.split("@")[0] ||
        "Usuario";

      // PASO 2: Calcular macros automÃ¡ticamente basados en el perfil
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
          // Asignar los macros calculados automÃ¡ticamente
          daily_calorie_goal: calculatedMacros?.dailyCalories || 2000,
          daily_protein_goal: calculatedMacros?.protein || 150,
          daily_carbs_goal: calculatedMacros?.carbs || 200,
          daily_fat_goal: calculatedMacros?.fat || 50,
          routine_assignment_status: "pending",
          routine_assignment_error: null,
          onboarding_completed: false // SerÃ¡ completado por la funciÃ³n de backend
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
        // Ignorar error si el rol ya existe (cÃ³digo 23505 es violaciÃ³n de unique constraint)
        if (roleError.code !== '23505') {
          console.error("Error al crear rol de usuario:", roleError);
          throw roleError;
        }
      }

      // Limpiar datos temporales de onboarding
      sessionStorage.removeItem("pendingOnboardingProfile");
      sessionStorage.removeItem("pendingRegistration");

      // PASO 5: Asignar rutina automÃ¡ticamente basada en el perfil
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No se encontrÃ³ una sesiÃ³n autenticada para asignar la rutina.");

        const { data: routineData, error: routineError } = await supabase.functions.invoke('assign-routine', {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (routineError) {
          console.error("Error al asignar rutina:", routineError);
          toast.warning("Cuenta creada, pero hubo un error al asignar tu rutina. Puedes asignarla despuÃ©s desde el dashboard.");
        } else if (routineData?.success === false || routineData?.status === "failed") {
          console.warn("Routine assignment failed:", routineData);
          toast.warning(
            routineData?.error ||
              "Cuenta creada, pero no pudimos asignar tu rutina. PodrÃ¡s reintentarlo desde el dashboard.",
          );
        } else {
          toast.success(`Â¡Cuenta creada! Se te asignÃ³ el plan: ${routineData.plan?.nombre_plan || 'personalizado'} ðŸŽ‰`);
        }
      } catch (error) {
        console.error("Error al llamar a la funciÃ³n de asignar rutina:", error);
        toast.warning("Cuenta creada exitosamente. Puedes configurar tu rutina desde el dashboard.");
      }

      navigate("/dashboard");
    } catch (error: unknown) {
      console.error("Error en handleSubmit:", error);
      
      const err = error as Error & { code?: string };
      // Determinar el mensaje de error especÃ­fico
      let errorMessage = getSpanishAuthErrorMessage(error, "Hubo un error al completar tu registro.");
      
      if (err?.message?.includes("already registered") || err?.message?.includes("User already registered")) {
        errorMessage = "Este correo ya estÃ¡ registrado. SerÃ¡s redirigida a la pÃ¡gina de inicio de sesiÃ³n";
      } else if (err?.message?.includes("Invalid email")) {
        errorMessage = "El formato del correo electrÃ³nico no es vÃ¡lido";
      } else if (err?.message?.includes("Password")) {
        errorMessage = "La contraseÃ±a no cumple con los requisitos mÃ­nimos";
      } else if (err?.code === "23505") {
        errorMessage = "Este usuario ya existe en el sistema";
      } else if (err?.message?.includes("profiles")) {
        errorMessage = "Error al crear tu perfil. Verifica que todos los datos sean correctos";
      } else if (err?.message?.includes("permission denied") || err?.message?.includes("RLS")) {
        errorMessage = "Error de permisos al crear tu cuenta. Por favor, intenta nuevamente";
      }
      
      toast.error(errorMessage);
      
      // Limpiar datos temporales
      sessionStorage.removeItem("pendingOnboardingProfile");
      sessionStorage.removeItem("pendingRegistration");
      
      // Redirigir a la pÃ¡gina de autenticaciÃ³n
      setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  // FunciÃ³n para renderizar el paso actual - Switch entre los 7 componentes
  const renderStep = () => {
    const stepProps = { formData, updateFormData };
    
    switch (currentStep) {
      case 1: return <OnboardingStep1 {...stepProps} />; // Datos personales
      case 2: return <OnboardingStep2 {...stepProps} />; // Objetivos y nivel
      case 3: return <OnboardingStep3 {...stepProps} />; // Salud y condiciones
      case 4: return <OnboardingStep4 {...stepProps} />; // Ciclo menstrual (opcional)
      case 5: return <OnboardingStep5 {...stepProps} />; // NutriciÃ³n y hÃ¡bitos
      case 6: return <OnboardingStep6 {...stepProps} />; // Medidas iniciales
      case 7: return <OnboardingStep7 {...stepProps} />; // Preferencias y tÃ©rminos
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
