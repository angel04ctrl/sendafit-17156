-- Sprint 6 final exercise curation validation.
-- Read-only. Expected: 0 critical rows. Missing media warnings are allowed.

-- 1. Duplicate normalized names.
WITH normalized AS (
  SELECT id, nombre, lower(regexp_replace(trim(nombre), '\s+', ' ', 'g')) AS normalized_nombre
  FROM public.exercises
)
SELECT 'critical' AS severity, 'duplicate_normalized_name' AS check_name, array_agg(id ORDER BY id)::text AS id, normalized_nombre AS nombre, count(*)::text AS detail
FROM normalized
GROUP BY normalized_nombre
HAVING count(*) > 1;

-- 2. Exercises without instructions.
SELECT 'critical' AS severity, 'missing_instructions' AS check_name, id, nombre, instrucciones::text AS detail
FROM public.exercises
WHERE array_length(instrucciones, 1) IS NULL;

-- 3. Curated exercises with generic descriptions.
SELECT 'critical' AS severity, 'curated_generic_description' AS check_name, id, nombre, descripcion AS detail
FROM public.exercises
WHERE estado_calidad = 'curado'
  AND (
    descripcion ILIKE '%requiere control tecnico%'
    OR descripcion ILIKE '%requiere control técnico%'
    OR descripcion ILIKE '%Ejercicio de fuerza o habilidad%'
    OR descripcion ILIKE '%Ejercicio cardiovascular orientado a mejorar resistencia%'
  );

-- 4. Self-referencing substitutions.
SELECT 'critical' AS severity, 'self_substitution' AS check_name, e.id, e.nombre, s.item AS detail
FROM public.exercises e
CROSS JOIN LATERAL unnest(e.sustituciones) AS s(item)
WHERE lower(trim(s.item)) = lower(trim(e.nombre))
   OR lower(trim(s.item)) = ANY (SELECT lower(trim(alias_item)) FROM unnest(e.aliases) AS alias_item);

-- 5. Cardio with reps/RIR.
SELECT 'critical' AS severity, 'cardio_with_reps_or_rir' AS check_name, id, nombre,
  concat('reps=', coalesce(rango_reps_min::text, 'null'), '-', coalesce(rango_reps_max::text, 'null'), ', rir=', coalesce(rir_recomendado::text, 'null')) AS detail
FROM public.exercises
WHERE (
    tipo_entrenamiento ILIKE 'cardio%'
    OR patron_movimiento ILIKE '%cardio%'
  )
  AND (rango_reps_min IS NOT NULL OR rango_reps_max IS NOT NULL OR rir_recomendado IS NOT NULL);

-- 6. Strength without reps/rest, excluding explicitly timed exercises.
SELECT 'critical' AS severity, 'strength_without_reps_or_rest' AS check_name, id, nombre,
  concat('reps=', coalesce(rango_reps_min::text, 'null'), '-', coalesce(rango_reps_max::text, 'null'), ', rest=', coalesce(descanso_segundos_min::text, 'null'), '-', coalesce(descanso_segundos_max::text, 'null')) AS detail
FROM public.exercises
WHERE tipo_entrenamiento NOT ILIKE 'cardio%'
  AND duracion_promedio_segundos IS NULL
  AND (
    rango_reps_min IS NULL
    OR rango_reps_max IS NULL
    OR descanso_segundos_min IS NULL
    OR descanso_segundos_max IS NULL
  );

-- 7. Missing primary muscle.
SELECT 'critical' AS severity, 'missing_primary_muscle' AS check_name, id, nombre, musculo_principal AS detail
FROM public.exercises
WHERE musculo_principal IS NULL
   OR trim(musculo_principal) = '';

-- 8. Missing equipment.
SELECT 'critical' AS severity, 'missing_equipment' AS check_name, id, nombre, equipo_requerido::text AS detail
FROM public.exercises
WHERE array_length(equipo_requerido, 1) IS NULL;

-- 9. Mojibake.
SELECT 'critical' AS severity, 'mojibake' AS check_name, id, nombre, concat_ws(' | ', nombre, descripcion) AS detail
FROM public.exercises
WHERE nombre LIKE '%Ã%'
   OR nombre LIKE '%Â%'
   OR nombre LIKE '%�%'
   OR descripcion LIKE '%Ã%'
   OR descripcion LIKE '%Â%'
   OR descripcion LIKE '%�%'
   OR array_to_string(instrucciones, ' ') LIKE '%Ã%'
   OR array_to_string(cues_tecnicos, ' ') LIKE '%Ã%'
   OR array_to_string(errores_comunes, ' ') LIKE '%Ã%';

-- 10. Warning: media still missing. Allowed.
SELECT 'warning' AS severity, 'missing_media' AS check_name, id, nombre, 'imagen/video null' AS detail
FROM public.exercises
WHERE imagen IS NULL OR video IS NULL;

