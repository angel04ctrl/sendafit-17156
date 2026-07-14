# Sprint 7.2 - Auditoria integral del planner actual

## Alcance auditado

Archivos revisados:

- `supabase/functions/_shared/trainingPlanner.ts`
- `src/lib/trainingPlanner.ts`
- `supabase/functions/assign-routine/index.ts`
- `supabase/functions/generate-weekly-workouts/index.ts`
- `supabase/functions/get-user-routine/index.ts`
- `supabase/functions/apply-ai-routine/index.ts`
- `supabase/functions/validate-plan-change/index.ts`
- `supabase/functions/redistribute-workouts/index.ts`
- `src/components/RoutineManager.tsx`
- `src/lib/dayMapping.ts`
- `src/hooks/useBackendApi.ts`
- `src/lib/api/backend.ts`
- `supabase/schema_export.sql`

## Schema real relevante

`profiles` guarda:

- `assigned_routine_id text`
- `fitness_level fitness_level`
- `fitness_goal fitness_goal`
- `available_days_per_week integer`
- `available_weekdays text[]`
- `session_duration_minutes integer`
- `training_types text[]`
- `health_conditions text[]`
- `injuries_limitations text`
- `lesiones_activas text[]`

`predesigned_plans` es el unico destino formal de `assigned_routine_id`.

`workouts` guarda:

- `tipo workout_type`, con uso real `automatico` y `manual`
- `plan_id text`
- `scheduled_date date`
- `weekday integer`
- `completed boolean`

`workout_exercises` guarda `exercise_id`, `sets`, `reps`, `duration_minutes`, `notes`. No tiene columnas para descanso ni RIR objetivo.

`workout_sessions` y `workout_session_sets` existen para historial real. `workout_sessions.workout_id` tiene `ON DELETE CASCADE`, por lo que borrar un workout con sesiones puede borrar historial. Esto es critico.

No hay columnas reales de origen/proteccion como `source`, `origin`, `plan_source`, `generation_type` o `is_protected` en `workouts`/`predesigned_plans`/`profiles`.

## Flujo real

1. `assign-routine` asigna un plan prediseñado y materializa workouts automaticos.
2. `generate-weekly-workouts` materializa una semana usando el planner profesional.
3. `get-user-routine` es read-only: lee perfil, plan y catalogo; recalcula resumen del planner para visualizacion, pero no escribe.
4. `apply-ai-routine` aplica rutinas de IA desde metadata textual. No usa `exercise_id`, y por schema actual no puede distinguir formalmente origen IA salvo texto/tipo.
5. `validate-plan-change` hace preview de impacto y detecta manual/IA por heuristica.
6. `redistribute-workouts` redistribuye desde `plan_ejercicios`; no usa el planner profesional y tenia estrategia destructiva legacy.

## Hallazgos criticos corregidos

### Validacion SQL sin datos

`docs/sprint-7-1-training-planner-validation.sql` podia devolver `weekly_workout_count = 0` como info sin marcar fallo. Eso no validaba el planner real.

Correccion: se creo `docs/sprint-7-2-training-planner-final-validation.sql`, que devuelve:

- `critical expected_generated_workouts_missing` si un perfil con planner automatico esperado no tiene workouts automaticos en la semana.
- `info planner_validation_not_applicable` para usuarios sin plan automatico aplicable.
- `warning no_validation_data` si no hay ningun perfil en scope automatico.

### Escritura destructiva antes de validar

`assign-routine` y `generate-weekly-workouts` borraban workouts automaticos anteriores antes de confirmar que la nueva semana y sus ejercicios se insertaron bien.

Correccion: ahora inspeccionan workouts reemplazables, bloquean si hay sesiones, crean nuevos workouts, insertan ejercicios, limpian nuevos si falla algo, y solo eliminan los viejos al final.

### Riesgo sobre sesiones activas/historial

Por schema, borrar `workouts` puede borrar `workout_sessions` por cascade. Eso ponia en riesgo sesiones activas o historial.

Correccion: los flujos del planner bloquean regeneracion si los workouts a reemplazar tienen `workout_sessions`.

### `workout_exercises` sin cascade garantizado

El schema exportado no muestra `ON DELETE CASCADE` desde `workout_exercises` hacia `workouts`. Borrar workouts directamente podia fallar o dejar reemplazos parciales.

Correccion: los flujos nuevos borran explicitamente `workout_exercises` antes de borrar workouts.

### Calidad `revisar` como relleno

Sprint 7.1 permitia `revisar` bajo algunas condiciones. Sprint 7.2 requiere no usarlo como relleno normal.

Correccion: el planner automatico excluye `revisar` y `deprecado`.

### Volumen de cardio

El calculo de volumen podia sumar secundarios de ejercicios cardio.

Correccion: ejercicios con `tipo_entrenamiento` cardio no suman volumen muscular de fuerza/hipertrofia.

### Frecuencia capada

La frecuencia muscular tenia cap en 3. Eso ocultaba frecuencia real en planes de 4-6 dias.

Correccion: frecuencia = numero real de sesiones distintas con trabajo relevante.

## Hallazgos graves / deuda no bloqueante

- No existe metadata formal para distinguir rutina IA/manual/personalizada/protegida mas alla de `workouts.tipo`, `plan_id` y texto. Para proteccion total hace falta una migracion futura minima de origen/proteccion.
- `apply-ai-routine` trabaja con ejercicios por texto libre y no conserva `exercise_id`; esto pertenece al flujo IA, no al planner profesional, pero queda como deuda critica antes de sustituciones/progresion avanzada.
- `redistribute-workouts` sigue siendo legacy y no usa el planner profesional; debe migrarse o limitarse a redistribucion no destructiva en un sprint de limpieza.
- `workout_exercises` no puede persistir descanso objetivo ni RIR recomendado por schema actual. El planner los usa para estimacion/resumen, pero la experiencia real solo persiste sets/reps/duracion/notas.
- No hay constraint unica parcial para evitar duplicados automaticos por usuario/fecha/plan. Se mitiga por flujo, pero una proteccion de DB seria mas fuerte.

## Fuente unica de verdad

Las decisiones del planner viven en `supabase/functions/_shared/trainingPlanner.ts`.

`src/lib/trainingPlanner.ts` solo contiene tipos y formateadores de UI. No recalcula split, descanso, volumen, seleccion de ejercicios ni duracion.

## Validacion de 1-7 dias

- 1-6 dias: se programan solamente los dias seleccionados.
- 7 dias: `selectRestDay` reserva un descanso deterministico, y `trainingWeekdays` excluye ese dia.
- El frontend muestra `rest_day` devuelto por backend; no lo calcula.

## Persistencia

El planner conserva `exercise_id` al insertar `workout_exercises`. La validacion SQL final marca `automatic_workout_exercise_without_exercise_id` como critical.

## Fechas

Los flujos usan ISO weekday `1=lunes ... 7=domingo`, con validacion SQL `weekday_mismatch_scheduled_date`.

## Estado de cierre

Sprint 7.2 corrige bugs criticos del planner automatico y agrega validacion final. Aun no se puede afirmar cierre total de Sprint 7 en produccion hasta ejecutar el SQL final con datos reales y confirmar `0 critical`.
