-- Beta Nutrition Sprint 1B - Rollback de arquitectura nueva.
-- Ejecutar solo si necesitas retirar las tablas nutrition_* creadas por beta-food-migration.sql.
-- No toca tablas legacy: foods, meals, meal_ingredients, food_analysis_logs, profiles.

BEGIN;

DROP VIEW IF EXISTS public.nutrition_daily_totals_v;
DROP VIEW IF EXISTS public.nutrition_foods_search_v;

DROP TABLE IF EXISTS public.nutrition_shopping_list_items;
DROP TABLE IF EXISTS public.nutrition_shopping_lists;
DROP TABLE IF EXISTS public.nutrition_meal_plan_items;
DROP TABLE IF EXISTS public.nutrition_meal_plan_days;
DROP TABLE IF EXISTS public.nutrition_meal_plans;
DROP TABLE IF EXISTS public.nutrition_ingredient_substitutions;
DROP TABLE IF EXISTS public.nutrition_favorites;
DROP TABLE IF EXISTS public.nutrition_user_goals;
DROP TABLE IF EXISTS public.nutrition_meal_log_items;
DROP TABLE IF EXISTS public.nutrition_meal_logs;
DROP TABLE IF EXISTS public.nutrition_ai_detected_items;
DROP TABLE IF EXISTS public.nutrition_ai_analysis_logs;
DROP TABLE IF EXISTS public.nutrition_recipe_ingredients;
DROP TABLE IF EXISTS public.nutrition_recipes;
DROP TABLE IF EXISTS public.nutrition_food_preparations;
DROP TABLE IF EXISTS public.nutrition_barcodes;
DROP TABLE IF EXISTS public.nutrition_food_nutrients;
DROP TABLE IF EXISTS public.nutrition_food_servings;
DROP TABLE IF EXISTS public.nutrition_food_categories;
DROP TABLE IF EXISTS public.nutrition_food_aliases;
DROP TABLE IF EXISTS public.nutrition_foods;
DROP TABLE IF EXISTS public.nutrition_nutrients;
DROP TABLE IF EXISTS public.nutrition_units;
DROP TABLE IF EXISTS public.nutrition_categories;
DROP TABLE IF EXISTS public.nutrition_brands;
DROP TABLE IF EXISTS public.nutrition_sources;

DROP FUNCTION IF EXISTS public.nutrition_can_write_food(uuid);
DROP FUNCTION IF EXISTS public.nutrition_can_read_food(uuid);
DROP FUNCTION IF EXISTS public.nutrition_normalize_text(text);

COMMIT;

-- Verificacion rapida: debe devolver 0 filas.
SELECT object_name
FROM (
  SELECT table_name AS object_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name LIKE 'nutrition_%'
  UNION ALL
  SELECT routine_name
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name LIKE 'nutrition_%'
) remaining
ORDER BY object_name;
