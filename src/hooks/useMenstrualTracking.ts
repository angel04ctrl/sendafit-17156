import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MenstrualLog {
  id: string;
  user_id: string;
  period_start_date: string;
  period_end_date: string | null;
  cycle_length: number;
  period_length: number;
  symptoms: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenstrualPhaseInfo {
  phase: 'menstrual' | 'folicular' | 'ovulacion' | 'lutea' | null;
  dayOfCycle: number;
  nextPeriodDate: Date | null;
  cycleLength: number;
}

// Hook para obtener los logs menstruales del usuario
export const useMenstrualLogs = (limit = 12) => {
  return useQuery({
    queryKey: ['menstrual-logs', limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await (supabase as any)
        .from('menstrual_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('period_start_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as MenstrualLog[];
    },
    staleTime: 2 * 60 * 1000,
  });
};

// Hook para obtener la fase menstrual actual
export const useMenstrualPhase = () => {
  return useQuery({
    queryKey: ['menstrual-phase'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Obtener el último log
      const { data: logs, error } = await (supabase as any)
        .from('menstrual_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('period_start_date', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!logs || logs.length === 0) return null;

      const lastLog = logs[0] as MenstrualLog;
      const lastPeriodStart = new Date(lastLog.period_start_date);
      const cycleLength = lastLog.cycle_length || 28;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calcular días desde el inicio del último periodo
      let daysSincePeriod = Math.floor((today.getTime() - lastPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      
      // Ajustar si estamos en un nuevo ciclo
      if (daysSincePeriod >= cycleLength) {
        daysSincePeriod = daysSincePeriod % cycleLength;
      }

      // Determinar fase
      let phase: 'menstrual' | 'folicular' | 'ovulacion' | 'lutea';
      if (daysSincePeriod <= 5) {
        phase = 'menstrual';
      } else if (daysSincePeriod <= 13) {
        phase = 'folicular';
      } else if (daysSincePeriod <= 16) {
        phase = 'ovulacion';
      } else {
        phase = 'lutea';
      }

      // Calcular próximo periodo
      const daysUntilNextPeriod = cycleLength - daysSincePeriod;
      const nextPeriodDate = new Date(today);
      nextPeriodDate.setDate(today.getDate() + daysUntilNextPeriod);

      return {
        phase,
        dayOfCycle: daysSincePeriod + 1,
        nextPeriodDate,
        cycleLength,
      } as MenstrualPhaseInfo;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook para registrar un nuevo periodo
export const useLogPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      period_start_date: string;
      period_end_date?: string;
      cycle_length?: number;
      period_length?: number;
      symptoms?: string[];
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data: result, error } = await (supabase as any)
        .from('menstrual_logs')
        .insert({
          user_id: user.id,
          period_start_date: data.period_start_date,
          period_end_date: data.period_end_date || null,
          cycle_length: data.cycle_length || 28,
          period_length: data.period_length || 5,
          symptoms: data.symptoms || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menstrual-logs'] });
      queryClient.invalidateQueries({ queryKey: ['menstrual-phase'] });
    },
  });
};

// Hook para eliminar un log
export const useDeleteMenstrualLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await (supabase as any)
        .from('menstrual_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menstrual-logs'] });
      queryClient.invalidateQueries({ queryKey: ['menstrual-phase'] });
    },
  });
};
