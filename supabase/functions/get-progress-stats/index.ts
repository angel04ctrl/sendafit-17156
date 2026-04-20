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

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch progress data
    const { data: progressData, error: progressError } = await supabase
      .from('progress_tracking')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (progressError) {
      console.error('Error fetching progress data:', progressError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch progress data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate statistics
    const stats = {
      total_workouts: progressData?.length || 0,
      weight_change: 0,
      average_energy_level: 0,
      workout_streak: 0,
      weight_trend: [] as Array<{ date: string; weight: number }>,
      energy_trend: [] as Array<{ date: string; energy: number }>,
    };

    if (progressData && progressData.length > 0) {
      // Weight change
      const weightsRecorded = progressData.filter(p => p.weight !== null);
      if (weightsRecorded.length >= 2) {
        const firstWeight = weightsRecorded[0].weight;
        const lastWeight = weightsRecorded[weightsRecorded.length - 1].weight;
        stats.weight_change = lastWeight - firstWeight;
        
        stats.weight_trend = weightsRecorded.map(p => ({
          date: p.date,
          weight: p.weight
        }));
      }

      // Average energy level
      const energyLevels = progressData.filter(p => p.energy_level !== null);
      if (energyLevels.length > 0) {
        const sumEnergy = energyLevels.reduce((sum, p) => sum + p.energy_level, 0);
        stats.average_energy_level = sumEnergy / energyLevels.length;
        
        stats.energy_trend = energyLevels.map(p => ({
          date: p.date,
          energy: p.energy_level
        }));
      }

      // Calculate workout streak (consecutive days with workouts)
      const sortedDates = progressData.map(p => new Date(p.date)).sort((a, b) => b.getTime() - a.getTime());
      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      
      for (const workoutDate of sortedDates) {
        workoutDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === streak) {
          streak++;
        } else if (diffDays > streak) {
          break;
        }
      }
      stats.workout_streak = streak;
    }

    console.log(`Calculated stats for user ${user.id} over ${days} days`);

    return new Response(
      JSON.stringify({ 
        stats,
        period_days: days,
        calculated_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-progress-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
