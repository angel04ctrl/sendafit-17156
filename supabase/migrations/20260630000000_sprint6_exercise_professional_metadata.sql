-- Sprint 6: professional exercise metadata foundation.
-- Additive migration: keeps existing exercise ids and legacy columns.

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS musculo_principal text,
  ADD COLUMN IF NOT EXISTS musculos_secundarios text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS patron_movimiento text,
  ADD COLUMN IF NOT EXISTS equipo_requerido text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS nivel_minimo text,
  ADD COLUMN IF NOT EXISTS errores_comunes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cues_tecnicos text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS contraindicaciones text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS rango_reps_min integer,
  ADD COLUMN IF NOT EXISTS rango_reps_max integer,
  ADD COLUMN IF NOT EXISTS descanso_segundos_min integer,
  ADD COLUMN IF NOT EXISTS descanso_segundos_max integer,
  ADD COLUMN IF NOT EXISTS rir_recomendado integer,
  ADD COLUMN IF NOT EXISTS sustituciones text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS progresiones text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS regresiones text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS estado_calidad text NOT NULL DEFAULT 'legacy';

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_reps_range_check,
  DROP CONSTRAINT IF EXISTS exercises_rest_range_check,
  DROP CONSTRAINT IF EXISTS exercises_rir_recomendado_check,
  DROP CONSTRAINT IF EXISTS exercises_estado_calidad_check;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_reps_range_check
  CHECK (
    (rango_reps_min IS NULL AND rango_reps_max IS NULL)
    OR (
      rango_reps_min IS NOT NULL
      AND rango_reps_max IS NOT NULL
      AND rango_reps_min > 0
      AND rango_reps_max >= rango_reps_min
    )
  ),
  ADD CONSTRAINT exercises_rest_range_check
  CHECK (
    (descanso_segundos_min IS NULL AND descanso_segundos_max IS NULL)
    OR (
      descanso_segundos_min IS NOT NULL
      AND descanso_segundos_max IS NOT NULL
      AND descanso_segundos_min >= 0
      AND descanso_segundos_max >= descanso_segundos_min
    )
  ),
  ADD CONSTRAINT exercises_rir_recomendado_check
  CHECK (rir_recomendado IS NULL OR rir_recomendado BETWEEN 0 AND 5),
  ADD CONSTRAINT exercises_estado_calidad_check
  CHECK (estado_calidad IN ('legacy', 'basico', 'revisado', 'premium'));

UPDATE public.exercises
SET nivel = CASE
  WHEN lower(trim(nivel)) IN ('b', 'basic', 'basico', 'básico', 'beginner', 'principiante') THEN 'principiante'
  WHEN lower(trim(nivel)) IN ('i', 'intermediate', 'intermedio') THEN 'intermedio'
  WHEN lower(trim(nivel)) IN ('p', 'professional', 'profesional', 'advanced', 'avanzado') THEN 'avanzado'
  ELSE 'principiante'
END;

UPDATE public.exercises
SET
  musculo_principal = COALESCE(musculo_principal, grupo_muscular),
  nivel_minimo = COALESCE(nivel_minimo, nivel),
  rango_reps_min = COALESCE(rango_reps_min, CASE WHEN repeticiones_sugeridas IS NOT NULL THEN GREATEST(1, repeticiones_sugeridas - 2) ELSE 8 END),
  rango_reps_max = COALESCE(rango_reps_max, CASE WHEN repeticiones_sugeridas IS NOT NULL THEN repeticiones_sugeridas + 2 ELSE 12 END),
  descanso_segundos_min = COALESCE(descanso_segundos_min, CASE WHEN lower(tipo_entrenamiento) LIKE '%cardio%' THEN 30 ELSE 60 END),
  descanso_segundos_max = COALESCE(descanso_segundos_max, CASE WHEN lower(tipo_entrenamiento) LIKE '%fuerza%' THEN 120 ELSE 90 END),
  rir_recomendado = COALESCE(rir_recomendado, CASE WHEN nivel = 'principiante' THEN 2 ELSE 1 END),
  estado_calidad = CASE WHEN estado_calidad = 'legacy' THEN 'basico' ELSE estado_calidad END;

