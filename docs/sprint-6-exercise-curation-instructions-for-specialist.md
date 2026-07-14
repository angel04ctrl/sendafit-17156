# Instructions for the exercise curation specialist

You will receive a CSV export from `public.exercises` for editorial and technical review.

Your task is to propose a patch, not to replace the full table.

## Hard rules

- Do not change the database schema.
- Do not delete exercise IDs.
- Do not replace the full `public.exercises` table.
- Do not invent image or video URLs.
- Do not copy protected text, images, videos, or proprietary exercise descriptions from external sources.
- Write original content based on general fitness knowledge and the provided research/context.
- Keep existing IDs for updates.
- Preserve historical compatibility: existing IDs may already be referenced by routines, workouts, sessions, or plans.

## What you may propose

- Updates to existing exercises.
- Inserts for missing, useful, common exercise variants.
- `deprecate_review` only when a duplicate or low-quality row should be reviewed for future deprecation.
- Safer naming when a row is too generic.
- Better metadata: muscles, equipment, movement pattern, instructions, cues, errors, substitutions, progressions, regressions, rest, reps, RIR, and quality status.

## Patch CSV format

Return a patch CSV, not a full replacement CSV.

The patch CSV must include an `action` column with one of:

- `update`
- `insert`
- `deprecate_review`

For `update`:

- Keep the existing `id`.
- Only include rows that need changes.
- Keep values complete enough for review.

For `insert`:

- Leave `id` empty or provide a `new_temp_key`.
- Include a proposed `nombre`.
- Include complete metadata for the new exercise.
- Do not add media unless a license-safe source is explicitly provided.

For `deprecate_review`:

- Do not delete anything.
- Include the existing `id`.
- Explain why it may be duplicate, ambiguous, unsafe, or no longer useful.

## Recommended patch columns

Use these columns when applicable:

- `action`
- `id`
- `new_temp_key`
- `nombre`
- `aliases`
- `nivel`
- `nivel_minimo`
- `grupo_muscular`
- `musculo_principal`
- `musculos_secundarios`
- `equipamiento`
- `equipo_requerido`
- `tipo_entrenamiento`
- `patron_movimiento`
- `descripcion`
- `instrucciones`
- `cues_tecnicos`
- `errores_comunes`
- `contraindicaciones`
- `sustituciones`
- `progresiones`
- `regresiones`
- `lugar`
- `objetivo`
- `series_sugeridas`
- `repeticiones_sugeridas`
- `rango_reps_min`
- `rango_reps_max`
- `descanso_segundos_min`
- `descanso_segundos_max`
- `rir_recomendado`
- `duracion_promedio_segundos`
- `estado_calidad`
- `review_notes`

## Review focus

- Avoid generic exercise names when a common variant should exist separately.
- Separate cardio from strength exercises.
- Keep `Remo ergometro` as cardio only.
- Keep back rows as strength exercises.
- Differentiate biceps curls, triceps extensions, chest presses, shoulder raises/presses, squat/lunge variants, hip hinge variants, glute work, calves, forearms, and core patterns.
- For cardio, do not use reps or RIR.
- For strength, include reps/rest unless the exercise is intentionally time-based.
- Use `estado_calidad = curado` only when metadata is complete and confident.
- Use `estado_calidad = revisar` when the exercise is useful but needs extra human review.

## Output expected

Return:

1. A patch CSV.
2. A short summary of the main issues found.
3. A list of inserts proposed.
4. A list of updates proposed.
5. A list of rows marked `deprecate_review`, with reasons.
