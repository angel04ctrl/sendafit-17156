// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeo de días de semana a números (1-7, donde 1=Lunes, 7=Domingo)
const dayMap: Record<string, number> = {
  'L': 1,   // Lunes
  'M': 2,   // Martes
  'Mi': 3,  // Miércoles
  'J': 4,   // Jueves
  'V': 5,   // Viernes
  'S': 6,   // Sábado
  'D': 7,   // Domingo
};

const dayNames: Record<string, string> = {
  'L': 'Lunes',
  'M': 'Martes',
  'Mi': 'Miércoles',
  'J': 'Jueves',
  'V': 'Viernes',
  'S': 'Sábado',
  'D': 'Domingo',
};

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

    console.log(`Redistributing workouts for user ${user.id}`);

    // Obtener perfil del usuario con días seleccionados
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.available_weekdays || profile.available_weekdays.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No training days configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const selectedDays = profile.available_weekdays as string[];
    console.log('Selected training days:', selectedDays);

    // Obtener el plan asignado
    if (!profile.assigned_routine_id) {
      return new Response(
        JSON.stringify({ error: 'No routine assigned' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener ejercicios del plan
    const { data: planExercises, error: planExercisesError } = await supabase
      .from('plan_ejercicios')
      .select(`
        *,
        exercises:ejercicio_id (*)
      `)
      .eq('plan_id', profile.assigned_routine_id)
      .order('dia', { ascending: true })
      .order('orden', { ascending: true });

    if (planExercisesError || !planExercises || planExercises.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No exercises found for routine' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Total plan exercises fetched:', planExercises.length);

    // Agrupar ejercicios por día - REMOVIENDO DUPLICADOS
    const exercisesByDay: { [key: number]: any[] } = {};
    planExercises.forEach((pe: any) => {
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

    const planDays = Object.keys(exercisesByDay).map(Number).sort((a, b) => a - b);
    console.log('Plan has exercises for days:', planDays);

    // Eliminar TODOS los workouts automáticos del usuario (sin importar plan_id)
    // Esto asegura que los entrenamientos de días no seleccionados se eliminen
    console.log('Deleting all automatic workouts for user:', user.id);
    const { data: deletedWorkouts, error: deleteError } = await supabase
      .from('workouts')
      .delete()
      .eq('user_id', user.id)
      .eq('tipo', 'automatico')
      .select('id');

    if (deleteError) {
      console.error('Error deleting old workouts:', deleteError);
    } else {
      console.log(`Successfully deleted ${deletedWorkouts?.length || 0} automatic workouts`);
    }

    // Obtener el plan para información adicional
    const { data: planData } = await supabase
      .from('predesigned_plans')
      .select('*')
      .eq('id', profile.assigned_routine_id)
      .maybeSingle();

    const normalizeLocation = (lugar: string | null | undefined): 'casa' | 'gimnasio' | 'exterior' => {
      const normalized = lugar?.toLowerCase() || 'casa';
      if (normalized.includes('casa')) return 'casa';
      if (normalized.includes('gimnasio') || normalized.includes('gym')) return 'gimnasio';
      if (normalized.includes('exterior') || normalized.includes('parque')) return 'exterior';
      return 'casa';
    };

    // Crear nuevos workouts redistribuidos (permanentes por weekday)
    const workoutsToCreate = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Fecha de creación como referencia
    
    // Distribuir los días del plan entre los días seleccionados por el usuario
    selectedDays.forEach((dayCode, index) => {
      const weekday = dayMap[dayCode]; // 1-7 donde 1=Lunes
      if (!weekday) {
        console.warn(`Unknown day code: ${dayCode}`);
        return;
      }

      // Obtener el día del plan correspondiente (circular)
      const planDayIndex = index % planDays.length;
      const planDay = planDays[planDayIndex];
      const dayExercises = exercisesByDay[planDay];

      if (!dayExercises || dayExercises.length === 0) {
        return;
      }

      // Calcular calorías estimadas
      const estimatedCalories = dayExercises.reduce((total: number, pe: any) => {
        const exercise = pe.exercises;
        if (!exercise) return total;
        const caloriesPerRep = exercise.calorias_por_repeticion || 0;
        const reps = exercise.repeticiones_sugeridas || 10;
        const sets = exercise.series_sugeridas || 3;
        return total + (caloriesPerRep * reps * sets);
      }, 0);

      // Obtener grupo muscular del primer ejercicio
      const muscleGroup = dayExercises[0]?.exercises?.grupo_muscular || 'General';

      workoutsToCreate.push({
        user_id: user.id,
        name: `${planData?.nombre_plan || 'Entrenamiento'} - ${dayNames[dayCode]}`,
        description: `${muscleGroup} - ${planData?.descripcion_plan || 'Rutina personalizada'}`,
        scheduled_date: todayStr, // Solo fecha de creación como referencia
        weekday: weekday, // Campo principal: 1-7 donde 1=Lunes
        plan_id: profile.assigned_routine_id,
        location: normalizeLocation(planData?.lugar),
        duration_minutes: dayExercises.length * 5,
        estimated_calories: Math.round(estimatedCalories),
        completed: false,
        tipo: 'automatico',
        exercises: dayExercises,
      });
    });

    console.log('Creating', workoutsToCreate.length, 'redistributed workouts');

    // Crear todos los workouts
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

      // Agregar ejercicios al workout
      if (exercises && exercises.length > 0) {
        const workoutExercises = exercises
          .filter((pe: any) => pe.exercises && pe.exercises.nombre)
          .map((pe: any) => {
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
          const { error: exercisesError } = await supabase
            .from('workout_exercises')
            .insert(workoutExercises);

          if (exercisesError) {
            console.error('Error adding exercises to workout:', workout.id, exercisesError);
          }
        }
      }

      createdWorkouts.push(workout);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Workouts redistributed successfully',
        workouts_created: createdWorkouts.length,
        training_days: selectedDays,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in redistribute-workouts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
