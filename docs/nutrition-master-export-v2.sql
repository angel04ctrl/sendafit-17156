WITH global_foods AS (
  SELECT f.*
  FROM public.nutrition_foods f
  WHERE f.scope = 'global'
),
aliases_agg AS (
  SELECT
    a.food_id,
    jsonb_agg(
      jsonb_build_object(
        'alias_record', to_jsonb(a),
        'alias_id', a.id,
        'food_id', a.food_id,
        'food_client_key', 'existing:' || a.food_id::text,
        'alias', a.alias,
        'normalized_alias', a.normalized_alias,
        'locale', a.locale,
        'source', a.source,
        'created_at', a.created_at
      )
      ORDER BY a.normalized_alias, a.alias, a.id
    ) AS aliases_json
  FROM public.nutrition_food_aliases a
  JOIN global_foods f ON f.id = a.food_id
  GROUP BY a.food_id
),
categories_agg AS (
  SELECT
    fc.food_id,
    string_agg(c.name, ' | ' ORDER BY fc.is_primary DESC, c.category_level, c.normalized_name)
      FILTER (WHERE c.category_level = 'category') AS category,
    string_agg(c.name, ' | ' ORDER BY c.normalized_name)
      FILTER (WHERE c.category_level = 'subcategory') AS subcategory,
    jsonb_agg(
      jsonb_build_object(
        'food_category_record', to_jsonb(fc),
        'category_record', to_jsonb(c),
        'food_id', fc.food_id,
        'food_client_key', 'existing:' || fc.food_id::text,
        'category_id', c.id,
        'category_client_key', 'existing:category:' || c.id::text,
        'category_name', c.name,
        'normalized_name', c.normalized_name,
        'category_level', c.category_level,
        'locale', c.locale,
        'is_primary', fc.is_primary,
        'parent_id', c.parent_id
      )
      ORDER BY fc.is_primary DESC, c.category_level, c.normalized_name, c.id
    ) AS categories_json
  FROM public.nutrition_food_categories fc
  JOIN global_foods f ON f.id = fc.food_id
  JOIN public.nutrition_categories c ON c.id = fc.category_id
  GROUP BY fc.food_id
),
servings_agg AS (
  SELECT
    s.food_id,
    jsonb_agg(
      jsonb_build_object(
        'serving_record', to_jsonb(s),
        'unit_record', to_jsonb(u),
        'serving_id', s.id,
        'serving_client_key', 'existing:serving:' || s.id::text,
        'food_id', s.food_id,
        'food_client_key', 'existing:' || s.food_id::text,
        'unit_id', s.unit_id,
        'unit_client_key', 'existing:unit:' || u.code,
        'unit_code', u.code,
        'unit_name', u.name,
        'unit_dimension', u.dimension,
        'serving_label', s.serving_label,
        'quantity', s.quantity,
        'grams', s.grams,
        'milliliters', s.milliliters,
        'is_default', s.is_default,
        'source', s.source,
        'confidence_score', s.confidence_score,
        'verification_status', s.verification_status
      )
      ORDER BY s.is_default DESC, s.quantity, s.serving_label, s.id
    ) AS servings_json
  FROM public.nutrition_food_servings s
  JOIN global_foods f ON f.id = s.food_id
  JOIN public.nutrition_units u ON u.id = s.unit_id
  GROUP BY s.food_id
),
default_serving AS (
  SELECT DISTINCT ON (s.food_id)
    s.food_id,
    s.quantity AS base_amount,
    u.code AS base_unit,
    s.grams AS serving_grams
  FROM public.nutrition_food_servings s
  JOIN public.nutrition_units u ON u.id = s.unit_id
  JOIN global_foods f ON f.id = s.food_id
  ORDER BY s.food_id, s.is_default DESC, s.created_at, s.id
),
nutrients_agg AS (
  SELECT
    fn.food_id,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'energy_kcal') AS calories_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'protein_g') AS protein_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'carbs_g') AS carbohydrates_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'fat_g') AS fat_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'fiber_g') AS fiber_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'sugar_g') AS sugars_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'sodium_mg') AS sodium_mg_100g,
    jsonb_agg(
      jsonb_build_object(
        'food_nutrient_record', to_jsonb(fn),
        'nutrient_record', to_jsonb(n),
        'source_record', to_jsonb(src),
        'food_nutrient_id', fn.id,
        'food_nutrient_client_key', 'existing:food_nutrient:' || fn.id::text,
        'food_id', fn.food_id,
        'food_client_key', 'existing:' || fn.food_id::text,
        'nutrient_id', fn.nutrient_id,
        'nutrient_client_key', 'existing:nutrient:' || n.code,
        'nutrient_code', n.code,
        'nutrient_name', n.name,
        'nutrient_group', n.nutrient_group,
        'amount', fn.amount_per_100g,
        'unit', n.unit,
        'basis_amount', 100,
        'basis_unit', 'g',
        'source_id', fn.source_id,
        'source_code', src.code,
        'confidence_score', fn.confidence_score,
        'is_verified', fn.is_verified,
        'verification_status', fn.verification_status,
        'updated_at', fn.updated_at
      )
      ORDER BY n.display_order, n.code, fn.id
    ) AS nutrients_json
  FROM public.nutrition_food_nutrients fn
  JOIN global_foods f ON f.id = fn.food_id
  JOIN public.nutrition_nutrients n ON n.id = fn.nutrient_id
  LEFT JOIN public.nutrition_sources src ON src.id = fn.source_id
  GROUP BY fn.food_id
),
group_members AS (
  SELECT
    m.food_id,
    g.id AS canonical_group_id,
    COALESCE(g.client_key, 'existing:group:' || g.id::text) AS canonical_group_client_key,
    g.canonical_name AS canonical_group_name,
    g.normalized_name AS canonical_group_normalized_name,
    m.id AS group_member_id,
    m.variant_type,
    m.display_order AS variant_display_order,
    m.is_default AS is_default_variant,
    m.is_ui_visible AS is_ui_visible_variant,
    ps.code AS member_physical_state,
    pm.code AS member_preparation_method,
    jsonb_build_object(
      'group_record', to_jsonb(g),
      'member_record', to_jsonb(m),
      'physical_state_record', to_jsonb(ps),
      'preparation_method_record', to_jsonb(pm),
      'canonical_group_id', g.id,
      'canonical_group_client_key', COALESCE(g.client_key, 'existing:group:' || g.id::text),
      'group_member_id', m.id,
      'group_member_client_key', 'existing:group_member:' || m.id::text,
      'food_id', m.food_id,
      'food_client_key', 'existing:' || m.food_id::text,
      'variant_type', m.variant_type,
      'display_order', m.display_order,
      'is_default', m.is_default,
      'is_ui_visible', m.is_ui_visible
    ) AS canonical_group_json
  FROM public.nutrition_food_group_members m
  JOIN public.nutrition_canonical_food_groups g ON g.id = m.group_id
  LEFT JOIN public.nutrition_physical_states ps ON ps.id = m.physical_state_id
  LEFT JOIN public.nutrition_preparation_methods pm ON pm.id = m.preparation_method_id
),
relationships_agg AS (
  SELECT
    food_id,
    jsonb_agg(relationship_json ORDER BY direction, relationship_type, related_food_name, relationship_id) AS food_relationships_json
  FROM (
    SELECT
      r.parent_food_id AS food_id,
      'parent_to_child' AS direction,
      r.relationship_type,
      r.id AS relationship_id,
      child.display_name AS related_food_name,
      jsonb_build_object(
        'relationship_record', to_jsonb(r),
        'direction', 'parent_to_child',
        'relationship_id', r.id,
        'relationship_client_key', 'existing:relationship:' || r.id::text,
        'parent_food_id', r.parent_food_id,
        'parent_food_client_key', 'existing:' || r.parent_food_id::text,
        'parent_food_name', parent.display_name,
        'child_food_id', r.child_food_id,
        'child_food_client_key', 'existing:' || r.child_food_id::text,
        'child_food_name', child.display_name,
        'relationship_type', r.relationship_type,
        'display_order', r.display_order,
        'is_default', r.is_default,
        'is_ui_visible', r.is_ui_visible
      ) AS relationship_json
    FROM public.nutrition_food_relationships r
    JOIN global_foods parent ON parent.id = r.parent_food_id
    JOIN global_foods child ON child.id = r.child_food_id
    UNION ALL
    SELECT
      r.child_food_id AS food_id,
      'child_to_parent' AS direction,
      r.relationship_type,
      r.id AS relationship_id,
      parent.display_name AS related_food_name,
      jsonb_build_object(
        'relationship_record', to_jsonb(r),
        'direction', 'child_to_parent',
        'relationship_id', r.id,
        'relationship_client_key', 'existing:relationship:' || r.id::text,
        'parent_food_id', r.parent_food_id,
        'parent_food_client_key', 'existing:' || r.parent_food_id::text,
        'parent_food_name', parent.display_name,
        'child_food_id', r.child_food_id,
        'child_food_client_key', 'existing:' || r.child_food_id::text,
        'child_food_name', child.display_name,
        'relationship_type', r.relationship_type,
        'display_order', r.display_order,
        'is_default', r.is_default,
        'is_ui_visible', r.is_ui_visible
      ) AS relationship_json
    FROM public.nutrition_food_relationships r
    JOIN global_foods parent ON parent.id = r.parent_food_id
    JOIN global_foods child ON child.id = r.child_food_id
  ) r
  GROUP BY food_id
),
barcodes_agg AS (
  SELECT
    b.food_id,
    jsonb_agg(to_jsonb(b) ORDER BY b.barcode, b.id) AS barcodes_json
  FROM public.nutrition_barcodes b
  JOIN global_foods f ON f.id = b.food_id
  GROUP BY b.food_id
),
preparations_agg AS (
  SELECT
    food_id,
    jsonb_agg(preparation_json ORDER BY direction, related_food_name, preparation_state, preparation_id) AS preparations_json
  FROM (
    SELECT
      p.base_food_id AS food_id,
      'base_to_prepared' AS direction,
      p.id AS preparation_id,
      p.preparation_state,
      prepared.display_name AS related_food_name,
      jsonb_build_object(
        'preparation_record', to_jsonb(p),
        'direction', 'base_to_prepared',
        'base_food_id', p.base_food_id,
        'base_food_client_key', 'existing:' || p.base_food_id::text,
        'base_food_name', base.display_name,
        'prepared_food_id', p.prepared_food_id,
        'prepared_food_client_key', 'existing:' || p.prepared_food_id::text,
        'prepared_food_name', prepared.display_name,
        'preparation_state', p.preparation_state,
        'yield_factor', p.yield_factor,
        'notes', p.notes
      ) AS preparation_json
    FROM public.nutrition_food_preparations p
    JOIN global_foods base ON base.id = p.base_food_id
    JOIN global_foods prepared ON prepared.id = p.prepared_food_id
    UNION ALL
    SELECT
      p.prepared_food_id AS food_id,
      'prepared_from_base' AS direction,
      p.id AS preparation_id,
      p.preparation_state,
      base.display_name AS related_food_name,
      jsonb_build_object(
        'preparation_record', to_jsonb(p),
        'direction', 'prepared_from_base',
        'base_food_id', p.base_food_id,
        'base_food_client_key', 'existing:' || p.base_food_id::text,
        'base_food_name', base.display_name,
        'prepared_food_id', p.prepared_food_id,
        'prepared_food_client_key', 'existing:' || p.prepared_food_id::text,
        'prepared_food_name', prepared.display_name,
        'preparation_state', p.preparation_state,
        'yield_factor', p.yield_factor,
        'notes', p.notes
      ) AS preparation_json
    FROM public.nutrition_food_preparations p
    JOIN global_foods base ON base.id = p.base_food_id
    JOIN global_foods prepared ON prepared.id = p.prepared_food_id
  ) p
  GROUP BY food_id
),
sources_agg AS (
  SELECT
    food_id,
    jsonb_agg(source_json ORDER BY source_code, source_id) AS sources_json
  FROM (
    SELECT DISTINCT
      f.id AS food_id,
      src.id AS source_id,
      src.code AS source_code,
      jsonb_build_object('source_record', to_jsonb(src), 'source_id', src.id, 'source_code', src.code, 'source_name', src.name) AS source_json
    FROM global_foods f
    JOIN public.nutrition_sources src ON src.id = f.source_id
    UNION
    SELECT DISTINCT
      fn.food_id,
      src.id,
      src.code,
      jsonb_build_object('source_record', to_jsonb(src), 'source_id', src.id, 'source_code', src.code, 'source_name', src.name)
    FROM public.nutrition_food_nutrients fn
    JOIN global_foods f ON f.id = fn.food_id
    JOIN public.nutrition_sources src ON src.id = fn.source_id
  ) s
  GROUP BY food_id
),
brand_rows AS (
  SELECT
    f.id AS food_id,
    b.name AS brand_name,
    CASE WHEN b.id IS NULL THEN NULL::jsonb ELSE to_jsonb(b) END AS brand_json
  FROM global_foods f
  LEFT JOIN public.nutrition_brands b ON b.id = f.brand_id
),
reference_catalog AS (
  SELECT jsonb_build_object(
    'sources', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.code, s.id) FROM public.nutrition_sources s), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.normalized_name, b.id) FROM public.nutrition_brands b), '[]'::jsonb),
    'categories', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.category_level, c.normalized_name, c.id) FROM public.nutrition_categories c), '[]'::jsonb),
    'units', COALESCE((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.dimension, u.code, u.id) FROM public.nutrition_units u), '[]'::jsonb),
    'nutrients', COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.display_order, n.code, n.id) FROM public.nutrition_nutrients n), '[]'::jsonb),
    'physical_states', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.display_order, s.code, s.id) FROM public.nutrition_physical_states s), '[]'::jsonb),
    'preparation_methods', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.display_order, m.code, m.id) FROM public.nutrition_preparation_methods m), '[]'::jsonb),
    'verification_statuses', '["unverified","needs_review","partially_verified","verified","rejected","deprecated"]'::jsonb,
    'food_kinds', '["ingredient","prepared_variant","component","composite_food","recipe","branded_product","restaurant_item","supplement","beverage","unclassified","generic","branded","restaurant","user_custom","ai_estimated"]'::jsonb,
    'relationship_types', '["variant_of","preparation_of","component_of","part_of","derived_from","cut_of","equivalent_to","related_to"]'::jsonb,
    'variant_types', '["ingredient","prepared_variant","component","composite_food","recipe","branded_product","restaurant_item","supplement","beverage","unclassified","legacy_generic"]'::jsonb
  ) AS reference_catalog_json
),
audit_base AS (
  SELECT
    f.id AS food_id,
    (a.aliases_json IS NOT NULL AND jsonb_array_length(a.aliases_json) > 0) AS audit_has_aliases,
    (c.categories_json IS NOT NULL AND jsonb_array_length(c.categories_json) > 0) AS audit_has_category,
    (NULLIF(btrim(COALESCE(f.description, '')), '') IS NOT NULL) AS audit_has_description,
    (sv.servings_json IS NOT NULL AND jsonb_array_length(sv.servings_json) > 0) AS audit_has_servings,
    (src.sources_json IS NOT NULL AND jsonb_array_length(src.sources_json) > 0) AS audit_has_source,
    (n.calories_100g IS NOT NULL) AS audit_has_calories,
    (n.protein_100g IS NOT NULL) AS audit_has_protein,
    (n.carbohydrates_100g IS NOT NULL) AS audit_has_carbohydrates,
    (n.fat_100g IS NOT NULL) AS audit_has_fat,
    (n.protein_100g * 4 + n.carbohydrates_100g * 4 + n.fat_100g * 9) AS audit_macro_energy_calculated,
    CASE
      WHEN n.calories_100g IS NULL THEN NULL
      ELSE n.calories_100g - (COALESCE(n.protein_100g, 0) * 4 + COALESCE(n.carbohydrates_100g, 0) * 4 + COALESCE(n.fat_100g, 0) * 9)
    END AS audit_macro_energy_difference,
    f.normalized_name AS audit_possible_duplicate_key,
    COUNT(*) OVER (PARTITION BY f.normalized_name) AS duplicate_name_count,
    (gm.canonical_group_id IS NOT NULL) AS audit_has_canonical_group
  FROM global_foods f
  LEFT JOIN aliases_agg a ON a.food_id = f.id
  LEFT JOIN categories_agg c ON c.food_id = f.id
  LEFT JOIN servings_agg sv ON sv.food_id = f.id
  LEFT JOIN nutrients_agg n ON n.food_id = f.id
  LEFT JOIN sources_agg src ON src.food_id = f.id
  LEFT JOIN group_members gm ON gm.food_id = f.id
),
audit_final AS (
  SELECT
    ab.*,
    (ab.audit_has_calories AND ab.audit_has_protein AND ab.audit_has_carbohydrates AND ab.audit_has_fat) AS audit_has_complete_macros,
    to_jsonb(array_remove(ARRAY[
      CASE WHEN NOT ab.audit_has_aliases THEN 'missing_aliases' END,
      CASE WHEN NOT ab.audit_has_category THEN 'missing_category' END,
      CASE WHEN NOT ab.audit_has_description THEN 'missing_description' END,
      CASE WHEN NOT ab.audit_has_servings THEN 'missing_servings' END,
      CASE WHEN NOT ab.audit_has_source THEN 'missing_source' END,
      CASE WHEN NOT ab.audit_has_canonical_group THEN 'missing_canonical_group' END,
      CASE WHEN NOT ab.audit_has_calories THEN 'missing_calories' END,
      CASE WHEN NOT ab.audit_has_protein THEN 'missing_protein' END,
      CASE WHEN NOT ab.audit_has_carbohydrates THEN 'missing_carbohydrates' END,
      CASE WHEN NOT ab.audit_has_fat THEN 'missing_fat' END,
      CASE WHEN ab.duplicate_name_count > 1 THEN 'possible_duplicate_normalized_name' END,
      CASE WHEN ab.audit_macro_energy_difference IS NOT NULL AND abs(ab.audit_macro_energy_difference) > 20 THEN 'macro_energy_mismatch_gt_20_kcal' END
    ], NULL)) AS audit_review_reasons
  FROM audit_base ab
),
ranked_foods AS (
  SELECT
    f.*,
    row_number() OVER (ORDER BY f.normalized_name, f.display_name, f.id) AS export_row_number,
    count(*) OVER () AS export_total_foods
  FROM global_foods f
)
SELECT
  rf.export_row_number,
  rf.export_total_foods,
  rf.id AS food_id,
  'existing:' || rf.id::text AS client_key,
  rf.legacy_food_id,
  gm.canonical_group_id,
  gm.canonical_group_client_key,
  gm.canonical_group_name,
  gm.group_member_id,
  COALESCE(gm.variant_type, CASE WHEN rf.food_kind = 'generic' THEN 'legacy_generic' ELSE rf.food_kind END) AS variant_type,
  rf.food_kind,
  rf.canonical_name,
  rf.display_name,
  rf.normalized_name,
  rf.description,
  COALESCE(food_state.code, gm.member_physical_state) AS physical_state,
  COALESCE(food_method.code, gm.member_preparation_method) AS preparation_method,
  rf.preparation_state AS legacy_preparation_state,
  rf.verification_status,
  rf.confidence_score,
  br.brand_name,
  br.brand_json,
  ca.category,
  ca.subcategory,
  ds.base_amount,
  ds.base_unit,
  ds.serving_grams,
  nu.calories_100g,
  nu.protein_100g,
  nu.carbohydrates_100g,
  nu.fat_100g,
  nu.fiber_100g,
  nu.sugars_100g,
  nu.sodium_mg_100g,
  primary_source.code AS source_code,
  rf.source_external_id,
  rf.locale,
  rf.is_verified,
  rf.is_visible,
  rf.is_common,
  rf.visibility_priority,
  COALESCE(al.aliases_json, '[]'::jsonb) AS aliases_json,
  COALESCE(ca.categories_json, '[]'::jsonb) AS categories_json,
  COALESCE(se.servings_json, '[]'::jsonb) AS servings_json,
  COALESCE(nu.nutrients_json, '[]'::jsonb) AS nutrients_json,
  COALESCE(so.sources_json, '[]'::jsonb) AS sources_json,
  COALESCE(ba.barcodes_json, '[]'::jsonb) AS barcodes_json,
  COALESCE(pr.preparations_json, '[]'::jsonb) AS preparations_json,
  COALESCE(rel.food_relationships_json, '[]'::jsonb) AS food_relationships_json,
  COALESCE(gm.canonical_group_json, '{}'::jsonb) AS canonical_group_json,
  to_jsonb(rf) - 'export_row_number' - 'export_total_foods' - 'owner_user_id' AS food_record_json,
  CASE WHEN rf.export_row_number = 1 THEN rc.reference_catalog_json ELSE NULL::jsonb END AS reference_catalog_json,
  af.audit_has_aliases,
  af.audit_has_category,
  af.audit_has_description,
  af.audit_has_servings,
  af.audit_has_source,
  af.audit_has_canonical_group,
  af.audit_has_calories,
  af.audit_has_protein,
  af.audit_has_carbohydrates,
  af.audit_has_fat,
  af.audit_has_complete_macros,
  af.audit_possible_duplicate_key,
  af.audit_macro_energy_calculated,
  af.audit_macro_energy_difference,
  (jsonb_array_length(af.audit_review_reasons) > 0) AS audit_needs_review,
  af.audit_review_reasons,
  rf.created_at,
  rf.updated_at