UPDATE public.exercises
SET equipo_requerido = CASE
  WHEN array_length(equipo_requerido, 1) IS NOT NULL THEN equipo_requerido
  WHEN equipamiento IS NOT NULL AND trim(equipamiento) <> '' THEN ARRAY[equipamiento]
  WHEN maquina_gym IS NOT NULL AND trim(maquina_gym) <> '' THEN ARRAY[maquina_gym]
  WHEN lugar = 'gimnasio' THEN ARRAY['gimnasio']
  ELSE ARRAY['peso corporal']
END;

UPDATE public.exercises
SET
  patron_movimiento = CASE
    WHEN grupo_muscular ILIKE '%pecho%' THEN 'empuje_horizontal'
    WHEN grupo_muscular ILIKE '%espalda%' THEN 'traccion_horizontal_vertical'
    WHEN grupo_muscular ILIKE '%hombro%' THEN 'empuje_vertical'
    WHEN grupo_muscular ILIKE '%bicep%' OR grupo_muscular ILIKE '%bícep%' THEN 'flexion_codo'
    WHEN grupo_muscular ILIKE '%tricep%' OR grupo_muscular ILIKE '%trícep%' THEN 'extension_codo'
    WHEN grupo_muscular ILIKE '%abdomen%' OR grupo_muscular ILIKE '%core%' THEN 'estabilidad_core'
    WHEN grupo_muscular ILIKE '%glute%' OR grupo_muscular ILIKE '%glúte%' THEN 'dominante_cadera'
    WHEN grupo_muscular ILIKE '%femoral%' THEN 'bisagra_cadera'
    WHEN grupo_muscular ILIKE '%pantorr%' THEN 'flexion_plantar'
    WHEN grupo_muscular ILIKE '%pierna%' OR grupo_muscular ILIKE '%cuadri%' THEN 'dominante_rodilla'
    ELSE COALESCE(patron_movimiento, 'general')
  END,
  musculos_secundarios = CASE
    WHEN array_length(musculos_secundarios, 1) IS NOT NULL THEN musculos_secundarios
    WHEN grupo_muscular ILIKE '%pecho%' THEN ARRAY['triceps', 'hombro anterior']
    WHEN grupo_muscular ILIKE '%espalda%' THEN ARRAY['biceps', 'deltoide posterior']
    WHEN grupo_muscular ILIKE '%hombro%' THEN ARRAY['triceps', 'trapecio']
    WHEN grupo_muscular ILIKE '%pierna%' OR grupo_muscular ILIKE '%cuadri%' THEN ARRAY['gluteo', 'core']
    WHEN grupo_muscular ILIKE '%glute%' OR grupo_muscular ILIKE '%glúte%' THEN ARRAY['femoral', 'core']
    WHEN grupo_muscular ILIKE '%femoral%' THEN ARRAY['gluteo', 'erectores espinales']
    WHEN grupo_muscular ILIKE '%abdomen%' OR grupo_muscular ILIKE '%core%' THEN ARRAY['oblicuos', 'flexores de cadera']
    ELSE '{}'::text[]
  END,
  errores_comunes = CASE
    WHEN array_length(errores_comunes, 1) IS NOT NULL THEN errores_comunes
    WHEN grupo_muscular ILIKE '%pecho%' THEN ARRAY['Arquear la espalda en exceso', 'Rebotar la carga', 'Perder control en la bajada']
    WHEN grupo_muscular ILIKE '%espalda%' THEN ARRAY['Jalar con los brazos sin activar la espalda', 'Encoger hombros', 'Usar impulso excesivo']
    WHEN grupo_muscular ILIKE '%pierna%' OR grupo_muscular ILIKE '%cuadri%' THEN ARRAY['Colapsar rodillas hacia adentro', 'Perder estabilidad del tronco', 'Recortar demasiado el rango']
    WHEN grupo_muscular ILIKE '%hombro%' THEN ARRAY['Subir la carga con impulso', 'Arquear la espalda', 'Bloquear el cuello']
    ELSE ARRAY['Usar impulso excesivo', 'Perder postura neutra', 'No controlar la fase de regreso']
  END,
  cues_tecnicos = CASE
    WHEN array_length(cues_tecnicos, 1) IS NOT NULL THEN cues_tecnicos
    WHEN grupo_muscular ILIKE '%pecho%' THEN ARRAY['Escápulas firmes y pecho abierto', 'Baja con control', 'Empuja sin perder alineación de muñecas']
    WHEN grupo_muscular ILIKE '%espalda%' THEN ARRAY['Inicia llevando los codos hacia atrás', 'Mantén pecho abierto', 'Controla el regreso completo']
    WHEN grupo_muscular ILIKE '%pierna%' OR grupo_muscular ILIKE '%cuadri%' THEN ARRAY['Pie completo apoyado', 'Rodillas siguen la línea de los pies', 'Tronco firme durante todo el movimiento']
    WHEN grupo_muscular ILIKE '%hombro%' THEN ARRAY['Costillas abajo', 'Empuja vertical sin encoger el cuello', 'Controla la bajada']
    WHEN grupo_muscular ILIKE '%abdomen%' OR grupo_muscular ILIKE '%core%' THEN ARRAY['Activa abdomen antes de moverte', 'Respira sin perder tensión', 'Evita arquear la zona lumbar']
    ELSE ARRAY['Controla la fase de subida y bajada', 'Mantén una postura estable', 'Detén la serie si aparece dolor']
  END,
  contraindicaciones = CASE
    WHEN array_length(contraindicaciones, 1) IS NOT NULL THEN contraindicaciones
    WHEN grupo_muscular ILIKE '%hombro%' OR grupo_muscular ILIKE '%pecho%' THEN ARRAY['Evitar si provoca dolor agudo de hombro']
    WHEN grupo_muscular ILIKE '%pierna%' OR grupo_muscular ILIKE '%femoral%' THEN ARRAY['Evitar si provoca dolor agudo de rodilla o espalda baja']
    ELSE ARRAY['Evitar si provoca dolor agudo o síntomas inusuales']
  END,
  progresiones = CASE
    WHEN array_length(progresiones, 1) IS NOT NULL THEN progresiones
    ELSE ARRAY['Aumentar repeticiones dentro del rango', 'Aumentar carga de forma gradual', 'Mejorar control del tempo']
  END,
  regresiones = CASE
    WHEN array_length(regresiones, 1) IS NOT NULL THEN regresiones
    ELSE ARRAY['Reducir carga', 'Reducir rango temporalmente', 'Usar una variante más estable']
  END;

