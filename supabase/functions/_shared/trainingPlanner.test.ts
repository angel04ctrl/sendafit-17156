import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { canAutomaticPlannerReplaceWorkout, normalizePlanSource } from "./planIdentity.ts";
import { buildTrainingPlan, requiresMandatoryRestDay } from "./trainingPlanner.ts";

const weekdays = {
  three: [1, 3, 6],
  four: [1, 2, 4, 6],
  five: [1, 2, 3, 6, 7],
  six: [1, 2, 3, 4, 5, 6],
  seven: [1, 2, 3, 4, 5, 6, 7],
};

const catalog = [
  exercise("press-db", "Press de banca con mancuernas", "pecho", "pectoral mayor", ["triceps", "deltoides anterior"], "mancuernas, banco", ["mancuernas", "banco"], "empuje horizontal", "fuerza", "principiante"),
  exercise("pushup", "Lagartijas", "pecho", "pectoral mayor", ["triceps", "core"], "peso corporal", ["peso corporal"], "empuje horizontal", "fuerza", "principiante"),
  exercise("incline-pushup", "Lagartijas inclinadas", "pecho", "pectoral mayor", ["triceps", "core"], "banco o superficie elevada", ["banco"], "empuje horizontal", "fuerza", "principiante"),
  exercise("shoulder-db", "Press de hombro con mancuernas", "hombros", "deltoides anterior", ["triceps"], "mancuernas", ["mancuernas"], "empuje vertical", "fuerza", "principiante", ["Evitar si hay dolor de hombro"]),
  exercise("lateral-raise", "Elevaciones laterales con mancuernas", "hombros", "deltoides lateral", ["trapecio"], "mancuernas", ["mancuernas"], "abduccion hombro", "fuerza", "principiante"),
  exercise("row-cable", "Remo en polea sentado", "espalda", "espalda media", ["dorsal ancho", "biceps"], "polea baja", ["polea baja"], "jalon horizontal", "fuerza", "principiante"),
  exercise("row-db", "Remo con mancuerna a una mano", "espalda", "dorsal ancho", ["romboides", "biceps"], "mancuerna, banco", ["mancuerna", "banco"], "jalon horizontal", "fuerza", "principiante"),
  exercise("pullup", "Dominadas", "espalda", "dorsal ancho", ["biceps", "core"], "barra de dominadas", ["barra de dominadas"], "jalon vertical", "fuerza", "intermedio"),
  exercise("lat-pulldown", "Jalon al pecho", "espalda", "dorsal ancho", ["biceps"], "polea alta", ["polea alta"], "jalon vertical", "fuerza", "principiante"),
  exercise("rower", "Remo ergometro", "cardio", "sistema cardiovascular", ["dorsal ancho", "piernas"], "remo ergometro", ["remo ergometro"], "locomocion/cardio", "cardio", "principiante"),
  exercise("squat-body", "Sentadilla con peso corporal", "piernas", "cuadriceps", ["gluteos", "core"], "peso corporal", ["peso corporal"], "sentadilla", "fuerza", "principiante", ["Reducir profundidad si hay dolor de rodilla"]),
  exercise("leg-press", "Prensa de piernas", "piernas", "cuadriceps", ["gluteos"], "maquina de prensa", ["maquina de prensa"], "sentadilla en maquina", "fuerza", "principiante", ["Evitar si hay dolor de rodilla"]),
  exercise("rdl-db", "Peso muerto rumano con mancuernas", "piernas", "isquiosurales", ["gluteos", "erectores espinales"], "mancuernas", ["mancuernas"], "bisagra de cadera", "fuerza", "principiante", ["Evitar si hay dolor lumbar"]),
  exercise("glute-bridge", "Puente de gluteo", "piernas", "gluteos", ["isquiosurales", "core"], "peso corporal", ["peso corporal"], "bisagra de cadera", "fuerza", "principiante"),
  exercise("leg-curl", "Curl femoral en maquina", "piernas", "isquiosurales", ["gastrocnemio"], "maquina de curl femoral", ["maquina"], "flexion de rodilla", "fuerza", "principiante"),
  exercise("step-up", "Step-ups", "piernas", "cuadriceps", ["gluteos", "core"], "banco o caja estable", ["banco"], "sentadilla unilateral", "fuerza", "principiante"),
  exercise("calf", "Elevacion de talones en escalon", "piernas", "gastrocnemio", ["soleo"], "escalon", ["escalon"], "flexion plantar", "fuerza", "principiante"),
  exercise("plank", "Plancha abdominal", "core", "core", ["hombros", "gluteos"], "peso corporal", ["peso corporal"], "anti-extension", "core", "principiante"),
  exercise("curl", "Curl de biceps con mancuernas", "brazos", "biceps braquial", ["braquial"], "mancuernas", ["mancuernas"], "curl de codo", "fuerza", "principiante"),
  exercise("advanced-planche", "Planche", "cuerpo completo", "hombros", ["core"], "peso corporal", ["peso corporal"], "habilidad avanzada", "habilidad", "avanzado", [], "revisar"),
];