FROM ranked_foods rf
LEFT JOIN aliases_agg al ON al.food_id = rf.id
LEFT JOIN categories_agg ca ON ca.food_id = rf.id
LEFT JOIN servings_agg se ON se.food_id = rf.id
LEFT JOIN default_serving ds ON ds.food_id = rf.id
LEFT JOIN nutrients_agg nu ON nu.food_id = rf.id
LEFT JOIN group_members gm ON gm.food_id = rf.id
LEFT JOIN relationships_agg rel ON rel.food_id = rf.id
LEFT JOIN barcodes_agg ba ON ba.food_id = rf.id
LEFT JOIN preparations_agg pr ON pr.food_id = rf.id
LEFT JOIN sources_agg so ON so.food_id = rf.id
LEFT JOIN brand_rows br ON br.food_id = rf.id
LEFT JOIN public.nutrition_physical_states food_state ON food_state.id = rf.physical_state_id
LEFT JOIN public.nutrition_preparation_methods food_method ON food_method.id = rf.preparation_method_id
LEFT JOIN public.nutrition_sources primary_source ON primary_source.id = rf.source_id
LEFT JOIN audit_final af ON af.food_id = rf.id
CROSS JOIN reference_catalog rc
ORDER BY rf.normalized_name, rf.display_name, rf.id;
