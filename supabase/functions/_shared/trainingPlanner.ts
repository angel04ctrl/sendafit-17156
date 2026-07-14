type SplitSlot = {
  key: string;
  name: string;
  targets: string[];
  patterns: string[];
};

type PlannerProfile = {
  fitness_goal?: string | null;
  fitness_level?: string | null;
  training_types?: string[] | string | null;
  health_conditions?: string[] | null;
  lesiones_activas?: string[] | null;
  injuries_limitations?: string | null;
  available_days_per_week?: number | null;
  session_duration_minutes?: number | null;
};

type PlannerExercise = {
  id: string;
  nombre: string;
  grupo_muscular?: string | null;
  musculo_principal?: string | null;
  musculos_secundarios?: string[] | null;
  equipamiento?: string | null;
  equipo_requerido?: string[] | null;
  lugar?: string | null;
  nivel?: string | null;
  nivel_minimo?: string | null;
  tipo_entrenamiento?: string | null;
  patron_movimiento?: string | null;
  objetivo?: string | null;
  contraindicaciones?: string[] | null;
  series_sugeridas?: number | null;
  repeticiones_sugeridas?: number | null;
  rango_reps_min?: number | null;
  rango_reps_max?: number | null;
  descanso_segundos_min?: number | null;
  descanso_segundos_max?: number | null;
  duracion_promedio_segundos?: number | null;
  estado_calidad?: string | null;
  has_media?: boolean | null;
};

type PlannedDay = {
  planDay: number;
  weekday: number;
  name: string;
  focus: string;
  exercises: PlannerExercise[];
  estimatedDurationMinutes: number;
  intensity: "moderada" | "exigente";
};

type MuscleStat = {
  muscle: string;
  frequency: number;
  directSets: number;
  indirectSets: number;
  totalSets: number;
  status: "bajo" | "adecuado" | "alto";
};

type RestDay = {
  weekday: number;
  name: string;
  reason: string;
};

export type TrainingPlanResult = {
  split: {
    key: string;
    name: string;
    reason: string;
  };
  goal: string;
  targetDurationMinutes: number;
  equipmentMode: string;
  selectedWeekdays: number[];
  trainingWeekdays: number[];
  restDay: RestDay | null;
  days: PlannedDay[];
  muscleStats: MuscleStat[];
  warnings: string[];
  explanation: string;
};

export const MAX_WEEKLY_TRAINING_DAYS = 6;
export const DIRECT_SET_WEIGHT = 1;
export const INDIRECT_SET_WEIGHT = 0.5;

const DAY_NAMES: Record<number, string> = {
  1: "lunes",
  2: "martes",
  3: "miercoles",
  4: "jueves",
  5: "viernes",
  6: "sabado",
  7: "domingo",
};

const normalize = (value: unknown): string =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeKey = (value: unknown): string => normalize(value).replace(/\s+/g, "_");

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const levelRank = (level: string | null | undefined): number => {
  const normalized = normalizeKey(level);
  if (["p", "avanzado", "profesional"].includes(normalized)) return 3;
  if (["i", "intermedio"].includes(normalized)) return 2;
  return 1;
};