Deno.test("Caso A: principiante, 3 dias, gimnasio, hipertrofia, 60 min", () => {
  const plan = buildTrainingPlan({
    profile: profile("principiante", "ganar_masa", ["gimnasio"], 60),
    selectedWeekdays: weekdays.three,
    exercises: catalog,
  });

  assertEquals(plan.days.length, 3);
  assert(plan.split.key === "full_body_abc" || plan.split.key === "ppl_basic");
  assert(!containsExercise(plan, "advanced-planche"));
});

Deno.test("Caso B: intermedio, 5 dias, gimnasio, hipertrofia, 75 min", () => {
  const plan = buildTrainingPlan({
    profile: profile("intermedio", "ganar_masa", ["gimnasio"], 75),
    selectedWeekdays: weekdays.five,
    exercises: catalog,
  });

  assertEquals(plan.days.length, 5);
  assert(hasPattern(plan, "jalon horizontal"));
  assert(hasPattern(plan, "jalon vertical"));
  assert(hasPattern(plan, "sentadilla"));
  assert(hasPattern(plan, "bisagra"));
});

Deno.test("Caso C: principiante, 3 dias, casa, 45 min", () => {
  const plan = buildTrainingPlan({
    profile: profile("principiante", "general", ["casa"], 45),
    selectedWeekdays: weekdays.three,
    exercises: catalog,
  });

  assertEquals(plan.days.length, 3);
  assert(!allExercises(plan).some((item) => normalizeEquipment(item).match(/maquina|polea|prensa|ergometro/)));
});

Deno.test("Caso D: intermedio, 4 dias, calistenia, 60 min", () => {
  const plan = buildTrainingPlan({
    profile: profile("intermedio", "general", ["calistenia"], 60),
    selectedWeekdays: weekdays.four,
    exercises: catalog,
  });

  assertEquals(plan.days.length, 4);
  assert(!allExercises(plan).some((item) => normalizeEquipment(item).match(/maquina|polea|prensa/)));
  assert(!containsExercise(plan, "advanced-planche"));
});

Deno.test("Caso E: intermedio, 5 dias, gimnasio, restriccion hombro", () => {
  const plan = buildTrainingPlan({
    profile: { ...profile("intermedio", "ganar_masa", ["gimnasio"], 60), injuries_limitations: "molestia de hombro" },
    selectedWeekdays: weekdays.five,
    exercises: catalog,
  });

  assertEquals(plan.days.length, 5);
  assert(plan.warnings.length > 0);
  assert(!containsExercise(plan, "shoulder-db"));
});

Deno.test("Caso F: intermedio, 4 dias, gimnasio, rodilla + lumbar", () => {
  const plan = buildTrainingPlan({
    profile: { ...profile("intermedio", "ganar_masa", ["gimnasio"], 60), injuries_limitations: "rodilla y lumbar" },
    selectedWeekdays: weekdays.four,
    exercises: catalog,
  });

  assertEquals(plan.days.length, 4);
  assert(plan.warnings.length > 0);
  assert(!containsExercise(plan, "leg-press"));
  assert(!containsExercise(plan, "rdl-db"));
});

Deno.test("Caso G: 7 dias seleccionados reserva descanso obligatorio", () => {
  const plan = buildTrainingPlan({
    profile: profile("intermedio", "ganar_masa", ["gimnasio"], 60),
    selectedWeekdays: weekdays.seven,
    exercises: catalog,
  });

  assert(requiresMandatoryRestDay(weekdays.seven));
  assertEquals(plan.selectedWeekdays.length, 7);
  assertEquals(plan.trainingWeekdays.length, 6);
  assertEquals(plan.days.length, 6);
  assert(plan.restDay);
  assert(!plan.trainingWeekdays.includes(plan.restDay!.weekday));
  assert(plan.restDay!.weekday !== 7);
});

Deno.test("Caso I: 6 dias no inserta descanso adicional", () => {
  const plan = buildTrainingPlan({
    profile: profile("intermedio", "ganar_masa", ["gimnasio"], 60),
    selectedWeekdays: weekdays.six,
    exercises: catalog,
  });

  assertEquals(plan.trainingWeekdays.length, 6);
  assertEquals(plan.days.length, 6);
  assertEquals(plan.restDay, null);
});

