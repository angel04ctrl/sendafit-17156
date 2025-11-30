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

    // Get authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching todays workouts for user:', user.id);

    // Get user profile to fetch assigned plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('assigned_routine_id, available_weekdays')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    // Calculate today's weekday (1-7 where 1=Monday, 7=Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const weekday = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1-7 where 1=Monday, 7=Sunday
    
    // Format today's date in local timezone
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;

    console.log(`Today: ${todayDate}, JS day: ${dayOfWeek}, Weekday: ${weekday}, Plan: ${profile?.assigned_routine_id || 'none'}, User days: ${profile?.available_weekdays?.join(', ') || 'none'}`);

    let finalWorkouts: any[] = [];

    // Buscar entrenamientos de HOY por dos estrategias:
    // 1. Entrenamientos automáticos: por weekday + plan (permanentes)
    // 2. Entrenamientos manuales: por scheduled_date exacta
    
    // Estrategia 1: Entrenamientos automáticos por weekday
    let automaticQuery = supabase
      .from('workouts')
      .select(`*, workout_exercises (*)`)
      .eq('user_id', user.id)
      .eq('weekday', weekday)
      .eq('tipo', 'automatico');

    // Filter by current plan if user has one
    if (profile?.assigned_routine_id) {
      automaticQuery = automaticQuery.eq('plan_id', profile.assigned_routine_id);
    }

    const { data: automaticWorkouts, error: automaticError } = await automaticQuery
      .order('created_at', { ascending: true });

    if (automaticError) {
      console.error('Error fetching automatic workouts:', automaticError);
    }

    // Estrategia 2: Entrenamientos manuales por fecha exacta
    const { data: manualWorkouts, error: manualError } = await supabase
      .from('workouts')
      .select(`*, workout_exercises (*)`)
      .eq('user_id', user.id)
      .eq('scheduled_date', todayDate)
      .eq('tipo', 'manual')
      .order('created_at', { ascending: true });

    if (manualError) {
      console.error('Error fetching manual workouts:', manualError);
    }

    // Combinar ambos tipos de entrenamientos
    finalWorkouts = [
      ...(automaticWorkouts || []),
      ...(manualWorkouts || [])
    ];

    console.log(`Found ${automaticWorkouts?.length || 0} automatic workouts and ${manualWorkouts?.length || 0} manual workouts for today`);


    console.log('Found', finalWorkouts?.length || 0, 'workouts for today');

    return new Response(
      JSON.stringify({
        workouts: finalWorkouts || [],
        weekday: weekday,
        count: finalWorkouts?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-todays-workouts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