export const selectRoutineSplit = (daysPerWeek: number, profile: PlannerProfile = {}) => {
  const days = Math.max(1, Math.min(MAX_WEEKLY_TRAINING_DAYS, Math.round(daysPerWeek || 1)));
  const goal = normalizeKey(profile.fitness_goal);
  const isBeginner = levelRank(profile.fitness_level) <= 1;

  if (days === 1) {
    return {
      key: "full_body",
      name: "Full body",
      reason: "Un dia disponible requiere cubrir todo el cuerpo en una sola sesion.",
      slots: [slot("full_body_a", "Full body", ["pecho", "espalda", "piernas", "gluteos", "hombros", "core"], [])],
    };
  }

  if (days === 2) {
    return {
      key: "full_body_ab",
      name: "Full body A/B",
      reason: "Dos dias permiten repetir patrones principales con variacion A/B.",
      slots: [
        slot("full_body_a", "Full body A", ["pecho", "espalda", "piernas", "gluteos", "core"], ["empuje", "jalon", "sentadilla"]),
        slot("full_body_b", "Full body B", ["espalda", "pecho", "piernas", "gluteos", "hombros"], ["jalon", "empuje", "bisagra"]),
      ],
    };
  }

  if (days === 3) {
    const usePpl = !isBeginner && !["bajar_peso", "perder_peso", "mantener_peso"].includes(goal);
    return {
      key: usePpl ? "ppl_basic" : "full_body_abc",
      name: usePpl ? "PPL basico" : "Full body A/B/C",
      reason: usePpl
        ? "Tres dias con nivel suficiente permiten separar empuje, jalon y piernas."
        : "Tres dias se aprovechan mejor con frecuencia global y tecnica repetida.",
      slots: usePpl
        ? [
            slot("push", "Empuje", ["pecho", "hombros", "triceps"], ["empuje"]),
            slot("pull", "Jalon", ["espalda", "brazos", "antebrazos"], ["jalon"]),
            slot("legs", "Piernas", ["piernas", "gluteos", "core"], ["sentadilla", "bisagra"]),
          ]
        : [
            slot("full_body_a", "Full body A", ["pecho", "espalda", "piernas", "core"], ["empuje", "jalon", "sentadilla"]),
            slot("full_body_b", "Full body B", ["espalda", "gluteos", "hombros", "core"], ["jalon", "bisagra", "empuje"]),
            slot("full_body_c", "Full body C", ["piernas", "pecho", "espalda", "brazos"], ["sentadilla", "empuje", "jalon"]),
          ],
    };
  }

  if (days === 4) {
    return {
      key: "upper_lower_2x",
      name: "Torso/pierna frecuencia 2",
      reason: "Cuatro dias permiten frecuencia 2 para torso y pierna sin sesiones excesivas.",
      slots: [
        slot("upper_a", "Torso A", ["pecho", "espalda", "hombros", "brazos"], ["empuje", "jalon"]),
        slot("lower_a", "Pierna A", ["piernas", "gluteos", "core"], ["sentadilla", "bisagra"]),
        slot("upper_b", "Torso B", ["espalda", "pecho", "hombros", "brazos"], ["jalon", "empuje"]),
        slot("lower_b", "Pierna B", ["gluteos", "piernas", "core"], ["bisagra", "sentadilla"]),
      ],
    };
  }

  if (days === 5) {
    return {
      key: "ppl_upper_lower",
      name: "PPL + torso/pierna",
      reason: "Cinco dias combinan especializacion por patrones con un segundo estimulo de torso y pierna.",
      slots: [
        slot("push", "Empuje", ["pecho", "hombros", "triceps"], ["empuje"]),
        slot("pull", "Jalon", ["espalda", "brazos", "antebrazos"], ["jalon"]),
        slot("legs", "Piernas", ["piernas", "gluteos", "core"], ["sentadilla", "bisagra"]),
        slot("upper", "Torso", ["pecho", "espalda", "hombros", "brazos"], ["empuje", "jalon"]),
        slot("lower", "Pierna", ["gluteos", "piernas", "core"], ["bisagra", "sentadilla"]),
      ],
    };
  }

  return {
    key: "ppl_2x",
    name: "PPL frecuencia 2",
    reason: "Seis dias permiten repetir empuje, jalon y piernas dos veces por semana.",
    slots: [
      slot("push_a", "Empuje A", ["pecho", "hombros", "triceps"], ["empuje"]),
      slot("pull_a", "Jalon A", ["espalda", "brazos", "antebrazos"], ["jalon"]),
      slot("legs_a", "Piernas A", ["piernas", "gluteos", "core"], ["sentadilla", "bisagra"]),
      slot("push_b", "Empuje B", ["hombros", "pecho", "triceps"], ["empuje"]),
      slot("pull_b", "Jalon B", ["espalda", "antebrazos", "brazos"], ["jalon"]),
      slot("legs_b", "Piernas B", ["gluteos", "piernas", "core"], ["bisagra", "sentadilla"]),
    ],
  };
};

