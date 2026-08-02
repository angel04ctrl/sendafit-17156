-- Beta Exercise Curation - Reparacion post-import de criticals.
-- Ejecutar despues de beta-exercise-curation-import-apply.sql si la validacion
-- reporta alias_conflict o strength_missing_programming para los casos listados aqui.
--
-- Seguro: solo modifica public.exercises, no toca schema, workouts, planes,
-- workout_exercises, sesiones ni historial.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.be2_remove_alias_ci(
  _aliases text[],
  _alias_to_remove text
)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT alias
      FROM unnest(COALESCE(_aliases, '{}'::text[])) AS alias
      WHERE lower(regexp_replace(btrim(alias), '\s+', ' ', 'g'))
        IS DISTINCT FROM lower(regexp_replace(btrim(_alias_to_remove), '\s+', ' ', 'g'))
      ORDER BY alias
    ),
    '{}'::text[]
  )
$$;

-- 1) Resolver alias duplicado:
-- "press inclinado con mancuernas" debe pertenecer al ejercicio especifico
-- Press inclinado con mancuernas, no al press plano con mancuernas.
UPDATE public.exercises
SET aliases = pg_temp.be2_remove_alias_ci(aliases, 'press inclinado con mancuernas')
WHERE id = '1'
  AND 'press inclinado con mancuernas' = ANY(COALESCE(aliases, '{}'::text[]));

-- 2) Resolver alias duplicado:
-- "wide-grip lat pulldown" debe pertenecer al ejercicio especifico de agarre amplio,
-- no al jalon generico.
UPDATE public.exercises
SET aliases = pg_temp.be2_remove_alias_ci(aliases, 'wide-grip lat pulldown')
WHERE id = '48'
  AND 'wide-grip lat pulldown' = ANY(COALESCE(aliases, '{}'::text[]));

-- 3) Resolver alias duplicado:
-- "bicicleta estatica" debe pertenecer a Bicicleta estatica, no a Ciclismo al aire libre.
UPDATE public.exercises
SET aliases = pg_temp.be2_remove_alias_ci(aliases, 'bicicleta estática')
WHERE id = '75'
  AND 'bicicleta estática' = ANY(COALESCE(aliases, '{}'::text[]));

-- 4) Caminata del granjero se programa por tiempo/distancia, no por repeticiones.
-- Conserva duracion_promedio_segundos y agrega RIR para que el planner pueda
-- dosificar esfuerzo sin inventar repeticiones.
UPDATE public.exercises
SET rir_recomendado = COALESCE(rir_recomendado, 2)
WHERE id = 'sf-forearm-farmer-walk'
  AND rir_recomendado IS NULL;

COMMIT;

-- Verificacion rapida: debe devolver 0 filas para los criticals corregidos.
WITH exercise_scope AS (
  SELECT
    e.*,
    lower(regexp_replace(trim(COALESCE(e.nombre, '')), '\s+', ' ', 'g')) AS normalized_nombre
  FROM public.exercises e
),
alias_scope AS (
  SELECT id, nombre, lower(regexp_replace(trim(alias), '\s+', ' ', 'g')) AS normalized_alias
  FROM exercise_scope
  CROSS JOIN LATERAL unnest(COALESCE(aliases, '{}'::text[])) AS alias
),
alias_conflicts AS (
  SELECT
    normalized_alias,
    array_agg(DISTINCT id ORDER BY id) AS ids,
    array_agg(DISTINCT nombre ORDER BY nombre) AS nombres
  FROM alias_scope
  WHERE normalized_alias IN (
    'press inclinado con mancuernas',
    'wide-grip lat pulldown',
    'bicicleta estática'
  )
  GROUP BY normalized_alias
  HAVING count(DISTINCT id) > 1
)
SELECT
  'alias_conflict' AS check_name,
  array_to_string(ids, ', ') AS exercise_id,
  array_to_string(nombres, ' | ') AS nombre,
  normalized_alias AS details
FROM alias_conflicts

UNION ALL
SELECT
  'farmer_walk_missing_rir',
  id,
  nombre,
  concat('rir=', rir_recomendado, ', duration=', duracion_promedio_segundos)
FROM exercise_scope
WHERE id = 'sf-forearm-farmer-walk'
  AND rir_recomendado IS NULL;