WITH ranked AS (
  SELECT
    id,
    grupo_muscular,
    array_agg(nombre) OVER (PARTITION BY lower(grupo_muscular) ORDER BY nombre ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS group_names
  FROM public.exercises
)
UPDATE public.exercises e
SET sustituciones = COALESCE(NULLIF(e.sustituciones, '{}'::text[]), ranked.group_names[1:4])
FROM ranked
WHERE ranked.id = e.id
  AND ranked.group_names IS NOT NULL;

CREATE INDEX IF NOT EXISTS exercises_musculo_principal_idx
  ON public.exercises (musculo_principal);

CREATE INDEX IF NOT EXISTS exercises_patron_movimiento_idx
  ON public.exercises (patron_movimiento);

CREATE INDEX IF NOT EXISTS exercises_nivel_minimo_idx
  ON public.exercises (nivel_minimo);

CREATE INDEX IF NOT EXISTS exercises_equipo_requerido_gin_idx
  ON public.exercises USING gin (equipo_requerido);

COMMENT ON COLUMN public.exercises.nivel IS 'Nivel normalizado: principiante, intermedio, avanzado. Valores legacy B/I/P se migran a estos valores.';
COMMENT ON COLUMN public.exercises.patron_movimiento IS 'Patron principal de movimiento para seleccion, sustituciones y futura generacion de rutinas.';
COMMENT ON COLUMN public.exercises.estado_calidad IS 'Estado de calidad del contenido: legacy, basico, revisado, premium.';
