-- Sprint 7.1 - Validacion del motor profesional de planificacion.
-- Ejecutar en Supabase SQL Editor. Devuelve filas clasificadas por severity.
-- Ajustar nombres de columnas opcionales si el proyecto usa otro esquema para origen/proteccion de planes.

WITH profiles_days AS (
  SELECT
    p.id AS user_id,
    p.assigned_routine_id,
    p.fitness_level,
    p.fitness_goal,
    p.session_duration_minutes,
    ARRAY(
      SELECT CASE value
        WHEN 'L' THEN 1 WHEN 'M' THEN 2 WHEN 'Mi' THEN 3 WHEN 'J' THEN 4
        WHEN 'V' THEN 5 WHEN 'S' THEN 6 WHEN 'D' THEN 7
        ELSE NULLIF(value, '')::int
      END
      FROM jsonb_array_elements_text(COALESCE(to_jsonb(p.available_weekdays), '[]'::jsonb)) AS days(value)
      WHERE value IN ('L','M','Mi','J','V','S','D','1','2','3','4','5','6','7')
    ) AS selected_weekdays
  FROM public.profiles p
),
workout_week AS (
  SELECT
    w.id,
    w.user_id,
    w.plan_id,
    w.weekday,
    w.scheduled_date,
    w.duration_minutes,
    w.tipo,
    w.completed,
    EXTRACT(ISODOW FROM w.scheduled_date)::int AS scheduled_isodow
  FROM public.workouts w
  WHERE w.scheduled_date >= date_trunc('week', CURRENT_DATE)::date
    AND w.scheduled_date < (date_trunc('week', CURRENT_DATE)::date + INTERVAL '7 days')
),
workout_counts AS (
  SELECT user_id, COUNT(*) AS workouts_count, COUNT(DISTINCT weekday) AS workout_days_count
  FROM workout_week
  GROUP BY user_id
),
workout_exercise_details AS (
  SELECT
    ww.user_id,
    ww.id AS workout_id,
    ww.weekday,
    ww.duration_minutes,
    e.id AS exercise_id,
    e.nombre,
    e.tipo_entrenamiento,
    e.nivel_minimo,
    e.equipo_requerido,
    e.equipamiento,
    e.patron_movimiento,
    e.grupo_muscular,
    e.musculo_principal,
    e.musculos_secundarios
  FROM workout_week ww
  JOIN public.workout_exercises we ON we.workout_id = ww.id
  LEFT JOIN public.exercises e ON e.id = we.exercise_id
)
SELECT 'critical' AS severity, 'seven_selected_with_seven_workouts' AS check_name,
       pd.user_id, wc.workouts_count::text AS details
FROM profiles_days pd
JOIN workout_counts wc ON wc.user_id = pd.user_id
WHERE cardinality(pd.selected_weekdays) = 7 AND wc.workouts_count >= 7

UNION ALL
SELECT 'critical', 'seven_selected_without_empty_rest_day',
       pd.user_id, wc.workout_days_count::text
FROM profiles_days pd
JOIN workout_counts wc ON wc.user_id = pd.user_id
WHERE cardinality(pd.selected_weekdays) = 7 AND wc.workout_days_count >= 7

UNION ALL
SELECT 'critical', 'workout_outside_selected_days',
       pd.user_id, ww.weekday::text
FROM profiles_days pd
JOIN workout_week ww ON ww.user_id = pd.user_id
WHERE cardinality(pd.selected_weekdays) BETWEEN 1 AND 6
  AND NOT ww.weekday = ANY(pd.selected_weekdays)

UNION ALL
SELECT 'critical', 'weekday_mismatch_scheduled_date',
       ww.user_id, ww.id::text
FROM workout_week ww
WHERE ww.weekday IS DISTINCT FROM ww.scheduled_isodow

UNION ALL
SELECT 'critical', 'cardio_used_as_strength_volume',
       wed.user_id, CONCAT(wed.workout_id, ': ', wed.nombre)
FROM workout_exercise_details wed
WHERE lower(COALESCE(wed.tipo_entrenamiento::text, '')) LIKE '%cardio%'
  AND lower(COALESCE(wed.grupo_muscular::text, '')) NOT LIKE '%cardio%'

UNION ALL
SELECT 'critical', 'advanced_exercise_for_beginner',
       wed.user_id, CONCAT(wed.workout_id, ': ', wed.nombre)
FROM workout_exercise_details wed
JOIN profiles_days pd ON pd.user_id = wed.user_id
WHERE lower(COALESCE(pd.fitness_level::text, 'principiante')) = 'principiante'
  AND lower(COALESCE(wed.nivel_minimo::text, 'principiante')) IN ('avanzado', 'p')

UNION ALL
SELECT 'critical', 'home_user_with_machine_or_cable',
       wed.user_id, CONCAT(wed.workout_id, ': ', wed.nombre)
FROM workout_exercise_details wed
JOIN public.profiles p ON p.id = wed.user_id
WHERE lower(COALESCE(to_jsonb(p.training_types)::text, '')) LIKE '%casa%'
  AND lower(CONCAT(COALESCE(wed.equipamiento::text, ''), ' ', COALESCE(wed.equipo_requerido::text, ''))) ~ '(maquina|polea|prensa|caminadora|escaladora)'

UNION ALL
SELECT 'warning', 'duration_above_target_tolerance',
       pd.user_id, CONCAT('target=', pd.session_duration_minutes, ', workout=', ww.duration_minutes)
FROM profiles_days pd
JOIN workout_week ww ON ww.user_id = pd.user_id
WHERE pd.session_duration_minutes IS NOT NULL
  AND ww.duration_minutes > pd.session_duration_minutes + 15

UNION ALL
SELECT 'warning', 'more_than_four_programmed_days_this_week',
       pd.user_id, wc.workout_days_count::text
FROM profiles_days pd
JOIN workout_counts wc ON wc.user_id = pd.user_id
WHERE wc.workout_days_count > 4 AND cardinality(pd.selected_weekdays) >= 5

UNION ALL
SELECT 'info', 'seven_day_rest_gap',
       pd.user_id,
       ARRAY(
         SELECT d FROM generate_series(1, 7) AS d
         WHERE d = ANY(pd.selected_weekdays)
           AND NOT EXISTS (
             SELECT 1 FROM workout_week ww WHERE ww.user_id = pd.user_id AND ww.weekday = d
           )
       )::text AS details
FROM profiles_days pd
WHERE cardinality(pd.selected_weekdays) = 7

UNION ALL
SELECT 'info', 'weekly_workout_count',
       pd.user_id, COALESCE(wc.workouts_count, 0)::text
FROM profiles_days pd
LEFT JOIN workout_counts wc ON wc.user_id = pd.user_id
ORDER BY severity, check_name, user_id;
