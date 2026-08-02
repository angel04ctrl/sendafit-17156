-- Beta Exercise Sprint 2 - Validacion posterior al import de curaduria de ejercicios.
-- Read-only. Resultado esperado para cierre: 0 filas critical.

WITH exercise_scope AS (
  SELECT
    e.*,
    lower(regexp_replace(trim(COALESCE(e.nombre, '')), '\s+', ' ', 'g')) AS normalized_nombre,
    lower(concat_ws(' ', e.nombre, e.equipamiento, array_to_string(e.equipo_requerido, ' '), e.patron_movimiento, e.tipo_entrenamiento)) AS machine_search_text,
    lower(concat_ws(' ', e.nombre, e.equipamiento, array_to_string(e.equipo_requerido, ' '), e.patron_movimiento, e.tipo_entrenamiento)) ~
      '(m.quina|polea|prensa|smith|hack|pec[ -]?deck|caminadora|cinta de correr|bicicleta est.tica|spinning|el.ptica|escaladora|stair|remo erg.metro|erg.metro|banco predicador|predicador|asistid[ao]|assisted|multipower|cable|jal.n|leg press|leg curl|leg extension|curl femoral|extensi.n de cu.driceps|press en m.quina|remo en m.quina)' AS is_machine_exercise
  FROM public.exercises e
), alias_scope AS (
  SELECT id, nombre, lower(regexp_replace(trim(alias), '\s+', ' ', 'g')) AS normalized_alias
  FROM exercise_scope
  CROSS JOIN LATERAL unnest(COALESCE(aliases, '{}'::text[])) AS alias
), array_item_scope AS (
  SELECT id, nombre, column_name, item
  FROM exercise_scope
  CROSS JOIN LATERAL (
    VALUES
      ('aliases', aliases),
      ('musculos_secundarios', musculos_secundarios),
      ('equipo_requerido', equipo_requerido),
      ('instrucciones', instrucciones),
      ('cues_tecnicos', cues_tecnicos),
      ('errores_comunes', errores_comunes),
      ('contraindicaciones', contraindicaciones),
      ('sustituciones', sustituciones),
      ('progresiones', progresiones),
      ('regresiones', regresiones)
  ) AS arrays(column_name, values_array)
  CROSS JOIN LATERAL unnest(COALESCE(values_array, '{}'::text[])) AS item
), normalized_duplicates AS (
  SELECT normalized_nombre, count(*) AS duplicate_count, array_agg(id ORDER BY id) AS ids, array_agg(nombre ORDER BY nombre) AS nombres
  FROM exercise_scope
  WHERE normalized_nombre <> ''
  GROUP BY normalized_nombre
  HAVING count(*) > 1
), duplicate_aliases_same_exercise AS (
  SELECT id, nombre, normalized_alias, count(*) AS alias_count
  FROM alias_scope
  WHERE normalized_alias <> ''
  GROUP BY id, nombre, normalized_alias
  HAVING count(*) > 1
), alias_conflicts AS (
  SELECT normalized_alias, count(DISTINCT id) AS exercise_count, array_agg(DISTINCT id ORDER BY id) AS ids, array_agg(DISTINCT nombre ORDER BY nombre) AS nombres
  FROM alias_scope
  WHERE normalized_alias <> ''
  GROUP BY normalized_alias
  HAVING count(DISTINCT id) > 1
), relation_orphans AS (
  SELECT 'plan_ejercicios' AS source_table, pe.ejercicio_id AS exercise_id
  FROM public.plan_ejercicios pe
  LEFT JOIN public.exercises e ON e.id = pe.ejercicio_id
  WHERE e.id IS NULL
  UNION ALL
  SELECT 'workout_exercises', we.exercise_id
  FROM public.workout_exercises we
  LEFT JOIN public.exercises e ON e.id = we.exercise_id
  WHERE we.exercise_id IS NOT NULL
    AND e.id IS NULL
), validation_rows AS (
  SELECT 'critical' AS severity, 'duplicate_exercise_id' AS check_name, id AS exercise_id, nombre, 'id duplicado' AS details
  FROM exercise_scope
  GROUP BY id, nombre
  HAVING count(*) > 1
  UNION ALL
  SELECT 'critical', 'duplicate_normalized_nombre', array_to_string(ids, ', '), array_to_string(nombres, ' | '), normalized_nombre FROM normalized_duplicates
  UNION ALL
  SELECT 'critical', 'alias_conflict', array_to_string(ids, ', '), array_to_string(nombres, ' | '), normalized_alias FROM alias_conflicts
  UNION ALL
  SELECT 'critical', 'duplicate_alias_same_exercise', id, nombre, normalized_alias FROM duplicate_aliases_same_exercise
  UNION ALL
  SELECT 'critical', 'empty_array_item', id, nombre, column_name
  FROM array_item_scope
  WHERE COALESCE(length(btrim(item)), 0) = 0
  UNION ALL
  SELECT 'critical', 'invalid_estado_calidad', id, nombre, estado_calidad
  FROM exercise_scope
  WHERE lower(COALESCE(estado_calidad, '')) NOT IN ('legacy', 'pendiente', 'basico', 'básico', 'revisar', 'curado', 'deprecado', 'premium')
  UNION ALL
  SELECT 'critical', 'invalid_level', id, nombre, nivel
  FROM exercise_scope
  WHERE lower(COALESCE(nivel, '')) NOT IN ('principiante', 'intermedio', 'avanzado', 'b', 'i', 'p')
  UNION ALL
  SELECT 'critical', 'mojibake_detected', id, nombre, 'texto con posible encoding roto'
  FROM exercise_scope
  WHERE concat_ws(' ', nombre, descripcion, array_to_string(instrucciones, ' '), array_to_string(cues_tecnicos, ' '), array_to_string(errores_comunes, ' '), array_to_string(sustituciones, ' ')) ~ '(Ã|Â|â€|â€“|â€œ|�)'
  UNION ALL SELECT 'critical', 'missing_descripcion', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(descripcion)), 0) = 0
  UNION ALL SELECT 'critical', 'missing_instrucciones', id, nombre, NULL::text FROM exercise_scope WHERE cardinality(COALESCE(instrucciones, '{}'::text[])) = 0
  UNION ALL SELECT 'critical', 'missing_cues', id, nombre, NULL::text FROM exercise_scope WHERE cardinality(COALESCE(cues_tecnicos, '{}'::text[])) = 0
  UNION ALL SELECT 'critical', 'missing_errores_comunes', id, nombre, NULL::text FROM exercise_scope WHERE cardinality(COALESCE(errores_comunes, '{}'::text[])) = 0
  UNION ALL SELECT 'critical', 'missing_sustituciones', id, nombre, NULL::text FROM exercise_scope WHERE cardinality(COALESCE(sustituciones, '{}'::text[])) = 0
  UNION ALL SELECT 'critical', 'missing_musculo_principal', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(musculo_principal)), 0) = 0
  UNION ALL SELECT 'critical', 'missing_patron_movimiento', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(patron_movimiento)), 0) = 0
  UNION ALL SELECT 'critical', 'missing_nivel', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(nivel)), 0) = 0
  UNION ALL SELECT 'critical', 'missing_estado_calidad', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(estado_calidad)), 0) = 0
  UNION ALL
  SELECT 'critical', 'curado_with_critical_empty_fields', id, nombre, concat('estado=', estado_calidad)
  FROM exercise_scope
  WHERE lower(COALESCE(estado_calidad, '')) = 'curado'
    AND (
      COALESCE(length(btrim(descripcion)), 0) = 0
      OR cardinality(COALESCE(instrucciones, '{}'::text[])) = 0
      OR cardinality(COALESCE(cues_tecnicos, '{}'::text[])) = 0
      OR cardinality(COALESCE(errores_comunes, '{}'::text[])) = 0
      OR cardinality(COALESCE(sustituciones, '{}'::text[])) = 0
      OR COALESCE(length(btrim(musculo_principal)), 0) = 0
      OR COALESCE(length(btrim(patron_movimiento)), 0) = 0
      OR COALESCE(length(btrim(nivel)), 0) = 0
    )
  UNION ALL
  SELECT 'warning', 'gym_machine_missing_maquina_gym', id, nombre, concat('equipamiento=', COALESCE(equipamiento, ''), ', equipo=', array_to_string(equipo_requerido, ', '))
  FROM exercise_scope
  WHERE lower(COALESCE(lugar, '')) = 'gimnasio'
    AND COALESCE(length(btrim(maquina_gym)), 0) = 0
    AND is_machine_exercise
  UNION ALL
  SELECT 'warning', 'machine_exercise_without_adjustment_instruction', id, nombre, NULL::text
  FROM exercise_scope
  WHERE is_machine_exercise
    AND array_to_string(COALESCE(instrucciones, '{}'::text[]), ' ') !~* '(ajusta|regula|coloca|asiento|respaldo|rodillo|polea|agarre|soporte)'
  UNION ALL
  SELECT 'warning', 'equipment_inconsistent', id, nombre, concat('lugar=', COALESCE(lugar, ''), ', equipamiento=', COALESCE(equipamiento, ''), ', equipo=', array_to_string(equipo_requerido, ', '))
  FROM exercise_scope
  WHERE COALESCE(length(btrim(equipamiento)), 0) = 0
    AND cardinality(COALESCE(equipo_requerido, '{}'::text[])) = 0
    AND lower(COALESCE(tipo_entrenamiento, '')) NOT LIKE '%cardio%'
  UNION ALL
  SELECT 'critical', 'strength_missing_programming', id, nombre, concat('series=', series_sugeridas, ', reps=', rango_reps_min, '-', rango_reps_max, ', descanso=', descanso_segundos_min, '-', descanso_segundos_max, ', rir=', rir_recomendado)
  FROM exercise_scope
  WHERE lower(COALESCE(tipo_entrenamiento, '')) NOT LIKE '%cardio%'
    AND lower(COALESCE(tipo_entrenamiento, '')) NOT LIKE '%core%'
    AND lower(COALESCE(patron_movimiento, '')) !~ '(isometr|anti-|estabilidad|control motor)'
    AND lower(COALESCE(estado_calidad, '')) NOT IN ('revisar', 'deprecado')
    AND (
      series_sugeridas IS NULL
      OR descanso_segundos_min IS NULL
      OR descanso_segundos_max IS NULL
      OR descanso_segundos_min > descanso_segundos_max
      OR (
        rir_recomendado IS NULL
        AND lower(COALESCE(patron_movimiento, '')) !~ '(carga|carry|traslado)'
      )
      OR (
        duracion_promedio_segundos IS NULL
        AND (
          rango_reps_min IS NULL
          OR rango_reps_max IS NULL
          OR rango_reps_min > rango_reps_max
        )
      )
    )
  UNION ALL
  SELECT 'critical', 'cardio_has_strength_prescription', id, nombre, concat('reps=', rango_reps_min, '-', rango_reps_max, ', repeticiones=', repeticiones_sugeridas, ', rir=', rir_recomendado)
  FROM exercise_scope
  WHERE lower(COALESCE(tipo_entrenamiento, '')) LIKE '%cardio%'
    AND lower(COALESCE(estado_calidad, '')) NOT IN ('revisar', 'deprecado')
    AND (rir_recomendado IS NOT NULL OR rango_reps_min IS NOT NULL OR rango_reps_max IS NOT NULL OR repeticiones_sugeridas IS NOT NULL)
  UNION ALL
  SELECT 'critical', 'cardio_missing_or_invalid_duration', id, nombre, concat('duration=', duracion_promedio_segundos)
  FROM exercise_scope
  WHERE lower(COALESCE(tipo_entrenamiento, '')) LIKE '%cardio%'
    AND lower(COALESCE(estado_calidad, '')) NOT IN ('revisar', 'deprecado')
    AND (duracion_promedio_segundos IS NULL OR duracion_promedio_segundos < 20 OR duracion_promedio_segundos > 7200)
  UNION ALL
  SELECT 'critical', 'orphan_exercise_reference', exercise_id, NULL::text, source_table
  FROM relation_orphans
)
SELECT *
FROM validation_rows
ORDER BY severity, check_name, exercise_id;
