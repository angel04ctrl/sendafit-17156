-- Sprint 7.2 - Validacion final confiable del planner profesional.
-- Devuelve un unico result set:
-- severity, check_name, user_id, workout_id, scheduled_date, details
-- Importante: no considera exito una semana sin workouts cuando el perfil esperaba planner automatico.

WITH bounds AS (
  SELECT
    CURRENT_DATE::date AS today,
    date_trunc('week', CURRENT_DATE)::date AS week_start,
    (date_trunc('week', CURRENT_DATE)::date + INTERVAL '7 days')::date AS week_end,
    current_setting('TIMEZONE') AS db_timezone
),
profiles_days AS (
  SELECT
    p.id AS user_id,
    p.assigned_routine_id,
    p.available_days_per_week,
    p.available_weekdays,
    p.fitness_level,
    p.fitness_goal,
    p.training_types,
    p.session_duration_minutes,
    pp.id AS predesigned_plan_id,
    pp.nombre_plan,
    ARRAY(
      SELECT DISTINCT CASE day_code
        WHEN 'L' THEN 1 WHEN 'M' THEN 2 WHEN 'Mi' THEN 3 WHEN 'J' THEN 4
        WHEN 'V' THEN 5 WHEN 'S' THEN 6 WHEN 'D' THEN 7
        ELSE NULLIF(day_code, '')::int
      END
      FROM unnest(COALESCE(p.available_weekdays, ARRAY[]::text[])) AS day_code
      WHERE day_code IN ('L','M','Mi','J','V','S','D','1','2','3','4','5','6','7')
      ORDER BY 1
    ) AS selected_weekdays
  FROM public.profiles p
  LEFT JOIN public.predesigned_plans pp ON pp.id = p.assigned_routine_id
),
scope AS (
  SELECT
    pd.*,
    cardinality(pd.selected_weekdays) AS selected_count,
    CASE
      WHEN pd.assigned_routine_id IS NULL THEN 0
      WHEN cardinality(pd.selected_weekdays) = 7 THEN 6
      ELSE cardinality(pd.selected_weekdays)
    END AS expected_training_days,
    CASE
      WHEN pd.assigned_routine_id IS NULL THEN 'planner_validation_not_applicable'
      WHEN pd.predesigned_plan_id IS NULL THEN 'planner_validation_not_applicable'
      WHEN cardinality(pd.selected_weekdays) = 0 THEN 'no_validation_data'
      ELSE 'planner_automatic_expected'
    END AS validation_scope
  FROM profiles_days pd
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
  CROSS JOIN bounds b
  WHERE w.scheduled_date >= b.week_start
    AND w.scheduled_date < b.week_end
),
workout_counts AS (
  SELECT
    user_id,
    COUNT(*) AS workouts_count,
    COUNT(*) FILTER (WHERE tipo::text = 'automatico') AS automatic_workouts_count,
    COUNT(*) FILTER (WHERE tipo::text = 'manual') AS manual_workouts_count,
    COUNT(DISTINCT weekday) FILTER (WHERE tipo::text = 'automatico') AS automatic_workout_days_count
  FROM workout_week
  GROUP BY user_id
),
auto_workout_exercise_details AS (
  SELECT
    ww.user_id,
    ww.id AS workout_id,
    ww.scheduled_date,
    ww.weekday,
    ww.duration_minutes,
    we.id AS workout_exercise_id,
    we.exercise_id,
    we.name AS workout_exercise_name,
    we.sets,
    we.reps,
    we.duration_minutes AS exercise_duration_minutes,
    e.id AS catalog_exercise_id,
    e.nombre,
    e.tipo_entrenamiento,
    e.nivel_minimo,
    e.equipo_requerido,
    e.equipamiento,
    e.estado_calidad,
    e.patron_movimiento,
    e.grupo_muscular,
    e.musculo_principal,
    e.musculos_secundarios
  FROM workout_week ww
  JOIN public.workout_exercises we ON we.workout_id = ww.id
  LEFT JOIN public.exercises e ON e.id = we.exercise_id
  WHERE ww.tipo::text = 'automatico'
),
duplicate_workouts AS (
  SELECT user_id, scheduled_date, tipo::text AS tipo, plan_id, COUNT(*) AS duplicate_count, (ARRAY_AGG(id ORDER BY id::text))[1] AS sample_workout_id
  FROM workout_week
  GROUP BY user_id, scheduled_date, tipo::text, plan_id
  HAVING COUNT(*) > 1
),
session_links AS (
  SELECT ws.user_id, ws.workout_id, ws.status
  FROM public.workout_sessions ws
  JOIN workout_week ww ON ww.id = ws.workout_id
),
set_orphans AS (
  SELECT wss.id, wss.session_id, wss.workout_exercise_id
  FROM public.workout_session_sets wss
  LEFT JOIN public.workout_sessions ws ON ws.id = wss.session_id
  LEFT JOIN public.workout_exercises we ON we.id = wss.workout_exercise_id
  WHERE ws.id IS NULL
     OR (wss.workout_exercise_id IS NOT NULL AND we.id IS NULL)
)
SELECT 'info' AS severity, 'validation_context' AS check_name,
       NULL::uuid AS user_id, NULL::uuid AS workout_id, NULL::date AS scheduled_date,
       CONCAT('today=', b.today, ', week_start=', b.week_start, ', week_end=', b.week_end, ', timezone=', b.db_timezone) AS details
