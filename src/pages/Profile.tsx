/**
 * Profile.tsx - Página de perfil de usuario
 * 
 * Este documento gestiona la visualización y edición del perfil del usuario.
 * Se encarga de:
 * - Mostrar y editar datos personales (nombre, género, edad, peso, altura)
 * - Configurar objetivos de fitness y días de entrenamiento
 * - Gestionar la suscripción PRO y mostrar opciones de pago
 * - Validar cambios en el plan de entrenamiento
 * - Actualizar macros nutricionales automáticamente según perfil
 * - Detectar pagos exitosos desde el parámetro URL
 */

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Pencil, Sparkles, Lock } from "lucide-react";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { calculateMacros, validateProfileData } from "@/lib/macrosCalculator";
import { PlanChangePreviewModal } from "@/components/PlanChangePreviewModal";
import { PaymentModal } from "@/components/PaymentModal";
import { PaymentSuccessModal } from "@/components/PaymentSuccessModal";
import { useSearchParams } from "react-router-dom";
import { useValidatePlanChange, useAssignRoutine, useRedistributeWorkouts } from "@/hooks/useBackendApi";
import { useQueryClient } from "@tanstack/react-query";
import { MenstrualTrackingCard } from "@/components/MenstrualTrackingCard";

const Profile = () => {
  // Hook de autenticación para obtener usuario actual
  const { user } = useAuth();
  const { hasProAccess, user: userFlagsData } = useFeatureFlags();
  const sb = supabase as any;
  
  // Estado del perfil y datos del formulario
  const [profile, setProfile] = useState<any>(null);
  // Estados de UI y control
  const [userRole, setUserRole] = useState<string>("user"); // Rol del usuario (user/pro)
  const [loading, setLoading] = useState(false); // Estado de carga
  const [isEditing, setIsEditing] = useState(false); // Modo edición activado
  const [resetOnFirstDayClick, setResetOnFirstDayClick] = useState(false); // Reset de días al primer click
  const [showPreviewModal, setShowPreviewModal] = useState(false); // Modal de vista previa de cambios
  const [paymentModalOpen, setPaymentModalOpen] = useState(false); // Modal de pago abierto
  const [showSuccessModal, setShowSuccessModal] = useState(false); // Modal de éxito en pago
  const [validationData, setValidationData] = useState<any>(null); // Datos de validación de cambios
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null); // Estado de suscripción
  const [searchParams] = useSearchParams(); // Parámetros de URL para detectar pagos
  const [formData, setFormData] = useState({
    full_name: "",
    gender: "femenino",
    fitness_level: "principiante",
    fitness_goal: "mantener_peso",
    weight: "",
    height: "",
    age: "",
    available_days_per_week: "",
    available_weekdays: [] as string[],
    daily_calorie_goal: "",
    daily_protein_goal: "",
    daily_carbs_goal: "",
    daily_fat_goal: "",
  });

  const validateMutation = useValidatePlanChange();
  const assignMutation = useAssignRoutine();
  const redistributeMutation = useRedistributeWorkouts();
  const queryClient = useQueryClient();

  // Bloque de debug logging - Registra el estado del perfil y suscripción
  useEffect(() => {
    console.log('Profile State Debug:', { 
      userRole, 
      subscriptionStatus, 
      isPro: userRole === "pro", 
      isActive: subscriptionStatus === "active",
      showUpgradeButton: userRole !== "pro" && subscriptionStatus !== "active"
    });
  }, [userRole, subscriptionStatus]);

  // Bloque de carga inicial del perfil - Se ejecuta al montar el componente
  // Detecta si el usuario viene desde un pago exitoso o cancelado
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const loadProfile = async () => {
      setLoading(true);
      await fetchProfile();
      
      // Verificar si viene desde redirección de pago
      const paymentStatus = searchParams.get("payment");
      if (paymentStatus === "success") {
        // Implementar polling para verificar cambio de rol PRO
        // El webhook de Stripe puede tardar unos segundos en procesar
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkProStatus = async () => {
          if (!isMounted) return;
          
          attempts++;
          const { data: roleData } = await sb
            .from("user_roles")
            .select("role")
            .eq("user_id", user?.id)
            .maybeSingle();
          
          const { data: subscriptionData } = await sb
            .from("user_subscriptions")
            .select("status")
            .eq("user_id", user?.id)
            .maybeSingle();
          
          if (!isMounted) return;
          
          // Si ya es PRO, mostrar modal de éxito
          if (roleData?.role === "pro" || subscriptionData?.status === "active") {
            setUserRole("pro");
            setSubscriptionStatus("active");
            setShowSuccessModal(true);
            return true;
          }
          
          // Si no es PRO aún y no hemos llegado al máximo de intentos, reintentar
          if (attempts < maxAttempts && isMounted) {
            timeoutId = setTimeout(checkProStatus, 2000); // Reintentar cada 2 segundos
          } else if (isMounted) {
            // Después de 20 segundos, mostrar el modal de todas formas
            // El usuario puede refrescar manualmente si es necesario
            setShowSuccessModal(true);
            toast.info("Actualizando estado de tu cuenta...", {
              description: "Si no ves los cambios, recarga la página"
            });
          }
          return false;
        };
        
        // Iniciar verificación después de 1 segundo
        timeoutId = setTimeout(checkProStatus, 1000);
      } else if (paymentStatus === "canceled") {
        toast.error("Pago cancelado. Puedes intentar de nuevo cuando quieras.");
      }
    };

    loadProfile();
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user, searchParams]);

  // Bloque de suscripción en tiempo real - Escucha cambios en el perfil y roles
  // Se activa cuando el webhook de Stripe actualiza la suscripción y el rol
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-and-roles-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Profile updated:', payload);
          fetchProfile();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE o DELETE
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('User role updated:', payload);
          // Recargar perfil inmediatamente cuando cambia el rol
          fetchProfile();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE o DELETE
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Subscription updated:', payload);
          // Recargar perfil inmediatamente cuando cambia la suscripción
          fetchProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Función para obtener los datos del perfil del usuario desde la base de datos
  // También obtiene el rol del usuario y el estado de su suscripción
  const fetchProfile = async () => {
    if (!user) return;

    try {
      // Obtener datos del perfil
      const { data: profileData, error: profileError } = await sb
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error loading profile:", profileError);
        toast.error("Error al cargar el perfil");
        return;
      }

      // Actualizar estado del perfil y formulario con datos obtenidos
      if (profileData) {
        setProfile(profileData);
        setFormData({
          full_name: profileData.full_name || "",
          gender: profileData.gender || "femenino",
          fitness_level: profileData.fitness_level || "principiante",
          fitness_goal: profileData.fitness_goal || "mantener_peso",
          weight: profileData.weight?.toString() || "",
          height: profileData.height?.toString() || "",
          age: profileData.age?.toString() || "",
          available_days_per_week: profileData.available_days_per_week?.toString() || "",
          available_weekdays: Array.isArray(profileData.available_weekdays)
            ? ([...new Set((profileData.available_weekdays as any[]).map(String))] as string[])
            : [],
          daily_calorie_goal: profileData.daily_calorie_goal?.toString() || "",
          daily_protein_goal: profileData.daily_protein_goal?.toString() || "",
          daily_carbs_goal: profileData.daily_carbs_goal?.toString() || "",
          daily_fat_goal: profileData.daily_fat_goal?.toString() || "",
        });
      }

      // Obtener rol del usuario (user/pro)
      const { data: roleData } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role);
      }

      // Verificar estado de suscripción PRO del usuario
      const { data: subscriptionData } = await sb
        .from("user_subscriptions")
        .select("status, plan")
        .eq("user_id", user.id)
        .maybeSingle();

      if (subscriptionData?.status === "active") {
        setSubscriptionStatus("active");
        setUserRole("pro");
      }
    } catch (error) {
      console.error("Error in fetchProfile:", error);
    } finally {
      setLoading(false);
    }
  };

  // Función para manejar el envío del formulario de perfil
  // Valida si hubo cambios en el objetivo o días de entrenamiento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar si cambiaron campos relacionados con el plan de entrenamiento
    const oldGoal = profile?.fitness_goal;
    const newGoal = formData.fitness_goal;
    const oldWeekdays = profile?.available_weekdays || [];
    const newWeekdays = formData.available_weekdays;

    const goalChanged = oldGoal !== newGoal;
    const weekdaysChanged = oldWeekdays.length !== newWeekdays.length || 
      !oldWeekdays.every((day: string) => newWeekdays.includes(day));

    // Si cambió el objetivo o días, validar primero los cambios
    // Esto previene perder entrenamientos programados sin confirmación
    if (goalChanged || weekdaysChanged) {
      try {
        const validation = await validateMutation.mutateAsync({
          new_weekdays: newWeekdays,
          new_goal: newGoal,
        });

        if (validation.action !== 'none') {
          setValidationData(validation);
          setShowPreviewModal(true);
          return; // Esperar confirmación del usuario
        }
      } catch (error) {
        console.error('Error validating changes:', error);
        toast.error('Error al validar cambios');
        return;
      }
    }

    // Si solo cambiaron los días (sin cambio de objetivo), actualizar y redistribuir
    // Si cambió el objetivo, el modal ya se mostró
    await updateProfile(weekdaysChanged);
  };

  // Función para actualizar el perfil en la base de datos
  // Recalcula macros automáticamente si hay información completa
  const updateProfile = async (weekdaysChanged = false) => {
    setLoading(true);

    // Recalcular macros nutricionales si hay información completa del usuario
    let calculatedMacros = null;
    const profileData = {
      gender: formData.gender,
      age: parseInt(formData.age) || 0,
      weight: parseFloat(formData.weight) || 0,
      height: parseFloat(formData.height) || 0,
      availableDays: parseInt(formData.available_days_per_week) || 0,
      fitnessLevel: formData.fitness_level,
      fitnessGoal: formData.fitness_goal,
    };

    if (validateProfileData(profileData)) {
      calculatedMacros = calculateMacros(profileData);
      console.log("Macros recalculados:", calculatedMacros);
    }

    const { error } = await sb
      .from("profiles")
      .update({
        full_name: formData.full_name,
        gender: formData.gender,
        fitness_level: formData.fitness_level as "principiante" | "intermedio" | "avanzado",
        fitness_goal: formData.fitness_goal as "bajar_peso" | "aumentar_masa" | "mantener_peso" | "tonificar" | "mejorar_resistencia" | "ganar_masa" | "bajar_grasa" | "rendimiento",
        weight: parseFloat(formData.weight) || null,
        height: parseFloat(formData.height) || null,
        age: parseInt(formData.age) || null,
        available_days_per_week: formData.available_weekdays.length || null,
        available_weekdays: (formData.available_weekdays.length > 0 ? [...new Set(formData.available_weekdays)] : null) as any,
        daily_calorie_goal: calculatedMacros?.dailyCalories || parseInt(formData.daily_calorie_goal) || 2000,
        daily_protein_goal: calculatedMacros?.protein || parseInt(formData.daily_protein_goal) || 150,
        daily_carbs_goal: calculatedMacros?.carbs || parseInt(formData.daily_carbs_goal) || 200,
        daily_fat_goal: calculatedMacros?.fat || parseInt(formData.daily_fat_goal) || 50,
      })
      .eq("id", user?.id);

    if (error) {
      setLoading(false);
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar perfil: " + error.message);
      return;
    }

    // Si cambiaron los días de entrenamiento, redistribuir automáticamente
    if (weekdaysChanged) {
      await redistributeWorkoutsIfNeeded(true);
    }

    setLoading(false);
    if (calculatedMacros) {
      toast.success("Perfil y macros actualizados correctamente");
    } else {
      toast.success("Perfil actualizado correctamente");
    }
    setIsEditing(false);
    fetchProfile();
  };

  const handleConfirmPlanChange = async () => {
    if (!validationData) return;

    setLoading(true);
    try {
      // First update the profile
      await updateProfile();

      // Then execute the plan changes
      if (validationData.needsReassign) {
        toast.info('Reasignando plan de entrenamiento...');
        await assignMutation.mutateAsync();
      } else if (validationData.needsRedistribute) {
        toast.info('Redistribuyendo entrenamientos...');
        await redistributeMutation.mutateAsync({});
      }

      // Invalidate all related queries to refresh data across the app
      await queryClient.invalidateQueries({ queryKey: ['user-routine'] });
      await queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
      await queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['progress-stats'] });

      toast.success('Plan actualizado exitosamente');
      setShowPreviewModal(false);
      setValidationData(null);
      
      // Refetch profile
      fetchProfile();
    } catch (error) {
      console.error('Error applying plan changes:', error);
      toast.error('Error al aplicar cambios al plan');
    } finally {
      setLoading(false);
    }
  };

  // New function to handle redistribution when days change
  const redistributeWorkoutsIfNeeded = async (weekdaysChanged: boolean) => {
    if (!weekdaysChanged) return;

    try {
      toast.info('Actualizando entrenamientos...');
      await redistributeMutation.mutateAsync({});
      
      // Invalidate all related queries
      await queryClient.invalidateQueries({ queryKey: ['user-routine'] });
      await queryClient.invalidateQueries({ queryKey: ['todays-workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['workouts-by-date'] });
      await queryClient.invalidateQueries({ queryKey: ['all-workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['progress-stats'] });
    } catch (error) {
      console.error('Error redistributing workouts:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-14 sm:pt-16 pb-16 sm:pb-20 px-3 sm:px-4 overflow-x-hidden">
        <div className="max-w-4xl mx-auto space-y-2 sm:space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">Mi Perfil</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Configura tus datos personales y objetivos
            </p>
          </div>

           <Card className="p-3 sm:p-4 shadow-card bg-gradient-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base sm:text-lg font-semibold">Plan Actual</h3>
                <p className="text-sm text-muted-foreground">
                  {user?.email}
                </p>
              </div>
              <Badge 
                variant={hasProAccess || userRole === "pro" || subscriptionStatus === "active" ? "default" : "secondary"} 
                className="text-lg px-4 py-2 gap-1"
              >
                {userFlagsData.devMode ? (
                  <><Sparkles className="w-4 h-4" /> DEV PRO</>
                ) : hasProAccess || userRole === "pro" || subscriptionStatus === "active" ? (
                  "PRO"
                ) : (
                  "Básico"
                )}
              </Badge>
            </div>
            
            {userFlagsData.devMode ? (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm font-medium mb-1 text-yellow-600 dark:text-yellow-400">
                  🔧 Modo Desarrollo Activo
                </p>
                <p className="text-xs text-muted-foreground">
                  Todas las funciones PRO están desbloqueadas temporalmente para pruebas
                </p>
              </div>
            ) : (userRole !== "pro" && subscriptionStatus !== "active" && !hasProAccess) ? (
              <div className="mt-4 space-y-3">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium mb-2">
                    🌟 Actualiza a PRO y desbloquea
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Chat con entrenador IA personalizado</li>
                    <li>• Análisis avanzado con inteligencia artificial</li>
                    <li>• Integración con apps de ciclo menstrual</li>
                    <li>• Planes de entrenamiento premium</li>
                    <li>• Estadísticas y gráficos detallados</li>
                  </ul>
                </div>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => {
                    console.log('Opening payment modal');
                    setPaymentModalOpen(true);
                  }}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Actualizar a PRO - $4.99/mes
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  Cancela cuando quieras • Pago seguro con Stripe
                </p>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium mb-1">
                  ✨ Eres miembro PRO
                </p>
                <p className="text-xs text-muted-foreground">
                  Disfruta de todas las funciones premium sin límites
                </p>
              </div>
            )}
          </Card>

          {/* Menstrual Tracking - Solo visible para mujeres PRO */}
          {(hasProAccess || userRole === "pro" || subscriptionStatus === "active") && 
           formData.gender === "femenino" && (
            <MenstrualTrackingCard />
          )}

          <Card className="p-3 sm:p-4 shadow-card">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Información Personal</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsEditing(true); setResetOnFirstDayClick(true); }}
                  disabled={isEditing}
                >
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  disabled={!isEditing}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sexo Biológico</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: value })
                    }
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tu sexo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Días de Entrenamiento</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Selecciona los días que deseas entrenar
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'L', label: 'Lunes' },
                    { value: 'M', label: 'Martes' },
                    { value: 'Mi', label: 'Miércoles' },
                    { value: 'J', label: 'Jueves' },
                    { value: 'V', label: 'Viernes' },
                    { value: 'S', label: 'Sábado' },
                    { value: 'D', label: 'Domingo' },
                  ].map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={formData.available_weekdays.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (!isEditing) return;
                        let newDays: string[];
                        if (resetOnFirstDayClick) {
                          newDays = [day.value];
                          setResetOnFirstDayClick(false);
                        } else {
                          const currentDays = [...formData.available_weekdays];
                          newDays = currentDays.includes(day.value)
                            ? currentDays.filter(d => d !== day.value)
                            : [...currentDays, day.value];
                        }
                        const uniqueDays = [...new Set(newDays)];
                        // Auto-update available_days_per_week based on selected days
                        setFormData({ 
                          ...formData, 
                          available_weekdays: uniqueDays,
                          available_days_per_week: uniqueDays.length.toString()
                        });
                      }}
                      disabled={!isEditing}
                      className="min-w-[80px]"
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                {formData.available_weekdays.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {formData.available_weekdays.length} {formData.available_weekdays.length === 1 ? 'día seleccionado' : 'días seleccionados'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nivel de Fitness</Label>
                  <Select
                    value={formData.fitness_level}
                    onValueChange={(value) =>
                      setFormData({ ...formData, fitness_level: value })
                    }
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tu nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="principiante">Principiante</SelectItem>
                      <SelectItem value="intermedio">Intermedio</SelectItem>
                      <SelectItem value="avanzado">Avanzado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select
                    value={formData.fitness_goal}
                    onValueChange={(value) =>
                      setFormData({ ...formData, fitness_goal: value })
                    }
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tu objetivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bajar_peso">Bajar de peso</SelectItem>
                      <SelectItem value="aumentar_masa">Aumentar masa muscular</SelectItem>
                      <SelectItem value="mantener_peso">Mantener peso</SelectItem>
                      <SelectItem value="tonificar">Tonificar</SelectItem>
                      <SelectItem value="mejorar_resistencia">Mejorar resistencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Peso (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Altura (cm)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Edad</Label>
                  <Input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">Metas Nutricionales Diarias</h4>
                  <Badge variant="secondary" className="text-xs">Calculado automáticamente</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Estos valores se calculan automáticamente según tu perfil (edad, peso, altura, días de entrenamiento, nivel y objetivo).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Calorías (kcal)</Label>
                    <Input
                      type="number"
                      value={formData.daily_calorie_goal}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Proteína (g)</Label>
                    <Input
                      type="number"
                      value={formData.daily_protein_goal}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Carbohidratos (g)</Label>
                    <Input
                      type="number"
                      value={formData.daily_carbs_goal}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grasas (g)</Label>
                    <Input
                      type="number"
                      value={formData.daily_fat_goal}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={!isEditing || loading}>
                {loading ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <PlanChangePreviewModal
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        onConfirm={handleConfirmPlanChange}
        validationData={validationData}
        isLoading={loading}
      />

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
      />

      <PaymentSuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
      />
    </div>
  );
};

export default Profile;