const slot = (key: string, name: string, targets: string[], patterns: string[]): SplitSlot => ({
  key,
  name,
  targets,
  patterns,
});

export const buildTrainingPlan = (input: {
  profile: PlannerProfile;
  selectedWeekdays: number[];
  exercises: PlannerExercise[];
}): TrainingPlanResult => {
  const selectedWeekdays = normalizeWeekdays(input.selectedWeekdays);
  const restDay = requiresMandatoryRestDay(selectedWeekdays)
    ? selectRestDay(selectedWeekdays, input.profile)
    : null;
  const trainingWeekdays = restDay
    ? selectedWeekdays.filter((weekday) => weekday !== restDay.weekday)
    : selectedWeekdays.slice(0, MAX_WEEKLY_TRAINING_DAYS);
  const split = selectRoutineSplit(trainingWeekdays.length || input.profile.available_days_per_week || 1, input.profile);
  const targetDurationMinutes = normalizeDuration(input.profile.session_duration_minutes);
  const maxExercises = exercisesPerSession(targetDurationMinutes, input.profile);
  const equipmentMode = detectEquipmentMode(input.profile);
  const restrictions = detectRestrictions(input.profile);
  const warnings: string[] = [];

  const filteredExercises = input.exercises
    .filter((exercise) => isExerciseAllowedByQuality(exercise, input.profile))
    .filter((exercise) => isExerciseCompatibleWithEquipment(exercise, equipmentMode))
    .filter((exercise) => isExerciseCompatibleWithLevel(exercise, input.profile))
    .filter((exercise) => isExerciseAllowedByRestrictions(exercise, restrictions, warnings));

  if (filteredExercises.length === 0) {
    warnings.push("planner_insufficient_compatible_exercises: no hay ejercicios compatibles suficientes para construir el plan sin relajar seguridad, nivel o equipo.");
  } else if (filteredExercises.length < 12) {
    warnings.push("Hay pocos ejercicios compatibles con el equipo o restricciones; se uso el catalogo disponible con prioridad conservadora.");
  }

  if (restDay) {
    warnings.push(`Seleccionaste disponibilidad toda la semana; se reservo ${restDay.name} como dia completo de descanso.`);
  }

  const usedExerciseIds = new Set<string>();
  const days = trainingWeekdays.map((weekday, index) => {
    const currentSlot = split.slots[index % split.slots.length];
    const dayExercises = selectExercisesForSlot(
      currentSlot,
      filteredExercises,
      usedExerciseIds,
      maxExercises,
      targetDurationMinutes,
      input.profile,
    );

    return {
      planDay: index + 1,
      weekday,
      name: currentSlot.name,
      focus: currentSlot.targets.slice(0, 3).join(", "),
      exercises: dayExercises,
      estimatedDurationMinutes: estimateWorkoutDuration(dayExercises),
      intensity: estimateDayIntensity(currentSlot, dayExercises),
    };
  });
  if (days.some((day) => day.exercises.length === 0)) {
    warnings.push("planner_insufficient_compatible_exercises: al menos una sesion quedo sin ejercicios compatibles.");
  }

  const muscleStats = calculateMuscleStats(days);
  const restExplanation = restDay
    ? ` Seleccionaste 7 dias disponibles; SendaFit reservo ${restDay.name} como descanso completo y programo ${trainingWeekdays.length} sesiones.`
    : "";

  return {
    split: {
      key: split.key,
      name: split.name,
      reason: split.reason,
    },
    goal: labelGoal(input.profile.fitness_goal),
    targetDurationMinutes,
    equipmentMode,
    selectedWeekdays,
    trainingWeekdays,
    restDay,
    days,
    muscleStats,
    warnings: [...new Set(warnings)].slice(0, 6),
    explanation: `${split.reason} El volumen parte de nivel y objetivo, se distribuye por frecuencia y se ajusta al tiempo disponible (${targetDurationMinutes} min), equipo ${equipmentMode} y restricciones registradas.${restExplanation}`,
  };
};

