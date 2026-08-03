-- Beta Nutrition Sprint 1B - Validacion de arquitectura nueva.
-- Ejecutar despues de docs/beta-food-migration.sql.
-- Resultado esperado para aprobar arquitectura: 0 filas critical.

WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'nutrition_sources',
    'nutrition_brands',
    'nutrition_categories',
    'nutrition_units',
    'nutrition_nutrients',
    'nutrition_foods',
    'nutrition_food_aliases',
    'nutrition_food_categories',
    'nutrition_food_servings',
    'nutrition_food_nutrients',
    'nutrition_barcodes',
    'nutrition_food_preparations',
    'nutrition_recipes',
    'nutrition_recipe_ingredients',
    'nutrition_ai_analysis_logs',
    'nutrition_ai_detected_items',
    'nutrition_meal_logs',
    'nutrition_meal_log_items',
    'nutrition_user_goals',
    'nutrition_favorites',
    'nutrition_ingredient_substitutions',
    'nutrition_meal_plans',
    'nutrition_meal_plan_days',
    'nutrition_meal_plan_items',
    'nutrition_shopping_lists',
    'nutrition_shopping_list_items'
  ]) AS table_name
),
expected_views AS (
  SELECT unnest(ARRAY[
    'nutrition_foods_search_v',
    'nutrition_daily_totals_v'
  ]) AS view_name
),
legacy_counts AS (
  SELECT
    (SELECT COUNT(*) FROM public.foods) AS foods_count,
    (SELECT COUNT(*) FROM public.meals) AS meals_count,
    (SELECT COUNT(*) FROM public.meal_ingredients) AS meal_ingredients_count,
    (SELECT COUNT(*) FROM public.food_analysis_logs) AS food_analysis_logs_count,
    (SELECT COUNT(*) FROM public.profiles) AS profiles_count
),
nutrition_counts AS (
  SELECT
    (SELECT COUNT(*) FROM public.nutrition_foods WHERE legacy_food_id IS NOT NULL) AS migrated_foods_count,
    (SELECT COUNT(*) FROM public.nutrition_meal_logs WHERE legacy_meal_id IS NOT NULL) AS migrated_meals_count,
    (SELECT COUNT(*) FROM public.nutrition_meal_log_items WHERE legacy_meal_ingredient_id IS NOT NULL) AS migrated_meal_ingredients_count,
    (SELECT COUNT(*) FROM public.nutrition_ai_analysis_logs WHERE legacy_food_analysis_log_id IS NOT NULL) AS migrated_food_analysis_logs_count,
    (SELECT COUNT(*) FROM public.nutrition_user_goals WHERE source = 'profile_snapshot') AS migrated_profile_goals_count
)
SELECT 'critical' AS severity, 'missing_nutrition_table' AS check_name,
       table_name AS entity, NULL::text AS details
FROM expected_tables
WHERE to_regclass('public.' || table_name) IS NULL

UNION ALL
SELECT 'critical', 'missing_nutrition_view',
       view_name, NULL::text
FROM expected_views
WHERE to_regclass('public.' || view_name) IS NULL

UNION ALL
SELECT 'critical', 'legacy_foods_not_fully_migrated',
       'nutrition_foods',
       CONCAT('legacy=', lc.foods_count, ', migrated=', nc.migrated_foods_count)
FROM legacy_counts lc CROSS JOIN nutrition_counts nc
WHERE nc.migrated_foods_count <> lc.foods_count

UNION ALL
SELECT 'critical', 'legacy_meals_not_fully_migrated',
       'nutrition_meal_logs',
       CONCAT('legacy=', lc.meals_count, ', migrated=', nc.migrated_meals_count)
FROM legacy_counts lc CROSS JOIN nutrition_counts nc
WHERE nc.migrated_meals_count <> lc.meals_count

UNION ALL
SELECT 'critical', 'legacy_meal_ingredients_not_fully_migrated',
       'nutrition_meal_log_items',
       CONCAT('legacy=', lc.meal_ingredients_count, ', migrated=', nc.migrated_meal_ingredients_count)
FROM legacy_counts lc CROSS JOIN nutrition_counts nc
WHERE nc.migrated_meal_ingredients_count <> lc.meal_ingredients_count

UNION ALL
SELECT 'critical', 'legacy_ai_logs_not_fully_migrated',
       'nutrition_ai_analysis_logs',
       CONCAT('legacy=', lc.food_analysis_logs_count, ', migrated=', nc.migrated_food_analysis_logs_count)
FROM legacy_counts lc CROSS JOIN nutrition_counts nc
WHERE nc.migrated_food_analysis_logs_count <> lc.food_analysis_logs_count

UNION ALL
SELECT 'critical', 'duplicate_legacy_food_mapping',
       'nutrition_foods',
       legacy_food_id::text
