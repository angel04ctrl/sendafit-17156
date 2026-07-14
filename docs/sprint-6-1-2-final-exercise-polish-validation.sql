-- Sprint 6.1.2 final exercise polish validation.
-- Read-only. Expected result: no critical rows. Media warnings are expected.

-- CRITICAL: duplicated visible names after normalization.
WITH normalized AS (
  SELECT id, nombre, lower(regexp_replace(trim(nombre), '\s+', ' ', 'g')) AS normalized_name
  FROM public.exercises
)
SELECT 'critical' AS severity, 'duplicate_normalized_name' AS check_name, array_agg(id ORDER BY id)::text AS id, normalized_name AS nombre, count(*)::text AS detail
FROM normalized
GROUP BY normalized_name
HAVING count(*) > 1;

-- CRITICAL: specific duplicate that blocked Sprint 6.1.2.
SELECT 'critical' AS severity, 'duplicate_dumbbell_rdl' AS check_name, array_agg(id ORDER BY id)::text AS id, 'Peso muerto rumano con mancuernas' AS nombre, count(*)::text AS detail
FROM public.exercises
WHERE lower(trim(nombre)) = lower('Peso muerto rumano con mancuernas')
HAVING count(*) > 1;

-- CRITICAL: missing instructions.
SELECT 'critical' AS severity, 'missing_instructions' AS check_name, id, nombre, instrucciones::text AS detail
FROM public.exercises
WHERE array_length(instrucciones, 1) IS NULL;

-- CRITICAL: missing equipment or location.
SELECT 'critical' AS severity, 'missing_equipment' AS check_name, id, nombre, equipo_requerido::text AS detail
FROM public.exercises
WHERE array_length(equipo_requerido, 1) IS NULL;

SELECT 'critical' AS severity, 'missing_location' AS check_name, id, nombre, lugar AS detail
FROM public.exercises
WHERE lugar IS NULL OR trim(lugar) = '';

-- CRITICAL: obvious equipment/location mismatches.
SELECT 'critical' AS severity, 'obvious_equipment_mismatch' AS check_name, id, nombre, array_to_string(equipo_requerido, ', ') AS detail
FROM public.exercises
WHERE (
    (nombre ILIKE '%mancuerna%' AND NOT EXISTS (SELECT 1 FROM unnest(equipo_requerido) item WHERE item ILIKE '%mancuerna%'))
 OR (nombre ILIKE '%barra%' AND NOT EXISTS (SELECT 1 FROM unnest(equipo_requerido) item WHERE item ILIKE '%barra%'))
 OR (nombre ILIKE '%polea%' AND NOT EXISTS (SELECT 1 FROM unnest(equipo_requerido) item WHERE item ILIKE '%polea%'))
 OR ((nombre ILIKE '%maquina%' OR nombre ILIKE '%máquina%') AND NOT EXISTS (
      SELECT 1 FROM unnest(equipo_requerido) item
      WHERE item ILIKE '%maquina%' OR item ILIKE '%máquina%' OR item ILIKE '%ergometro%' OR item ILIKE '%ergómetro%'
    ))
);

SELECT 'critical' AS severity, 'home_with_gym_only_equipment' AS check_name, id, nombre, array_to_string(equipo_requerido, ', ') AS detail
FROM public.exercises
WHERE lugar = 'casa'
  AND EXISTS (
    SELECT 1
    FROM unnest(equipo_requerido) item
    WHERE item ILIKE '%maquina%' OR item ILIKE '%máquina%' OR item ILIKE '%polea%' OR item ILIKE '%rack%' OR item ILIKE '%prensa%'
  );

-- CRITICAL: legacy objective or ambiguous cardio/strength modeling.
SELECT 'critical' AS severity, 'legacy_objective_tonificar' AS check_name, id, nombre, objetivo AS detail
FROM public.exercises
WHERE objetivo = 'tonificar';

SELECT 'critical' AS severity, 'cardio_has_rir_or_reps' AS check_name, id, nombre,
  concat('reps=', coalesce(rango_reps_min::text, 'null'), '-', coalesce(rango_reps_max::text, 'null'), ', rir=', coalesce(rir_recomendado::text, 'null')) AS detail
FROM public.exercises
WHERE tipo_entrenamiento ILIKE 'cardio%'
  AND (rango_reps_min IS NOT NULL OR rango_reps_max IS NOT NULL OR rir_recomendado IS NOT NULL);

SELECT 'critical' AS severity, 'ambiguous_machine_row' AS check_name, id, nombre, tipo_entrenamiento AS detail
FROM public.exercises
WHERE lower(trim(nombre)) = lower('Remo en maquina')
   OR lower(trim(nombre)) = lower('Remo en máquina');

