-- Beta Exercise Sprint 2 - Reparacion post-import de aliases conflictivos.
-- Ejecutar despues de beta-exercise-curation-import-apply.sql si la validacion reporta alias_conflict.
-- Seguro e idempotente: solo elimina aliases ambiguos de ejercicios especificos.

BEGIN;

UPDATE public.exercises e
SET aliases = COALESCE((
  SELECT array_agg(alias ORDER BY ord)
  FROM unnest(COALESCE(e.aliases, '{}'::text[])) WITH ORDINALITY AS a(alias, ord)
  WHERE lower(regexp_replace(trim(alias), '\s+', ' ', 'g')) <> 'press inclinado con mancuernas'
), '{}'::text[])
WHERE e.id = '1';

UPDATE public.exercises e
SET aliases = COALESCE((
  SELECT array_agg(alias ORDER BY ord)
  FROM unnest(COALESCE(e.aliases, '{}'::text[])) WITH ORDINALITY AS a(alias, ord)
  WHERE lower(regexp_replace(trim(alias), '\s+', ' ', 'g')) <> 'wide-grip lat pulldown'
), '{}'::text[])
WHERE e.id = '48';

UPDATE public.exercises e
SET aliases = COALESCE((
  SELECT array_agg(alias ORDER BY ord)
  FROM unnest(COALESCE(e.aliases, '{}'::text[])) WITH ORDINALITY AS a(alias, ord)
  WHERE replace(replace(replace(replace(replace(replace(lower(regexp_replace(trim(alias), '\s+', ' ', 'g')), chr(225), 'a'), chr(233), 'e'), chr(237), 'i'), chr(243), 'o'), chr(250), 'u'), chr(252), 'u') <> 'bicicleta estatica'
), '{}'::text[])
WHERE e.id = '75';

COMMIT;

-- Verificacion rapida: debe devolver 0 filas para estos tres conflictos.
WITH alias_scope AS (
  SELECT
    id,
    nombre,
    replace(replace(replace(replace(replace(replace(lower(regexp_replace(trim(alias), '\s+', ' ', 'g')), chr(225), 'a'), chr(233), 'e'), chr(237), 'i'), chr(243), 'o'), chr(250), 'u'), chr(252), 'u') AS normalized_alias
  FROM public.exercises
  CROSS JOIN LATERAL unnest(COALESCE(aliases, '{}'::text[])) AS alias
), alias_conflicts AS (
  SELECT
    normalized_alias,
    array_agg(DISTINCT id ORDER BY id) AS ids,
    array_agg(DISTINCT nombre ORDER BY nombre) AS nombres
  FROM alias_scope
  WHERE normalized_alias IN (
    'press inclinado con mancuernas',
    'wide-grip lat pulldown',
    'bicicleta estatica'
  )
  GROUP BY normalized_alias
  HAVING count(DISTINCT id) > 1
)
SELECT *
FROM alias_conflicts
ORDER BY normalized_alias;