FROM bounds b

UNION ALL
SELECT 'info', 'profile_context',
       s.user_id, NULL::uuid, NULL::date,
       CONCAT(
         'scope=', s.validation_scope,
         ', available_weekdays=', COALESCE(s.available_weekdays::text, '{}'),
         ', available_days_per_week=', COALESCE(s.available_days_per_week::text, 'null'),
         ', selected=', s.selected_weekdays::text,
         ', expected_training_days=', s.expected_training_days,
         ', assigned_routine_id=', COALESCE(s.assigned_routine_id, 'null'),
         ', plan=', COALESCE(s.nombre_plan, 'none'),
         ', workouts=', COALESCE(wc.workouts_count, 0),
         ', automatic=', COALESCE(wc.automatic_workouts_count, 0),
         ', manual=', COALESCE(wc.manual_workouts_count, 0)
       )
FROM scope s
LEFT JOIN workout_counts wc ON wc.user_id = s.user_id

UNION ALL
SELECT 'critical', 'expected_generated_workouts_missing',
       s.user_id, NULL::uuid, NULL::date,
       CONCAT('expected_training_days=', s.expected_training_days, ', automatic_workouts_found=0')
FROM scope s
LEFT JOIN workout_counts wc ON wc.user_id = s.user_id
WHERE s.validation_scope = 'planner_automatic_expected'
  AND s.expected_training_days > 0
  AND COALESCE(wc.automatic_workouts_count, 0) = 0

UNION ALL
SELECT 'info', 'planner_validation_not_applicable',
       s.user_id, NULL::uuid, NULL::date,
       CONCAT('scope=', s.validation_scope, ', assigned_routine_id=', COALESCE(s.assigned_routine_id, 'null'))
FROM scope s
WHERE s.validation_scope = 'planner_validation_not_applicable'

UNION ALL
SELECT 'warning', 'no_validation_data',
       NULL::uuid, NULL::uuid, NULL::date,
       'No profiles with planner_automatic_expected scope were found.'
WHERE NOT EXISTS (SELECT 1 FROM scope WHERE validation_scope = 'planner_automatic_expected')

UNION ALL
SELECT 'critical', 'seven_selected_with_seven_workouts',
       s.user_id, NULL::uuid, NULL::date, COALESCE(wc.automatic_workouts_count, 0)::text
FROM scope s
JOIN workout_counts wc ON wc.user_id = s.user_id
WHERE s.validation_scope = 'planner_automatic_expected'
  AND s.selected_count = 7
  AND wc.automatic_workouts_count >= 7

UNION ALL
SELECT 'critical', 'seven_selected_without_exactly_one_rest_day',
       s.user_id, NULL::uuid, NULL::date, CONCAT('automatic_days=', COALESCE(wc.automatic_workout_days_count, 0))
FROM scope s
JOIN workout_counts wc ON wc.user_id = s.user_id
WHERE s.validation_scope = 'planner_automatic_expected'
  AND s.selected_count = 7
  AND wc.automatic_workout_days_count <> 6

UNION ALL
SELECT 'critical', 'workout_outside_selected_days',
       s.user_id, ww.id, ww.scheduled_date, ww.weekday::text
FROM scope s
JOIN workout_week ww ON ww.user_id = s.user_id AND ww.tipo::text = 'automatico'
WHERE s.validation_scope = 'planner_automatic_expected'
  AND s.selected_count BETWEEN 1 AND 6
  AND NOT ww.weekday = ANY(s.selected_weekdays)

UNION ALL
SELECT 'critical', 'weekday_mismatch_scheduled_date',
       ww.user_id, ww.id, ww.scheduled_date,
       CONCAT('weekday=', ww.weekday, ', isodow=', ww.scheduled_isodow)
FROM workout_week ww
WHERE ww.weekday IS DISTINCT FROM ww.scheduled_isodow

UNION ALL
SELECT 'critical', 'duplicate_workouts_same_user_date_type_plan',
       dw.user_id, dw.sample_workout_id, dw.scheduled_date,
       CONCAT('tipo=', dw.tipo, ', plan_id=', COALESCE(dw.plan_id, 'null'), ', count=', dw.duplicate_count)
FROM duplicate_workouts dw

UNION ALL
SELECT 'critical', 'automatic_workout_exercise_without_exercise_id',
       wed.user_id, wed.workout_id, wed.scheduled_date, wed.workout_exercise_name
FROM auto_workout_exercise_details wed
WHERE wed.exercise_id IS NULL

UNION ALL
SELECT 'critical', 'automatic_workout_exercise_missing_catalog_row',
       wed.user_id, wed.workout_id, wed.scheduled_date, wed.exercise_id
FROM auto_workout_exercise_details wed
WHERE wed.exercise_id IS NOT NULL AND wed.catalog_exercise_id IS NULL

