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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse query parameters
    const url = new URL(req.url);
    const location = url.searchParams.get('location');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Build query
    let query = supabase
      .from('workouts')
      .select(`
        *,
        workout_exercises(*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (location) {
      query = query.eq('location', location);
    }

    const { data: routines, error: routinesError } = await query;

    if (routinesError) {
      console.error('Error fetching routines:', routinesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch routines' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Retrieved ${routines?.length || 0} routines`);

    return new Response(
      JSON.stringify({ 
        routines: routines || [],
        count: routines?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-routines:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