FROM public.nutrition_foods
WHERE legacy_food_id IS NOT NULL
GROUP BY legacy_food_id
HAVING COUNT(*) > 1

UNION ALL
SELECT 'critical', 'duplicate_legacy_meal_mapping',
       'nutrition_meal_logs',
       legacy_meal_id::text
FROM public.nutrition_meal_logs
WHERE legacy_meal_id IS NOT NULL
GROUP BY legacy_meal_id
HAVING COUNT(*) > 1

UNION ALL
SELECT 'critical', 'nutrition_food_missing_core_name',
       'nutrition_foods',
       id::text
FROM public.nutrition_foods
WHERE NULLIF(btrim(display_name), '') IS NULL
   OR NULLIF(btrim(normalized_name), '') IS NULL

UNION ALL
SELECT 'critical', 'nutrition_food_missing_macro_nutrients',
       'nutrition_foods',
       CONCAT(display_name, ' missing=', array_to_string(missing_codes, ','))
FROM (
  SELECT
    f.id,
    f.display_name,
    ARRAY(
      SELECT missing_code.code
      FROM unnest(ARRAY['energy_kcal','protein_g','carbs_g','fat_g']) AS missing_code(code)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.nutrition_food_nutrients fn
        JOIN public.nutrition_nutrients n ON n.id = fn.nutrient_id
        WHERE fn.food_id = f.id
          AND n.code = missing_code.code
      )
    ) AS missing_codes
  FROM public.nutrition_foods f
  WHERE f.legacy_food_id IS NOT NULL
) missing
WHERE cardinality(missing_codes) > 0

UNION ALL
SELECT 'critical', 'meal_log_missing_required_fields',
       'nutrition_meal_logs',
       id::text
FROM public.nutrition_meal_logs
WHERE user_id IS NULL
   OR NULLIF(btrim(name), '') IS NULL
   OR logged_date IS NULL
   OR meal_type NOT IN ('desayuno', 'colacion_am', 'comida', 'colacion_pm', 'cena')

UNION ALL
SELECT 'critical', 'meal_log_item_without_meal',
       'nutrition_meal_log_items',
       i.id::text
FROM public.nutrition_meal_log_items i
LEFT JOIN public.nutrition_meal_logs m ON m.id = i.meal_log_id
WHERE m.id IS NULL

UNION ALL
SELECT 'critical', 'negative_macro_snapshot',
       'nutrition_meal_log_items',
       id::text
FROM public.nutrition_meal_log_items
WHERE calories < 0 OR protein < 0 OR carbs < 0 OR fat < 0

UNION ALL
SELECT 'warning', 'legacy_food_without_category_link',
       'nutrition_food_categories',
       CONCAT('count=', COUNT(*))
FROM public.nutrition_foods f
WHERE f.legacy_food_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.nutrition_food_categories fc
    WHERE fc.food_id = f.id
  )
HAVING COUNT(*) > 0

UNION ALL
SELECT 'warning', 'legacy_food_without_aliases',
       'nutrition_food_aliases',
       CONCAT('count=', COUNT(*))
FROM public.nutrition_foods f
WHERE f.legacy_food_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.nutrition_food_aliases a
    WHERE a.food_id = f.id
  )
HAVING COUNT(*) > 0

UNION ALL
SELECT 'warning', 'legacy_meal_without_items',
       'nutrition_meal_logs',
       CONCAT('count=', COUNT(*))
FROM public.nutrition_meal_logs m
WHERE m.legacy_meal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.nutrition_meal_log_items i
    WHERE i.meal_log_id = m.id
  )
HAVING COUNT(*) > 0

UNION ALL
SELECT 'warning', 'profile_goal_snapshots_missing',
       'nutrition_user_goals',
       CONCAT('profiles=', lc.profiles_count, ', snapshots=', nc.migrated_profile_goals_count)
FROM legacy_counts lc CROSS JOIN nutrition_counts nc
WHERE nc.migrated_profile_goals_count < lc.profiles_count

UNION ALL
SELECT 'info', 'nutrition_table_counts',
       'nutrition_foods',
       COUNT(*)::text
FROM public.nutrition_foods

UNION ALL
SELECT 'info', 'nutrition_table_counts',
       'nutrition_food_nutrients',
       COUNT(*)::text
FROM public.nutrition_food_nutrients

UNION ALL
SELECT 'info', 'nutrition_table_counts',
       'nutrition_meal_logs',
       COUNT(*)::text
FROM public.nutrition_meal_logs

UNION ALL
SELECT 'info', 'nutrition_table_counts',
       'nutrition_meal_log_items',
       COUNT(*)::text
FROM public.nutrition_meal_log_items

UNION ALL
SELECT 'info', 'nutrition_table_counts',
       'nutrition_ai_analysis_logs',
       COUNT(*)::text
FROM public.nutrition_ai_analysis_logs

ORDER BY severity, check_name, entity;
