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
      .select('assigned_routine_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    // Calculate today's weekday (1-7 where 1=Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const weekday = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1-7 where 1=Monday, 7=Sunday

    console.log(`Today's weekday: ${weekday}, Assigned plan: ${profile?.assigned_routine_id || 'none'}`);

    // Fetch today's workouts by weekday and plan_id (more reliable than date)
    let query = supabase
      .from('workouts')
      .select(`
        *,
        workout_exercises (*)
      `)
      .eq('user_id', user.id)
      .eq('weekday', weekday);

    // Filter by plan_id if user has an assigned plan
    if (profile?.assigned_routine_id) {
      query = query.eq('plan_id', profile.assigned_routine_id);
    }

    const { data: workouts, error: workoutsError } = await query
      .order('created_at', { ascending: true });

    if (workoutsError) {
      console.error('Error fetching workouts:', workoutsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch workouts', details: workoutsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found', workouts?.length || 0, 'workouts for today');

    return new Response(
      JSON.stringify({
        workouts: workouts || [],
        weekday: weekday,
        count: workouts?.length || 0,
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