const normalizeDuration = (duration?: number | null): number => {
  if (!duration || duration <= 0) return 60;
  return Math.max(30, Math.min(120, Math.round(duration)));
};

const exercisesPerSession = (duration: number, profile: PlannerProfile): number => {
  const rank = levelRank(profile.fitness_level);
  let count = duration <= 35 ? 4 : duration <= 55 ? 5 : duration <= 75 ? 6 : duration <= 95 ? 7 : 8;
  if (rank <= 1) count = Math.min(count, 6);
  return count;
};

const normalizeWeekdays = (weekdays: number[]): number[] =>
  [...new Set(weekdays)]
    .filter((weekday) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7)
    .sort((a, b) => a - b);

export const requiresMandatoryRestDay = (weekdays: number[]): boolean =>
  normalizeWeekdays(weekdays).length >= 7;

export const selectRestDay = (weekdays: number[], profile: PlannerProfile = {}): RestDay => {
  const selected = normalizeWeekdays(weekdays);
  const level = levelRank(profile.fitness_level);
  const goal = normalizeKey(profile.fitness_goal);
  const preferredBreaks = level <= 2 || ["ganar_masa", "aumentar_masa", "fuerza"].includes(goal)
    ? [4, 5, 3, 6, 2, 7, 1]
    : [5, 4, 6, 3, 7, 2, 1];

  const weekday = preferredBreaks.find((candidate) => selected.includes(candidate)) || selected[3] || 4;
  return {
    weekday,
    name: DAY_NAMES[weekday] || `dia ${weekday}`,
    reason: "Reserva obligatoria cuando el usuario marca disponibilidad los 7 dias; corta cadenas largas de sesiones exigentes y no suma volumen.",
  };
};

const detectEquipmentMode = (profile: PlannerProfile): string => {
  const trainingTypes = toArray(profile.training_types).map(normalizeKey);
  if (trainingTypes.some((type) => type.includes("calistenia"))) return "calistenia";
  if (trainingTypes.some((type) => type.includes("gimnasio") || type.includes("gym") || type.includes("mixto"))) {
    return "gimnasio";
  }
  return "casa";
};

const isExerciseCompatibleWithEquipment = (exercise: PlannerExercise, equipmentMode: string): boolean => {
  const haystack = normalize([
    exercise.lugar,
    exercise.equipamiento,
    ...(exercise.equipo_requerido || []),
  ].join(" "));

  if (equipmentMode === "gimnasio") {
    return !haystack.includes("piscina") && !haystack.includes("pista");
  }

  if (equipmentMode === "calistenia") {
    const allowed = ["peso corporal", "barra de dominadas", "barra", "paralelas", "banco", "cuerda", "suelo", "caja"];
    const blocked = ["maquina", "polea", "discos", "mancuerna", "kettlebell", "rack", "bicicleta", "caminadora"];
    return allowed.some((item) => haystack.includes(item)) && !blocked.some((item) => haystack.includes(item));
  }

  const blockedAtHome = ["maquina", "polea", "barra,", "discos", "rack", "prensa", "caminadora", "escaladora", "remo ergometro"];
  const allowedAtHome = ["peso corporal", "mancuerna", "banda", "kettlebell", "colchoneta", "banco", "cuerda", "pelota", "cualquiera"];
  return allowedAtHome.some((item) => haystack.includes(item)) && !blockedAtHome.some((item) => haystack.includes(item));
};

const isExerciseCompatibleWithLevel = (exercise: PlannerExercise, profile: PlannerProfile): boolean => {
  const userRank = levelRank(profile.fitness_level);
  const exerciseRank = levelRank(exercise.nivel_minimo || exercise.nivel);
  if (exerciseRank >= 3 && userRank < 3) {
    const type = normalize(exercise.tipo_entrenamiento);
    return type.includes("habilidad") && normalizeKey(profile.fitness_goal).includes("habilidad");
  }
  return exerciseRank <= userRank;
};

