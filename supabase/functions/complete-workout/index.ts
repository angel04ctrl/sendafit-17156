import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
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

    // Parse request body
    const { workout_id, completed = true } = await req.json();

    if (!workout_id) {
      return new Response(
        JSON.stringify({ error: 'workout_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Marking workout ${workout_id} as ${completed ? 'completed' : 'incomplete'} for user ${user.id}`);

    // Verify workout belongs to user
    const { data: workout, error: fetchError } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workout_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Database error', details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!workout) {
      return new Response(
        JSON.stringify({ error: 'Workout not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update workout completion status
    const updateData: unknown = {
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    };

    const { data: updatedWorkout, error: updateError } = await supabase
      .from('workouts')
      .update(updateData)
      .eq('id', workout_id)
      .eq('user_id', user.id)
      .select(`
        *,
        workout_exercises(*)
      `)
      .single();

    if (updateError) {
      console.error('Error updating workout:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update workout', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully updated workout ${workout_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        workout: updatedWorkout,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in complete-workout:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
