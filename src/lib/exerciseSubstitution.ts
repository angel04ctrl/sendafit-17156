import type { Tables } from "@/integrations/supabase/types";
import { normalizeExerciseLevel } from "@/lib/exerciseMetadata";

export type Exercise = Tables<"exercises">;

export type SubstitutionReason =
  | "machine_busy"
  | "pain_discomfort"
  | "not_available"
  | "preference"
  | "app_recommended";

export interface SubstitutionCandidate {
  exercise: Exercise;
  score: number;
  matchReasons: string[];
  cautions: string[];
}

const levelRank = {
  principiante: 1,
  intermedio: 2,
  avanzado: 3,
} as const;

export const substitutionReasonLabels: Record<SubstitutionReason, string> = {
  machine_busy: "Maquina ocupada",
  pain_discomfort: "Dolor o molestia",
  not_available: "No disponible",
  preference: "Preferencia",
  app_recommended: "Recomendado por app",
};

export function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toTextList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizedSet(values: unknown) {
  return new Set(toTextList(values).map(normalizeText).filter(Boolean));
}

function intersects(a: Set<string>, b: Set<string>) {
  for (const item of a) {
    if (b.has(item)) return true;
  }
  return false;
}

function exerciseLevelRank(exercise: Exercise) {
  return levelRank[normalizeExerciseLevel(exercise.nivel_minimo || exercise.nivel)];
}

function isGymOnlyExercise(exercise: Exercise) {
  const equipment = normalizeText(`${exercise.equipamiento || ""} ${(exercise.equipo_requerido || []).join(" ")}`);
  const place = normalizeText(exercise.lugar);
  return place === "gimnasio" || /(maquina|polea|prensa|rack|barra|discos|caminadora|escaladora)/.test(equipment);
}

function isCardio(exercise: Exercise) {
  return normalizeText(`${exercise.tipo_entrenamiento} ${exercise.grupo_muscular} ${exercise.patron_movimiento || ""}`).includes("cardio");
}

export function getExerciseSubstitutionCandidates(params: {
  original: Exercise;
  exercises: Exercise[];
  userFitnessLevel?: string | null;
  workoutLocation?: string | null;
  limit?: number;
}) {
  const { original, exercises, userFitnessLevel, workoutLocation, limit = 8 } = params;
  const userLevel = levelRank[normalizeExerciseLevel(userFitnessLevel || original.nivel_minimo || original.nivel)];
  const originalPrimaryMuscle = normalizeText(original.musculo_principal || original.grupo_muscular);
  const originalGroup = normalizeText(original.grupo_muscular);
  const originalPattern = normalizeText(original.patron_movimiento);
  const originalType = normalizeText(original.tipo_entrenamiento);
  const originalEquipment = normalizedSet(original.equipo_requerido?.length ? original.equipo_requerido : original.equipamiento);
  const originalContraindications = normalizedSet(original.contraindicaciones);
  const location = normalizeText(workoutLocation);
  const originalIsCardio = isCardio(original);

  return exercises
    .flatMap<SubstitutionCandidate>((exercise) => {
      if (exercise.id === original.id) return [];
      if (normalizeText(exercise.estado_calidad) && normalizeText(exercise.estado_calidad) !== "curado") return [];
      if (exerciseLevelRank(exercise) > userLevel) return [];
      if (location === "casa" && isGymOnlyExercise(exercise)) return [];
      if (location === "exterior" && isGymOnlyExercise(exercise)) return [];
      if (isCardio(exercise) !== originalIsCardio) return [];

      const candidatePrimaryMuscle = normalizeText(exercise.musculo_principal || exercise.grupo_muscular);
      const candidateGroup = normalizeText(exercise.grupo_muscular);
      const candidatePattern = normalizeText(exercise.patron_movimiento);
      const candidateType = normalizeText(exercise.tipo_entrenamiento);
      const candidateEquipment = normalizedSet(exercise.equipo_requerido?.length ? exercise.equipo_requerido : exercise.equipamiento);
      const candidateContraindications = normalizedSet(exercise.contraindicaciones);
      const matchReasons: string[] = [];
      const cautions: string[] = [];
      let score = 0;

      if (candidatePrimaryMuscle && candidatePrimaryMuscle === originalPrimaryMuscle) {
        score += 45;
        matchReasons.push("Mismo musculo principal");
      } else if (candidateGroup && candidateGroup === originalGroup) {
        score += 28;
        matchReasons.push("Mismo grupo muscular");
      } else {
        return [];
      }

      if (candidatePattern && originalPattern && candidatePattern === originalPattern) {
        score += 28;
        matchReasons.push("Mismo patron");
      } else if (candidatePattern && originalPattern && candidatePattern.includes(originalPattern.split(" ")[0])) {
        score += 10;
        matchReasons.push("Patron cercano");
      }

      if (candidateType === originalType) {
        score += 8;
        matchReasons.push("Mismo tipo");
      }

      if (originalEquipment.size && candidateEquipment.size && intersects(originalEquipment, candidateEquipment)) {
        score += 8;
        matchReasons.push("Equipo parecido");
      } else if (candidateEquipment.has("peso corporal") || candidateEquipment.has("ninguno")) {
        score += 6;
        matchReasons.push("No requiere equipo especial");
      }

      if (candidateContraindications.size && intersects(originalContraindications, candidateContraindications)) {
        score -= 12;
        cautions.push("Revisa molestias similares antes de usarlo");
      }

      if (score < 32) return [];

      return [{ exercise, score, matchReasons, cautions }];
    })
    .sort((a, b) => b.score - a.score || a.exercise.nombre.localeCompare(b.exercise.nombre))
    .slice(0, limit);
}
