-- Beta Exercise Sprint 1 - Resumen de cobertura en un solo result set.
-- Read-only. Ejecutar en Supabase SQL Editor y exportar el resultado como CSV.
-- No modifica datos, IDs ni schema.

WITH base AS (
  SELECT
    e.*,
    lower(regexp_replace(trim(COALESCE(e.nombre, '')), '\s+', ' ', 'g')) AS normalized_nombre,
    lower(concat_ws(
      ' ',
      e.nombre,
      e.equipamiento,
      array_to_string(e.equipo_requerido, ' '),
      e.patron_movimiento,
      e.tipo_entrenamiento
    )) AS machine_search_text
  FROM public.exercises e
),
equipment_items AS (
  SELECT
    COALESCE(NULLIF(btrim(equipo), ''), 'sin_equipo') AS equipment,
    count(*) AS total
  FROM base b
  CROSS JOIN LATERAL unnest(
    CASE
      WHEN cardinality(COALESCE(b.equipo_requerido, '{}'::text[])) > 0 THEN b.equipo_requerido
      WHEN COALESCE(length(btrim(b.equipamiento)), 0) > 0 THEN ARRAY[b.equipamiento]
      ELSE ARRAY['sin_equipo']
    END
  ) AS equipment_values(equipo)
  GROUP BY COALESCE(NULLIF(btrim(equipo), ''), 'sin_equipo')
),
name_duplicates AS (
  SELECT
    normalized_nombre,
    count(*) AS duplicate_count,
    array_agg(id ORDER BY id) AS ids,
    array_agg(nombre ORDER BY nombre) AS nombres
  FROM base
  GROUP BY normalized_nombre
  HAVING count(*) > 1
),
possible_duplicate_groups AS (
  SELECT
    lower(regexp_replace(trim(COALESCE(grupo_muscular, '')), '\s+', ' ', 'g')) AS grupo_norm,
    lower(regexp_replace(trim(COALESCE(musculo_principal, '')), '\s+', ' ', 'g')) AS musculo_norm,
    lower(regexp_replace(trim(COALESCE(patron_movimiento, '')), '\s+', ' ', 'g')) AS patron_norm,
    lower(regexp_replace(trim(COALESCE(equipamiento, array_to_string(equipo_requerido, ', '), '')), '\s+', ' ', 'g')) AS equipo_norm,
    count(*) AS possible_duplicate_count,
    array_agg(id ORDER BY nombre) AS ids,
    array_agg(nombre ORDER BY nombre) AS nombres
  FROM base
  WHERE COALESCE(musculo_principal, '') <> ''
  GROUP BY
    lower(regexp_replace(trim(COALESCE(grupo_muscular, '')), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(COALESCE(musculo_principal, '')), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(COALESCE(patron_movimiento, '')), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(COALESCE(equipamiento, array_to_string(equipo_requerido, ', '), '')), '\s+', ' ', 'g'))
  HAVING count(*) > 1
)
SELECT
  1 AS section_order,
  'total_ejercicios' AS section,
  'info' AS severity,
  'total' AS check_name,
  NULL::text AS entity_id,
  NULL::text AS nombre,
  NULL::text AS grupo_muscular,
  NULL::text AS musculo_principal,
  NULL::text AS patron_movimiento,
  NULL::text AS equipment,
  NULL::text AS estado_calidad,
  NULL::text AS details,
  count(*) AS total
FROM base

UNION ALL
SELECT
  2,
  'total_por_grupo_muscular',
  'info',
  'grupo_muscular_count',
  NULL::text,
  NULL::text,
  COALESCE(NULLIF(btrim(grupo_muscular), ''), 'sin_grupo'),
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  count(*)
FROM base
GROUP BY COALESCE(NULLIF(btrim(grupo_muscular), ''), 'sin_grupo')

UNION ALL
SELECT
  3,
  'total_por_equipo',
  'info',
  'equipo_count',
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  equipment,
  NULL::text,
  NULL::text,
  total
