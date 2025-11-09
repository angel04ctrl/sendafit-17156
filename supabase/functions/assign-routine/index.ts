// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanScore {
  plan: any;
  score: number;
}

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

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Assigning routine for user ${user.id}`);

    // Get current date for generating weekly workouts
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday of current week
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);

    // Get user profile
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

    console.log('User profile:', { 
      fitness_goal: profile.fitness_goal, 
      fitness_level: profile.fitness_level,
      available_days: profile.available_days_per_week,
      available_weekdays: profile.available_weekdays,
      training_types: profile.training_types
    });

    // Delete existing future automatic workouts (allows plan reassignment)
    const { error: deleteError } = await supabase
      .from('workouts')
      .delete()
      .eq('user_id', user.id)
      .eq('tipo', 'automatico')
      .eq('completed', false)
      .gte('scheduled_date', new Date().toISOString().split('T')[0]);

    if (deleteError) {
      console.error('Error deleting old workouts:', deleteError);
    } else {
      console.log('Deleted old automatic workouts for plan reassignment');
    }

    // Get all available predesigned plans
    const { data: plans, error: plansError } = await supabase
      .from('predesigned_plans')
      .select('*');

    if (plansError || !plans || plans.length === 0) {
      console.error('Error fetching plans:', plansError);
      return new Response(
        JSON.stringify({ error: 'No predesigned plans available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${plans.length} predesigned plans`);

    // --- Scoring Mappings ---
    // Normalize goal strings to match between DB and profile formats
    const normalizeGoal = (goal: string | null | undefined): string => {
      if (!goal) return '';
      return goal
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, '_')
        .trim();
    };

    // Normalizar el valor de location al enum correcto (casa, gimnasio, exterior)
    const normalizeLocation = (lugar: string | null | undefined): 'casa' | 'gimnasio' | 'exterior' => {
      const normalized = lugar?.toLowerCase() || 'casa';
      if (normalized.includes('casa')) return 'casa';
      if (normalized.includes('gimnasio') || normalized.includes('gym')) return 'gimnasio';
      if (normalized.includes('exterior') || normalized.includes('parque')) return 'exterior';
      return 'casa'; // default
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

    // Validate user level
    const userLevelCode = levelMapping[profile.fitness_level];
    if (!userLevelCode) {
      console.warn(`Unknown fitness level: ${profile.fitness_level}, defaulting to principiante`);
    }

    // Score each plan based on user profile
    const scoredPlans: PlanScore[] = plans.map(plan => {
      let score = 0;
      
      // 1. Match fitness goal (highest priority)
      const userPrimaryGoal = profile.fitness_goal;
      const equivalentGoals = goalMapping[userPrimaryGoal] || [userPrimaryGoal];
      
      // Normalize plan objectives (e.g., "Ganar Masa, Perder Grasa" -> ["ganar_masa", "perder_grasa"])
      const planGoals = plan.objetivo
        ? plan.objetivo.split(',').map((g: string) => normalizeGoal(g)).filter(g => g)
        : [];

      // Check for exact match with primary goal
      const hasExactGoalMatch = planGoals.some(pg => equivalentGoals.includes(pg));
      const hasSecondaryGoalMatch = equivalentGoals.length > 1 
        ? planGoals.some(pg => equivalentGoals.slice(1).includes(pg))
        : false;
      
      if (hasExactGoalMatch) {
        score += 70; // Perfect match on primary goal
      } else if (hasSecondaryGoalMatch) {
        score += 50; // Match on secondary equivalent goal
      }

      // 2. Match fitness level (very important)
      const hasLevelMatch = plan.nivel === userLevelCode;
      const hasProgressionMatch = (userLevelCode === 'B' && plan.nivel === 'I') || 
                                    (userLevelCode === 'I' && plan.nivel === 'P');
      if (hasLevelMatch) {
        score += 30;
      } else if (hasProgressionMatch) {
        score += 15; // Slightly higher level for progression
      }

      // 3. Match days per week availability
      if (profile.available_days_per_week >= plan.dias_semana) {
        const daysDiff = Math.abs(profile.available_days_per_week - plan.dias_semana);
        score += Math.max(0, 20 - daysDiff * 3);
      } else {
        score -= 30; // Penalize heavily if the plan requires more days than available
      }
      
      // 4. Match training location preference
      let userTrainingTypes = profile.training_types;
      if (userTrainingTypes && typeof userTrainingTypes === 'string') {
        try {
          userTrainingTypes = JSON.parse(userTrainingTypes);
        } catch (e) {
          userTrainingTypes = [userTrainingTypes];
        }
      }
      
      const hasLocationMatch = userTrainingTypes && Array.isArray(userTrainingTypes)
        ? (() => {
            const planLocation = normalizeGoal(plan.lugar);
            const normalizedUserTypes = userTrainingTypes.map((t: string) => normalizeGoal(t));
            return normalizedUserTypes.includes(planLocation) || normalizedUserTypes.includes('mixto');
          })()
        : false;

      if (hasLocationMatch) {
        score += 15;
      }

      // 5. Consider health conditions
      if (profile.health_conditions && !profile.health_conditions.includes('ninguna') && 
          plan.nivel === 'B') {
        score += 10; // Prefer beginner plans for people with health conditions
      }

      console.log(`Plan ${plan.id} (${plan.nombre_plan}) scored: ${score}`, {
        goalMatch: hasExactGoalMatch ? 'exact' : (hasSecondaryGoalMatch ? 'secondary' : 'none'),
        levelMatch: hasLevelMatch,
        levelProgression: hasProgressionMatch,
        daysAvailable: profile.available_days_per_week >= plan.dias_semana,
        locationMatch: hasLocationMatch
      });
      return { plan, score };
    });

    // Sort by score and pick the best match
    scoredPlans.sort((a, b) => b.score - a.score);
    
    // Validate that we have a reasonable match (score > 0)
    if (scoredPlans[0].score === 0) {
      console.warn('No suitable plan found with matching criteria, selecting default beginner plan');
    }
    
    const selectedPlan = scoredPlans[0].plan;
    console.log(`Best match: ${selectedPlan.id} - ${selectedPlan.nombre_plan} (score: ${scoredPlans[0].score})`);

    // Fetch exercises from plan_ejercicios for the selected plan
    const { data: planExercises, error: planExercisesError } = await supabase
      .from('plan_ejercicios')
      .select(`
        *,
        exercises:ejercicio_id (*)
      `)
      .eq('plan_id', selectedPlan.id)
      .order('dia', { ascending: true })
      .order('orden', { ascending: true });

    if (planExercisesError) {
      console.error('Error fetching plan exercises:', planExercisesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch plan exercises', details: planExercisesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetched plan exercises:', planExercises?.length || 0);

    // Group exercises by day - REMOVIENDO DUPLICADOS
    const exercisesByDay: { [key: number]: any[] } = {};
    planExercises?.forEach((pe: any) => {
      if (!exercisesByDay[pe.dia]) {
        exercisesByDay[pe.dia] = [];
      }
      // Verificar que el ejercicio no esté ya agregado (evitar duplicados)
      const alreadyExists = exercisesByDay[pe.dia].some(
        (existing: any) => existing.ejercicio_id === pe.ejercicio_id
      );
      if (!alreadyExists) {
        exercisesByDay[pe.dia].push(pe);
      }
    });

    console.log('Exercises grouped by day:', Object.keys(exercisesByDay).length, 'days');

    // Mapeo de días de semana - weekday 1-7 donde 1=Lunes, 7=Domingo
    const dayMap: Record<string, number> = {
      // Formato letra (L, M, Mi, etc.)
      'L': 1,   // Lunes
      'M': 2,   // Martes
      'Mi': 3,  // Miércoles
      'J': 4,   // Jueves
      'V': 5,   // Viernes
      'S': 6,   // Sábado
      'D': 7,   // Domingo
      // Formato numérico (1=Lunes, 2=Martes, etc.)
      '1': 1,   // Lunes
      '2': 2,   // Martes
      '3': 3,   // Miércoles
      '4': 4,   // Jueves
      '5': 5,   // Viernes
      '6': 6,   // Sábado
      '7': 7,   // Domingo
    };

    const dayNames: Record<string, string> = {
      // Formato letra
      'L': 'Lunes',
      'M': 'Martes',
      'Mi': 'Miércoles',
      'J': 'Jueves',
      'V': 'Viernes',
      'S': 'Sábado',
      'D': 'Domingo',
      // Formato numérico
      '1': 'Lunes',
      '2': 'Martes',
      '3': 'Miércoles',
      '4': 'Jueves',
      '5': 'Viernes',
      '6': 'Sábado',
      '7': 'Domingo',
    };

    // Generate workouts for the week
    const workoutsToCreate = [];
    const days = Object.keys(exercisesByDay).map(Number).sort((a, b) => a - b);
    
    // Check if user has specific weekdays configured
    const hasSpecificDays = profile.available_weekdays && Array.isArray(profile.available_weekdays) && profile.available_weekdays.length > 0;
    
    if (hasSpecificDays) {
      // Use user's selected weekdays
      const selectedDays = profile.available_weekdays as string[];
      console.log('Using user-selected days:', selectedDays);
      
      selectedDays.forEach((dayCode: string, index: number) => {
        const weekday = dayMap[dayCode]; // 1-7 donde 1=Lunes
        if (weekday === undefined) {
          console.warn(`Unknown day code: ${dayCode}, skipping`);
          return;
        }
        
        console.log(`Processing day ${dayCode} (index ${index}, weekday ${weekday})`);
        
        // Calculate date for this day (weekday 1=Lunes = monday + 0 días)
        const workoutDate = new Date(monday);
        workoutDate.setDate(monday.getDate() + (weekday - 1));
        
        // If date is in the past, schedule for next week
        if (workoutDate < today) {
          console.log(`Date ${workoutDate.toISOString().split('T')[0]} is in the past, scheduling for next week`);
          workoutDate.setDate(workoutDate.getDate() + 7);
        }
        
        const dateStr = workoutDate.toISOString().split('T')[0];
        console.log(`Workout date for day ${dayCode}: ${dateStr}`);
        
        // Get corresponding plan day (circular distribution)
        const planDayIndex = index % days.length;
        const planDay = days[planDayIndex];
        console.log(`Plan day index: ${planDayIndex}, Plan day: ${planDay}, Available plan days: [${days.join(', ')}]`);
        
        const dayExercises = exercisesByDay[planDay];
        console.log(`Day exercises for plan day ${planDay}: ${dayExercises?.length || 0} exercises`);
        
        if (!dayExercises || dayExercises.length === 0) {
          console.warn(`No exercises found for plan day ${planDay}, skipping`);
          return;
        }
        
        // Calculate estimated calories
        const estimatedCalories = dayExercises.reduce((total: number, pe: any) => {
          const exercise = pe.exercises;
          if (!exercise) return total;
          const caloriesPerRep = exercise.calorias_por_repeticion || 0;
          const reps = exercise.repeticiones_sugeridas || 10;
          const sets = exercise.series_sugeridas || 3;
          return total + (caloriesPerRep * reps * sets);
        }, 0);
        
        // Get muscle group from first exercise
        const muscleGroup = dayExercises[0]?.exercises?.grupo_muscular || 'General';
        
        workoutsToCreate.push({
          user_id: user.id,
          name: `${selectedPlan.nombre_plan} - ${dayNames[dayCode]}`,
          description: `${muscleGroup} - ${selectedPlan.descripcion_plan}`,
          scheduled_date: dateStr,
          weekday: weekday, // 1-7 donde 1=Lunes
          plan_id: selectedPlan.id,
          location: normalizeLocation(selectedPlan.lugar),
          duration_minutes: dayExercises.length * 5,
          estimated_calories: Math.round(estimatedCalories),
          completed: false,
          tipo: 'automatico',
          exercises: dayExercises,
        });
      });
    } else {
      // Original logic: use sequential days from Monday
      for (const dayNum of days) {
        const dayExercises = exercisesByDay[dayNum];
        if (!dayExercises || dayExercises.length === 0) continue;

        // Validate dayNum is within reasonable range (1-7)
        if (dayNum < 1 || dayNum > 7) {
          console.warn(`Invalid day number: ${dayNum}, skipping`);
          continue;
        }

        // Calculate date for this day (starting from Monday)
        const workoutDate = new Date(monday);
        workoutDate.setDate(monday.getDate() + dayNum - 1);
        const dateStr = workoutDate.toISOString().split('T')[0];

        // Calculate estimated calories for this day's exercises
        const estimatedCalories = dayExercises.reduce((total: number, pe: any) => {
          const exercise = pe.exercises;
          if (!exercise) return total;
          const caloriesPerRep = exercise.calorias_por_repeticion || 0;
          const reps = exercise.repeticiones_sugeridas || 10;
          const sets = exercise.series_sugeridas || 3;
          return total + (caloriesPerRep * reps * sets);
        }, 0);

        // Get muscle group from first exercise
        const muscleGroup = dayExercises[0]?.exercises?.grupo_muscular || 'General';

        workoutsToCreate.push({
          user_id: user.id,
          name: `${selectedPlan.nombre_plan} - Día ${dayNum}`,
          description: `${muscleGroup} - ${selectedPlan.descripcion_plan}`,
          scheduled_date: dateStr,
          weekday: dayNum,
          plan_id: selectedPlan.id,
          location: normalizeLocation(selectedPlan.lugar),
          duration_minutes: dayExercises.length * 5, // Estimate 5 min per exercise
          estimated_calories: Math.round(estimatedCalories),
          completed: false,
          tipo: 'automatico',
          exercises: dayExercises,
        });
      }
    }

    console.log('Creating', workoutsToCreate.length, 'workouts for the week');

    // Create all workouts
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

      console.log('Created workout:', workout.id, 'for date:', workoutData.scheduled_date);

      // Add exercises to the workout (filtrando duplicados)
      if (exercises && exercises.length > 0) {
        // Primero filtrar ejercicios válidos
        const validExercises = exercises.filter((pe: any) => pe.exercises && pe.exercises.nombre);
        
        // Luego eliminar duplicados por ejercicio_id
        const uniqueExercises = validExercises.filter((pe: any, index: number, self: any[]) => 
          self.findIndex((t: any) => t.ejercicio_id === pe.ejercicio_id) === index
        );
        
        console.log(`Exercises: ${exercises.length} total, ${validExercises.length} valid, ${uniqueExercises.length} unique`);
        
        const workoutExercises = uniqueExercises.map((pe: any) => {
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

        if (workoutExercises.length === 0) {
          console.warn('No valid exercises found for workout:', workout.id);
          continue;
        }

        const { error: exercisesError } = await supabase
          .from('workout_exercises')
          .insert(workoutExercises);

        if (exercisesError) {
          console.error('Error adding exercises to workout:', workout.id, exercisesError);
        } else {
          console.log('Added', workoutExercises.length, 'exercises to workout:', workout.id);
        }
      }

      createdWorkouts.push(workout);
    }

    // Update user profile with the plan reference
    if (createdWorkouts.length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ assigned_routine_id: selectedPlan.id, onboarding_completed: true })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile with assigned plan:', updateError);
      }
    }

    console.log('Routine assigned successfully:', createdWorkouts.length, 'workouts created');

      return new Response(
        JSON.stringify({
          success: true,
          message: `Routine assigned successfully: ${selectedPlan.nombre_plan}`,
          plan: selectedPlan,
          workouts_created: createdWorkouts.length,
        }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in assign-routine:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
