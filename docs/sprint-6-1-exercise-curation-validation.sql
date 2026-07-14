-- Sprint 6.1 exercise curation validation.
-- Read-only. Separates critical errors, warnings, and manual review items.

-- CRITICAL: equipment missing.
SELECT 'critical' AS severity, 'empty_equipment' AS check_name, id, nombre, equipo_requerido::text AS detail
FROM public.exercises
WHERE array_length(equipo_requerido, 1) IS NULL;

-- CRITICAL: bodyweight equipment on exercises that clearly need equipment.
SELECT 'critical' AS severity, 'bodyweight_on_equipment_exercise' AS check_name, id, nombre, equipo_requerido::text AS detail
FROM public.exercises
WHERE equipo_requerido = ARRAY['peso corporal']
  AND (
    nombre ILIKE '%barra%' OR nombre ILIKE '%mancuerna%' OR nombre ILIKE '%máquina%'
    OR nombre ILIKE '%polea%' OR nombre ILIKE '%banco%' OR nombre ILIKE '%prensa%'
    OR nombre ILIKE '%elíptica%' OR nombre ILIKE '%bicicleta%' OR nombre ILIKE '%remo en máquina%'
  );

-- CRITICAL: home location with gym-only equipment.
SELECT 'critical' AS severity, 'home_location_with_gym_equipment' AS check_name, id, nombre, array_to_string(equipo_requerido, ', ') AS detail
FROM public.exercises
WHERE lugar = 'casa'
  AND EXISTS (
    SELECT 1
    FROM unnest(equipo_requerido) AS equipment
    WHERE equipment ILIKE '%barra%'
       OR equipment ILIKE '%máquina%'
       OR equipment ILIKE '%polea%'
       OR equipment ILIKE '%rack%'
       OR equipment ILIKE '%discos%'
       OR equipment ILIKE '%banco%'
  );

-- CRITICAL: legacy objective.
SELECT 'critical' AS severity, 'legacy_tonificar_objective' AS check_name, id, nombre, objetivo AS detail
FROM public.exercises
WHERE objetivo = 'tonificar';

-- CRITICAL: missing specific muscle metadata.
SELECT 'critical' AS severity, 'missing_muscle_metadata' AS check_name, id, nombre, musculo_principal AS detail
FROM public.exercises
WHERE musculo_principal IS NULL
   OR trim(musculo_principal) = ''
   OR lower(musculo_principal) IN ('pecho', 'espalda', 'piernas', 'brazos', 'hombros', 'core', 'cardio');

-- CRITICAL: missing secondary muscles.
SELECT 'critical' AS severity, 'empty_secondary_muscles' AS check_name, id, nombre, musculos_secundarios::text AS detail
FROM public.exercises
WHERE array_length(musculos_secundarios, 1) IS NULL;

-- CRITICAL: invalid rep ranges.
SELECT 'critical' AS severity, 'invalid_rep_range' AS check_name, id, nombre, concat(rango_reps_min, '-', rango_reps_max) AS detail
FROM public.exercises
WHERE (rango_reps_min = 1 AND rango_reps_max = 2)
   OR (tipo_entrenamiento NOT ILIKE 'cardio%' AND (rango_reps_min IS NULL OR rango_reps_max IS NULL))
   OR (rango_reps_min IS NOT NULL AND rango_reps_max IS NOT NULL AND rango_reps_max < rango_reps_min);

-- CRITICAL: cardio modeled as strength reps/RIR.
SELECT 'critical' AS severity, 'cardio_with_strength_reps_or_rir' AS check_name, id, nombre,
  concat('reps=', coalesce(rango_reps_min::text, 'null'), '-', coalesce(rango_reps_max::text, 'null'), ', rir=', coalesce(rir_recomendado::text, 'null')) AS detail
FROM public.exercises
WHERE tipo_entrenamiento ILIKE 'cardio%'
  AND (rango_reps_min IS NOT NULL OR rango_reps_max IS NOT NULL OR rir_recomendado IS NOT NULL);

-- CRITICAL: empty substitutions/progressions/regressions.
SELECT 'critical' AS severity, 'empty_substitutions' AS check_name, id, nombre, sustituciones::text AS detail
FROM public.exercises
WHERE array_length(sustituciones, 1) IS NULL;

SELECT 'critical' AS severity, 'empty_progressions_or_regressions' AS check_name, id, nombre,
  jsonb_build_object('progresiones', progresiones, 'regresiones', regresiones)::text AS detail
FROM public.exercises
WHERE array_length(progresiones, 1) IS NULL
   OR array_length(regresiones, 1) IS NULL;

-- WARNING: possible duplicates by normalized name.
WITH normalized AS (
  SELECT id, nombre, lower(regexp_replace(nombre, '\s+', ' ', 'g')) AS normalized_name
  FROM public.exercises
)
SELECT 'warning' AS severity, 'possible_duplicate_name' AS check_name, array_agg(id ORDER BY id)::text AS id, normalized_name AS nombre, count(*)::text AS detail
FROM normalized
GROUP BY normalized_name
HAVING count(*) > 1;

-- WARNING: English mixed into visible name.
SELECT 'warning' AS severity, 'english_in_visible_name' AS check_name, id, nombre, aliases::text AS detail
FROM public.exercises
WHERE nombre ~ '\(.+[A-Za-z].+\)'
   OR nombre ILIKE '%push%'
   OR nombre ILIKE '%pull%'
   OR nombre ILIKE '%curl%'
   OR nombre ILIKE '%jump%'
   OR nombre ILIKE '%sit%';

-- WARNING: mojibake or missing obvious accents.
SELECT 'warning' AS severity, 'mojibake_or_missing_accents' AS check_name, id, nombre, nombre AS detail
FROM public.exercises
WHERE nombre LIKE '%' || chr(195) || '%'
   OR nombre LIKE '%' || chr(194) || '%'
   OR nombre LIKE '%' || chr(65533) || '%'
   OR nombre ILIKE '%Gluteo%';

-- WARNING: curated status with empty key fields.
SELECT 'warning' AS severity, 'curado_with_empty_key_fields' AS check_name, id, nombre, estado_calidad AS detail
FROM public.exercises
WHERE estado_calidad = 'curado'
  AND (
    array_length(equipo_requerido, 1) IS NULL
    OR musculo_principal IS NULL
    OR array_length(cues_tecnicos, 1) IS NULL
    OR array_length(errores_comunes, 1) IS NULL
    OR array_length(sustituciones, 1) IS NULL
  );

-- WARNING: media missing, not critical.
SELECT 'warning' AS severity, 'missing_media' AS check_name, id, nombre, 'imagen/video null' AS detail
FROM public.exercises
WHERE imagen IS NULL
   OR video IS NULL;

-- MANUAL REVIEW: invalid or inconsistent training type.
SELECT 'manual_review' AS severity, 'training_type_review' AS check_name, id, nombre, tipo_entrenamiento AS detail
FROM public.exercises
WHERE lower(tipo_entrenamiento) NOT IN ('fuerza', 'cardio', 'cardio intervalo', 'core', 'potencia')
   OR (tipo_entrenamiento ILIKE 'cardio%' AND patron_movimiento NOT ILIKE '%cardio%');
