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

    // Parse query parameters
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    console.log('Fetching workouts for user:', user.id, 'date:', date, 'range:', startDate, '-', endDate);

    // Get user's assigned routine and available weekdays to filter automatic workouts
    const { data: profile } = await supabase
      .from('profiles')
      .select('assigned_routine_id, available_weekdays')
      .eq('id', user.id)
      .single();

    // Map available weekdays to numbers (L=1, M=2, Mi=3, J=4, V=5, S=6, D=7)
    const dayMap: { [key: string]: number } = {
      'L': 1, 'M': 2, 'Mi': 3, 'J': 4, 'V': 5, 'S': 6, 'D': 7
    };
    const availableWeekdaysNumbers = (profile?.available_weekdays || [])
      .map((d: string) => dayMap[d])
      .filter(Boolean) as number[];

    let allWorkouts: Record<string, unknown>[] = [];

    // Para entrenamientos automáticos: buscar por weekday
    if (startDate && endDate) {
      // Calcular weekdays en el rango
      const start = new Date(startDate);
      const end = new Date(endDate);
      const weekdays = new Set<number>();
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const jsDay = d.getDay();
        const weekday = jsDay === 0 ? 7 : jsDay;
        weekdays.add(weekday);
      }

      // Buscar entrenamientos automáticos por weekday
      // Solo mostrar workouts de días que el usuario tiene seleccionados
      const validWeekdays = Array.from(weekdays).filter(wd => availableWeekdaysNumbers.includes(wd));
      
      let automaticWorkouts: Record<string, unknown>[] = [];
      
      if (validWeekdays.length > 0) {
        let automaticQuery = supabase
          .from('workouts')
          .select(`*, workout_exercises (*)`)
          .eq('user_id', user.id)
          .eq('tipo', 'automatico')
          .in('weekday', validWeekdays);

        if (profile?.assigned_routine_id) {
          automaticQuery = automaticQuery.eq('plan_id', profile.assigned_routine_id);
        }

        const { data } = await automaticQuery;
        automaticWorkouts = data || [];
      }

      // Buscar entrenamientos manuales por fecha
      const { data: manualWorkouts } = await supabase
        .from('workouts')
        .select(`*, workout_exercises (*)`)
        .eq('user_id', user.id)
        .eq('tipo', 'manual')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);

      allWorkouts = [
        ...(automaticWorkouts || []),
        ...(manualWorkouts || [])
      ];
    } else if (date) {
      // Buscar por fecha específica
      const d = new Date(date);
      const jsDay = d.getDay();
      const weekday = jsDay === 0 ? 7 : jsDay;

      // Solo mostrar workouts automáticos si hoy es un día de entrenamiento
      let automaticWorkouts: Record<string, unknown>[] = [];
      
      if (availableWeekdaysNumbers.includes(weekday)) {
        let automaticQuery = supabase
          .from('workouts')
          .select(`*, workout_exercises (*)`)
          .eq('user_id', user.id)
          .eq('tipo', 'automatico')
          .eq('weekday', weekday);

        if (profile?.assigned_routine_id) {
          automaticQuery = automaticQuery.eq('plan_id', profile.assigned_routine_id);
        }

        const { data } = await automaticQuery;
        automaticWorkouts = data || [];
      }

      const { data: manualWorkouts } = await supabase
        .from('workouts')
        .select(`*, workout_exercises (*)`)
        .eq('user_id', user.id)
        .eq('tipo', 'manual')
        .eq('scheduled_date', date);

      allWorkouts = [
        ...(automaticWorkouts || []),
        ...(manualWorkouts || [])
      ];
    }

    const { data: workouts, error: workoutsError } = { data: allWorkouts, error: null };

    if (workoutsError) {
      console.error('Error fetching workouts:', workoutsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch workouts', details: workoutsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found', workouts?.length || 0, 'workouts');

    return new Response(
      JSON.stringify({
        workouts: workouts || [],
        count: workouts?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-workouts-by-date:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