Deno.test("Suite 1-7 dias: respeta entrenamientos maximos y descanso obligatorio", () => {
  for (let selectedCount = 1; selectedCount <= 7; selectedCount += 1) {
    const selectedWeekdays = [1, 2, 3, 4, 5, 6, 7].slice(0, selectedCount);
    const plan = buildTrainingPlan({
      profile: profile("intermedio", "ganar_masa", ["gimnasio"], 60),
      selectedWeekdays,
      exercises: catalog,
    });

    assertEquals(plan.days.length, Math.min(selectedCount, 6));
    assertEquals(plan.trainingWeekdays.length, Math.min(selectedCount, 6));

    if (selectedCount < 7) {
      assertEquals(plan.restDay, null);
      assertEquals(plan.trainingWeekdays, selectedWeekdays);
    } else {
      assert(plan.restDay);
      assert(!plan.trainingWeekdays.includes(plan.restDay!.weekday));
    }
  }
});

Deno.test("Caso J: determinismo con mismo input produce mismo plan", () => {
  const input = {
    profile: profile("intermedio", "ganar_masa", ["gimnasio"], 60),
    selectedWeekdays: weekdays.seven,
    exercises: catalog,
  };
  const first = buildTrainingPlan(input);
  const second = buildTrainingPlan(input);

  assertEquals(JSON.stringify(first), JSON.stringify(second));
});

Deno.test("Caso M: aliases de objetivo generan la misma estructura", () => {
  const ganarMasa = buildTrainingPlan({
    profile: profile("intermedio", "ganar_masa", ["gimnasio"], 60),
    selectedWeekdays: weekdays.three,
    exercises: catalog,
  });
  const aumentarMasa = buildTrainingPlan({
    profile: profile("intermedio", "aumentar_masa", ["gimnasio"], 60),
    selectedWeekdays: weekdays.three,
    exercises: catalog,
  });

  assertEquals(ganarMasa.split.key, aumentarMasa.split.key);
  assertEquals(ganarMasa.trainingWeekdays, aumentarMasa.trainingWeekdays);
});

Deno.test("Caso T: pool vacio falla de forma clara", () => {
  const plan = buildTrainingPlan({
    profile: { ...profile("principiante", "general", ["calistenia"], 45), injuries_limitations: "hombro lumbar rodilla" },
    selectedWeekdays: weekdays.three,
    exercises: [
      exercise("only-machine", "Prensa de piernas", "piernas", "cuadriceps", ["gluteos"], "maquina de prensa", ["maquina"], "sentadilla", "fuerza", "principiante", ["dolor de rodilla"]),
    ],
  });

  assert(plan.warnings.some((warning) => warning.includes("planner_insufficient_compatible_exercises")));
  assert(plan.days.some((day) => day.exercises.length === 0));
});

Deno.test("Caso U: volumen directo e indirecto usa 1.0 y 0.5", () => {
  const plan = buildTrainingPlan({
    profile: profile("principiante", "general", ["gimnasio"], 45),
    selectedWeekdays: [1],
    exercises: [
      exercise("bench-known", "Press banca", "pecho", "pectoral mayor", ["triceps", "deltoides anterior"], "mancuernas", ["mancuernas"], "empuje horizontal", "fuerza", "principiante", [], "curado", 4),
    ],
  });

  const pecho = plan.muscleStats.find((stat) => stat.muscle === "pecho");
  const triceps = plan.muscleStats.find((stat) => stat.muscle === "triceps");

  assertEquals(pecho?.directSets, 4);
  assertEquals(triceps?.indirectSets, 2);
});

Deno.test("Caso V: dos ejercicios del mismo musculo en una sesion cuentan frecuencia 1", () => {
  const plan = buildTrainingPlan({
    profile: profile("intermedio", "ganar_masa", ["gimnasio"], 60),
    selectedWeekdays: [1],
    exercises: [
      exercise("bench-a", "Press banca A", "pecho", "pectoral mayor", ["triceps"], "mancuernas", ["mancuernas"], "empuje horizontal", "fuerza", "principiante"),
      exercise("bench-b", "Press banca B", "pecho", "pectoral mayor", ["triceps"], "mancuernas", ["mancuernas"], "empuje horizontal", "fuerza", "principiante"),
      exercise("row-a", "Remo", "espalda", "dorsal ancho", ["biceps"], "polea baja", ["polea baja"], "jalon horizontal", "fuerza", "principiante"),
    ],
  });

  const pecho = plan.muscleStats.find((stat) => stat.muscle === "pecho");
  assertEquals(pecho?.frequency, 1);
});

