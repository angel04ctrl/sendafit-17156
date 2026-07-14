-- Sprint 6.1 curated exercise export.
-- Run after applying 20260630001000_sprint6_1_exercise_professional_curation.sql.

SELECT
  id,
  nombre,
  aliases,
  nivel,
  nivel_minimo,
  grupo_muscular,
  musculo_principal,
  musculos_secundarios,
  equipamiento,
  equipo_requerido,
  patron_movimiento,
  tipo_entrenamiento,
  descripcion,
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
  maquina_gym,
  imagen,
  video,
  estado_calidad,
  created_at
FROM public.exercises
ORDER BY
  grupo_muscular NULLS LAST,
  nivel NULLS LAST,
  nombre ASC;
