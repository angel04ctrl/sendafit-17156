-- Sprint 6.1.3 exercise coverage validation.
-- Read-only. Expected: 0 critical rows. Media warnings are expected.

-- CRITICAL: duplicated normalized names.
WITH normalized AS (
  SELECT id, nombre, lower(regexp_replace(trim(nombre), '\s+', ' ', 'g')) AS normalized_name
  FROM public.exercises
)
SELECT 'critical' AS severity, 'duplicate_normalized_name' AS check_name, array_agg(id ORDER BY id)::text AS id, normalized_name AS nombre, count(*)::text AS detail
FROM normalized
GROUP BY normalized_name
HAVING count(*) > 1;

-- CRITICAL: incomplete metadata.
SELECT 'critical' AS severity, 'missing_instructions' AS check_name, id, nombre, instrucciones::text AS detail
FROM public.exercises
WHERE array_length(instrucciones, 1) IS NULL;

SELECT 'critical' AS severity, 'missing_equipment' AS check_name, id, nombre, equipo_requerido::text AS detail
FROM public.exercises
WHERE array_length(equipo_requerido, 1) IS NULL;

SELECT 'critical' AS severity, 'missing_specific_primary_muscle' AS check_name, id, nombre, musculo_principal AS detail
FROM public.exercises
WHERE musculo_principal IS NULL
   OR trim(musculo_principal) = ''
   OR lower(trim(musculo_principal)) IN ('pecho','espalda','piernas','brazos','hombros','gluteos','cardio');

SELECT 'critical' AS severity, 'missing_movement_pattern' AS check_name, id, nombre, patron_movimiento AS detail
FROM public.exercises
WHERE patron_movimiento IS NULL OR trim(patron_movimiento) = '';

SELECT 'critical' AS severity, 'missing_substitutions' AS check_name, id, nombre, sustituciones::text AS detail
FROM public.exercises
WHERE array_length(sustituciones, 1) IS NULL;

-- CRITICAL: substitution problems.
SELECT 'critical' AS severity, 'self_substitution' AS check_name, e.id, e.nombre, s.item AS detail
FROM public.exercises e
CROSS JOIN LATERAL unnest(e.sustituciones) AS s(item)
WHERE lower(trim(s.item)) = lower(trim(e.nombre))
   OR lower(trim(s.item)) = ANY (SELECT lower(trim(alias_item)) FROM unnest(e.aliases) alias_item);

SELECT 'critical' AS severity, 'duplicate_substitution' AS check_name, id, nombre, item AS detail
FROM (
  SELECT e.id, e.nombre, lower(trim(s.item)) AS item, count(*) AS duplicate_count
  FROM public.exercises e
  CROSS JOIN LATERAL unnest(e.sustituciones) AS s(item)
  GROUP BY e.id, e.nombre, lower(trim(s.item))
  HAVING count(*) > 1
) duplicated;

-- CRITICAL: strength/cardio modeling.
SELECT 'critical' AS severity, 'strength_missing_reps_or_rest' AS check_name, id, nombre,
  concat('reps=', coalesce(rango_reps_min::text,'null'), '-', coalesce(rango_reps_max::text,'null'), ', rest=', coalesce(descanso_segundos_min::text,'null'), '-', coalesce(descanso_segundos_max::text,'null')) AS detail
FROM public.exercises
WHERE tipo_entrenamiento NOT ILIKE 'cardio%'
  AND duracion_promedio_segundos IS NULL
  AND (rango_reps_min IS NULL OR rango_reps_max IS NULL OR descanso_segundos_min IS NULL OR descanso_segundos_max IS NULL);

SELECT 'critical' AS severity, 'cardio_has_strength_fields' AS check_name, id, nombre,
  concat('reps=', coalesce(rango_reps_min::text,'null'), '-', coalesce(rango_reps_max::text,'null'), ', rir=', coalesce(rir_recomendado::text,'null')) AS detail
FROM public.exercises
WHERE tipo_entrenamiento ILIKE 'cardio%'
  AND (rango_reps_min IS NOT NULL OR rango_reps_max IS NOT NULL OR rir_recomendado IS NOT NULL);