Deno.test("Caso W: remo ergometro no cubre jalon horizontal de fuerza", () => {
  const plan = buildTrainingPlan({
    profile: profile("principiante", "ganar_masa", ["gimnasio"], 60),
    selectedWeekdays: weekdays.three,
    exercises: [
      exercise("rower-only", "Remo ergometro", "cardio", "sistema cardiovascular", ["dorsal ancho"], "remo ergometro", ["remo ergometro"], "locomocion/cardio", "cardio", "principiante"),
      exercise("push-only", "Lagartijas", "pecho", "pectoral mayor", ["triceps"], "peso corporal", ["peso corporal"], "empuje horizontal", "fuerza", "principiante"),
    ],
  });

  assert(!containsExercise(plan, "rower-only"));
  assert(plan.warnings.some((warning) => warning.includes("planner_insufficient_compatible_exercises")));
});

Deno.test("Caso X: compuestos principales antes de aislamientos", () => {
  const plan = buildTrainingPlan({
    profile: profile("intermedio", "ganar_masa", ["gimnasio"], 60),
    selectedWeekdays: [1],
    exercises: [
      exercise("lateral-first", "Elevaciones laterales", "hombros", "deltoides lateral", ["trapecio"], "mancuernas", ["mancuernas"], "abduccion hombro", "fuerza", "principiante"),
      exercise("press-main", "Press banca", "pecho", "pectoral mayor", ["triceps"], "mancuernas", ["mancuernas"], "empuje horizontal", "fuerza", "principiante"),
    ],
  });

  assertEquals(plan.days[0].exercises[0].id, "press-main");
});

Deno.test("Caso AA: planner no protegido puede reemplazarse", () => {
  assertEquals(canAutomaticPlannerReplaceWorkout({
    tipo: "automatico",
    completed: false,
    plan_source: "planner",
    is_protected: false,
  }), true);
});

Deno.test("Caso AB: ai_coach queda protegido contra reemplazo automatico", () => {
  assertEquals(canAutomaticPlannerReplaceWorkout({
    tipo: "automatico",
    completed: false,
    plan_source: "ai_coach",
    is_protected: true,
  }), false);
});

Deno.test("Caso AC: manual y legacy_unknown no son reemplazables", () => {
  assertEquals(canAutomaticPlannerReplaceWorkout({
    tipo: "manual",
    completed: false,
    plan_source: "manual",
    is_protected: true,
  }), false);
  assertEquals(canAutomaticPlannerReplaceWorkout({
    tipo: "automatico",
    completed: false,
    plan_source: "legacy_unknown",
    is_protected: true,
  }), false);
});

Deno.test("Caso AD: fuentes desconocidas normalizan a legacy_unknown", () => {
  assertEquals(normalizePlanSource("otra_fuente"), "legacy_unknown");
  assertEquals(normalizePlanSource(null), "legacy_unknown");
});

function profile(fitness_level: string, fitness_goal: string, training_types: string[], session_duration_minutes: number) {
  return {
    fitness_level,
    fitness_goal,
    training_types,
    session_duration_minutes,
  };
}

function exercise(
  id: string,
  nombre: string,
  grupo_muscular: string,
  musculo_principal: string,
  musculos_secundarios: string[],
  equipamiento: string,
  equipo_requerido: string[],
  patron_movimiento: string,
  tipo_entrenamiento: string,
  nivel_minimo: string,
  contraindicaciones: string[] = [],
  estado_calidad = "curado",
  series_sugeridas = 3,
) {
  return {
    id,
    nombre,
    grupo_muscular,
    musculo_principal,
    musculos_secundarios,
    equipamiento,
    equipo_requerido,
    lugar: equipamiento.includes("maquina") || equipamiento.includes("polea") ? "gimnasio" : "cualquiera",
    patron_movimiento,
    tipo_entrenamiento,
    nivel_minimo,
    contraindicaciones,
    estado_calidad,
    series_sugeridas,
    repeticiones_sugeridas: 10,
    rango_reps_min: 8,
    rango_reps_max: 12,
    descanso_segundos_min: 60,
    descanso_segundos_max: 90,
  };
}

function allExercises(plan: ReturnType<typeof buildTrainingPlan>) {
  return plan.days.flatMap((day) => day.exercises);
}

function containsExercise(plan: ReturnType<typeof buildTrainingPlan>, id: string) {
  return allExercises(plan).some((item) => item.id === id);
}

function hasPattern(plan: ReturnType<typeof buildTrainingPlan>, pattern: string) {
  return allExercises(plan).some((item) => normalizeText(item.patron_movimiento).includes(normalizeText(pattern)));
}

function normalizeEquipment(exercise: ReturnType<typeof allExercises>[number]) {
  return normalizeText(`${exercise.equipamiento || ""} ${(exercise.equipo_requerido || []).join(" ")}`);
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
