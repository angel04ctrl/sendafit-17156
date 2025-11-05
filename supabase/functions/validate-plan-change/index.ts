import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { new_weekdays, new_goal } = await req.json();

    console.log('Validating plan change for user:', user.id);
    console.log('New weekdays:', new_weekdays);
    console.log('New goal:', new_goal);

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('available_weekdays, fitness_goal, assigned_routine_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    console.log('Current weekdays:', profile.available_weekdays);
    console.log('Current goal:', profile.fitness_goal);

    // Analyze changes
    const oldWeekdays = profile.available_weekdays || [];
    const oldGoal = profile.fitness_goal;
    const newWeekdays = new_weekdays || oldWeekdays;
    const newGoal = new_goal || oldGoal;

    const goalChanged = oldGoal !== newGoal;
    const weekdaysCountChanged = oldWeekdays.length !== newWeekdays.length;
    
    // Check if the actual days changed (not just count)
    const weekdaysSame = oldWeekdays.length === newWeekdays.length && 
      oldWeekdays.every((day: string) => newWeekdays.includes(day));
    const weekdaysChanged = !weekdaysSame;

    console.log('Analysis:', {
      goalChanged,
      weekdaysCountChanged,
      weekdaysChanged,
      weekdaysSame
    });

    // Decision logic
    let action = 'none';
    let needsReassign = false;
    let needsRedistribute = false;
    let reason = '';

    if (goalChanged) {
      needsReassign = true;
      reason = 'El objetivo de fitness ha cambiado';
      
      if (weekdaysCountChanged || weekdaysChanged) {
        needsRedistribute = true;
        action = 'reassign_and_redistribute';
        reason += ' y los días de entrenamiento también';
      } else {
        action = 'reassign';
      }
    } else if (weekdaysCountChanged) {
      // Quantity of days changed
      needsReassign = true;
      needsRedistribute = true;
      action = 'reassign_and_redistribute';
      reason = 'La cantidad de días de entrenamiento ha cambiado';
    } else if (weekdaysChanged && !weekdaysSame) {
      // Only which days changed (same quantity)
      needsRedistribute = true;
      action = 'redistribute';
      reason = 'Los días de entrenamiento seleccionados han cambiado';
    }

    // Get affected workouts
    const { data: upcomingWorkouts, error: workoutsError } = await supabase
      .from('workouts')
      .select('id, name, scheduled_date, completed, tipo')
      .eq('user_id', user.id)
      .eq('completed', false)
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true });

    if (workoutsError) {
      console.error('Error fetching workouts:', workoutsError);
    }

    const affectedWorkouts = upcomingWorkouts || [];
    const completedCount = affectedWorkouts.filter(w => w.completed).length;
    const pendingCount = affectedWorkouts.filter(w => !w.completed).length;

    // Get current plan info
    let currentPlanInfo = null;
    if (profile.assigned_routine_id) {
      const { data: planData } = await supabase
        .from('predesigned_plans')
        .select('nombre_plan, dias_semana, objetivo')
        .eq('id', profile.assigned_routine_id)
        .single();
      
      currentPlanInfo = planData;
    }

    const response = {
      action,
      needsReassign,
      needsRedistribute,
      reason,
      changes: {
        goalChanged,
        weekdaysCountChanged,
        weekdaysChanged,
        oldGoal,
        newGoal,
        oldWeekdays,
        newWeekdays,
        oldDaysCount: oldWeekdays.length,
        newDaysCount: newWeekdays.length,
      },
      impact: {
        affectedWorkoutsCount: affectedWorkouts.length,
        completedWorkoutsCount: completedCount,
        pendingWorkoutsCount: pendingCount,
        willPreserveCompleted: needsRedistribute,
      },
      currentPlan: currentPlanInfo,
      preview: {
        message: reason,
        summary: `Se ${needsReassign ? 'reasignará' : 'redistribuirá'} tu plan de entrenamiento`,
      }
    };

    console.log('Validation result:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in validate-plan-change:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
