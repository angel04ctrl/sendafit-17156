import type { ProgressionConfidence } from "@/lib/progression";

export const RIR_LABEL = "Repeticiones en reserva";
export const RIR_HELP =
  "Cuantas repeticiones mas crees que podrias hacer al terminar la serie. Ejemplo: 2 significa que aun podrias hacer 2 repeticiones mas.";

export const RPE_LABEL = "Esfuerzo percibido";
export const RPE_HELP = "Que tan dificil se sintio la serie del 1 al 10. 10 significa esfuerzo maximo.";

export const PERSONAL_RECORD_HELP = "Record personal: tu mejor marca registrada en este ejercicio.";

export function getProgressionContextLabel(confidence: ProgressionConfidence) {
  if (confidence === "low") return "Recomendacion inicial";
  return "Sugerencia con historial";
}
