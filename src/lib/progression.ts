import type { ExerciseProgressSummary } from "@/lib/api/backend";

export type ProgressionAction =
  | "increase_weight"
  | "maintain_weight"
  | "decrease_weight"
  | "increase_reps"
  | "no_data"
  | "blocked_pain";

export type ProgressionConfidence = "high" | "medium" | "low";

export interface ProgressionSuggestion {
  action: ProgressionAction;
  label: string;
  confidence: ProgressionConfidence;
  reason: string;
  previousWeight: number | null;
  previousReps: number[];
  suggestedWeight: number | null;
  suggestedReps: number | null;
  source: "exercise_id" | "snapshot";
  basedOnSessionId: string | null;
}

interface BuildProgressionSuggestionParams {
  progress?: ExerciseProgressSummary | null;
  targetReps: number;
  targetSets: number;
  targetWeight?: number | null;
  hasStableExerciseId: boolean;
  fitnessLevel?: string | null;
  currentSessionFeeling?: "strong" | "normal" | "tired" | "pain" | "" | null;
}

const roundToHalf = (value: number) => Math.round(value * 2) / 2;

const getAverage = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
};

export function buildProgressionSuggestion({
  progress,
  targetReps,
  targetSets,
  targetWeight = null,
  hasStableExerciseId,
  fitnessLevel,
  currentSessionFeeling,
}: BuildProgressionSuggestionParams): ProgressionSuggestion {
  const source = hasStableExerciseId ? "exercise_id" : "snapshot";
  const fallbackConfidence: ProgressionConfidence = source === "exercise_id" ? "medium" : "low";
  const confidencePrefix = source === "snapshot"
    ? "Esta es una recomendacion inicial porque aun falta historial completo de este ejercicio. "
    : "";

  if (currentSessionFeeling === "pain") {
    return {
      action: "blocked_pain",
      label: "No subir peso",
      confidence: "low",
      reason: "Reportaste dolor en esta sesión; hoy no conviene aumentar carga.",
      previousWeight: null,
      previousReps: [],
      suggestedWeight: null,
      suggestedReps: targetReps,
      source,
      basedOnSessionId: null,
    };
  }

  const lastSession = progress?.lastSession || null;
  if (!lastSession || lastSession.sets.length === 0) {
    const levelHint = fitnessLevel === "principiante"
      ? " Empieza muy conservador."
      : fitnessLevel === "intermedio"
        ? " Elige una carga cómoda/moderada."
        : fitnessLevel === "avanzado"
          ? " Usa una primera serie de aproximación para calibrar la carga del día."
          : "";
    const reason = targetWeight
      ? `Manten este peso por ahora y enfocate en completar las series con buena tecnica. Usa un peso comodo y deja 2-3 repeticiones en reserva. Con mas entrenamientos, SendaFit ajustara mejor tus sugerencias.${levelHint}`
      : `Usa un peso comodo y deja 2-3 repeticiones en reserva. Con mas entrenamientos, SendaFit ajustara mejor tus sugerencias.${levelHint}`;

    return {
      action: "no_data",
      label: "Mantener",
      confidence: "low",
      reason,
      previousWeight: targetWeight,
      previousReps: [],
      suggestedWeight: targetWeight,
      suggestedReps: targetReps,
      source,
      basedOnSessionId: null,
    };
  }

  const lastSets = lastSession.sets.filter((set) => set.reps !== null);
  const previousReps = lastSets.map((set) => set.reps || 0);
  const weightedSets = lastSets.filter((set) => (set.weight || 0) > 0);
  const previousWeight = weightedSets.length
    ? Math.max(...weightedSets.map((set) => set.weight || 0))
    : targetWeight;
  const plannedSets = Math.max(1, Math.min(targetSets, lastSets.length || targetSets));
  const completedPlannedSets = lastSets.slice(0, plannedSets);
  const minReps = Math.max(1, targetReps - 4);
  const allAtTarget = completedPlannedSets.length >= plannedSets
    && completedPlannedSets.every((set) => (set.reps || 0) >= targetReps);
  const belowRange = completedPlannedSets.some((set) => (set.reps || 0) < minReps);
  const highEffortSets = lastSets.filter((set) => (set.rir !== null && set.rir <= 0) || (set.rpe !== null && set.rpe >= 10));
  const hasPain = lastSession.painFlag || lastSession.sessionFeeling === "pain";
  const previousSession = progress?.sessions?.[1] || null;
  const volumeDrop = previousSession && previousSession.totalVolume > 0
    ? (previousSession.totalVolume - lastSession.totalVolume) / previousSession.totalVolume
    : 0;
  const isBodyweight = weightedSets.length === 0 && !targetWeight;
  const averageReps = getAverage(previousReps);

  if (hasPain) {
    return {
      action: "blocked_pain",
      label: "No subir peso",
      confidence: fallbackConfidence,
      reason: `${confidencePrefix}La última sesión marcó dolor o molestia; mantener o bajar la exigencia es más seguro.`,
      previousWeight,
      previousReps,
      suggestedWeight: previousWeight,
      suggestedReps: Math.max(minReps, Math.floor(averageReps || targetReps)),
      source,
      basedOnSessionId: lastSession.sessionId,
    };
  }

  if (highEffortSets.length >= 2) {
    return {
      action: "maintain_weight",
      label: "Mantener",
      confidence: fallbackConfidence,
      reason: `${confidencePrefix}Hubo esfuerzo límite en varias series; repite la carga antes de subir.`,
      previousWeight,
      previousReps,
      suggestedWeight: previousWeight,
      suggestedReps: targetReps,
      source,
      basedOnSessionId: lastSession.sessionId,
    };
  }

  if (volumeDrop >= 0.2) {
    return {
      action: belowRange ? "decrease_weight" : "maintain_weight",
      label: belowRange ? "Bajar peso" : "Mantener",
      confidence: fallbackConfidence,
      reason: `${confidencePrefix}El volumen bajó más de 20% frente a la sesión previa; prioriza recuperar técnica y reps.`,
      previousWeight,
      previousReps,
      suggestedWeight: previousWeight ? roundToHalf(previousWeight * (belowRange ? 0.95 : 1)) : previousWeight,
      suggestedReps: Math.max(minReps, Math.floor(averageReps || targetReps)),
      source,
      basedOnSessionId: lastSession.sessionId,
    };
  }

  if (isBodyweight) {
    if (allAtTarget) {
      return {
        action: "increase_reps",
        label: "Aumentar reps",
        confidence: source === "exercise_id" ? "high" : "low",
        reason: `${confidencePrefix}Completaste el objetivo de reps con peso corporal; progresa agregando 1-2 reps por serie.`,
        previousWeight: null,
        previousReps,
        suggestedWeight: null,
        suggestedReps: targetReps + 1,
        source,
        basedOnSessionId: lastSession.sessionId,
      };
    }

    return {
      action: "maintain_weight",
      label: "Mantener",
      confidence: fallbackConfidence,
      reason: `${confidencePrefix}Todavía no completaste el rango objetivo de reps; conserva la variante actual.`,
      previousWeight: null,
      previousReps,
      suggestedWeight: null,
      suggestedReps: targetReps,
      source,
      basedOnSessionId: lastSession.sessionId,
    };
  }

  if (source === "snapshot") {
    return {
      action: "maintain_weight",
      label: "Mantener",
      confidence: "low",
      reason: "Recomendacion inicial: manten la carga hasta que SendaFit tenga mas entrenamientos registrados de este ejercicio.",
      previousWeight,
      previousReps,
      suggestedWeight: previousWeight,
      suggestedReps: targetReps,
      source,
      basedOnSessionId: lastSession.sessionId,
    };
  }

  if (allAtTarget && previousWeight) {
    return {
      action: "increase_weight",
      label: "Subir peso",
      confidence: "high",
      reason: "Completaste todas las series objetivo sin dolor ni esfuerzo límite; sube la carga de forma pequeña.",
      previousWeight,
      previousReps,
      suggestedWeight: roundToHalf(previousWeight * 1.025),
      suggestedReps: targetReps,
      source,
      basedOnSessionId: lastSession.sessionId,
    };
  }

  if (belowRange && previousWeight) {
    return {
      action: "decrease_weight",
      label: "Bajar peso",
      confidence: "medium",
      reason: "Quedaste por debajo del rango mínimo de reps; baja un poco la carga para recuperar el volumen.",
      previousWeight,
      previousReps,
      suggestedWeight: roundToHalf(previousWeight * 0.95),
      suggestedReps: targetReps,
      source,
      basedOnSessionId: lastSession.sessionId,
    };
  }

  return {
    action: "maintain_weight",
    label: "Mantener",
    confidence: fallbackConfidence,
    reason: `${confidencePrefix}Estás dentro del rango de trabajo, pero aún no completaste todas las series objetivo.`,
    previousWeight,
    previousReps,
    suggestedWeight: previousWeight,
    suggestedReps: targetReps,
    source,
    basedOnSessionId: lastSession.sessionId,
  };
}
