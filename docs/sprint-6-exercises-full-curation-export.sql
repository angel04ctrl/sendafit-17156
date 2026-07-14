-- Sprint 6 full exercise curation export.
-- Read-only.
-- First result: real columns currently present in public.exercises.
-- Second result: full export for CSV review by an exercise specialist.

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exercises'
ORDER BY ordinal_position;

SELECT
  id,
  created_at,
  nombre,
  aliases,
  lower(regexp_replace(trim(nombre), '\s+', ' ', 'g')) AS normalized_nombre,
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
  array_length(instrucciones, 1) IS NOT NULL AS has_instrucciones,
  (
    descripcion ILIKE '%requiere control tecnico%'
    OR descripcion ILIKE '%requiere control técnico%'
    OR descripcion ILIKE '%Ejercicio de fuerza o habilidad%'
    OR descripcion ILIKE '%Ejercicio cardiovascular orientado a mejorar resistencia%'
  ) AS has_descripcion_generica,
  (imagen IS NOT NULL OR video IS NOT NULL) AS has_media,
  (
    tipo_entrenamiento ILIKE 'cardio%'
    OR patron_movimiento ILIKE '%cardio%'
    OR grupo_muscular ILIKE '%cardio%'
  ) AS is_cardio,
  concat_ws(
    ' | ',
    CASE WHEN array_length(instrucciones, 1) IS NULL THEN 'sin instrucciones' END,
    CASE WHEN array_length(aliases, 1) IS NULL THEN 'sin aliases' END,
    CASE WHEN array_length(sustituciones, 1) IS NULL THEN 'sin sustituciones' END,
    CASE WHEN array_length(progresiones, 1) IS NULL OR array_length(regresiones, 1) IS NULL THEN 'sin progresiones/regresiones' END,
    CASE WHEN array_length(musculos_secundarios, 1) IS NULL THEN 'sin musculos secundarios' END,
    CASE
      WHEN tipo_entrenamiento ILIKE 'cardio%'
        AND (rango_reps_min IS NOT NULL OR rango_reps_max IS NOT NULL OR rir_recomendado IS NOT NULL)
      THEN 'cardio con reps/RIR'
    END,
    CASE
      WHEN tipo_entrenamiento NOT ILIKE 'cardio%'
        AND duracion_promedio_segundos IS NULL
        AND (rango_reps_min IS NULL OR rango_reps_max IS NULL OR descanso_segundos_min IS NULL OR descanso_segundos_max IS NULL)
      THEN 'fuerza sin reps/descanso'
    END,
    CASE
      WHEN lower(trim(nombre)) IN ('remo', 'curl', 'press', 'sentadilla', 'extension', 'extensión', 'remo en maquina', 'remo en máquina')
      THEN 'nombre ambiguo/generico'
    END,
    CASE WHEN estado_calidad = 'revisar' THEN 'estado revisar' END,
    CASE WHEN imagen IS NULL AND video IS NULL THEN 'sin multimedia' END
  ) AS needs_review_reason
FROM public.exercises
ORDER BY
  grupo_muscular NULLS LAST,
  musculo_principal NULLS LAST,
  patron_movimiento NULLS LAST,
  nombre ASC;

