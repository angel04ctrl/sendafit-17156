-- Beta Exercise Sprint 1 - Export completo de biblioteca de ejercicios.
-- Read-only. Ejecutar en Supabase SQL Editor y exportar el resultado como CSV.
-- No modifica datos, IDs ni schema.
--
-- Nota: no se incluye updated_at porque no existe en el schema local actual de public.exercises.
-- Si beta-exercise-curation-schema.sql muestra updated_at en tu Supabase remoto,
-- agregalo manualmente al SELECT antes de exportar.

SELECT
  id,
  nombre,
  aliases,
  lower(regexp_replace(trim(COALESCE(nombre, '')), '\s+', ' ', 'g')) AS normalized_nombre,
  nivel,
  nivel_minimo,
  grupo_muscular,
  musculo_principal,
  musculos_secundarios,
  equipamiento,
  equipo_requerido,
  tipo_entrenamiento,
  patron_movimiento,
  descripcion,
  instrucciones,
  cues_tecnicos,
  errores_comunes,
  contraindicaciones,
  sustituciones,
  progresiones,
  regresiones,
  lugar,
  objetivo,
  series_sugeridas,
  repeticiones_sugeridas,
  rango_reps_min,
  rango_reps_max,
  descanso_segundos_min,
  descanso_segundos_max,
  rir_recomendado,
  duracion_promedio_segundos,
  calorias_por_repeticion,
  maquina_gym,
  imagen,
  video,
  estado_calidad,
  created_at,
  cardinality(COALESCE(instrucciones, '{}'::text[])) > 0 AS has_instrucciones,
  COALESCE(length(btrim(descripcion)), 0) > 0 AS has_descripcion,
  cardinality(COALESCE(cues_tecnicos, '{}'::text[])) > 0 AS has_cues,
  cardinality(COALESCE(errores_comunes, '{}'::text[])) > 0 AS has_errores,
  cardinality(COALESCE(sustituciones, '{}'::text[])) > 0 AS has_sustituciones,
  (
    COALESCE(length(btrim(equipamiento)), 0) > 0
    OR cardinality(COALESCE(equipo_requerido, '{}'::text[])) > 0
  ) AS has_equipo,
  COALESCE(length(btrim(maquina_gym)), 0) > 0 AS has_maquina_gym,
  concat_ws(
    ' | ',
    CASE WHEN cardinality(COALESCE(instrucciones, '{}'::text[])) = 0 THEN 'sin instrucciones' END,
    CASE WHEN COALESCE(length(btrim(descripcion)), 0) = 0 THEN 'sin descripcion' END,
    CASE WHEN COALESCE(length(btrim(descripcion)), 0) > 0 AND length(btrim(descripcion)) < 60 THEN 'descripcion muy corta' END,
    CASE WHEN cardinality(COALESCE(cues_tecnicos, '{}'::text[])) = 0 THEN 'sin cues tecnicos' END,
    CASE WHEN cardinality(COALESCE(errores_comunes, '{}'::text[])) = 0 THEN 'sin errores comunes' END,
    CASE WHEN cardinality(COALESCE(sustituciones, '{}'::text[])) = 0 THEN 'sin sustituciones' END,
    CASE WHEN cardinality(COALESCE(aliases, '{}'::text[])) = 0 THEN 'sin aliases' END,
    CASE
      WHEN COALESCE(length(btrim(equipamiento)), 0) = 0
       AND cardinality(COALESCE(equipo_requerido, '{}'::text[])) = 0
      THEN 'sin equipo'
    END,
    CASE
      WHEN lower(COALESCE(lugar, '')) = 'gimnasio'
       AND COALESCE(length(btrim(equipamiento)), 0) = 0
       AND cardinality(COALESCE(equipo_requerido, '{}'::text[])) = 0
       AND COALESCE(length(btrim(maquina_gym)), 0) = 0
      THEN 'sin maquina/equipamiento claro'
    END,
    CASE
      WHEN lower(COALESCE(lugar, '')) = 'gimnasio'
       AND COALESCE(length(btrim(maquina_gym)), 0) = 0
       AND lower(concat_ws(
         ' ',
         nombre,
         equipamiento,
         array_to_string(equipo_requerido, ' '),
         patron_movimiento,
         tipo_entrenamiento
       )) ~ '(m.quina|polea|prensa|smith|hack|pec[ -]?deck|caminadora|cinta de correr|bicicleta|el.ptica|escaladora|stair|remo erg.metro|erg.metro|banco predicador|predicador|asistid[ao]|assisted|multipower|cable|jal.n|leg press|leg curl|leg extension|curl femoral|extensi.n de cu.driceps|press en m.quina|remo en m.quina)'
      THEN 'maquina_gym vacia'
    END,
    CASE
      WHEN lower(btrim(COALESCE(nombre, ''))) IN (
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
      THEN 'nombre generico'
    END,
    CASE
      WHEN lower(COALESCE(estado_calidad, '')) IN ('revisar', 'needs_review', 'deprecate_review')
      THEN 'estado marcado para revisar'
    END
  ) AS needs_review_reason
FROM public.exercises
ORDER BY
  grupo_muscular NULLS LAST,
  musculo_principal NULLS LAST,
  patron_movimiento NULLS LAST,
  nombre ASC;
