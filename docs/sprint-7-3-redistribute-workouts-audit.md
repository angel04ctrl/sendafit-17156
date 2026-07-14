# Sprint 7.3 - Auditoria de redistribute-workouts

## Estado anterior

`supabase/functions/redistribute-workouts` era una autoridad legacy separada:

- Leia `profiles.available_weekdays`.
- Leia `plan_ejercicios`.
- Borraba todos los `workouts` automaticos del usuario.
- Insertaba nuevos `workouts` y `workout_exercises`.

Ese comportamiento chocaba con Sprint 7.2 y 7.3 porque no respetaba identidad, proteccion, sesiones activas, prescripcion completa ni la logica profesional del planner.

## Decision

Se eligio una salida segura de compatibilidad: el endpoint sigue existiendo, autentica al usuario y responde `409 redistribute_workouts_legacy_disabled`.

No borra datos, no crea planes y no compite con `generate-weekly-workouts`.

## Autoridad vigente

La redistribucion/regeneracion debe pasar por:

- `generate-weekly-workouts` para generar una semana desde el planner profesional.
- `assign-routine` durante asignacion inicial o reasignacion compatible.

Ambos flujos:

- Usan `buildTrainingPlan`.
- Materializan `plan_source`, `is_protected`, `exercise_id`, `rest_seconds`, `target_rir` y `order_index`.
- Bloquean reemplazo de planes protegidos o con sesiones.

## Compatibilidad frontend

`src/lib/api/backend.ts` conserva el wrapper `redistributeWorkouts` para no romper imports existentes, pero cualquier llamada recibira el bloqueo explicito del endpoint legacy.