-- CRITICAL: self-referencing or duplicate substitutions.
SELECT 'critical' AS severity, 'self_substitution' AS check_name, e.id, e.nombre, s.item AS detail
FROM public.exercises e
CROSS JOIN LATERAL unnest(e.sustituciones) AS s(item)
WHERE lower(trim(s.item)) = lower(trim(e.nombre))
   OR lower(trim(s.item)) = ANY (
      SELECT lower(trim(alias_item))
      FROM unnest(e.aliases) AS alias_item
   );

SELECT 'critical' AS severity, 'duplicate_substitution' AS check_name, id, nombre, item AS detail
FROM (
  SELECT e.id, e.nombre, lower(trim(s.item)) AS item, count(*) AS duplicate_count
  FROM public.exercises e
  CROSS JOIN LATERAL unnest(e.sustituciones) AS s(item)
  GROUP BY e.id, e.nombre, lower(trim(s.item))
  HAVING count(*) > 1
) duplicates;

-- CRITICAL: mojibake in visible fields.
SELECT 'critical' AS severity, 'mojibake_visible_text' AS check_name, id, nombre, concat_ws(' | ', nombre, descripcion) AS detail
FROM public.exercises
WHERE nombre LIKE '%Ãƒ%'
   OR nombre LIKE '%Ã‚%'
   OR nombre LIKE '%Ã%'
   OR nombre LIKE '%Â%'
   OR nombre LIKE '%�%'
   OR nombre LIKE '%ï¿½%'
   OR descripcion LIKE '%Ãƒ%'
   OR descripcion LIKE '%Ã‚%'
   OR descripcion LIKE '%Ã%'
   OR descripcion LIKE '%Â%'
   OR descripcion LIKE '%�%'
   OR descripcion LIKE '%ï¿½%';

-- CRITICAL: curated records with key fields empty.
SELECT 'critical' AS severity, 'curado_missing_key_fields' AS check_name, id, nombre, estado_calidad AS detail
FROM public.exercises
WHERE estado_calidad = 'curado'
  AND (
    musculo_principal IS NULL
    OR array_length(musculos_secundarios, 1) IS NULL
    OR array_length(equipo_requerido, 1) IS NULL
    OR array_length(instrucciones, 1) IS NULL
    OR array_length(cues_tecnicos, 1) IS NULL
    OR array_length(errores_comunes, 1) IS NULL
    OR array_length(sustituciones, 1) IS NULL
  );

-- WARNING: media is intentionally not filled without licensed assets.
SELECT 'warning' AS severity, 'missing_media' AS check_name, id, nombre, 'imagen/video null' AS detail
FROM public.exercises
WHERE imagen IS NULL OR video IS NULL;

SELECT 'warning' AS severity, 'advanced_without_video' AS check_name, id, nombre, nivel AS detail
FROM public.exercises
WHERE lower(nivel) IN ('avanzado', 'p')
  AND video IS NULL;

SELECT 'warning' AS severity, 'generic_description_or_cues' AS check_name, id, nombre, descripcion AS detail
FROM public.exercises
WHERE descripcion ILIKE '%Ejercicio de fuerza o habilidad orientado%'
   OR EXISTS (
      SELECT 1
      FROM unnest(cues_tecnicos) cue
      WHERE cue ILIKE '%Controla la fase de ida y vuelta%'
   );

SELECT 'warning' AS severity, 'empty_aliases' AS check_name, id, nombre, aliases::text AS detail
FROM public.exercises
WHERE array_length(aliases, 1) IS NULL;

SELECT 'warning' AS severity, 'debatable_location' AS check_name, id, nombre, lugar AS detail
FROM public.exercises
WHERE lugar NOT IN ('casa', 'gimnasio', 'exterior', 'piscina', 'cualquiera');

SELECT 'warning' AS severity, 'short_instructions' AS check_name, id, nombre, instrucciones::text AS detail
FROM public.exercises
WHERE array_length(instrucciones, 1) < 4;

-- INFO: reference review helper for the former duplicate ids.
SELECT 'info' AS severity, 'rdl_reference_review' AS check_name, e.id, e.nombre,
  jsonb_build_object(
    'plan_ejercicios', (SELECT count(*) FROM public.plan_ejercicios pe WHERE pe.ejercicio_id = e.id),
    'workout_session_sets', (SELECT count(*) FROM public.workout_session_sets wss WHERE wss.exercise_id = e.id)
  )::text AS detail
FROM public.exercises e
WHERE e.id IN ('16', '39');
