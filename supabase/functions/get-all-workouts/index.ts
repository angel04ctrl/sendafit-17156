import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log(`Fetching all workouts for user ${user.id}`);

    let bodyParams: { include_completed?: boolean; tipo?: string } = {};
    try {
      bodyParams = await req.json();
    } catch {
      bodyParams = {};
    }

    // Parse query parameters and support POST body params from supabase.functions.invoke
    const url = new URL(req.url);
    const includeCompletedParam = url.searchParams.get('include_completed');
    const includeCompleted = includeCompletedParam !== null
      ? includeCompletedParam !== 'false'
      : bodyParams.include_completed !== false;
    const tipo = url.searchParams.get('tipo') || bodyParams.tipo; // 'automatico' or 'manual'

    // Build query
    let query = supabase
      .from('workouts')
      .select(`
        *,
        workout_exercises(
          id,
          name,
          sets,
          reps,
          notes,
          duration_minutes
        )
      `)
      .eq('user_id', user.id)
      .order('scheduled_date', { ascending: true });

    // Filter by completed status if needed
    if (!includeCompleted) {
      query = query.eq('completed', false);
    }

    // Filter by tipo if specified
    if (tipo === 'automatico' || tipo === 'manual') {
      query = query.eq('tipo', tipo);
    }

    const { data: workouts, error: workoutsError } = await query;

    if (workoutsError) {
      console.error('Error fetching workouts:', workoutsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch workouts', details: workoutsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Retrieved ${workouts?.length || 0} workouts`);

    // Calculate statistics
    const stats = {
      total: workouts?.length || 0,
      completed: workouts?.filter(w => w.completed).length || 0,
      skipped: workouts?.filter(w => w.skipped).length || 0,
      pending: workouts?.filter(w => !w.completed && !w.skipped).length || 0,
      automaticos: workouts?.filter(w => w.tipo === 'automatico').length || 0,
      manuales: workouts?.filter(w => w.tipo === 'manual').length || 0,
      totalCalories: workouts?.reduce((sum, w) => sum + (w.estimated_calories || 0), 0) || 0,
      totalMinutes: workouts?.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) || 0,
    };

    return new Response(
      JSON.stringify({ 
        workouts: workouts || [],
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-all-workouts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