FROM equipment_items

UNION ALL
SELECT
  4,
  'total_por_patron_movimiento',
  'info',
  'patron_movimiento_count',
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  COALESCE(NULLIF(btrim(patron_movimiento), ''), 'sin_patron'),
  NULL::text,
  NULL::text,
  NULL::text,
  count(*)
FROM base
GROUP BY COALESCE(NULLIF(btrim(patron_movimiento), ''), 'sin_patron')

UNION ALL
SELECT
  5,
  'total_por_estado_calidad',
  'info',
  'estado_calidad_count',
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  COALESCE(NULLIF(btrim(estado_calidad), ''), 'sin_estado'),
  NULL::text,
  count(*)
FROM base
GROUP BY COALESCE(NULLIF(btrim(estado_calidad), ''), 'sin_estado')

UNION ALL
SELECT
  6,
  'ejercicios_sin_instrucciones',
  'warning',
  'sin_instrucciones',
  id,
  nombre,
  grupo_muscular,
  musculo_principal,
  patron_movimiento,
  COALESCE(equipamiento, array_to_string(equipo_requerido, ', ')),
  estado_calidad,
  NULL::text,
  NULL::bigint
FROM base
WHERE cardinality(COALESCE(instrucciones, '{}'::text[])) = 0

UNION ALL
SELECT
  7,
  'ejercicios_con_instrucciones_muy_cortas',
  'warning',
  'instrucciones_muy_cortas',
  id,
  nombre,
  grupo_muscular,
  musculo_principal,
  patron_movimiento,
  COALESCE(equipamiento, array_to_string(equipo_requerido, ', ')),
  estado_calidad,
  concat('instruction_chars=', length(array_to_string(COALESCE(instrucciones, '{}'::text[]), ' '))),
  NULL::bigint
FROM base
WHERE cardinality(COALESCE(instrucciones, '{}'::text[])) > 0
  AND length(array_to_string(COALESCE(instrucciones, '{}'::text[]), ' ')) < 80

UNION ALL
SELECT
  8,
  'ejercicios_sin_equipo',
  'warning',
  'sin_equipo',
  id,
  nombre,
  grupo_muscular,
  musculo_principal,
  patron_movimiento,
  COALESCE(equipamiento, array_to_string(equipo_requerido, ', ')),
  estado_calidad,
  NULL::text,
  NULL::bigint
FROM base
WHERE COALESCE(length(btrim(equipamiento)), 0) = 0
  AND cardinality(COALESCE(equipo_requerido, '{}'::text[])) = 0

UNION ALL
SELECT
  9,
  'ejercicios_sin_maquina_equipamiento_claro',
  'warning',
  'sin_maquina_equipamiento_claro',
  id,
  nombre,
  grupo_muscular,
  musculo_principal,
  patron_movimiento,
  COALESCE(equipamiento, array_to_string(equipo_requerido, ', ')),
  estado_calidad,
  concat('lugar=', COALESCE(lugar, ''), ', maquina_gym=', COALESCE(maquina_gym, '')),
  NULL::bigint
FROM base
WHERE lower(COALESCE(lugar, '')) = 'gimnasio'
  AND COALESCE(length(btrim(equipamiento)), 0) = 0
  AND cardinality(COALESCE(equipo_requerido, '{}'::text[])) = 0
  AND COALESCE(length(btrim(maquina_gym)), 0) = 0

UNION ALL
SELECT
  10,
  'ejercicios_gym_con_maquina_gym_vacia',
  'warning',
  'maquina_gym_vacia',
  id,
  nombre,
  grupo_muscular,
  musculo_principal,
  patron_movimiento,
  COALESCE(equipamiento, array_to_string(equipo_requerido, ', ')),
  estado_calidad,
  concat('lugar=', COALESCE(lugar, ''), ', maquina_gym=', COALESCE(maquina_gym, '')),
  NULL::bigint