const isExerciseAllowedByQuality = (exercise: PlannerExercise, profile: PlannerProfile): boolean => {
  const quality = normalize(exercise.estado_calidad || "curado");
  if (quality === "deprecado" || quality === "revisar") return false;
  return true;
};

const detectRestrictions = (profile: PlannerProfile): string[] => {
  const text = normalize([
    ...toArray(profile.health_conditions),
    ...toArray(profile.lesiones_activas),
    profile.injuries_limitations || "",
  ].join(" "));

  const restrictions: string[] = [];
  if (text.includes("rodilla")) restrictions.push("rodilla");
  if (text.includes("lumbar") || text.includes("espalda")) restrictions.push("lumbar");
  if (text.includes("hombro")) restrictions.push("hombro");
  return restrictions;
};

const isExerciseAllowedByRestrictions = (
  exercise: PlannerExercise,
  restrictions: string[],
  warnings: string[],
): boolean => {
  if (restrictions.length === 0) return true;

  const contraText = normalize((exercise.contraindicaciones || []).join(" "));
  const exerciseText = normalize([
    exercise.nombre,
    exercise.grupo_muscular,
    exercise.musculo_principal,
    exercise.patron_movimiento,
  ].join(" "));

  for (const restriction of restrictions) {
    if (contraText.includes(restriction)) {
      warnings.push(`Se evitaron ejercicios con advertencia directa para ${restriction}.`);
      return false;
    }

    if (restriction === "hombro" && exerciseText.includes("remo vertical")) return false;
    if (restriction === "lumbar" && exerciseText.includes("peso muerto convencional")) return false;
    if (restriction === "rodilla" && exerciseText.includes("salto")) return false;
  }

  return true;
};

const selectExercisesForSlot = (
  currentSlot: SplitSlot,
  exercises: PlannerExercise[],
  usedExerciseIds: Set<string>,
  maxExercises: number,
  targetDurationMinutes: number,
  profile: PlannerProfile,
) => {
  const selected: PlannerExercise[] = [];
  const targetCount = maxExercises;
  const requiredPatterns = minimumPatternsForSlot(currentSlot);

  for (const wantedPattern of requiredPatterns) {
    const candidate = bestCandidate(exercises, usedExerciseIds, currentSlot.targets, [wantedPattern], selected, profile);
    if (candidate) {
      selected.push(candidate);
      usedExerciseIds.add(candidate.id);
    }
    if (selected.length >= targetCount) break;
  }

  for (const target of currentSlot.targets) {
    const candidate = bestCandidate(exercises, usedExerciseIds, [target], currentSlot.patterns, selected, profile);
    if (candidate) {
      selected.push(candidate);
      usedExerciseIds.add(candidate.id);
    }
    if (selected.length >= targetCount) break;
  }

  while (selected.length < targetCount) {
    const candidate = bestCandidate(exercises, usedExerciseIds, currentSlot.targets, currentSlot.patterns, selected, profile);
    if (!candidate) break;
    selected.push(candidate);
    usedExerciseIds.add(candidate.id);
    if (estimateWorkoutDuration(selected) >= targetDurationMinutes + 10) break;
  }

  return orderExercisesForSession(selected.slice(0, targetCount));
};

