-- Sprint 6 full exercise curation summary.
-- Read-only.

-- 1. Total exercises.
SELECT count(*) AS total_exercises
FROM public.exercises;

-- 2. Total by muscle group.
SELECT grupo_muscular, count(*) AS total
FROM public.exercises
GROUP BY grupo_muscular
ORDER BY total DESC, grupo_muscular ASC NULLS LAST;

-- 3. Total by level.
SELECT nivel, count(*) AS total
FROM public.exercises
GROUP BY nivel
ORDER BY total DESC, nivel ASC NULLS LAST;

-- 4. Total by movement pattern.
SELECT patron_movimiento, count(*) AS total
FROM public.exercises
GROUP BY patron_movimiento
ORDER BY total DESC, patron_movimiento ASC NULLS LAST;

-- 5. Total by quality status.
SELECT estado_calidad, count(*) AS total
FROM public.exercises
GROUP BY estado_calidad
ORDER BY total DESC, estado_calidad ASC NULLS LAST;

-- 6. Exercises without instructions.
SELECT id, nombre, grupo_muscular, estado_calidad
FROM public.exercises
WHERE array_length(instrucciones, 1) IS NULL
ORDER BY grupo_muscular NULLS LAST, nombre ASC;

-- 7. Exercises with generic descriptions.
SELECT id, nombre, descripcion
FROM public.exercises
WHERE descripcion ILIKE '%requiere control tecnico%'
   OR descripcion ILIKE '%requiere control técnico%'
   OR descripcion ILIKE '%Ejercicio de fuerza o habilidad%'
   OR descripcion ILIKE '%Ejercicio cardiovascular orientado a mejorar resistencia%'
ORDER BY nombre ASC;

-- 8. Exercises without substitutions.
SELECT id, nombre, grupo_muscular, patron_movimiento
FROM public.exercises
WHERE array_length(sustituciones, 1) IS NULL
ORDER BY grupo_muscular NULLS LAST, nombre ASC;

-- 9. Exercises without progressions/regressions.
SELECT id, nombre, grupo_muscular, progresiones, regresiones
FROM public.exercises
WHERE array_length(progresiones, 1) IS NULL
   OR array_length(regresiones, 1) IS NULL
ORDER BY grupo_muscular NULLS LAST, nombre ASC;

-- 10. Exercises without secondary muscles.
SELECT id, nombre, grupo_muscular, musculo_principal, musculos_secundarios
FROM public.exercises
WHERE array_length(musculos_secundarios, 1) IS NULL
ORDER BY grupo_muscular NULLS LAST, nombre ASC;

-- 11. Potential duplicates by normalized name.
WITH normalized AS (
  SELECT id, nombre, lower(regexp_replace(trim(nombre), '\s+', ' ', 'g')) AS normalized_nombre
  FROM public.exercises
)
SELECT
  normalized_nombre,
  count(*) AS duplicate_count,
  array_agg(id ORDER BY id) AS ids,
  array_agg(nombre ORDER BY nombre) AS nombres
FROM normalized
GROUP BY normalized_nombre
HAVING count(*) > 1
ORDER BY duplicate_count DESC, normalized_nombre ASC;

-- 12. Cardio exercises with reps or RIR.
SELECT id, nombre, tipo_entrenamiento, patron_movimiento, rango_reps_min, rango_reps_max, rir_recomendado
FROM public.exercises
WHERE (
    tipo_entrenamiento ILIKE 'cardio%'
    OR patron_movimiento ILIKE '%cardio%'
  )
  AND (rango_reps_min IS NOT NULL OR rango_reps_max IS NOT NULL OR rir_recomendado IS NOT NULL)
ORDER BY nombre ASC;

-- 13. Strength exercises without reps/rest.
SELECT id, nombre, tipo_entrenamiento, patron_movimiento, rango_reps_min, rango_reps_max, descanso_segundos_min, descanso_segundos_max
FROM public.exercises
WHERE tipo_entrenamiento NOT ILIKE 'cardio%'
  AND duracion_promedio_segundos IS NULL
  AND (
    rango_reps_min IS NULL
    OR rango_reps_max IS NULL
    OR descanso_segundos_min IS NULL
    OR descanso_segundos_max IS NULL
  )
ORDER BY nombre ASC;

-- 14. Exercises without aliases.
SELECT id, nombre, grupo_muscular, aliases
FROM public.exercises
WHERE array_length(aliases, 1) IS NULL
ORDER BY grupo_muscular NULLS LAST, nombre ASC;

-- 15. Ambiguous names that may need variant-specific naming.
SELECT id, nombre, grupo_muscular, musculo_principal, patron_movimiento, equipo_requerido
FROM public.exercises
WHERE lower(trim(nombre)) IN (
    'remo',
    'curl',
    'press',
    'sentadilla',
    'extension',
    'extensión',
    'elevacion de talones',
    'elevación de talones',
    'remo en maquina',
    'remo en máquina',
    'press de pecho',
    'curl de biceps',
    'curl de bíceps',
    'extension de triceps',
    'extensión de tríceps'
  )
ORDER BY nombre ASC;