FROM base
WHERE lower(COALESCE(lugar, '')) = 'gimnasio'
  AND COALESCE(length(btrim(maquina_gym)), 0) = 0
  AND machine_search_text ~ '(m.quina|polea|prensa|smith|hack|pec[ -]?deck|caminadora|cinta de correr|bicicleta|el.ptica|escaladora|stair|remo erg.metro|erg.metro|banco predicador|predicador|asistid[ao]|assisted|multipower|cable|jal.n|leg press|leg curl|leg extension|curl femoral|extensi.n de cu.driceps|press en m.quina|remo en m.quina)'

UNION ALL
SELECT
  11,
  'ejercicios_sin_sustituciones',
  'warning',
  'sin_sustituciones',
  id,
  nombre,
  grupo_muscular,
  musculo_principal,
  patron_movimiento,
  COALESCE(equipamiento, array_to_string(equipo_requerido, ', ')),
  estado_calidad,
  NULL::text,
  NULL::bigint
FROM base
WHERE cardinality(COALESCE(sustituciones, '{}'::text[])) = 0

UNION ALL
SELECT
  12,
  'ejercicios_con_nombres_genericos',
  'warning',
  'nombre_generico',
  id,
  nombre,
  grupo_muscular,
  musculo_principal,
  patron_movimiento,
  COALESCE(equipamiento, array_to_string(equipo_requerido, ', ')),
  estado_calidad,
  NULL::text,
  NULL::bigint
FROM base
WHERE lower(btrim(COALESCE(nombre, ''))) IN (
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
  OR lower(btrim(COALESCE(nombre, ''))) ~ '^(press|curl|remo|sentadilla|extension|extensión)$'

UNION ALL
SELECT
  13,
  'ejercicios_con_posibles_duplicados_nombre',
  'warning',
  'posible_duplicado_nombre',
  array_to_string(ids, ', '),
  array_to_string(nombres, ' | '),
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  concat('normalized_nombre=', normalized_nombre),
  duplicate_count
FROM name_duplicates

UNION ALL
SELECT
  14,
  'ejercicios_con_posibles_duplicados_grupo',
  'warning',
  'posible_duplicado_grupo_musculo_patron_equipo',
  array_to_string(ids, ', '),
  array_to_string(nombres, ' | '),
  grupo_norm,
  musculo_norm,
  patron_norm,
  equipo_norm,
  NULL::text,
  concat('grupo=', grupo_norm, ', musculo=', musculo_norm, ', patron=', patron_norm, ', equipo=', equipo_norm),
  possible_duplicate_count
FROM possible_duplicate_groups

UNION ALL
SELECT
  15,
  'ejercicios_marcados_como_revisar',
  'warning',
  'estado_revision',
  id,
  nombre,
  grupo_muscular,
  musculo_principal,
  patron_movimiento,
  COALESCE(equipamiento, array_to_string(equipo_requerido, ', ')),
  estado_calidad,
  NULL::text,
  NULL::bigint
FROM base
WHERE lower(COALESCE(estado_calidad, '')) IN ('revisar', 'needs_review', 'deprecate_review')

UNION ALL
SELECT
  16,
  'ejercicios_sin_aliases',
  'warning',
  'sin_aliases',
  id,
  nombre,
  grupo_muscular,
  musculo_principal,
  patron_movimiento,
  COALESCE(equipamiento, array_to_string(equipo_requerido, ', ')),
  estado_calidad,
  NULL::text,
  NULL::bigint
FROM base
WHERE cardinality(COALESCE(aliases, '{}'::text[])) = 0

ORDER BY
  section_order ASC,
  total DESC NULLS LAST,
  grupo_muscular ASC NULLS LAST,
  musculo_principal ASC NULLS LAST,
  patron_movimiento ASC NULLS LAST,
  nombre ASC NULLS LAST;
