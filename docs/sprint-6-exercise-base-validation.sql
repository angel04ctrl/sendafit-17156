-- Sprint 6 exercise base validation queries.

-- 1. Legacy or unknown levels should be gone after migration.
SELECT id, nombre, nivel
FROM public.exercises
WHERE lower(nivel) NOT IN ('principiante', 'intermedio', 'avanzado');

-- 2. Exercises missing professional metadata required by Sprint 6.
SELECT id, nombre, grupo_muscular, nivel, musculo_principal, patron_movimiento, nivel_minimo, estado_calidad
FROM public.exercises
WHERE musculo_principal IS NULL
   OR patron_movimiento IS NULL
   OR nivel_minimo IS NULL
   OR estado_calidad IS NULL
   OR rango_reps_min IS NULL
   OR rango_reps_max IS NULL
   OR descanso_segundos_min IS NULL
   OR descanso_segundos_max IS NULL
   OR rir_recomendado IS NULL;

-- 3. Exercises without usable coaching content.
SELECT id, nombre, grupo_muscular, cues_tecnicos, errores_comunes, sustituciones
FROM public.exercises
WHERE array_length(cues_tecnicos, 1) IS NULL
   OR array_length(errores_comunes, 1) IS NULL
   OR array_length(sustituciones, 1) IS NULL;

-- 4. Minimum group coverage expected for the current professional foundation.
WITH normalized AS (
  SELECT
    id,
    nombre,
    lower(coalesce(musculo_principal, grupo_muscular)) AS muscle
  FROM public.exercises
)
SELECT expected.muscle_group, count(normalized.id) AS exercise_count
FROM (
  VALUES
    ('pecho'),
    ('espalda'),
    ('pierna'),
    ('hombro'),
    ('bicep'),
    ('tricep'),
    ('abdomen'),
    ('glute'),
    ('femoral'),
    ('pantorr')
) AS expected(muscle_group)
LEFT JOIN normalized ON normalized.muscle LIKE '%' || expected.muscle_group || '%'
GROUP BY expected.muscle_group
ORDER BY expected.muscle_group;

-- 5. Check invalid ranges.
SELECT id, nombre, rango_reps_min, rango_reps_max, descanso_segundos_min, descanso_segundos_max, rir_recomendado
FROM public.exercises
WHERE rango_reps_min <= 0
   OR rango_reps_max < rango_reps_min
   OR descanso_segundos_min < 0
   OR descanso_segundos_max < descanso_segundos_min
   OR rir_recomendado NOT BETWEEN 0 AND 5;
