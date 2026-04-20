import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProgressData {
  workout_id?: string;
  date?: string;
  weight?: number;
  body_measurements?: Record<string, number>;
  energy_level?: number;
  menstrual_phase?: string;
  notes?: string;
  exercises_completed?: Array<{
    exercise_id: string;
    sets?: number;
    reps?: number;
    duration_minutes?: number;
    weight_used?: number;
  }>;
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

    // Parse request body
    const progressData: ProgressData = await req.json();

    // Validate energy level if provided
    if (progressData.energy_level !== undefined) {
      if (progressData.energy_level < 1 || progressData.energy_level > 5) {
        return new Response(
          JSON.stringify({ error: 'Energy level must be between 1 and 5' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Insert progress record
    const { data: progress, error: insertError } = await supabase
      .from('progress_tracking')
      .insert({
        user_id: user.id,
        workout_id: progressData.workout_id,
        date: progressData.date || new Date().toISOString().split('T')[0],
        weight: progressData.weight,
        body_measurements: progressData.body_measurements,
        energy_level: progressData.energy_level,
        menstrual_phase: progressData.menstrual_phase,
        notes: progressData.notes,
        exercises_completed: progressData.exercises_completed
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error recording progress:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record progress' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Progress recorded for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        progress,
        message: 'Progress recorded successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in record-progress:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
