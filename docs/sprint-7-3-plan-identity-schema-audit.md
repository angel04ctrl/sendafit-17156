# Sprint 7.3 - Auditoria de identidad de planes y prescripcion

## Alcance

Sprint 7.3 cierra las deudas de integracion del planner profesional sin entrar en Sprint 8 ni cambiar sustituciones, calendario, macros, coach o biblioteca multimedia.

## Hallazgos

- `workouts` no distinguia origen del plan materializado. Un entrenamiento del planner, uno predefinido legacy, uno manual y uno del AI Coach se veian igual salvo por `tipo`, `plan_id` y texto libre.
- No habia bandera explicita para proteger entrenamientos con historial, manuales o generados por AI Coach ante regeneraciones automaticas.
- `workout_exercises` tenia `exercise_id`, pero los flujos de IA podian guardar ejercicios por texto libre sin resolver contra `public.exercises`.
- El planner calculaba descanso y RIR desde `exercises`, pero esos valores no quedaban congelados en la prescripcion del entrenamiento.
- `redistribute-workouts` conservaba una ruta destructiva legacy que podia borrar y recrear sin pasar por la autoridad nueva del planner.

## Migracion

Archivo: `supabase/migrations/20260705010000_sprint7_3_plan_identity_and_prescription.sql`

Cambios en `public.workouts`:

- `plan_source text not null default 'legacy_unknown'`
- `is_protected boolean not null default true`
- `workouts_plan_source_check`
- Indice `workouts_user_plan_source_idx`

Valores permitidos:

- `planner`
- `predesigned`
- `ai_coach`
- `manual`
- `personalized`
- `legacy_unknown`

Cambios en `public.workout_exercises`:

- `rest_seconds integer`
- `target_rir numeric`
- `order_index integer`
- Checks de rango para descanso, RIR y orden.
- Indice `workout_exercises_order_idx`

## Backfill

La migracion usa una politica conservadora:

- `manual` queda como `manual` y protegido.
- `automatico` con indicios de IA o Coach en descripcion queda como `ai_coach` y protegido.
- `automatico` con `plan_id` queda como `predesigned` y no protegido.
- Todo lo desconocido queda como `legacy_unknown` y protegido.

## Regla central

Archivo: `supabase/functions/_shared/planIdentity.ts`

`canAutomaticPlannerReplaceWorkout` solo permite reemplazo cuando:

- `tipo = automatico`
- `completed = false`
- `is_protected = false`
- `plan_source` pertenece a `planner` o `predesigned`

Esto deja fuera `ai_coach`, `manual`, `personalized` y `legacy_unknown`.

## Flujos actualizados

- `generate-weekly-workouts`: materializa `plan_source = planner`, `is_protected = false`, `exercise_id`, `rest_seconds`, `target_rir` y `order_index`.
- `assign-routine`: usa la misma autoridad profesional y la misma politica de reemplazo.
- `apply-ai-routine`: resuelve todos los ejercicios contra `public.exercises` antes de escribir; si hay ejercicios no resueltos, ambiguos o incompatibles, devuelve `ai_routine_unresolved_exercises` y no crea filas falsas.
- `ActiveWorkout`: usa `workout_exercises.rest_seconds` para el timer y muestra `target_rir` como objetivo de ejecucion.

## Riesgo residual

- Los entrenamientos historicos `legacy_unknown` quedan protegidos por diseno. Si se quiere reclasificarlos, debe hacerse con una migracion manual revisada.
- La migracion debe aplicarse antes de desplegar las Edge Functions que escriben las nuevas columnas.