const bestCandidate = (
  exercises: PlannerExercise[],
  usedExerciseIds: Set<string>,
  targets: string[],
  patterns: string[],
  selected: PlannerExercise[],
  profile: PlannerProfile,
) => {
  return exercises
    .filter((exercise) => !usedExerciseIds.has(exercise.id))
    .map((exercise) => ({ exercise, score: scoreExercise(exercise, targets, patterns, selected, profile) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.exercise.nombre.localeCompare(b.exercise.nombre))[0]?.exercise || null;
};

const scoreExercise = (
  exercise: PlannerExercise,
  targets: string[],
  patterns: string[],
  selected: PlannerExercise[],
  profile: PlannerProfile,
): number => {
  const primaryGroup = normalize(exercise.grupo_muscular);
  const primaryMuscle = normalize(exercise.musculo_principal);
  const secondary = normalize((exercise.musculos_secundarios || []).join(" "));
  const pattern = normalize(exercise.patron_movimiento);
  const type = normalize(exercise.tipo_entrenamiento);
  const selectedPatterns = selected.map((item) => normalize(item.patron_movimiento));

  let score = 0;
  for (const target of targets) {
    const normalizedTarget = normalize(target);
    if (primaryMuscle.includes(normalizedTarget)) score += 90;
    if (secondary.includes(normalizedTarget)) score += 35;
    if (primaryGroup.includes(normalizedTarget)) score += 25;
  }

  for (const wantedPattern of patterns) {
    if (pattern.includes(normalize(wantedPattern))) score += 18;
  }

  if (selectedPatterns.filter((item) => item === pattern).length >= 1) score -= 18;
  if (exercise.estado_calidad === "curado") score += 10;
  if ((exercise.series_sugeridas || 0) > 0 || exercise.duracion_promedio_segundos) score += 8;
  if (type.includes("cardio") && !targets.includes("cardio")) score -= 120;
  if (levelRank(exercise.nivel_minimo || exercise.nivel) > levelRank(profile.fitness_level)) score -= 30;
  return score;
};

export const estimateWorkoutDuration = (exercises: PlannerExercise[]): number => {
  const warmupMinutes = exercises.length > 0 ? 6 : 0;
  const changeoverMinutes = Math.max(0, exercises.length - 1) * 2;
  const workMinutes = exercises.reduce((total, exercise) => {
    if (exercise.duracion_promedio_segundos) {
      return total + Math.ceil(exercise.duracion_promedio_segundos / 60);
    }

    const sets = exercise.series_sugeridas || 3;
    const reps = exercise.repeticiones_sugeridas || exercise.rango_reps_max || exercise.rango_reps_min || 10;
    const rest = exercise.descanso_segundos_max || exercise.descanso_segundos_min || 75;
    const secondsPerRep = 3;
    return total + Math.ceil((sets * reps * secondsPerRep + Math.max(0, sets - 1) * rest) / 60);
  }, 0);

  return workMinutes + warmupMinutes + changeoverMinutes;
};

const calculateMuscleStats = (days: PlannedDay[]): MuscleStat[] => {
  const stats = new Map<string, { days: Set<number>; directSets: number; indirectSets: number }>();

  days.forEach((day) => {
    day.exercises.forEach((exercise) => {
      if (normalize(exercise.tipo_entrenamiento).includes("cardio")) return;

      const directMuscle = normalizeMuscle(exercise.musculo_principal || exercise.grupo_muscular || "general");
      const sets = exercise.series_sugeridas || 3;
      addMuscleStat(stats, directMuscle, day.planDay, sets * DIRECT_SET_WEIGHT, 0);

      const secondaryMuscles = [...new Set((exercise.musculos_secundarios || []).map(normalizeMuscle))]
        .filter((muscle) => muscle && muscle !== directMuscle);

      for (const secondary of secondaryMuscles) {
        addMuscleStat(stats, secondary, day.planDay, 0, sets * INDIRECT_SET_WEIGHT);
      }
    });
  });

  return [...stats.entries()]
    .map(([muscle, value]) => {
      const totalSets = value.directSets + value.indirectSets;
      return {
        muscle,
        frequency: value.days.size,
        directSets: value.directSets,
        indirectSets: value.indirectSets,
        totalSets,
        status: volumeStatus(totalSets),
      };
    })
    .filter((item) => item.totalSets > 0)
    .sort((a, b) => b.totalSets - a.totalSets)
    .slice(0, 12);
};

const orderExercisesForSession = (exercises: PlannerExercise[]): PlannerExercise[] =>
  [...exercises].sort((a, b) => exerciseOrderScore(a) - exerciseOrderScore(b) || a.nombre.localeCompare(b.nombre));

const exerciseOrderScore = (exercise: PlannerExercise): number => {
  const pattern = normalize(exercise.patron_movimiento);
  const type = normalize(exercise.tipo_entrenamiento);
  const name = normalize(exercise.nombre);

  if (type.includes("potencia") || type.includes("habilidad")) return 10;
  if (
    pattern.includes("sentadilla") ||
    pattern.includes("bisagra") ||
    pattern.includes("empuje horizontal") ||
    pattern.includes("empuje vertical") ||
    pattern.includes("jalon horizontal") ||
    pattern.includes("jalon vertical")
  ) return 20;
  if (pattern.includes("unilateral")) return 30;
  if (pattern.includes("abduccion") || pattern.includes("curl") || name.includes("elevacion")) return 50;
  if (type.includes("core") || pattern.includes("anti-") || pattern.includes("rotacion")) return 70;
  if (type.includes("cardio")) return 90;
  return 40;
};

const addMuscleStat = (
  stats: Map<string, { days: Set<number>; directSets: number; indirectSets: number }>,
  muscle: string,
  day: number,
  directSets: number,
  indirectSets: number,
) => {
  if (!stats.has(muscle)) {
    stats.set(muscle, { days: new Set<number>(), directSets: 0, indirectSets: 0 });
  }

  const value = stats.get(muscle)!;
  value.days.add(day);
  value.directSets += directSets;
  value.indirectSets += indirectSets;
};

const normalizeMuscle = (muscle: string): string => {
  const normalized = normalize(muscle);
  if (normalized.includes("bicep")) return "biceps";
  if (normalized.includes("tricep")) return "triceps";
  if (normalized.includes("cuadricep")) return "cuadriceps";
  if (normalized.includes("glute")) return "gluteos";
  if (normalized.includes("dorsal") || normalized.includes("espalda")) return "espalda";
  if (normalized.includes("pectoral") || normalized.includes("pecho")) return "pecho";
  if (normalized.includes("deltoides") || normalized.includes("hombro")) return "hombros";
  if (normalized.includes("isquio")) return "isquiosurales";
  if (normalized.includes("pantorrilla") || normalized.includes("soleo") || normalized.includes("gastrocnemio")) return "pantorrillas";
  return normalized || "general";
};

const volumeStatus = (sets: number): "bajo" | "adecuado" | "alto" => {
  if (sets < 6) return "bajo";
  if (sets > 20) return "alto";
  return "adecuado";
};

const minimumPatternsForSlot = (slot: SplitSlot): string[] => {
  const targets = slot.targets.map(normalize).join(" ");
  const patterns = slot.patterns.map(normalize);

  if (targets.includes("espalda") || patterns.some((pattern) => pattern.includes("jalon"))) {
    return ["jalon vertical", "jalon horizontal"];
  }

  if (targets.includes("piernas") || targets.includes("gluteos")) {
    return ["sentadilla", "bisagra", "flexion de rodilla"];
  }

  if (targets.includes("pecho") || patterns.some((pattern) => pattern.includes("empuje"))) {
    return ["empuje horizontal", "empuje vertical"];
  }

  return patterns;
};

const estimateDayIntensity = (slot: SplitSlot, exercises: PlannerExercise[]): "moderada" | "exigente" => {
  const haystack = normalize([
    slot.name,
    slot.targets.join(" "),
    slot.patterns.join(" "),
    exercises.map((exercise) => `${exercise.patron_movimiento} ${exercise.tipo_entrenamiento}`).join(" "),
  ].join(" "));

  if (
    exercises.length >= 6 ||
    haystack.includes("pierna") ||
    haystack.includes("sentadilla") ||
    haystack.includes("bisagra") ||
    haystack.includes("fuerza")
  ) {
    return "exigente";
  }

  return "moderada";
};

const labelGoal = (goal?: string | null): string => {
  const normalized = normalizeKey(goal);
  const labels: Record<string, string> = {
    ganar_masa: "Ganar masa",
    aumentar_masa: "Ganar masa",
    bajar_peso: "Perder grasa",
    perder_peso: "Perder grasa",
    bajar_grasa: "Perder grasa",
    mantener_peso: "Mantener",
    tonificar: "Tonificar",
  };
  return labels[normalized] || String(goal || "General");
};
