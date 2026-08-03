-- Beta Nutrition Sprint 2 - Validacion de integracion nutrition_*.
-- Ejecutar despues de 20260803010000_beta_nutrition_sprint2_catalog_integration.sql.
-- Cierre esperado: 0 filas severity = critical.
-- Las filas warning requieren revision, pero no implican corrupcion por si solas.

WITH
function_scope AS (
  SELECT
    p.oid,
    p.oid::regprocedure::text AS signature,
    p.prosecdef,
    p.proconfig,
    COALESCE(p.proacl, acldefault('f', p.proowner)) AS effective_acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'nutrition_search_normalize',
      'search_nutrition_catalog',
      'get_nutrition_catalog_group',
      'register_nutrition_food_meal',
      'get_nutrition_meal_log'
    )
),
visible_members AS (
  SELECT m.group_id, m.food_id, m.is_default
  FROM public.nutrition_food_group_members m
  JOIN public.nutrition_canonical_food_groups g ON g.id = m.group_id
  JOIN public.nutrition_foods f ON f.id = m.food_id
  WHERE g.status = 'active'
    AND m.is_ui_visible IS TRUE
    AND f.is_visible IS TRUE
    AND f.scope = 'global'
    AND f.verification_status NOT IN ('deprecated', 'rejected')
),
calculable_servings AS (
  SELECT DISTINCT fs.food_id
  FROM public.nutrition_food_servings fs
  JOIN public.nutrition_units u ON u.id = fs.unit_id
  WHERE fs.verification_status NOT IN ('deprecated', 'rejected')
    AND COALESCE(fs.grams, fs.quantity * u.grams_multiplier) > 0
),
core_nutrients AS (
  SELECT
    fn.food_id,
    COUNT(DISTINCT n.code) FILTER (
      WHERE n.code IN ('energy_kcal', 'protein_g', 'carbs_g', 'fat_g')
    ) AS core_count
  FROM public.nutrition_food_nutrients fn
  JOIN public.nutrition_nutrients n ON n.id = fn.nutrient_id
  WHERE fn.verification_status NOT IN ('deprecated', 'rejected')
  GROUP BY fn.food_id
),
search_sample AS (
  SELECT * FROM public.search_nutrition_catalog(NULL, 50, 0)
),
issues AS (
  SELECT 'critical'::text AS severity, 'missing_required_column'::text AS check_name,
         'nutrition schema'::text AS entity,
         COUNT(*)::bigint AS actual_value, 0::bigint AS expected_value,
         string_agg(required.table_name || '.' || required.column_name, ', ' ORDER BY required.table_name, required.column_name) AS details
  FROM (
    VALUES
      ('nutrition_meal_logs', 'client_request_id'),
      ('nutrition_meal_log_items', 'canonical_group_id'),
      ('nutrition_meal_log_items', 'food_id'),
      ('nutrition_meal_log_items', 'serving_id'),
      ('nutrition_meal_log_items', 'unit_id')
  ) AS required(table_name, column_name)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = required.table_name
   AND c.column_name = required.column_name
  WHERE c.column_name IS NULL
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'critical', 'missing_required_function', 'nutrition RPCs', COUNT(*), 0,
         string_agg(required.signature, ', ' ORDER BY required.signature)
  FROM (
    VALUES
      ('nutrition_search_normalize(text)'),
      ('search_nutrition_catalog(text,integer,integer)'),
      ('get_nutrition_catalog_group(uuid)'),
      ('register_nutrition_food_meal(uuid,uuid,uuid,numeric,text,date,uuid)'),
      ('get_nutrition_meal_log(uuid)')
  ) AS required(signature)
  WHERE to_regprocedure('public.' || required.signature) IS NULL
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'critical', 'registration_rpc_not_security_definer', signature, 1, 0,
         'La escritura atomica debe validar auth.uid() dentro de SECURITY DEFINER.'
  FROM function_scope
  WHERE signature LIKE 'register_nutrition_food_meal(%'
    AND prosecdef IS DISTINCT FROM true

  UNION ALL
  SELECT 'critical', 'registration_rpc_unsafe_search_path', signature, 1, 0,
         COALESCE(array_to_string(proconfig, ', '), 'sin configuracion')
  FROM function_scope
  WHERE signature LIKE 'register_nutrition_food_meal(%'
    AND NOT (COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=public'])

  UNION ALL
  SELECT 'critical', 'public_can_execute_private_rpc', fs.signature, COUNT(*), 0,
         'PUBLIC no debe ejecutar RPCs del Sprint 2.'
  FROM function_scope fs
  CROSS JOIN LATERAL aclexplode(fs.effective_acl) acl
  WHERE fs.signature NOT LIKE 'nutrition_search_normalize(%'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE'
  GROUP BY fs.signature

  UNION ALL
  SELECT 'critical', 'authenticated_missing_rpc_execute', fs.signature, 0, 1,
         'authenticated necesita EXECUTE.'
  FROM function_scope fs
  WHERE fs.signature NOT LIKE 'nutrition_search_normalize(%'
    AND NOT EXISTS (
      SELECT 1
      FROM aclexplode(fs.effective_acl) acl
      WHERE acl.grantee = to_regrole('authenticated')
        AND acl.privilege_type = 'EXECUTE'
    )

  UNION ALL
  SELECT 'critical', 'accent_normalization_failed', 'nutrition_search_normalize', 1, 0,
         CONCAT('salmón=', public.nutrition_search_normalize('Salmón'),
                ', México=', public.nutrition_search_normalize('  MÉXICO  '))
  WHERE public.nutrition_search_normalize('Salmón') <> 'salmon'
     OR public.nutrition_search_normalize('  MÉXICO  ') <> 'mexico'

  UNION ALL
  SELECT 'critical', 'catalog_initial_page_too_small', 'search_nutrition_catalog', COUNT(*), 10,
         'La primera pagina debe superar el limite legacy de 8-9 alimentos.'
  FROM search_sample
  HAVING COUNT(*) < 10

  UNION ALL
  SELECT 'critical', 'catalog_returns_invalid_default_food', s.default_food_id::text, COUNT(*), 0,
         CONCAT('status=', f.verification_status, ', visible=', f.is_visible)
  FROM search_sample s
  LEFT JOIN public.nutrition_foods f ON f.id = s.default_food_id
  WHERE f.id IS NULL
     OR f.is_visible IS DISTINCT FROM true
     OR f.scope <> 'global'
     OR f.verification_status IN ('deprecated', 'rejected')
  GROUP BY s.default_food_id, f.verification_status, f.is_visible

  UNION ALL
  SELECT 'critical', 'active_group_without_visible_variant', g.id::text, 1, 0, g.canonical_name
  FROM public.nutrition_canonical_food_groups g
  WHERE g.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM visible_members vm WHERE vm.group_id = g.id)

  UNION ALL
  SELECT 'critical', 'visible_food_without_active_group', f.id::text, 1, 0, f.display_name
  FROM public.nutrition_foods f
  WHERE f.scope = 'global'
    AND f.is_visible IS TRUE
    AND f.verification_status NOT IN ('deprecated', 'rejected')
    AND NOT EXISTS (SELECT 1 FROM visible_members vm WHERE vm.food_id = f.id)

  UNION ALL
  SELECT 'critical', 'invalid_canonical_default_food', g.id::text, 1, 0,
         CONCAT(g.canonical_name, ' default=', g.default_food_id)
  FROM public.nutrition_canonical_food_groups g
  WHERE g.status = 'active'
    AND g.default_food_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM visible_members vm
      WHERE vm.group_id = g.id AND vm.food_id = g.default_food_id
    )

  UNION ALL
  SELECT 'critical', 'visible_variant_without_calculable_serving', vm.food_id::text, 1, 0, f.display_name
  FROM visible_members vm
  JOIN public.nutrition_foods f ON f.id = vm.food_id
  LEFT JOIN calculable_servings cs ON cs.food_id = vm.food_id
  WHERE cs.food_id IS NULL

  UNION ALL
  SELECT 'critical', 'multiple_default_servings', fs.food_id::text,
         COUNT(*) FILTER (WHERE fs.is_default IS TRUE), 1, f.display_name
  FROM public.nutrition_food_servings fs
  JOIN public.nutrition_foods f ON f.id = fs.food_id
  WHERE fs.verification_status NOT IN ('deprecated', 'rejected')
  GROUP BY fs.food_id, f.display_name
  HAVING COUNT(*) FILTER (WHERE fs.is_default IS TRUE) > 1

  UNION ALL
  SELECT 'critical', 'visible_variant_missing_core_nutrients', vm.food_id::text,
         COALESCE(cn.core_count, 0), 4, f.display_name
  FROM visible_members vm
  JOIN public.nutrition_foods f ON f.id = vm.food_id
  LEFT JOIN core_nutrients cn ON cn.food_id = vm.food_id
  WHERE COALESCE(cn.core_count, 0) <> 4

  UNION ALL
  SELECT 'critical', 'duplicate_active_food_nutrient', fn.food_id::text, COUNT(*), 1, n.code
  FROM public.nutrition_food_nutrients fn
  JOIN public.nutrition_nutrients n ON n.id = fn.nutrient_id
  WHERE fn.verification_status NOT IN ('deprecated', 'rejected')
  GROUP BY fn.food_id, fn.nutrient_id, n.code
  HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'critical', 'duplicate_registration_request', client_request_id::text, COUNT(*), 1,
         'client_request_id debe ser idempotente.'
  FROM public.nutrition_meal_logs
  WHERE client_request_id IS NOT NULL
  GROUP BY client_request_id
  HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'critical', 'catalog_log_missing_identity', ml.id::text, 1, 0,
         CONCAT('request=', ml.client_request_id, ', legacy=', ml.legacy_meal_id)
  FROM public.nutrition_meal_logs ml
  WHERE ml.source = 'nutrition_catalog'
    AND (ml.client_request_id IS NULL OR ml.legacy_meal_id IS NULL)

  UNION ALL
  SELECT 'critical', 'catalog_log_missing_item', ml.id::text, 1, 0, ml.name
  FROM public.nutrition_meal_logs ml
  WHERE ml.source = 'nutrition_catalog'
    AND NOT EXISTS (
      SELECT 1 FROM public.nutrition_meal_log_items item WHERE item.meal_log_id = ml.id
    )

  UNION ALL
  SELECT 'critical', 'catalog_item_missing_selection_ids', item.id::text, 1, 0,
         CONCAT('group=', item.canonical_group_id, ', food=', item.food_id, ', serving=', item.serving_id)
  FROM public.nutrition_meal_log_items item
  JOIN public.nutrition_meal_logs ml ON ml.id = item.meal_log_id
  WHERE ml.source = 'nutrition_catalog'
    AND (item.canonical_group_id IS NULL OR item.food_id IS NULL OR item.serving_id IS NULL)

  UNION ALL
  SELECT 'critical', 'catalog_item_selection_relationship_mismatch', item.id::text, 1, 0,
         CONCAT('group=', item.canonical_group_id, ', food=', item.food_id, ', serving=', item.serving_id)
  FROM public.nutrition_meal_log_items item
  JOIN public.nutrition_meal_logs ml ON ml.id = item.meal_log_id
  LEFT JOIN public.nutrition_food_group_members member
    ON member.group_id = item.canonical_group_id
   AND member.food_id = item.food_id
  LEFT JOIN public.nutrition_food_servings serving
    ON serving.id = item.serving_id
   AND serving.food_id = item.food_id
  WHERE ml.source = 'nutrition_catalog'
    AND item.canonical_group_id IS NOT NULL
    AND item.food_id IS NOT NULL
    AND item.serving_id IS NOT NULL
    AND (member.id IS NULL OR serving.id IS NULL)

  UNION ALL
  SELECT 'critical', 'catalog_legacy_mirror_missing', ml.id::text, 1, 0,
         CONCAT('legacy_meal=', ml.legacy_meal_id, ', legacy_ingredient=', item.legacy_meal_ingredient_id)
  FROM public.nutrition_meal_logs ml
  JOIN public.nutrition_meal_log_items item ON item.meal_log_id = ml.id
  LEFT JOIN public.meals legacy_meal ON legacy_meal.id = ml.legacy_meal_id AND legacy_meal.user_id = ml.user_id
  LEFT JOIN public.meal_ingredients legacy_item
    ON legacy_item.id = item.legacy_meal_ingredient_id
   AND legacy_item.meal_id = legacy_meal.id
   AND legacy_item.user_id = ml.user_id
  WHERE ml.source = 'nutrition_catalog'
    AND (legacy_meal.id IS NULL OR legacy_item.id IS NULL)

  UNION ALL
  SELECT 'critical', 'mojibake_detected', 'nutrition catalog', COUNT(*), 0,
         string_agg(sample, ' | ' ORDER BY sample)
  FROM (
    SELECT DISTINCT left(value, 100) AS sample
    FROM (
      SELECT display_name AS value FROM public.nutrition_foods
      UNION ALL SELECT canonical_name FROM public.nutrition_canonical_food_groups
      UNION ALL SELECT alias FROM public.nutrition_food_aliases
      UNION ALL SELECT serving_label FROM public.nutrition_food_servings
    ) strings
    WHERE value ~ '(Ã|Â|â€|�)'
    LIMIT 20
  ) bad_encoding
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'warning', 'visible_variants_partially_verified', 'nutrition_foods',
         COUNT(DISTINCT f.id), 0,
         'Estos datos pueden mostrarse con el aviso editorial de verificacion parcial.'
  FROM visible_members vm
  JOIN public.nutrition_foods f ON f.id = vm.food_id
  WHERE f.verification_status <> 'verified'
  HAVING COUNT(DISTINCT f.id) > 0
),
metrics AS (
  SELECT 'info'::text AS severity, 'visible_canonical_groups'::text AS check_name,
         'nutrition_canonical_food_groups'::text AS entity,
         COUNT(DISTINCT group_id)::bigint AS actual_value, NULL::bigint AS expected_value,
         'Grupos activos con al menos una variante visible.'::text AS details
  FROM visible_members

  UNION ALL
  SELECT 'info', 'visible_food_variants', 'nutrition_foods', COUNT(DISTINCT food_id), NULL,
         'Variantes globales visibles y no deprecadas.'
  FROM visible_members

  UNION ALL
  SELECT 'info', 'catalog_first_page_rows', 'search_nutrition_catalog', COUNT(*), 50,
         CONCAT('total_count=', COALESCE(MAX(total_count), 0))
  FROM search_sample

  UNION ALL
  SELECT 'info', 'catalog_registration_count', 'nutrition_meal_logs', COUNT(*), NULL,
         'Registros nuevos creados mediante el catálogo nutrition_*.'
  FROM public.nutrition_meal_logs
  WHERE source = 'nutrition_catalog'

  UNION ALL
  SELECT 'info', 'database_encoding', 'PostgreSQL', 1, 1,
         CONCAT('server=', current_setting('server_encoding'), ', client=', current_setting('client_encoding'))
)
SELECT
  severity,
  check_name,
  entity,
  actual_value,
  expected_value,
  CASE
    WHEN severity = 'critical' THEN false
    WHEN severity = 'warning' THEN false
    ELSE true
  END AS passed,
  details
FROM (
  SELECT * FROM issues
  UNION ALL
  SELECT * FROM metrics
) results
ORDER BY
  CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
  check_name,
  entity;
