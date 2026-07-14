-- Sprint 6.1.2 final exercise export.
-- Run after applying 20260630002000_sprint6_1_2_final_exercise_polish.sql.

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
  lugar,
  objetivo,
  patron_movimiento,
  tipo_entrenamiento,
  descripcion,
  instrucciones,
  cues_tecnicos,
  errores_comunes,
  contraindicaciones,
  sustituciones,
  progresiones,
  regresiones,
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
