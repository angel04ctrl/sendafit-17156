-- Beta Nutrition Sprint 1A - Resumen de cobertura nutricional.
-- Read-only. Devuelve un unico result set con UNION ALL para exportar a CSV.

WITH food_scope AS (
  SELECT
    f.*,
    COALESCE(f.display_name, f.name, f.nombre) AS effective_name,
    lower(regexp_replace(trim(COALESCE(f.normalized_name, f.display_name, f.name, f.nombre, '')), '\s+', ' ', 'g')) AS normalized_effective_name,
    COALESCE(f.calories_per_100g, f.calorias) AS effective_calories,
    COALESCE(f.protein_per_100g, f.proteinas) AS effective_protein,
    COALESCE(f.carbs_per_100g, f.carbohidratos) AS effective_carbs,
    COALESCE(f.fat_per_100g, f.grasas) AS effective_fat,
    COALESCE(f.serving_unit, f.unidad) AS effective_unit,
    COALESCE(f.serving_size, f.racion) AS effective_serving_size
  FROM public.foods f
), duplicate_names AS (
  SELECT normalized_effective_name, count(*) AS duplicate_count, array_agg(id::text ORDER BY id) AS ids
  FROM food_scope
  WHERE normalized_effective_name <> ''
  GROUP BY normalized_effective_name
  HAVING count(*) > 1
), possible_duplicates AS (
  SELECT left(normalized_effective_name, 12) AS name_prefix, count(*) AS duplicate_count, array_agg(id::text ORDER BY id) AS ids
  FROM food_scope
  WHERE length(normalized_effective_name) >= 12
  GROUP BY left(normalized_effective_name, 12)
  HAVING count(*) > 1
), meal_scope AS (
  SELECT * FROM public.meals
), ingredient_scope AS (
  SELECT * FROM public.meal_ingredients
), food_ai_scope AS (
  SELECT * FROM public.food_analysis_logs
)
SELECT 'foods' AS section, 'total_alimentos' AS metric, count(*)::bigint AS value, NULL::text AS details FROM food_scope
UNION ALL SELECT 'foods', 'categorias_distintas', count(DISTINCT category)::bigint, NULL FROM food_scope WHERE COALESCE(length(btrim(category)), 0) > 0
UNION ALL SELECT 'foods', 'subcategorias_distintas', count(DISTINCT group_name)::bigint, NULL FROM food_scope WHERE COALESCE(length(btrim(group_name)), 0) > 0
UNION ALL SELECT 'foods', 'preparaciones_distintas', count(DISTINCT preparation_state)::bigint, NULL FROM food_scope WHERE COALESCE(length(btrim(preparation_state)), 0) > 0
UNION ALL SELECT 'foods', 'unidades_distintas', count(DISTINCT effective_unit)::bigint, NULL FROM food_scope WHERE COALESCE(length(btrim(effective_unit)), 0) > 0
UNION ALL SELECT 'foods', 'porciones_conocidas', count(*)::bigint, NULL FROM food_scope WHERE effective_serving_size IS NOT NULL
UNION ALL SELECT 'foods', 'alimentos_sin_descripcion', count(*)::bigint, NULL FROM food_scope WHERE COALESCE(length(btrim(description)), 0) = 0
UNION ALL SELECT 'foods', 'alimentos_sin_macros', count(*)::bigint, NULL FROM food_scope WHERE effective_calories IS NULL OR effective_protein IS NULL OR effective_carbs IS NULL OR effective_fat IS NULL
UNION ALL SELECT 'foods', 'alimentos_sin_proteinas', count(*)::bigint, NULL FROM food_scope WHERE effective_protein IS NULL
UNION ALL SELECT 'foods', 'alimentos_sin_grasas', count(*)::bigint, NULL FROM food_scope WHERE effective_fat IS NULL
UNION ALL SELECT 'foods', 'alimentos_sin_carbohidratos', count(*)::bigint, NULL FROM food_scope WHERE effective_carbs IS NULL
UNION ALL SELECT 'foods', 'alimentos_sin_calorias', count(*)::bigint, NULL FROM food_scope WHERE effective_calories IS NULL
UNION ALL SELECT 'foods', 'alimentos_sin_unidades', count(*)::bigint, NULL FROM food_scope WHERE COALESCE(length(btrim(effective_unit)), 0) = 0
UNION ALL SELECT 'foods', 'alimentos_sin_categoria', count(*)::bigint, NULL FROM food_scope WHERE COALESCE(length(btrim(category)), 0) = 0
UNION ALL SELECT 'foods', 'alimentos_sin_aliases', count(*)::bigint, NULL FROM food_scope WHERE cardinality(COALESCE(aliases, '{}'::text[])) = 0
UNION ALL SELECT 'foods', 'duplicados_nombre_exactos', count(*)::bigint, string_agg(normalized_effective_name || ':' || ids::text, ' | ') FROM duplicate_names
UNION ALL SELECT 'foods', 'posibles_duplicados_por_prefijo', count(*)::bigint, string_agg(name_prefix || ':' || ids::text, ' | ') FROM possible_duplicates
UNION ALL SELECT 'foods', 'nombres_genericos', count(*)::bigint, NULL FROM food_scope WHERE normalized_effective_name IN ('alimento','comida','producto','sin nombre','unknown','desconocido') OR length(normalized_effective_name) < 3
UNION ALL SELECT 'foods', 'alimentos_incompletos', count(*)::bigint, NULL FROM food_scope WHERE COALESCE(length(btrim(effective_name)), 0) = 0 OR effective_calories IS NULL OR effective_protein IS NULL OR effective_carbs IS NULL OR effective_fat IS NULL OR COALESCE(length(btrim(effective_unit)), 0) = 0
UNION ALL SELECT 'foods', 'macro_calories_inconsistentes_mayor_20pct', count(*)::bigint, NULL FROM food_scope WHERE effective_calories IS NOT NULL AND effective_protein IS NOT NULL AND effective_carbs IS NOT NULL AND effective_fat IS NOT NULL AND effective_calories > 0 AND abs(effective_calories - ((effective_protein * 4) + (effective_carbs * 4) + (effective_fat * 9))) / effective_calories > 0.20
UNION ALL SELECT 'foods', 'foods_source_distintos', count(DISTINCT source)::bigint, string_agg(DISTINCT source, ', ') FROM food_scope
UNION ALL SELECT 'foods', 'foods_usda_fdc', count(*)::bigint, NULL FROM food_scope WHERE fdc_id IS NOT NULL OR source ILIKE '%USDA%'
UNION ALL SELECT 'foods', 'foods_verificados', count(*)::bigint, NULL FROM food_scope WHERE is_verified IS TRUE
UNION ALL SELECT 'meals', 'total_meal_logs', count(*)::bigint, NULL FROM meal_scope
UNION ALL SELECT 'meals', 'meal_logs_sin_ingredientes', count(*)::bigint, NULL FROM meal_scope m WHERE NOT EXISTS (SELECT 1 FROM ingredient_scope i WHERE i.meal_id = m.id)
UNION ALL SELECT 'meal_ingredients', 'total_ingredientes_log', count(*)::bigint, NULL FROM ingredient_scope
UNION ALL SELECT 'meal_ingredients', 'ingredientes_sin_food_id', count(*)::bigint, NULL FROM ingredient_scope WHERE food_id IS NULL
UNION ALL SELECT 'meal_ingredients', 'ingredientes_con_food_id_huerfano', count(*)::bigint, NULL FROM ingredient_scope i LEFT JOIN public.foods f ON f.id = i.food_id WHERE i.food_id IS NOT NULL AND f.id IS NULL
UNION ALL SELECT 'meal_ingredients', 'ingredientes_macros_inconsistentes_mayor_20pct', count(*)::bigint, NULL FROM ingredient_scope WHERE calories > 0 AND abs(calories - ((protein * 4) + (carbs * 4) + (fat * 9))) / calories > 0.20
UNION ALL SELECT 'food_analysis_logs', 'total_food_ai_logs', count(*)::bigint, NULL FROM food_ai_scope
UNION ALL SELECT 'food_analysis_logs', 'food_ai_logs_no_guardados', count(*)::bigint, NULL FROM food_ai_scope WHERE saved_to_daily IS DISTINCT FROM true
UNION ALL SELECT 'food_analysis_logs', 'food_ai_logs_sin_detected_foods', count(*)::bigint, NULL FROM food_ai_scope WHERE COALESCE(detected_foods, '[]'::jsonb) = '[]'::jsonb
UNION ALL SELECT 'food_analysis_logs', 'food_ai_logs_sin_estimated_macros', count(*)::bigint, NULL FROM food_ai_scope WHERE COALESCE(estimated_macros, '{}'::jsonb) = '{}'::jsonb
ORDER BY section, metric;
