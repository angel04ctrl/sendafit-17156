-- Beta Sprint 1 - Coach IA exercise resolution coverage.
-- Safe migration: aliases only for existing rows and one curated assisted pull-up variant.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.beta_sprint1_append_aliases(
  current_aliases text[],
  new_aliases text[]
)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY(
    SELECT DISTINCT alias_value
    FROM unnest(COALESCE(current_aliases, '{}'::text[]) || COALESCE(new_aliases, '{}'::text[])) AS alias_value
    WHERE btrim(alias_value) <> ''
    ORDER BY alias_value
  )
$$;

UPDATE public.exercises
SET aliases = pg_temp.beta_sprint1_append_aliases(
  aliases,
  ARRAY['fondos en paralelas','parallel bar dips','fondos paralelas']
)
WHERE id = '33';

UPDATE public.exercises
SET aliases = pg_temp.beta_sprint1_append_aliases(
  aliases,
  ARRAY['press de triceps en polea','jalon de triceps en polea','jalon de triceps','extension de triceps en polea']
)
WHERE id = 'sf-triceps-pushdown';

UPDATE public.exercises
SET aliases = pg_temp.beta_sprint1_append_aliases(
  aliases,
  ARRAY[
    'extension de triceps con mancuerna sobre la cabeza',
    'extension de triceps con mancuerna por encima de la cabeza',
    'extension triceps mancuerna overhead'
  ]
)
WHERE id = '10';

UPDATE public.exercises
SET aliases = pg_temp.beta_sprint1_append_aliases(
  aliases,
  ARRAY['press inclinado mancuernas','press inclinado con mancuerdas','incline db press']
)
WHERE id = 'sf-press-incline-db';

UPDATE public.exercises
SET aliases = pg_temp.beta_sprint1_append_aliases(
  aliases,
  ARRAY['dominada','pull up','pull ups']
)
WHERE id = '36';

INSERT INTO public.exercises (
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
  series_sugeridas,
  repeticiones_sugeridas,
  rango_reps_min,
  rango_reps_max,
  descanso_segundos_min,
  descanso_segundos_max,
  rir_recomendado,
  duracion_promedio_segundos,
  estado_calidad,
  imagen,
  video
)
VALUES (
  'sf-assisted-pullup',
  'Dominadas asistidas',
  ARRAY['assisted pull-up','assisted pull ups','dominada asistida','dominadas con asistencia','dominadas en maquina asistida'],
  'principiante',
  'principiante',
  'espalda',
  'dorsal ancho',
  ARRAY['biceps','romboides','trapecio medio','core'],
  'maquina asistida o banda elastica',
  ARRAY['maquina asistida o banda elastica','barra de dominadas'],
  'gimnasio',
  'hipertrofia',
  'fuerza',
  'jalon vertical asistido',
  'Variante asistida de dominadas para entrenar dorsal ancho y espalda alta con una carga escalable. Es util para principiantes o para acumular volumen tecnico antes de dominadas libres.',
  ARRAY[
    'Ajusta la asistencia de la maquina o coloca una banda segura',
    'Toma la barra con agarre comodo y hombros activos',
    'Jala el pecho hacia la barra sin balancearte',
    'Pausa brevemente arriba manteniendo costillas controladas',
    'Baja lento hasta extender brazos sin perder tension'
  ],
  ARRAY['Hombros abajo','Pecho hacia la barra','Sin balanceo','Bajada controlada'],
  ARRAY['Impulsarse con piernas','Encoger hombros','Recortar rango','Soltar la bajada'],
  ARRAY['Evitar si causa dolor agudo de hombro o codo','Usar jalon al pecho si no hay equipo de asistencia'],
  ARRAY['Jalón al pecho','Dominadas','Remo en polea sentado'],
  ARRAY['Reducir asistencia','Pausar arriba','Pasar a dominadas libres'],
  ARRAY['Aumentar asistencia','Jalón al pecho','Remo en polea ligero'],
  3,
  10,
  8,
  12,
  90,
  150,
  2,
  NULL,
  'curado',
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  aliases = pg_temp.beta_sprint1_append_aliases(public.exercises.aliases, EXCLUDED.aliases),
  nivel = EXCLUDED.nivel,
  nivel_minimo = EXCLUDED.nivel_minimo,
  grupo_muscular = EXCLUDED.grupo_muscular,
  musculo_principal = EXCLUDED.musculo_principal,
  musculos_secundarios = EXCLUDED.musculos_secundarios,
  equipamiento = EXCLUDED.equipamiento,
  equipo_requerido = EXCLUDED.equipo_requerido,
  lugar = EXCLUDED.lugar,
  objetivo = EXCLUDED.objetivo,
  tipo_entrenamiento = EXCLUDED.tipo_entrenamiento,
  patron_movimiento = EXCLUDED.patron_movimiento,
  descripcion = EXCLUDED.descripcion,
  instrucciones = EXCLUDED.instrucciones,
  cues_tecnicos = EXCLUDED.cues_tecnicos,
  errores_comunes = EXCLUDED.errores_comunes,
  contraindicaciones = EXCLUDED.contraindicaciones,
  sustituciones = EXCLUDED.sustituciones,
  progresiones = EXCLUDED.progresiones,
  regresiones = EXCLUDED.regresiones,
  series_sugeridas = EXCLUDED.series_sugeridas,
  repeticiones_sugeridas = EXCLUDED.repeticiones_sugeridas,
  rango_reps_min = EXCLUDED.rango_reps_min,
  rango_reps_max = EXCLUDED.rango_reps_max,
  descanso_segundos_min = EXCLUDED.descanso_segundos_min,
  descanso_segundos_max = EXCLUDED.descanso_segundos_max,
  rir_recomendado = EXCLUDED.rir_recomendado,
  duracion_promedio_segundos = EXCLUDED.duracion_promedio_segundos,
  estado_calidad = EXCLUDED.estado_calidad;

COMMIT;
