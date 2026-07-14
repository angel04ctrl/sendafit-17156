export type ExerciseLevel = "principiante" | "intermedio" | "avanzado";

export const exerciseLevelOrder: ExerciseLevel[] = ["principiante", "intermedio", "avanzado"];

export function normalizeExerciseLevel(value?: string | null): ExerciseLevel {
  const normalized = (value || "").trim().toLowerCase();

  if (["b", "basic", "basico", "básico", "beginner", "principiante"].includes(normalized)) {
    return "principiante";
  }

  if (["i", "intermediate", "intermedio"].includes(normalized)) {
    return "intermedio";
  }

  if (["p", "professional", "profesional", "advanced", "avanzado"].includes(normalized)) {
    return "avanzado";
  }

  return "principiante";
}

export function formatExerciseLevel(value?: string | null) {
  const level = normalizeExerciseLevel(value);
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function canAccessExerciseLevel(exerciseLevel?: string | null, selectedLevel?: string | null) {
  if (!selectedLevel || selectedLevel === "all") return true;

  const exerciseIndex = exerciseLevelOrder.indexOf(normalizeExerciseLevel(exerciseLevel));
  const selectedIndex = exerciseLevelOrder.indexOf(normalizeExerciseLevel(selectedLevel));

  return exerciseIndex <= selectedIndex;
}

export function toTextArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string") return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  return [];
}