UNION ALL
SELECT 'critical', 'cardio_used_as_strength_volume',
       wed.user_id, wed.workout_id, wed.scheduled_date, COALESCE(wed.nombre, wed.workout_exercise_name)
FROM auto_workout_exercise_details wed
WHERE lower(COALESCE(wed.tipo_entrenamiento::text, '')) LIKE '%cardio%'
  AND lower(COALESCE(wed.grupo_muscular::text, '')) NOT LIKE '%cardio%'

UNION ALL
SELECT 'critical', 'deprecated_or_review_exercise_autoassigned',
       wed.user_id, wed.workout_id, wed.scheduled_date,
       CONCAT(COALESCE(wed.nombre, wed.workout_exercise_name), ', estado=', COALESCE(wed.estado_calidad::text, 'null'))
FROM auto_workout_exercise_details wed
WHERE lower(COALESCE(wed.estado_calidad::text, 'curado')) IN ('deprecado', 'revisar')

UNION ALL
SELECT 'critical', 'advanced_exercise_for_beginner',
       wed.user_id, wed.workout_id, wed.scheduled_date, COALESCE(wed.nombre, wed.workout_exercise_name)
FROM auto_workout_exercise_details wed
JOIN scope s ON s.user_id = wed.user_id
WHERE lower(COALESCE(s.fitness_level::text, 'principiante')) = 'principiante'
  AND lower(COALESCE(wed.nivel_minimo::text, 'principiante')) IN ('avanzado', 'p')

UNION ALL
SELECT 'critical', 'equipment_incompatible_with_home',
       wed.user_id, wed.workout_id, wed.scheduled_date, COALESCE(wed.nombre, wed.workout_exercise_name)
FROM auto_workout_exercise_details wed
JOIN scope s ON s.user_id = wed.user_id
WHERE lower(COALESCE(to_jsonb(s.training_types)::text, '')) LIKE '%casa%'
  AND lower(CONCAT(COALESCE(wed.equipamiento::text, ''), ' ', COALESCE(wed.equipo_requerido::text, ''))) ~ '(maquina|polea|prensa|caminadora|escaladora|remo erg)'

UNION ALL
SELECT 'critical', 'strength_exercise_without_valid_sets_or_reps',
       wed.user_id, wed.workout_id, wed.scheduled_date, COALESCE(wed.nombre, wed.workout_exercise_name)
FROM auto_workout_exercise_details wed
WHERE lower(COALESCE(wed.tipo_entrenamiento::text, 'fuerza')) NOT LIKE '%cardio%'
  AND (COALESCE(wed.sets, 0) <= 0 OR COALESCE(wed.reps, 0) <= 0)

UNION ALL
SELECT 'critical', 'session_or_set_orphan',
       NULL::uuid, NULL::uuid, NULL::date,
       CONCAT('session_id=', so.session_id, ', workout_exercise_id=', so.workout_exercise_id)
FROM set_orphans so

UNION ALL
SELECT 'warning', 'active_session_present_in_validation_window',
       sl.user_id, sl.workout_id, NULL::date, sl.status
FROM session_links sl
WHERE sl.status = 'active'

UNION ALL
SELECT 'warning', 'session_duration_above_target_tolerance',
       s.user_id, ww.id, ww.scheduled_date,
       CONCAT('target=', s.session_duration_minutes, ', workout=', ww.duration_minutes)
FROM scope s
JOIN workout_week ww ON ww.user_id = s.user_id AND ww.tipo::text = 'automatico'
WHERE s.session_duration_minutes IS NOT NULL
  AND ww.duration_minutes > s.session_duration_minutes + 15

UNION ALL
SELECT 'warning', 'available_days_mismatch_selected_weekdays',
       s.user_id, NULL::uuid, NULL::date,
       CONCAT('available_days_per_week=', s.available_days_per_week, ', selected_count=', s.selected_count)
FROM scope s
WHERE s.available_days_per_week IS NOT NULL
  AND s.available_days_per_week <> s.selected_count

UNION ALL
SELECT 'info', 'seven_day_rest_gap',
       s.user_id, NULL::uuid, NULL::date,
       ARRAY(
         SELECT d FROM generate_series(1, 7) AS d
         WHERE d = ANY(s.selected_weekdays)
           AND NOT EXISTS (
             SELECT 1 FROM workout_week ww
             WHERE ww.user_id = s.user_id
               AND ww.tipo::text = 'automatico'
               AND ww.weekday = d
           )
       )::text
FROM scope s
WHERE s.selected_count = 7

UNION ALL
SELECT 'info', 'weekly_workout_count',
       s.user_id, NULL::uuid, NULL::date,
       CONCAT('all=', COALESCE(wc.workouts_count, 0), ', automatic=', COALESCE(wc.automatic_workouts_count, 0), ', manual=', COALESCE(wc.manual_workouts_count, 0))
FROM scope s
LEFT JOIN workout_counts wc ON wc.user_id = s.user_id
ORDER BY severity, check_name, user_id, scheduled_date;
