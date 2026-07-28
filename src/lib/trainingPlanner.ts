export type RoutineMuscleStat = {
  muscle: string;
  frequency: number;
  directSets: number;
  indirectSets: number;
  totalSets: number;
  status: "bajo" | "adecuado" | "alto";
};

export type RoutinePlannerSummary = {
  split?: {
    key: string;
    name: string;
    reason: string;
  };
  goal?: string;
  rest_day?: {
    weekday: number;
    name: string;
    reason: string;
  } | null;
  target_duration_minutes?: number;
  equipment_mode?: string;
  muscle_stats?: RoutineMuscleStat[];
  warnings?: string[];
  explanation?: string;
  day_summaries?: Array<{
    weekday: number;
    name: string;
    focus: string;
    estimated_duration_minutes: number;
    exercise_count: number;
  }>;
};

export const formatEquipmentMode = (mode?: string | null) => {
  const labels: Record<string, string> = {
    casa: "Casa",
    gimnasio: "Gimnasio",
    calistenia: "Calistenia",
  };

  return labels[mode || ""] || "Equipo disponible";
};

export const formatVolumeStatus = (status?: RoutineMuscleStat["status"]) => {
  const labels: Record<RoutineMuscleStat["status"], string> = {
    bajo: "Bajo",
    adecuado: "Adecuado",
    alto: "Alto",
  };

  return status ? labels[status] : "Adecuado";
};

export const getVolumeStatusClassName = (status?: RoutineMuscleStat["status"]) => {
  if (status === "bajo") return "border-warning/30 bg-warning/10 text-foreground";
  if (status === "alto") return "border-destructive/30 bg-destructive/10 text-foreground";
  return "border-success/30 bg-success/10 text-foreground";
};
