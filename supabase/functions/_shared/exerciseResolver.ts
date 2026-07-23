export interface RoutineExerciseInput {
  name: string;
  sets?: number;
  reps?: number;
  notes?: string;
  duration_minutes?: number;
}

export interface CatalogExercise {
  id: string;
  nombre: string;
  aliases?: string[] | string | null;
  nivel_minimo?: string | null;
  nivel?: string | null;
  estado_calidad?: string | null;
  equipo_requerido?: string[] | string | null;
  equipamiento?: string | null;
  tipo_entrenamiento?: string | null;
  descanso_segundos_min?: number | null;
  descanso_segundos_max?: number | null;
  rir_recomendado?: number | null;
}

export interface ExerciseResolution {
  ok: boolean;
  inputName: string;
  exercise?: CatalogExercise;
  canonicalName?: string;
  reason?: "exact" | "alias" | "canonical_alias" | "safe_substitution" | "fuzzy";
  substitution?: boolean;
  message?: string;
  candidates?: CatalogExercise[];
}

const CANONICAL_ALIASES: Record<string, string[]> = {
  "fondos en paralelas": ["Fondos en paralelas para pecho", "Fondos en banco para triceps"],
  "fondos paralelas": ["Fondos en paralelas para pecho", "Fondos en banco para triceps"],
  "fondos": ["Fondos en paralelas para pecho", "Fondos en banco para triceps"],
  "dips": ["Fondos en paralelas para pecho", "Fondos en banco para triceps"],
  "press de triceps en polea": ["Pushdown de triceps en polea"],
  "press triceps polea": ["Pushdown de triceps en polea"],
  "jalon de triceps": ["Pushdown de triceps en polea"],
  "jalon de triceps en polea": ["Pushdown de triceps en polea"],
  "extension de triceps en polea": ["Pushdown de triceps en polea"],
  "extension de triceps con mancuerna sobre la cabeza": [
    "Extension de triceps por encima de la cabeza con mancuerna",
  ],
  "extension de triceps con mancuerna por encima de la cabeza": [
    "Extension de triceps por encima de la cabeza con mancuerna",
  ],
  "extension triceps mancuerna overhead": [
    "Extension de triceps por encima de la cabeza con mancuerna",
  ],
  "dominadas asistidas": ["Jalon al pecho", "Dominadas"],
  "dominada asistida": ["Jalon al pecho", "Dominadas"],
  "assisted pull up": ["Jalon al pecho", "Dominadas"],
  "assisted pull ups": ["Jalon al pecho", "Dominadas"],
  "press inclinado con mancuerdas": ["Press inclinado con mancuernas"],
  "press inclinado mancuerda": ["Press inclinado con mancuernas"],
  "press inclinado mancuernas": ["Press inclinado con mancuernas"],
  "incline dumbbell press": ["Press inclinado con mancuernas"],
};

const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bmancuerda(s)?\b/g, "mancuerna$1"],
  [/\btricep\b/g, "triceps"],
  [/\btricepss\b/g, "triceps"],
  [/\bjalon\b/g, "jalon"],
  [/\bpressdown\b/g, "pushdown"],
  [/\bpullups\b/g, "pull ups"],
  [/\bpull-up(s)?\b/g, "pull up$1"],
];

export function normalizeExerciseText(value: unknown): string {
  let normalized = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

export function toTextArray(value: unknown): string[] {
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
}

export function levelRank(level: unknown): number {
  const normalized = normalizeExerciseText(level);
  if (["avanzado", "p", "profesional"].includes(normalized)) return 3;
  if (["intermedio", "i"].includes(normalized)) return 2;
  return 1;
}

export function isCatalogExerciseUsable(exercise: CatalogExercise, profileLevel?: unknown): boolean {
  const quality = normalizeExerciseText(exercise.estado_calidad || "curado");
  if (["deprecado", "revisar"].includes(quality)) return false;
  return levelRank(exercise.nivel_minimo || exercise.nivel) <= levelRank(profileLevel);
}

function exerciseNames(exercise: CatalogExercise): string[] {
  return [exercise.nombre, ...toTextArray(exercise.aliases)].map(normalizeExerciseText).filter(Boolean);
}

function findByName(catalog: CatalogExercise[], wanted: string): CatalogExercise[] {
  return catalog.filter((exercise) => exerciseNames(exercise).includes(wanted));
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter((token) => token.length > 2));
  const bTokens = new Set(b.split(" ").filter((token) => token.length > 2));
  if (!aTokens.size || !bTokens.size) return 0;
  const shared = [...aTokens].filter((token) => bTokens.has(token)).length;
  return shared / Math.max(aTokens.size, bTokens.size);
}

