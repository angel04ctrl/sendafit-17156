# Beta Exercise Sprint 2 - Reporte local de preparacion

Fuente CSV: `BD-sendaFit/senda-fit-professional-exercise-curation-patch.csv`

## Conteo del CSV

- Filas totales: 109
- Updates solicitados: 75
- Inserts solicitados: 25
- Deprecate review solicitados: 9

## Archivos generados

- `docs/beta-exercise-curation-import-preview.sql`: reporte previo, no modifica datos.
- `docs/beta-exercise-curation-import-apply.sql`: import transaccional con staging temporal.
- `docs/beta-exercise-curation-import-validation.sql`: validacion posterior read-only.
- `docs/beta-exercise-curation-import-rollback.sql`: notas de rollback seguro.

## Seguridad aplicada

- No TRUNCATE.
- No DELETE.
- No cambios de schema.
- No modificaciones a workouts, workout_exercises, sesiones, planes ni historial.
- Updates no cambian `id` ni `created_at`.
- Campos vacios del CSV no sobrescriben valores existentes.
- Inserts generan `gen_random_uuid()::text` y se ignoran si parecen duplicados.
- `deprecate_review` solo actualiza `estado_calidad`; se guarda como `revisar` si el CSV no trae otro estado permitido por el constraint actual.
- La importacion puede ejecutarse varias veces: updates son idempotentes e inserts se bloquean por deteccion de duplicados.

## Pendiente antes de aplicar

Ejecuta primero el preview en Supabase y revisa:

- `blocking_validation_errors`
- `insert_conflicts_ignored`
- `updates_that_would_change`
- `warnings`

No ejecutes el apply si el preview muestra errores bloqueantes inesperados.
