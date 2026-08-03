-- Beta Nutrition Sprint 1A - Export completo de datos nutricionales.
-- Read-only. Ejecutar en Supabase SQL Editor y exportar el resultado a CSV.
-- Formato unificado para incluir alimentos, comidas, ingredientes, logs IA y objetivos nutricionales sin modificar datos.

WITH food_export AS (
  SELECT
    'foods'::text AS entity_type,
    f.id::text AS record_id,
    NULL::uuid AS user_id,
    COALESCE(f.display_name, f.name, f.nombre) AS display_label,
    to_jsonb(f) AS payload,
    lower(regexp_replace(trim(COALESCE(f.normalized_name, f.name, f.nombre, '')), '\s+', ' ', 'g')) AS normalized_name,
    NULL::text AS normalized_brand,
    COALESCE(length(btrim(f.description)), 0) > 0 AS has_description,
    cardinality(COALESCE(f.aliases, '{}'::text[])) > 0 AS has_aliases,
    COALESCE(length(btrim(f.category)), 0) > 0 AS has_category,
    COALESCE(length(btrim(f.group_name)), 0) > 0 AS has_subcategory,
    (COALESCE(f.calories_per_100g, f.calorias) IS NOT NULL AND COALESCE(f.protein_per_100g, f.proteinas) IS NOT NULL AND COALESCE(f.carbs_per_100g, f.carbohidratos) IS NOT NULL AND COALESCE(f.fat_per_100g, f.grasas) IS NOT NULL) AS has_macros,
    (f.fiber_per_100g IS NOT NULL OR f.sugar_per_100g IS NOT NULL OR f.sodium_mg_per_100g IS NOT NULL) AS has_micros,
    (COALESCE(length(btrim(f.serving_unit)), 0) > 0 OR COALESCE(length(btrim(f.unidad)), 0) > 0) AS has_serving_units,
    f.grams_per_serving IS NOT NULL AS has_density,
    (f.serving_size IS NOT NULL OR f.racion IS NOT NULL) AS has_portions,
    COALESCE(length(btrim(f.preparation_state)), 0) > 0 AS has_preparation,
    false AS has_barcode,
    COALESCE(length(btrim(f.source)), 0) > 0 OR f.fdc_id IS NOT NULL AS has_api_source,
    false AS has_image,
    COALESCE(f.is_verified, false) AS has_verified_values,
    concat_ws(' | ',
      CASE WHEN COALESCE(length(btrim(COALESCE(f.display_name, f.name, f.nombre))), 0) = 0 THEN 'nombre vacio' END,
      CASE WHEN COALESCE(length(btrim(f.description)), 0) = 0 THEN 'sin descripcion' END,
      CASE WHEN COALESCE(length(btrim(f.category)), 0) = 0 THEN 'sin categoria' END,
      CASE WHEN cardinality(COALESCE(f.aliases, '{}'::text[])) = 0 THEN 'sin aliases' END,
      CASE WHEN COALESCE(f.calories_per_100g, f.calorias) IS NULL THEN 'sin calorias' END,
      CASE WHEN COALESCE(f.protein_per_100g, f.proteinas) IS NULL THEN 'sin proteinas' END,
      CASE WHEN COALESCE(f.carbs_per_100g, f.carbohidratos) IS NULL THEN 'sin carbohidratos' END,
      CASE WHEN COALESCE(f.fat_per_100g, f.grasas) IS NULL THEN 'sin grasas' END,
      CASE WHEN COALESCE(f.serving_unit, f.unidad) IS NULL THEN 'sin unidad' END,
      CASE WHEN f.grams_per_serving IS NULL THEN 'sin grams_per_serving/densidad' END,
      CASE WHEN COALESCE(f.is_verified, false) IS FALSE THEN 'valores no verificados' END
    ) AS needs_review_reason,
    f.created_at,
    f.updated_at
  FROM public.foods f
), meals_export AS (
  SELECT
    'meals'::text AS entity_type,
    m.id::text AS record_id,
    m.user_id,
    m.name AS display_label,
    to_jsonb(m) AS payload,
    lower(regexp_replace(trim(COALESCE(m.name, '')), '\s+', ' ', 'g')) AS normalized_name,
    NULL::text AS normalized_brand,
    COALESCE(length(btrim(m.name)), 0) > 0 AS has_description,
    false AS has_aliases,
    true AS has_category,
    m.meal_type::text IS NOT NULL AS has_subcategory,
    (m.calories IS NOT NULL AND m.protein IS NOT NULL AND m.carbs IS NOT NULL AND m.fat IS NOT NULL) AS has_macros,
    false AS has_micros,
    false AS has_serving_units,
    false AS has_density,
    EXISTS (SELECT 1 FROM public.meal_ingredients mi WHERE mi.meal_id = m.id) AS has_portions,
    false AS has_preparation,
    false AS has_barcode,
    false AS has_api_source,
    false AS has_image,
    false AS has_verified_values,
    concat_ws(' | ',
      CASE WHEN COALESCE(length(btrim(m.name)), 0) = 0 THEN 'nombre vacio' END,
      CASE WHEN m.calories IS NULL THEN 'sin calorias' END,
      CASE WHEN m.protein IS NULL THEN 'sin proteinas' END,
      CASE WHEN m.carbs IS NULL THEN 'sin carbohidratos' END,
      CASE WHEN m.fat IS NULL THEN 'sin grasas' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM public.meal_ingredients mi WHERE mi.meal_id = m.id) THEN 'sin desglose de ingredientes' END
    ) AS needs_review_reason,
    m.created_at,
    NULL::timestamptz AS updated_at
  FROM public.meals m
), ingredients_export AS (
  SELECT
    'meal_ingredients'::text AS entity_type,
    mi.id::text AS record_id,
    mi.user_id,
    mi.ingredient_name AS display_label,
    to_jsonb(mi) AS payload,
    lower(regexp_replace(trim(COALESCE(mi.ingredient_name, '')), '\s+', ' ', 'g')) AS normalized_name,
    NULL::text AS normalized_brand,
    COALESCE(length(btrim(mi.ingredient_name)), 0) > 0 AS has_description,
    false AS has_aliases,
    COALESCE(length(btrim(mi.source)), 0) > 0 AS has_category,
    false AS has_subcategory,
    (mi.calories IS NOT NULL AND mi.protein IS NOT NULL AND mi.carbs IS NOT NULL AND mi.fat IS NOT NULL) AS has_macros,
    (mi.fiber IS NOT NULL OR mi.sugar IS NOT NULL OR mi.sodium_mg IS NOT NULL) AS has_micros,
    COALESCE(length(btrim(mi.unit)), 0) > 0 AS has_serving_units,
    mi.grams IS NOT NULL AS has_density,
    mi.quantity IS NOT NULL AS has_portions,
    false AS has_preparation,
    false AS has_barcode,
    mi.food_id IS NOT NULL OR COALESCE(length(btrim(mi.source)), 0) > 0 AS has_api_source,
    false AS has_image,
    COALESCE(mi.is_verified, false) AS has_verified_values,
    concat_ws(' | ',
      CASE WHEN mi.food_id IS NULL THEN 'sin food_id catalogo' END,
      CASE WHEN mi.grams IS NULL OR mi.grams <= 0 THEN 'gramos invalidos' END,
      CASE WHEN mi.quantity IS NULL OR mi.quantity <= 0 THEN 'cantidad invalida' END,
      CASE WHEN mi.calories IS NULL THEN 'sin calorias' END,
      CASE WHEN mi.protein IS NULL THEN 'sin proteinas' END,
      CASE WHEN mi.carbs IS NULL THEN 'sin carbohidratos' END,
      CASE WHEN mi.fat IS NULL THEN 'sin grasas' END,
      CASE WHEN COALESCE(mi.is_verified, false) IS FALSE THEN 'valores no verificados' END
    ) AS needs_review_reason,
    mi.created_at,
    mi.updated_at
  FROM public.meal_ingredients mi
), food_ai_export AS (
  SELECT
    'food_analysis_logs'::text AS entity_type,
    l.id::text AS record_id,
    l.user_id,
    'food analysis ' || l.analysis_date::text AS display_label,
    to_jsonb(l) AS payload,
    lower(regexp_replace(trim(COALESCE(l.detected_foods::text, '')), '\s+', ' ', 'g')) AS normalized_name,
    NULL::text AS normalized_brand,
    true AS has_description,
    false AS has_aliases,
    true AS has_category,
    false AS has_subcategory,
    COALESCE(l.estimated_macros, '{}'::jsonb) <> '{}'::jsonb OR COALESCE(l.adjusted_macros, '{}'::jsonb) <> '{}'::jsonb AS has_macros,
    false AS has_micros,
    false AS has_serving_units,
    false AS has_density,
    false AS has_portions,
    false AS has_preparation,
    false AS has_barcode,
    true AS has_api_source,
    COALESCE(length(btrim(l.image_url)), 0) > 0 AS has_image,
    false AS has_verified_values,
    concat_ws(' | ',
      CASE WHEN COALESCE(l.detected_foods, '[]'::jsonb) = '[]'::jsonb THEN 'sin alimentos detectados' END,
      CASE WHEN COALESCE(l.estimated_macros, '{}'::jsonb) = '{}'::jsonb THEN 'sin macros estimados' END,
      CASE WHEN l.saved_to_daily IS DISTINCT FROM true THEN 'no guardado en diario' END
    ) AS needs_review_reason,
    l.created_at,
    l.updated_at
  FROM public.food_analysis_logs l
), profile_goals_export AS (
  SELECT
    'profiles_nutrition_goals'::text AS entity_type,
    p.id::text AS record_id,
    p.id AS user_id,
    'profile nutrition goals' AS display_label,
    jsonb_build_object(
      'id', p.id,
      'daily_calorie_goal', p.daily_calorie_goal,
      'daily_protein_goal', p.daily_protein_goal,
      'daily_carbs_goal', p.daily_carbs_goal,
      'daily_fat_goal', p.daily_fat_goal,
      'current_calorie_intake', p.current_calorie_intake
    ) AS payload,
    NULL::text AS normalized_name,
    NULL::text AS normalized_brand,
    true AS has_description,
    false AS has_aliases,
    true AS has_category,
    false AS has_subcategory,
    (p.daily_calorie_goal IS NOT NULL AND p.daily_protein_goal IS NOT NULL AND p.daily_carbs_goal IS NOT NULL AND p.daily_fat_goal IS NOT NULL) AS has_macros,
    false AS has_micros,
    false AS has_serving_units,
    false AS has_density,
    false AS has_portions,
    false AS has_preparation,
    false AS has_barcode,
    false AS has_api_source,
    false AS has_image,
    false AS has_verified_values,
    concat_ws(' | ',
      CASE WHEN p.daily_calorie_goal IS NULL THEN 'sin objetivo calorias' END,
      CASE WHEN p.daily_protein_goal IS NULL THEN 'sin objetivo proteina' END,
      CASE WHEN p.daily_carbs_goal IS NULL THEN 'sin objetivo carbohidratos' END,
      CASE WHEN p.daily_fat_goal IS NULL THEN 'sin objetivo grasas' END
    ) AS needs_review_reason,
    NULL::timestamptz AS created_at,
    NULL::timestamptz AS updated_at
  FROM public.profiles p
)
SELECT * FROM food_export
UNION ALL SELECT * FROM meals_export
UNION ALL SELECT * FROM ingredients_export
UNION ALL SELECT * FROM food_ai_export
UNION ALL SELECT * FROM profile_goals_export
ORDER BY entity_type, normalized_name NULLS LAST, display_label NULLS LAST, record_id;