function rankCandidates(candidates: CatalogExercise[], profileLevel?: unknown): CatalogExercise[] {
  return candidates
    .filter((exercise) => isCatalogExerciseUsable(exercise, profileLevel))
    .sort((a, b) => {
      const levelDelta = levelRank(a.nivel_minimo || a.nivel) - levelRank(b.nivel_minimo || b.nivel);
      if (levelDelta !== 0) return levelDelta;
      return String(a.nombre).localeCompare(String(b.nombre));
    });
}

export function resolveExercise(
  name: string,
  catalog: CatalogExercise[],
  profileLevel?: unknown,
): ExerciseResolution {
  const wanted = normalizeExerciseText(name);
  if (!wanted) return { ok: false, inputName: name, message: "Nombre de ejercicio vacio." };

  const exactMatches = rankCandidates(findByName(catalog, wanted), profileLevel);
  if (exactMatches.length === 1) {
    return { ok: true, inputName: name, exercise: exactMatches[0], reason: "exact" };
  }
  if (exactMatches.length > 1) {
    const canonicalExact = exactMatches.find((exercise) => normalizeExerciseText(exercise.nombre) === wanted);
    if (canonicalExact) return { ok: true, inputName: name, exercise: canonicalExact, reason: "exact" };
    return { ok: false, inputName: name, candidates: exactMatches, message: "Ejercicio ambiguo." };
  }

  const canonicalTargets = CANONICAL_ALIASES[wanted] || [];
  for (const target of canonicalTargets) {
    const matches = rankCandidates(findByName(catalog, normalizeExerciseText(target)), profileLevel);
    if (matches.length > 0) {
      const selected = matches[0];
      return {
        ok: true,
        inputName: name,
        exercise: selected,
        canonicalName: selected.nombre,
        reason: "canonical_alias",
        substitution: normalizeExerciseText(selected.nombre) !== wanted,
        message: selected.nombre !== name ? `${name} -> ${selected.nombre}` : undefined,
      };
    }
  }

  const fuzzy = rankCandidates(
    catalog.filter((exercise) => exerciseNames(exercise).some((candidate) => {
      if (candidate.includes(wanted) || wanted.includes(candidate)) return Math.min(candidate.length, wanted.length) >= 8;
      return tokenSimilarity(wanted, candidate) >= 0.75;
    })),
    profileLevel,
  );

  if (fuzzy.length === 1) {
    return { ok: true, inputName: name, exercise: fuzzy[0], reason: "fuzzy", substitution: true, message: `${name} -> ${fuzzy[0].nombre}` };
  }

  return {
    ok: false,
    inputName: name,
    candidates: fuzzy.slice(0, 5),
    message: fuzzy.length > 1 ? "Ejercicio ambiguo." : "Ejercicio no encontrado.",
  };
}

export function resolveRoutineExercises<TDay extends { exercises: RoutineExerciseInput[] }>(
  days: TDay[],
  catalog: CatalogExercise[],
  profileLevel?: unknown,
) {
  const unresolved: string[] = [];
  const incompatible: string[] = [];
  const ambiguous: Record<string, string[]> = {};
  const substitutions: string[] = [];
  const resolvedByKey = new Map<string, CatalogExercise>();

  days.forEach((day, dayIndex) => {
    (day.exercises || []).forEach((exercise, exerciseIndex) => {
      const key = `${dayIndex}:${exerciseIndex}`;
      const resolution = resolveExercise(exercise.name, catalog, profileLevel);
      if (!resolution.ok || !resolution.exercise) {
        if (resolution.candidates?.length) {
          ambiguous[exercise.name] = resolution.candidates.map((candidate) => `${candidate.id}:${candidate.nombre}`);
        } else {
          unresolved.push(exercise.name);
        }
        return;
      }

      if (!isCatalogExerciseUsable(resolution.exercise, profileLevel)) {
        incompatible.push(`${exercise.name} -> ${resolution.exercise.nombre}`);
        return;
      }

      resolvedByKey.set(key, resolution.exercise);
      if (resolution.substitution || exercise.name.trim() !== resolution.exercise.nombre) {
        substitutions.push(`${exercise.name} -> ${resolution.exercise.nombre}`);
        exercise.name = resolution.exercise.nombre;
      }
    });
  });

  return {
    ok: unresolved.length === 0 && incompatible.length === 0 && Object.keys(ambiguous).length === 0,
    unresolved,
    incompatible,
    ambiguous,
    substitutions,
    resolvedByKey,
  };
}
