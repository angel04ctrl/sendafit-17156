-- Nutrition import v2.1 - post-import validation.
-- Expected approval signal: 0 rows where severity = 'critical'.

WITH latest_batch AS (
  SELECT id
  FROM public.nutrition_import_batches
  WHERE import_name = 'nutrition-master-catalog-v2.1-curated'
    AND status = 'committed'
  ORDER BY finished_at DESC NULLS LAST, started_at DESC
  LIMIT 1
),
batch_foods AS (
  SELECT entity_id AS food_id
  FROM public.nutrition_import_entity_map
  WHERE import_batch_id = (SELECT id FROM latest_batch)
    AND entity_type = 'food'
),
active_foods AS (
  SELECT f.*
  FROM public.nutrition_foods f
  WHERE f.id IN (SELECT food_id FROM batch_foods)
    AND f.is_visible IS TRUE
    AND f.verification_status NOT IN ('deprecated', 'rejected')
),
validation AS (
  SELECT 'critical' AS severity, 'missing_committed_import_batch' AS check_name,
         '1' AS expected_value, '0' AS actual_value, false AS passed,
         'No committed nutrition-master-catalog-v2.1-curated batch found' AS details
  WHERE NOT EXISTS (SELECT 1 FROM latest_batch)

  UNION ALL
  SELECT 'critical', 'imported_food_count',
         '304', COUNT(*)::text, COUNT(*) = 304,
         COUNT(*)::text
  FROM batch_foods
  HAVING COUNT(*) <> 304

  UNION ALL
  SELECT 'critical', 'catalog_food_count_after_import',
         '304 or more', COUNT(*)::text, COUNT(*) >= 304,
         COUNT(*)::text
  FROM public.nutrition_foods
  HAVING COUNT(*) < 304

  UNION ALL
  SELECT 'critical', 'duplicate_active_normalized_foods',
         '0', COUNT(*)::text, COUNT(*) = 0,
         normalized_name || ' count=' || COUNT(*)
  FROM active_foods
  GROUP BY normalized_name
  HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'critical', 'active_food_without_default_serving',
         '0', COUNT(*)::text, COUNT(*) = 0,
         COUNT(*)::text
  FROM active_foods f
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.nutrition_food_servings s
    WHERE s.food_id = f.id
      AND s.is_default IS TRUE
  )
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'critical', 'active_food_without_primary_category',
         '0', COUNT(*)::text, COUNT(*) = 0,
         COUNT(*)::text
  FROM active_foods f
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.nutrition_food_categories c
    WHERE c.food_id = f.id
      AND c.is_primary IS TRUE
  )
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'critical', 'duplicate_default_servings',
         '0', COUNT(*)::text, COUNT(*) = 0,
         food_id::text || ' count=' || COUNT(*)
  FROM public.nutrition_food_servings
  WHERE food_id IN (SELECT food_id FROM batch_foods)
    AND is_default IS TRUE
  GROUP BY food_id
  HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'critical', 'duplicate_nutrient_per_food',
         '0', COUNT(*)::text, COUNT(*) = 0,
         food_id::text || ':' || nutrient_id::text || ' count=' || COUNT(*)
  FROM public.nutrition_food_nutrients
  WHERE food_id IN (SELECT food_id FROM batch_foods)
  GROUP BY food_id, nutrient_id
  HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'critical', 'duplicate_group_default',
         '0', COUNT(*)::text, COUNT(*) = 0,
         group_id::text || ' count=' || COUNT(*)
  FROM public.nutrition_food_group_members
  WHERE group_id IN (
    SELECT group_id
    FROM public.nutrition_food_group_members
    WHERE food_id IN (SELECT food_id FROM batch_foods)
  )
    AND is_default IS TRUE
  GROUP BY group_id
  HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'critical', 'orphan_group_default_food',
         '0', COUNT(*)::text, COUNT(*) = 0,
         COUNT(*)::text
  FROM public.nutrition_canonical_food_groups g
  WHERE g.default_food_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.nutrition_foods f WHERE f.id = g.default_food_id)
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'critical', 'orphan_group_member',
         '0', COUNT(*)::text, COUNT(*) = 0,
         COUNT(*)::text
  FROM public.nutrition_food_group_members m
  WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_foods f WHERE f.id = m.food_id)
     OR NOT EXISTS (SELECT 1 FROM public.nutrition_canonical_food_groups g WHERE g.id = m.group_id)
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'critical', 'orphan_food_relationship',
         '0', COUNT(*)::text, COUNT(*) = 0,
         COUNT(*)::text
  FROM public.nutrition_food_relationships r
  WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_foods f WHERE f.id = r.parent_food_id)
     OR NOT EXISTS (SELECT 1 FROM public.nutrition_foods f WHERE f.id = r.child_food_id)
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'critical', 'self_food_relationship',
         '0', COUNT(*)::text, COUNT(*) = 0,
         COUNT(*)::text
  FROM public.nutrition_food_relationships
  WHERE parent_food_id = child_food_id
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'critical', 'negative_catalog_values',
         '0', COUNT(*)::text, COUNT(*) = 0,
         COUNT(*)::text
  FROM public.nutrition_food_nutrients
  WHERE food_id IN (SELECT food_id FROM batch_foods)
    AND amount_per_100g < 0
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'critical', 'mojibake_in_catalog_text',
         '0', COUNT(*)::text, COUNT(*) = 0,
         COUNT(*)::text
  FROM public.nutrition_foods
  WHERE id IN (SELECT food_id FROM batch_foods)
    AND (
      display_name ~ 'Ãƒ|Ã‚|Ã¢â‚¬|Ã°Å¸|ï¿½'
      OR canonical_name ~ 'Ãƒ|Ã‚|Ã¢â‚¬|Ã°Å¸|ï¿½'
      OR description ~ 'Ãƒ|Ã‚|Ã¢â‚¬|Ã°Å¸|ï¿½'
    )
  HAVING COUNT(*) > 0

  UNION ALL
  SELECT 'info', 'latest_import_batch',
         NULL::text, id::text, true, id::text
  FROM latest_batch

  UNION ALL
  SELECT 'info', 'batch_food_count',
         '304', COUNT(*)::text, COUNT(*) = 304, COUNT(*)::text
  FROM batch_foods

  UNION ALL
  SELECT 'info', 'canonical_group_count',
         NULL::text, COUNT(*)::text, true, COUNT(*)::text
  FROM public.nutrition_canonical_food_groups

  UNION ALL
  SELECT 'info', 'food_relationship_count',
         NULL::text, COUNT(*)::text, true, COUNT(*)::text
  FROM public.nutrition_food_relationships
)
SELECT *
FROM validation
ORDER BY severity, check_name, details;
