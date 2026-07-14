export type PlanSource = "planner" | "predesigned" | "ai_coach" | "manual" | "personalized" | "legacy_unknown";

export const REPLACEABLE_PLAN_SOURCES: PlanSource[] = ["planner", "predesigned"];
export const PROTECTED_PLAN_SOURCES: PlanSource[] = ["ai_coach", "manual", "personalized", "legacy_unknown"];

export const normalizePlanSource = (value: unknown): PlanSource => {
  const source = String(value || "").toLowerCase().trim();
  if (source === "planner") return "planner";
  if (source === "predesigned") return "predesigned";
  if (source === "ai_coach") return "ai_coach";
  if (source === "manual") return "manual";
  if (source === "personalized") return "personalized";
  return "legacy_unknown";
};

export const canAutomaticPlannerReplaceWorkout = (workout: {
  tipo?: string | null;
  plan_source?: string | null;
  is_protected?: boolean | null;
  completed?: boolean | null;
}): boolean => {
  if (workout.completed) return false;
  if (workout.tipo !== "automatico") return false;

  const source = normalizePlanSource(workout.plan_source);
  if (workout.is_protected === true) return false;
  return REPLACEABLE_PLAN_SOURCES.includes(source);
};
