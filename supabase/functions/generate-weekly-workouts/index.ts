// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeo de días: 1=Lunes, 7=Domingo
const dayMap: Record<string, number> = {
  'L': 1, 'M': 2, 'Mi': 3, 'J': 4, 'V': 5, 'S': 6, 'D': 7,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
};

const dayNames: Record<string, string> = {
  'L': 'Lunes', 'M': 'Martes', 'Mi': 'Miércoles', 'J': 'Jueves',
  'V': 'Viernes', 'S': 'Sábado', 'D': 'Domingo',
  '1': 'Lunes', '2': 'Martes', '3': 'Miércoles', '4': 'Jueves',
  '5': 'Viernes', '6': 'Sábado', '7': 'Domingo',
};

interface PlanScore {
  plan: unknown;
  score: number;
}

interface UserHealthContext {
  isPro: boolean;
  menstrualPhase: string | null;
  activeInjuries: string[] | null;
  fatigueLevel: number | null;
  fitnessLevel: string;
  fitnessGoal: string;
}

// =============================================
// PLACEHOLDER PARA LÓGICA DE IA (USUARIOS PRO)
// =============================================
async function generateProWorkoutsWithAI(
  supabase: unknown,
  userId: string,
  profile: unknown,
  healthContext: UserHealthContext,
  selectedDays: string[]
): Promise<{ workouts: Record<string, unknown>[]; aiGenerated: boolean; aiMessage: string }> {
  /**
   * TODO: Implementar lógica de IA para usuarios PRO
   * 
   * Este placeholder será reemplazado con:
   * 1. Llamada a Lovable AI para generar entrenamientos personalizados
   * 2. Consideración de fase menstrual para ajustar intensidad
   * 3. Exclusión de ejercicios que afecten lesiones activas
   * 4. Ajuste de volumen según nivel de fatiga
   * 5. Variación inteligente de ejercicios basada en historial
   * 
   * Contexto disponible para IA:
   * - healthContext.menstrualPhase: 'menstrual' | 'folicular' | 'ovulacion' | 'lutea' | null
   * - healthContext.activeInjuries: ['rodilla', 'espalda baja', etc.]
   * - healthContext.fatigueLevel: 1-10
   * - healthContext.fitnessLevel: 'principiante' | 'intermedio' | 'avanzado'
   * - healthContext.fitnessGoal: objetivo del usuario
   * - profile: perfil completo del usuario
   */
  
  console.log('🤖 [PRO] AI Workout Generation - PLACEHOLDER');
  console.log('📊 Health Context for AI:', JSON.stringify(healthContext, null, 2));
  
  // Por ahora, retornamos null para que use la lógica estándar
  // Cuando se implemente la IA, este return cambiará
  return {
    workouts: [],
    aiGenerated: false,
    aiMessage: 'AI generation placeholder - using standard logic for now'
  };
}