-- CRITICAL: generic placeholders or generic variant names.
SELECT 'critical' AS severity, 'generic_description' AS check_name, id, nombre, descripcion AS detail
FROM public.exercises
WHERE descripcion ILIKE '%Ejercicio de fuerza o habilidad orientado%'
   OR descripcion ILIKE '%requiere control tecnico%'
   OR descripcion ILIKE '%requiere control técnico%';

SELECT 'critical' AS severity, 'added_without_aliases' AS check_name, id, nombre, aliases::text AS detail
FROM public.exercises
WHERE id LIKE 'sf-%'
  AND array_length(aliases, 1) IS NULL;

SELECT 'critical' AS severity, 'curado_incomplete_fields' AS check_name, id, nombre, estado_calidad AS detail
FROM public.exercises
WHERE estado_calidad = 'curado'
  AND (
    array_length(aliases, 1) IS NULL
    OR array_length(instrucciones, 1) IS NULL
    OR array_length(cues_tecnicos, 1) IS NULL
    OR array_length(errores_comunes, 1) IS NULL
    OR array_length(contraindicaciones, 1) IS NULL
    OR array_length(sustituciones, 1) IS NULL
    OR array_length(progresiones, 1) IS NULL
    OR array_length(regresiones, 1) IS NULL
    OR musculo_principal IS NULL
    OR patron_movimiento IS NULL
    OR lugar IS NULL
  );

-- CRITICAL: row/cardio separation and overly generic variant names.
SELECT 'critical' AS severity, 'back_row_misclassified_as_cardio' AS check_name, id, nombre, tipo_entrenamiento AS detail
FROM public.exercises
WHERE nombre ILIKE 'Remo%'
  AND nombre NOT ILIKE '%ergómetro%'
  AND nombre NOT ILIKE '%ergometro%'
  AND tipo_entrenamiento ILIKE 'cardio%';

SELECT 'critical' AS severity, 'ergometer_mixed_with_strength' AS check_name, id, nombre, concat(tipo_entrenamiento, ' | ', grupo_muscular) AS detail
FROM public.exercises
WHERE (nombre ILIKE '%ergómetro%' OR nombre ILIKE '%ergometro%' OR array_to_string(aliases, ',') ILIKE '%rowing machine%')
  AND (tipo_entrenamiento NOT ILIKE 'cardio%' OR rango_reps_min IS NOT NULL OR rir_recomendado IS NOT NULL);

SELECT 'critical' AS severity, 'overly_generic_variant_name' AS check_name, id, nombre, patron_movimiento AS detail
FROM public.exercises
WHERE lower(trim(nombre)) IN ('remo', 'curl', 'press', 'sentadilla', 'extension', 'extensión', 'elevacion de talones', 'elevación de talones')
   OR lower(trim(nombre)) IN ('remo en maquina', 'remo en máquina');

-- CRITICAL: mojibake.
SELECT 'critical' AS severity, 'mojibake_visible_text' AS check_name, id, nombre, concat_ws(' | ', nombre, descripcion) AS detail
FROM public.exercises
WHERE nombre LIKE '%Ã%'
   OR nombre LIKE '%Â%'
   OR nombre LIKE '%�%'
   OR descripcion LIKE '%Ã%'
   OR descripcion LIKE '%Â%'
   OR descripcion LIKE '%�%';

-- WARNING: expected beta gaps.
SELECT 'warning' AS severity, 'missing_media' AS check_name, id, nombre, 'imagen/video null' AS detail
FROM public.exercises
WHERE imagen IS NULL OR video IS NULL;

SELECT 'warning' AS severity, 'advanced_without_video' AS check_name, id, nombre, nivel AS detail
FROM public.exercises
WHERE nivel = 'avanzado' AND video IS NULL;

SELECT 'warning' AS severity, 'empty_contraindications' AS check_name, id, nombre, contraindicaciones::text AS detail
FROM public.exercises
WHERE array_length(contraindicaciones, 1) IS NULL;

SELECT 'warning' AS severity, 'few_aliases' AS check_name, id, nombre, aliases::text AS detail
FROM public.exercises
WHERE array_length(aliases, 1) < 2;

SELECT 'warning' AS severity, 'marked_for_review' AS check_name, id, nombre, estado_calidad AS detail
FROM public.exercises
WHERE estado_calidad = 'revisar';
