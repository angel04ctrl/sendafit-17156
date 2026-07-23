-- Beta Sprint 1 - Validacion de resolucion de ejercicios del Coach IA.
-- Ejecutar en Supabase SQL Editor despues de aplicar 20260722010000.
-- Resultado esperado para cierre: 0 filas critical.

WITH required_matches AS (
  SELECT *
  FROM (VALUES
    ('fondos en paralelas', '33'),
    ('press de triceps en polea', 'sf-triceps-pushdown'),
    ('extension de triceps con mancuerna sobre la cabeza', '10'),
    ('dominadas asistidas', 'sf-assisted-pullup'),
    ('press inclinado con mancuernas', 'sf-press-incline-db')
  ) AS v(input_name, expected_id)
),
exercise_alias_scope AS (
  SELECT
    e.id,
    e.nombre,
    lower(translate(alias_value, 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN')) AS alias_normalized
  FROM public.exercises e
  CROSS JOIN LATERAL unnest(COALESCE(e.aliases, '{}'::text[])) AS alias_value
),
catalog_scope AS (
  SELECT
    e.id,
    e.nombre,
    e.estado_calidad,
    e.nivel_minimo,
    lower(translate(e.nombre, 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN')) AS nombre_normalized,
    ARRAY_AGG(eas.alias_normalized) FILTER (WHERE eas.alias_normalized IS NOT NULL) AS aliases_normalized
  FROM public.exercises e
  LEFT JOIN exercise_alias_scope eas ON eas.id = e.id
  GROUP BY e.id, e.nombre, e.estado_calidad, e.nivel_minimo
),
match_scope AS (
  SELECT
    r.input_name,
    r.expected_id,
    c.id AS matched_id,
    c.nombre,
    c.estado_calidad,
    c.nivel_minimo
  FROM required_matches r
  LEFT JOIN catalog_scope c
    ON c.id = r.expected_id
   AND (
     c.nombre_normalized = lower(translate(r.input_name, 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN'))
     OR lower(translate(r.input_name, 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN')) = ANY(COALESCE(c.aliases_normalized, '{}'::text[]))
   )
)
SELECT 'critical' AS severity, 'required_alias_not_resolvable' AS check_name,
       input_name, expected_id, COALESCE(matched_id, 'missing') AS details
FROM match_scope
WHERE matched_id IS NULL

UNION ALL
SELECT 'critical', 'required_exercise_not_curated',
       input_name, expected_id, CONCAT(nombre, ' estado=', estado_calidad)
FROM match_scope
WHERE matched_id IS NOT NULL
  AND estado_calidad IS DISTINCT FROM 'curado'

UNION ALL
SELECT 'critical', 'required_exercise_above_beginner',
       input_name, expected_id, CONCAT(nombre, ' nivel_minimo=', nivel_minimo)
FROM match_scope
WHERE matched_id IS NOT NULL
  AND lower(COALESCE(nivel_minimo, 'principiante')) NOT IN ('principiante', 'b')

UNION ALL
SELECT 'info', 'resolved_required_exercise',
       input_name, expected_id, nombre
FROM match_scope
WHERE matched_id IS NOT NULL

ORDER BY severity, check_name, input_name;