// =============================================
// FUNCIÓN PRINCIPAL
// =============================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating weekly workouts for user ${user.id}`);

    // =============================================
    // PASO 1: Verificar si el usuario es PRO
    // =============================================
    const { data: proCheck } = await supabase.rpc('is_user_pro', { _user_id: user.id });
    const isPro = proCheck === true;
    console.log(`👤 User type: ${isPro ? 'PRO' : 'FREE'}`);

    // =============================================
    // PASO 2: Obtener perfil del usuario
    // =============================================
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const selectedDays = profile.available_weekdays as string[] || [];
    if (selectedDays.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No training days configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =============================================
    // PASO 3: Obtener contexto de salud (solo PRO)
    // =============================================
    let menstrualPhase: string | null = null;
    
    if (isPro && profile.menstrual_tracking_enabled) {
      // Calcular fase menstrual usando la función de BD
      const { data: phaseData } = await supabase.rpc('calculate_menstrual_phase', { _user_id: user.id });
      menstrualPhase = phaseData;
      
      // Actualizar fase en el perfil para acceso rápido
      if (menstrualPhase) {
        await supabase
          .from('profiles')
          .update({ fase_menstrual_actual: menstrualPhase })
          .eq('id', user.id);
      }
    }

    const healthContext: UserHealthContext = {
      isPro,
      menstrualPhase,
      activeInjuries: profile.lesiones_activas || null,
      fatigueLevel: profile.nivel_fatiga || null,
      fitnessLevel: profile.fitness_level,
      fitnessGoal: profile.fitness_goal
    };

    console.log('📊 Health context:', JSON.stringify(healthContext, null, 2));
    console.log('User profile:', {
      goal: profile.fitness_goal,
      level: profile.fitness_level,
      days: selectedDays,
      current_plan: profile.assigned_routine_id,
      isPro,
      menstrualPhase
    });

    // =============================================
    // PASO 4: Generar entrenamientos según tipo de usuario
    // =============================================
    let aiResult = { workouts: [], aiGenerated: false, aiMessage: '' };
    
    if (isPro) {
      // Intentar generar con IA para usuarios PRO
      aiResult = await generateProWorkoutsWithAI(
        supabase,
        user.id,
        profile,
        healthContext,
        selectedDays
      );
      
      if (aiResult.aiGenerated && aiResult.workouts.length > 0) {
        console.log('✅ Using AI-generated workouts for PRO user');
        // TODO: Insertar entrenamientos generados por IA
        // Por ahora, continuamos con la lógica estándar
      }
    }

    // =============================================
    // PASO 5: Lógica estándar (FREE y fallback PRO)
    // =============================================
    console.log(`📋 Using standard plan logic (${isPro ? 'PRO fallback' : 'FREE user'})`);

    // Calculate week boundaries in local timezone
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDayOfWeek = today.getDay();
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // If no plan assigned or request to reassign, score and select best plan
    let planId = profile.assigned_routine_id;
    let needsReassign = false;
    
    const { reassign } = await req.json().catch(() => ({ reassign: false }));
    
    if (!planId || reassign) {
      console.log('Selecting optimal plan...');
      needsReassign = true;

      const { data: plans, error: plansError } = await supabase
        .from('predesigned_plans')
        .select('*');

      if (plansError || !plans || plans.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No plans available' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizeGoal = (goal: string | null | undefined): string => {
        if (!goal) return '';
        return goal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').trim();
      };

      const goalMapping: Record<string, string[]> = {
        ganar_masa: ['ganar_masa', 'fuerza', 'aumentar_masa'],
        bajar_peso: ['perder_grasa', 'tonificar', 'bajar_grasa', 'definir'],
        perder_peso: ['perder_grasa', 'tonificar', 'bajar_grasa', 'definir'],
        bajar_grasa: ['perder_grasa', 'tonificar', 'definir'],
        mantener_peso: ['mantener_peso', 'mantener', 'tonificar'],
        tonificar: ['tonificar', 'definir', 'perder_grasa'],
      };

      const levelMapping: Record<string, string> = {
        principiante: 'B',
        intermedio: 'I',
        avanzado: 'P'
      };

      const userLevelCode = levelMapping[profile.fitness_level] || 'B';
      const userPrimaryGoal = profile.fitness_goal;
      const equivalentGoals = goalMapping[userPrimaryGoal] || [userPrimaryGoal];

      const scoredPlans: PlanScore[] = plans.map(plan => {
        let score = 0;
        const planGoals = plan.objetivo ? plan.objetivo.split(',').map((g: string) => normalizeGoal(g)).filter(g => g) : [];
        
        if (planGoals.some(pg => equivalentGoals.includes(pg))) score += 70;
        if (plan.nivel === userLevelCode) score += 30;
        if (profile.available_days_per_week >= plan.dias_semana) {
          score += Math.max(0, 20 - Math.abs(profile.available_days_per_week - plan.dias_semana) * 3);
        } else {
          score -= 30;
        }
        
        return { plan, score };
      });

      scoredPlans.sort((a, b) => b.score - a.score);
      const selectedPlan = scoredPlans[0].plan;
      planId = selectedPlan.id;

      console.log(`Selected plan: ${selectedPlan.nombre_plan} (score: ${scoredPlans[0].score})`);

      // Update profile with new plan
      await supabase
        .from('profiles')
        .update({ assigned_routine_id: planId })
        .eq('id', user.id);
    }

    // Fetch plan exercises
    const { data: planExercises, error: planExercisesError } = await supabase
      .from('plan_ejercicios')
      .select('*, exercises:ejercicio_id (*)')
      .eq('plan_id', planId)
      .order('dia', { ascending: true })
      .order('orden', { ascending: true });

    if (planExercisesError || !planExercises || planExercises.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No exercises found for plan' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group exercises by day, removing duplicates
    const exercisesByDay: { [key: number]: Record<string, unknown>[] } = {};
    planExercises.forEach((pe: unknown) => {
      if (!exercisesByDay[pe.dia]) {
        exercisesByDay[pe.dia] = [];
      }
      const alreadyExists = exercisesByDay[pe.dia].some(
        (existing: unknown) => existing.ejercicio_id === pe.ejercicio_id
      );
      if (!alreadyExists) {
        exercisesByDay[pe.dia].push(pe);
      }
    });

    const planDays = Object.keys(exercisesByDay).map(Number).sort((a, b) => a - b);
    console.log(`Plan has ${planExercises.length} exercises across ${planDays.length} days`);

    // Delete ALL existing automatic workouts to ensure clean state
    console.log('Deleting all automatic workouts for clean regeneration');
    const { data: deletedWorkouts, error: deleteError } = await supabase
      .from('workouts')
      .delete()
      .eq('user_id', user.id)
      .eq('tipo', 'automatico')
      .select('id');
    
    const deletedCount = deletedWorkouts?.length || 0;
    console.log(`Successfully deleted ${deletedCount} automatic workouts`);
    
    if (deleteError) {
      console.error('Error deleting workouts:', deleteError);
    }

    // Get plan metadata
    const { data: planData } = await supabase
      .from('predesigned_plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();

    const normalizeLocation = (lugar: string | null | undefined): 'casa' | 'gimnasio' | 'exterior' => {
      const normalized = lugar?.toLowerCase() || 'casa';
      if (normalized.includes('casa')) return 'casa';
      if (normalized.includes('gimnasio') || normalized.includes('gym')) return 'gimnasio';
      if (normalized.includes('exterior') || normalized.includes('parque')) return 'exterior';
      return 'casa';
    };

    // Generate permanent workouts based on weekday (not specific dates)
    const workoutsToCreate = [];
    selectedDays.forEach((dayCode, index) => {
      const weekday = dayMap[dayCode];
      if (!weekday) {
        console.warn(`Unknown day code: ${dayCode}`);
        return;
      }

      const dayNameMapping: Record<number, string> = {
        1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
        5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
      };
      const dayName = dayNameMapping[weekday];
      
      console.log(`Generando workout permanente: dayCode=${dayCode}, weekday=${weekday}, nombre=${dayName}`);
      
      const planDayIndex = index % planDays.length;
      const planDay = planDays[planDayIndex];
      const dayExercises = exercisesByDay[planDay];

      if (!dayExercises || dayExercises.length === 0) return;

      const estimatedCalories = dayExercises.reduce((total: number, pe: unknown) => {
        const exercise = pe.exercises;
        if (!exercise) return total;
        const caloriesPerRep = exercise.calorias_por_repeticion || 0;
        const reps = exercise.repeticiones_sugeridas || 10;
        const sets = exercise.series_sugeridas || 3;
        return total + (caloriesPerRep * reps * sets);
      }, 0);

      const muscleGroup = dayExercises[0]?.exercises?.grupo_muscular || 'General';

      workoutsToCreate.push({
        user_id: user.id,
        name: `${planData?.nombre_plan || 'Entrenamiento'} - ${dayName}`,
        description: `${muscleGroup} - ${planData?.descripcion_plan || 'Plan personalizado'}`,
        scheduled_date: today.toISOString().split('T')[0],
        weekday: weekday,
        plan_id: planId,
        location: normalizeLocation(planData?.lugar),
        duration_minutes: dayExercises.length * 5,
        estimated_calories: Math.round(estimatedCalories),
        completed: false,
        tipo: 'automatico',
        exercises: dayExercises,
      });
    });

    console.log(`Creating ${workoutsToCreate.length} workouts`);

    // Insert workouts
    const createdWorkouts = [];
    for (const workoutData of workoutsToCreate) {
      const { exercises, ...workoutInsertData } = workoutData;

      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert(workoutInsertData)
        .select()
        .single();

      if (workoutError) {
        console.error('Error creating workout:', workoutError);
        continue;
      }

      if (exercises && exercises.length > 0) {
        const uniqueExercises = exercises.filter((pe: unknown, index: number, self: Record<string, unknown>[]) => 
          self.findIndex((t: unknown) => t.ejercicio_id === pe.ejercicio_id) === index
        );

        const workoutExercises = uniqueExercises
          .filter((pe: unknown) => pe.exercises && pe.exercises.nombre)
          .map((pe: unknown) => {
            const exercise = pe.exercises;
            return {
              workout_id: workout.id,
              name: exercise.nombre,
              sets: exercise.series_sugeridas || 3,
              reps: exercise.repeticiones_sugeridas || 10,
              notes: `${exercise.grupo_muscular || 'General'} - ${exercise.nivel || 'B'}`,
              duration_minutes: exercise.duracion_promedio_segundos ? Math.ceil(exercise.duracion_promedio_segundos / 60) : null,
            };
          });

        if (workoutExercises.length > 0) {
          await supabase.from('workout_exercises').insert(workoutExercises);
        }
      }

      createdWorkouts.push(workout);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: needsReassign ? 'Plan asignado y entrenamientos permanentes creados' : 'Entrenamientos redistribuidos',
        plan_id: planId,
        plan_name: planData?.nombre_plan,
        workouts_created: createdWorkouts.length,
        workouts_deleted: deletedCount,
        training_days: selectedDays,
        user_type: isPro ? 'PRO' : 'FREE',
        health_context: isPro ? healthContext : null,
        ai_generated: aiResult.aiGenerated,
        note: 'Los entrenamientos son permanentes y se repiten cada semana',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-weekly-workouts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
