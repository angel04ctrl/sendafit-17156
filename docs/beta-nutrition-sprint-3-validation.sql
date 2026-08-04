-- Beta Nutrition Sprint 3 - Post-migration validation.
-- Run after 20260803030000_beta_nutrition_sprint3_recipes.sql.
-- Approval gate: zero rows with severity = critical.

WITH results AS (
  SELECT 'critical'::text AS severity, 'recipe_without_current_version'::text AS check_name,
         recipe.id::text AS entity, 1::bigint AS actual_value, 0::bigint AS expected_value,
         false AS passed, recipe.name AS details
  FROM public.nutrition_recipes recipe
  WHERE recipe.status = 'active' AND recipe.current_version_id IS NULL

  UNION ALL
  SELECT 'critical', 'current_version_belongs_to_other_recipe', recipe.id::text, 1, 0, false,
         CONCAT('current_version_id=', recipe.current_version_id)
  FROM public.nutrition_recipes recipe
  JOIN public.nutrition_recipe_versions version ON version.id = recipe.current_version_id
  WHERE version.recipe_id <> recipe.id

  UNION ALL
  SELECT 'critical', 'active_recipe_current_version_not_published', recipe.id::text, 1, 0, false,
         CONCAT('version=', version.id, ', status=', version.status)
  FROM public.nutrition_recipes recipe
  JOIN public.nutrition_recipe_versions version ON version.id = recipe.current_version_id
  WHERE recipe.status = 'active' AND version.status <> 'published'

  UNION ALL
  SELECT 'critical', 'recipe_version_without_recipe', version.id::text, 1, 0, false,
         CONCAT('recipe_id=', version.recipe_id)
  FROM public.nutrition_recipe_versions version
  LEFT JOIN public.nutrition_recipes recipe ON recipe.id = version.recipe_id
  WHERE recipe.id IS NULL

  UNION ALL
  SELECT 'critical', 'invalid_recipe_version_servings', version.id::text, 1, 0, false,
         CONCAT('servings=', version.servings)
  FROM public.nutrition_recipe_versions version
  WHERE version.servings <= 0

  UNION ALL
  SELECT 'critical', 'published_recipe_without_ingredients', version.id::text, 0, 1, false,
         CONCAT('recipe_id=', version.recipe_id)
  FROM public.nutrition_recipe_versions version
  JOIN public.nutrition_recipes recipe ON recipe.current_version_id = version.id
  WHERE version.status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM public.nutrition_recipe_ingredients ingredient
      WHERE ingredient.recipe_version_id = version.id
    )

  UNION ALL
  SELECT 'critical', 'published_recipe_without_steps', version.id::text, 0, 1, false,
         CONCAT('recipe_id=', version.recipe_id)
  FROM public.nutrition_recipe_versions version
  JOIN public.nutrition_recipes recipe ON recipe.current_version_id = version.id
  WHERE version.status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM public.nutrition_recipe_steps step
      WHERE step.recipe_version_id = version.id
    )

  UNION ALL
  SELECT 'critical', 'ingredient_without_catalog_reference', ingredient.id::text, 1, 0, false,
         CONCAT('food=', ingredient.food_id, ', group=', ingredient.canonical_group_id, ', serving=', ingredient.serving_id)
  FROM public.nutrition_recipe_ingredients ingredient
  WHERE ingredient.food_id IS NULL
     OR ingredient.canonical_group_id IS NULL
     OR ingredient.serving_id IS NULL

  UNION ALL
  SELECT 'critical', 'ingredient_serving_food_mismatch', ingredient.id::text, 1, 0, false,
         CONCAT('food=', ingredient.food_id, ', serving_food=', serving.food_id)
  FROM public.nutrition_recipe_ingredients ingredient
  JOIN public.nutrition_food_servings serving ON serving.id = ingredient.serving_id
  WHERE serving.food_id <> ingredient.food_id

  UNION ALL
  SELECT 'critical', 'ingredient_group_food_mismatch', ingredient.id::text, 1, 0, false,
         CONCAT('group=', ingredient.canonical_group_id, ', food=', ingredient.food_id)
  FROM public.nutrition_recipe_ingredients ingredient
  WHERE NOT EXISTS (
    SELECT 1 FROM public.nutrition_food_group_members member
    WHERE member.group_id = ingredient.canonical_group_id
      AND member.food_id = ingredient.food_id
  )

  UNION ALL
  SELECT 'critical', 'ingredient_version_recipe_mismatch', ingredient.id::text, 1, 0, false,
         CONCAT('ingredient_recipe=', ingredient.recipe_id, ', version_recipe=', version.recipe_id)
  FROM public.nutrition_recipe_ingredients ingredient
  JOIN public.nutrition_recipe_versions version ON version.id = ingredient.recipe_version_id
  WHERE ingredient.recipe_id <> version.recipe_id

  UNION ALL
  SELECT 'critical', 'ingredient_without_recipe_version', ingredient.id::text, 1, 0, false,
         CONCAT('recipe_version_id=', ingredient.recipe_version_id)
  FROM public.nutrition_recipe_ingredients ingredient
  LEFT JOIN public.nutrition_recipe_versions version ON version.id = ingredient.recipe_version_id
  WHERE version.id IS NULL

  UNION ALL
  SELECT 'critical', 'step_without_recipe_version', step.id::text, 1, 0, false,
         CONCAT('recipe_version_id=', step.recipe_version_id)
  FROM public.nutrition_recipe_steps step
  LEFT JOIN public.nutrition_recipe_versions version ON version.id = step.recipe_version_id
  WHERE version.id IS NULL

  UNION ALL
  SELECT 'critical', 'nutrient_without_recipe_version', nutrient.id::text, 1, 0, false,
         CONCAT('recipe_version_id=', nutrient.recipe_version_id)
  FROM public.nutrition_recipe_nutrients nutrient
  LEFT JOIN public.nutrition_recipe_versions version ON version.id = nutrient.recipe_version_id
  WHERE version.id IS NULL

  UNION ALL
  SELECT 'critical', 'ingredient_invalid_quantity_or_equivalence', ingredient.id::text, 1, 0, false,
         CONCAT('quantity=', ingredient.quantity, ', grams=', ingredient.grams)
  FROM public.nutrition_recipe_ingredients ingredient
  WHERE ingredient.quantity <= 0 OR ingredient.grams IS NULL OR ingredient.grams <= 0

  UNION ALL
  SELECT 'critical', 'ingredient_snapshot_incomplete', ingredient.id::text, 1, 0, false,
         CONCAT('food_name=', ingredient.food_name_snapshot, ', serving=', ingredient.serving_label_snapshot)
  FROM public.nutrition_recipe_ingredients ingredient
  WHERE NULLIF(btrim(ingredient.food_name_snapshot), '') IS NULL
     OR NULLIF(btrim(ingredient.serving_label_snapshot), '') IS NULL
     OR ingredient.nutrient_snapshot IS NULL

  UNION ALL
  SELECT 'critical', 'duplicate_ingredient_order', version.id::text, COUNT(*)::bigint, 1, false,
         CONCAT('order=', ingredient.order_index)
  FROM public.nutrition_recipe_versions version
  JOIN public.nutrition_recipe_ingredients ingredient ON ingredient.recipe_version_id = version.id
  GROUP BY version.id, ingredient.order_index
  HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'critical', 'duplicate_step_number', version.id::text, COUNT(*)::bigint, 1, false,
         CONCAT('step=', step.step_number)
  FROM public.nutrition_recipe_versions version
  JOIN public.nutrition_recipe_steps step ON step.recipe_version_id = version.id
  GROUP BY version.id, step.step_number
  HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'critical', 'duplicate_recipe_nutrient', version.id::text, COUNT(*)::bigint, 1, false,
         CONCAT('nutrient_id=', nutrient.nutrient_id)
  FROM public.nutrition_recipe_versions version
  JOIN public.nutrition_recipe_nutrients nutrient ON nutrient.recipe_version_id = version.id
  GROUP BY version.id, nutrient.nutrient_id
  HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'critical', 'recipe_nutrient_per_serving_mismatch', nutrient.id::text, 1, 0, false,
         CONCAT('total=', nutrient.total_amount, ', per_serving=', nutrient.amount_per_serving, ', servings=', version.servings)
  FROM public.nutrition_recipe_nutrients nutrient
  JOIN public.nutrition_recipe_versions version ON version.id = nutrient.recipe_version_id
  WHERE abs(nutrient.amount_per_serving - nutrient.total_amount / version.servings) > 0.02

  UNION ALL
  SELECT 'critical', 'recipe_nutrient_snapshot_total_mismatch', nutrient.id::text, 1, 0, false,
         CONCAT('stored=', nutrient.total_amount, ', snapshot_sum=', snapshot.total_amount)
  FROM public.nutrition_recipe_nutrients nutrient
  JOIN public.nutrition_nutrients definition ON definition.id = nutrient.nutrient_id
  JOIN LATERAL (
    SELECT SUM((ingredient.nutrient_snapshot -> definition.code ->> 'amount')::numeric) AS total_amount
    FROM public.nutrition_recipe_ingredients ingredient
    WHERE ingredient.recipe_version_id = nutrient.recipe_version_id
      AND ingredient.nutrient_snapshot ? definition.code
  ) snapshot ON true
  WHERE snapshot.total_amount IS NOT NULL
    AND abs(nutrient.total_amount - snapshot.total_amount) > 0.02

  UNION ALL
  SELECT 'critical', 'recipe_nutrient_per_100g_mismatch', nutrient.id::text, 1, 0, false,
         CONCAT('total=', nutrient.total_amount, ', per_100g=', nutrient.amount_per_100g, ', final_weight=', version.total_weight_g)
  FROM public.nutrition_recipe_nutrients nutrient
  JOIN public.nutrition_recipe_versions version ON version.id = nutrient.recipe_version_id
  WHERE version.total_weight_g IS NOT NULL
    AND (
      nutrient.amount_per_100g IS NULL
      OR abs(nutrient.amount_per_100g - nutrient.total_amount / version.total_weight_g * 100) > 0.02
    )

  UNION ALL
  SELECT 'critical', 'complete_calculation_has_missing_core_snapshot', version.id::text, 1, 0, false,
         required.code
  FROM public.nutrition_recipe_versions version
  CROSS JOIN LATERAL unnest(ARRAY['energy_kcal', 'protein_g', 'carbs_g', 'fat_g']) required(code)
  WHERE version.calculation_complete IS TRUE
    AND EXISTS (
      SELECT 1 FROM public.nutrition_recipe_ingredients ingredient
      WHERE ingredient.recipe_version_id = version.id
        AND NOT (ingredient.nutrient_snapshot ? required.code)
    )

  UNION ALL
  SELECT 'critical', 'meal_item_ambiguous_source', item.id::text, 1, 0, false,
         CONCAT('food=', item.food_id, ', recipe=', item.recipe_id, ', version=', item.recipe_version_id)
  FROM public.nutrition_meal_log_items item
  WHERE (item.food_id IS NOT NULL AND item.recipe_id IS NOT NULL)
     OR (item.recipe_version_id IS NOT NULL AND item.recipe_id IS NULL)

  UNION ALL
  SELECT 'critical', 'recipe_meal_log_without_version', item.id::text, 1, 0, false,
         CONCAT('recipe_id=', item.recipe_id, ', source=', item.source)
  FROM public.nutrition_meal_log_items item
  WHERE item.source = 'nutrition_recipe'
    AND (item.recipe_id IS NULL OR item.recipe_version_id IS NULL)

  UNION ALL
  SELECT 'critical', 'meal_item_recipe_version_mismatch', item.id::text, 1, 0, false,
         CONCAT('recipe=', item.recipe_id, ', version_recipe=', version.recipe_id)
  FROM public.nutrition_meal_log_items item
  JOIN public.nutrition_recipe_versions version ON version.id = item.recipe_version_id
  WHERE item.recipe_id <> version.recipe_id

  UNION ALL
  SELECT 'critical', 'recipe_meal_log_missing_snapshot', item.id::text, 1, 0, false,
         CONCAT('name=', item.item_name, ', quantity=', item.quantity)
  FROM public.nutrition_meal_log_items item
  WHERE item.source = 'nutrition_recipe'
    AND (
      NULLIF(btrim(item.item_name), '') IS NULL
      OR item.quantity <= 0
      OR item.calories < 0 OR item.protein < 0 OR item.carbs < 0 OR item.fat < 0
    )

  UNION ALL
  SELECT 'critical', 'recipe_log_missing_legacy_mirror', log.id::text, 1, 0, false,
         CONCAT('legacy_meal_id=', log.legacy_meal_id)
  FROM public.nutrition_meal_logs log
  WHERE log.source = 'nutrition_recipe'
    AND (
      log.legacy_meal_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.meals meal WHERE meal.id = log.legacy_meal_id)
    )

  UNION ALL
  SELECT 'critical', 'recipe_log_has_multiple_nutrition_items', log.id::text, COUNT(item.id)::bigint, 1, false,
         'Una receta registrada debe contabilizarse como un solo item.'
  FROM public.nutrition_meal_logs log
  LEFT JOIN public.nutrition_meal_log_items item ON item.meal_log_id = log.id
  WHERE log.source = 'nutrition_recipe'
  GROUP BY log.id
  HAVING COUNT(item.id) <> 1

  UNION ALL
  SELECT 'critical', 'recipe_log_has_multiple_legacy_items', log.id::text, COUNT(ingredient.id)::bigint, 1, false,
         'El espejo legacy debe contener un solo item de receta.'
  FROM public.nutrition_meal_logs log
  LEFT JOIN public.meal_ingredients ingredient ON ingredient.meal_id = log.legacy_meal_id
  WHERE log.source = 'nutrition_recipe'
  GROUP BY log.id
  HAVING COUNT(ingredient.id) <> 1

  UNION ALL
  SELECT 'critical', 'recipe_rows_without_rls', class.relname, 0, 1, false, 'RLS must be enabled'
  FROM pg_class class
  JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'public'
    AND class.relname IN (
      'nutrition_recipes', 'nutrition_recipe_versions', 'nutrition_recipe_ingredients',
      'nutrition_recipe_steps', 'nutrition_recipe_nutrients'
    )
    AND class.relrowsecurity IS DISTINCT FROM true

  UNION ALL
  SELECT 'critical', 'authenticated_has_direct_recipe_write', privilege.table_name, 1, 0, false,
         privilege.privilege_type
  FROM information_schema.role_table_grants privilege
  WHERE privilege.grantee = 'authenticated'
    AND privilege.table_schema = 'public'
    AND privilege.table_name IN (
      'nutrition_recipes', 'nutrition_recipe_versions', 'nutrition_recipe_ingredients',
      'nutrition_recipe_steps', 'nutrition_recipe_nutrients'
    )
    AND privilege.privilege_type IN ('INSERT', 'UPDATE', 'DELETE')

  UNION ALL
  SELECT 'critical', 'recipe_table_missing_select_policy', expected.table_name, 0, 1, false,
         'Cada tabla de recetas debe tener una policy SELECT limitada por ownership o receta padre.'
  FROM (
    VALUES
      ('nutrition_recipes'),
      ('nutrition_recipe_versions'),
      ('nutrition_recipe_ingredients'),
      ('nutrition_recipe_steps'),
      ('nutrition_recipe_nutrients')
  ) expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = expected.table_name
      AND policy.cmd = 'SELECT'
      AND (
        policy.qual ILIKE '%auth.uid()%'
        OR policy.qual ILIKE '%nutrition_can_read_recipe%'
      )
  )

  UNION ALL
  SELECT 'critical', 'public_can_execute_recipe_rpc', procedure.proname, 1, 0, false,
         pg_get_function_identity_arguments(procedure.oid)
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(procedure.proacl, acldefault('f', procedure.proowner))) acl
  WHERE namespace.nspname = 'public'
    AND procedure.proname IN (
      'get_nutrition_recipe', 'save_nutrition_recipe', 'duplicate_nutrition_recipe',
      'archive_nutrition_recipe', 'register_nutrition_recipe_meal'
    )
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE'

  UNION ALL
  SELECT 'critical', 'security_definer_without_fixed_search_path', procedure.proname, 1, 0, false,
         COALESCE(array_to_string(procedure.proconfig, ', '), 'no proconfig')
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname IN (
      'nutrition_can_read_recipe', 'nutrition_can_edit_recipe', 'get_nutrition_recipe',
      'save_nutrition_recipe', 'duplicate_nutrition_recipe', 'archive_nutrition_recipe',
      'register_nutrition_recipe_meal'
    )
    AND procedure.prosecdef IS TRUE
    AND NOT ('search_path=public' = ANY(COALESCE(procedure.proconfig, '{}'::text[])))

  UNION ALL
  SELECT 'critical', 'recipe_text_contains_mojibake', recipe.id::text, 1, 0, false, recipe.name
  FROM public.nutrition_recipes recipe
  WHERE CONCAT_WS(' ', recipe.name, recipe.description, recipe.category, array_to_string(recipe.tags, ' '))
        ~ '(Ãƒ|Ã‚|Ã¢â‚¬|ï¿½)'

  UNION ALL
  SELECT 'critical', 'recipe_step_contains_mojibake', step.id::text, 1, 0, false, step.instruction
  FROM public.nutrition_recipe_steps step
  WHERE step.instruction ~ '(Ãƒ|Ã‚|Ã¢â‚¬|ï¿½)'

  UNION ALL
  SELECT 'warning', 'incomplete_recipe_calculation', version.id::text, 1, 0, false,
         CONCAT('missing=', version.missing_nutrient_codes::text)
  FROM public.nutrition_recipe_versions version
  JOIN public.nutrition_recipes recipe ON recipe.current_version_id = version.id
  WHERE recipe.status = 'active' AND version.calculation_complete IS DISTINCT FROM true

  UNION ALL
  SELECT 'warning', 'dietary_attribute_evaluation_incomplete', recipe.id::text, 1, 0, false,
         'No se inventaron etiquetas dieteticas ni alergenos sin evidencia del catalogo.'
  FROM public.nutrition_recipes recipe
  WHERE recipe.status = 'active' AND recipe.attribute_evaluation_complete IS DISTINCT FROM true

  UNION ALL
  SELECT 'info', 'active_recipe_count', 'nutrition_recipes', COUNT(*)::bigint, NULL::bigint, true,
         COUNT(*)::text
  FROM public.nutrition_recipes WHERE status = 'active'

  UNION ALL
  SELECT 'info', 'recipe_version_count', 'nutrition_recipe_versions', COUNT(*)::bigint, NULL::bigint, true,
         COUNT(*)::text
  FROM public.nutrition_recipe_versions

  UNION ALL
  SELECT 'info', 'recipe_meal_registration_count', 'nutrition_meal_log_items', COUNT(*)::bigint, NULL::bigint, true,
         COUNT(*)::text
  FROM public.nutrition_meal_log_items WHERE source = 'nutrition_recipe'

  UNION ALL
  SELECT 'info', 'database_encoding', 'PostgreSQL',
         CASE WHEN current_setting('server_encoding') = 'UTF8' AND current_setting('client_encoding') = 'UTF8' THEN 1 ELSE 0 END,
         1, current_setting('server_encoding') = 'UTF8' AND current_setting('client_encoding') = 'UTF8',
         CONCAT('server=', current_setting('server_encoding'), ', client=', current_setting('client_encoding'))
)
SELECT severity, check_name, entity, actual_value, expected_value, passed, details
FROM results
ORDER BY
  CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
  check_name,
  entity;
