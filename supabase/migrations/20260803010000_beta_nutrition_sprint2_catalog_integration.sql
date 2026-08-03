-- Beta Nutrition Sprint 2 - Catalog integration and transactional meal logging.
-- Additive only: preserves all legacy and nutrition history.

BEGIN;

ALTER TABLE public.nutrition_meal_logs
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_meal_logs_client_request_idx
  ON public.nutrition_meal_logs (client_request_id)
  WHERE client_request_id IS NOT NULL;

ALTER TABLE public.nutrition_meal_log_items
  ADD COLUMN IF NOT EXISTS canonical_group_id uuid
    REFERENCES public.nutrition_canonical_food_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS nutrition_meal_log_items_group_idx
  ON public.nutrition_meal_log_items (canonical_group_id);

CREATE OR REPLACE FUNCTION public.nutrition_search_normalize(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT btrim(
    regexp_replace(
      translate(
        lower(COALESCE(_value, '')),
        'áàäâãéèëêíìïîóòöôõúùüûñç',
        'aaaaaeeeeiiiiooooouuuunc'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  )
$function$;

CREATE OR REPLACE FUNCTION public.search_nutrition_catalog(
  _query text DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  canonical_group_id uuid,
  canonical_name text,
  group_description text,
  default_food_id uuid,
  default_food_name text,
  food_kind text,
  variant_count bigint,
  category_name text,
  brand_name text,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  default_serving_id uuid,
  default_serving_label text,
  default_serving_quantity numeric,
  default_serving_grams numeric,
  default_serving_milliliters numeric,
  verification_status text,
  is_common boolean,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  WITH params AS (
    SELECT
      public.nutrition_search_normalize(_query) AS q,
      LEAST(GREATEST(COALESCE(_limit, 24), 1), 50) AS page_limit,
      GREATEST(COALESCE(_offset, 0), 0) AS page_offset
  ),
  matching_groups AS (
    SELECT
      g.id,
      CASE
        WHEN p.q = '' THEN 4
        WHEN public.nutrition_search_normalize(g.canonical_name) = p.q THEN 0
        WHEN EXISTS (
          SELECT 1
          FROM public.nutrition_food_group_members em
          JOIN public.nutrition_foods ef ON ef.id = em.food_id
          WHERE em.group_id = g.id
            AND em.is_ui_visible IS TRUE
            AND ef.is_visible IS TRUE
            AND ef.verification_status NOT IN ('deprecated', 'rejected')
            AND (ef.scope = 'global' OR ef.owner_user_id = auth.uid())
            AND public.nutrition_search_normalize(ef.display_name) = p.q
        ) THEN 0
        WHEN EXISTS (
          SELECT 1
          FROM public.nutrition_food_group_members em
          JOIN public.nutrition_foods ef ON ef.id = em.food_id
          JOIN public.nutrition_food_aliases ea ON ea.food_id = ef.id
          WHERE em.group_id = g.id
            AND em.is_ui_visible IS TRUE
            AND ef.is_visible IS TRUE
            AND ef.verification_status NOT IN ('deprecated', 'rejected')
            AND (ef.scope = 'global' OR ef.owner_user_id = auth.uid())
            AND public.nutrition_search_normalize(ea.alias) = p.q
        ) THEN 1
        WHEN public.nutrition_search_normalize(g.canonical_name) LIKE p.q || '%' THEN 2
        WHEN EXISTS (
          SELECT 1
          FROM public.nutrition_food_group_members em
          JOIN public.nutrition_foods ef ON ef.id = em.food_id
          LEFT JOIN public.nutrition_food_aliases ea ON ea.food_id = ef.id
          WHERE em.group_id = g.id
            AND em.is_ui_visible IS TRUE
            AND ef.is_visible IS TRUE
            AND ef.verification_status NOT IN ('deprecated', 'rejected')
            AND (ef.scope = 'global' OR ef.owner_user_id = auth.uid())
            AND (
              public.nutrition_search_normalize(ef.display_name) LIKE p.q || '%'
              OR public.nutrition_search_normalize(ea.alias) LIKE p.q || '%'
            )
        ) THEN 2
        ELSE 3
      END AS match_rank
    FROM public.nutrition_canonical_food_groups g
    CROSS JOIN params p
    WHERE g.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM public.nutrition_food_group_members em
        JOIN public.nutrition_foods ef ON ef.id = em.food_id
        WHERE em.group_id = g.id
          AND em.is_ui_visible IS TRUE
          AND ef.is_visible IS TRUE
          AND ef.verification_status NOT IN ('deprecated', 'rejected')
          AND (ef.scope = 'global' OR ef.owner_user_id = auth.uid())
      )
      AND (
        p.q = ''
        OR public.nutrition_search_normalize(g.canonical_name) LIKE '%' || p.q || '%'
        OR EXISTS (
          SELECT 1
          FROM public.nutrition_food_group_members sm
          JOIN public.nutrition_foods sf ON sf.id = sm.food_id
          LEFT JOIN public.nutrition_brands sb ON sb.id = sf.brand_id
          LEFT JOIN public.nutrition_food_aliases sa ON sa.food_id = sf.id
          WHERE sm.group_id = g.id
            AND sm.is_ui_visible IS TRUE
            AND sf.is_visible IS TRUE
            AND sf.verification_status NOT IN ('deprecated', 'rejected')
            AND (sf.scope = 'global' OR sf.owner_user_id = auth.uid())
            AND (
              public.nutrition_search_normalize(sf.display_name) LIKE '%' || p.q || '%'
              OR public.nutrition_search_normalize(sf.canonical_name) LIKE '%' || p.q || '%'
              OR public.nutrition_search_normalize(sf.normalized_name) LIKE '%' || p.q || '%'
              OR public.nutrition_search_normalize(sf.search_text) LIKE '%' || p.q || '%'
              OR public.nutrition_search_normalize(sa.alias) LIKE '%' || p.q || '%'
              OR public.nutrition_search_normalize(sb.name) LIKE '%' || p.q || '%'
            )
        )
      )
  ),
  cards AS (
    SELECT
      g.id AS canonical_group_id,
      g.canonical_name,
      g.description AS group_description,
      selected_food.id AS default_food_id,
      selected_food.display_name AS default_food_name,
      selected_food.food_kind,
      variants.variant_count,
      category.name AS category_name,
      brand.name AS brand_name,
      nutrient.calories_per_100g,
      nutrient.protein_per_100g,
      nutrient.carbs_per_100g,
      nutrient.fat_per_100g,
      serving.id AS default_serving_id,
      serving.serving_label AS default_serving_label,
      serving.quantity AS default_serving_quantity,
      serving.grams AS default_serving_grams,
      serving.milliliters AS default_serving_milliliters,
      selected_food.verification_status,
      selected_food.is_common,
      selected_food.visibility_priority,
      mg.match_rank
    FROM matching_groups mg
    JOIN public.nutrition_canonical_food_groups g ON g.id = mg.id
    JOIN LATERAL (
      SELECT f.*
      FROM public.nutrition_food_group_members m
      JOIN public.nutrition_foods f ON f.id = m.food_id
      WHERE m.group_id = g.id
        AND m.is_ui_visible IS TRUE
        AND f.is_visible IS TRUE
        AND f.verification_status NOT IN ('deprecated', 'rejected')
        AND (f.scope = 'global' OR f.owner_user_id = auth.uid())
      ORDER BY
        (f.id = g.default_food_id) DESC,
        m.is_default DESC,
        f.is_common DESC,
        f.visibility_priority ASC,
        m.display_order ASC,
        f.display_name ASC
      LIMIT 1
    ) selected_food ON true
    LEFT JOIN public.nutrition_brands brand ON brand.id = selected_food.brand_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::bigint AS variant_count
      FROM public.nutrition_food_group_members vm
      JOIN public.nutrition_foods vf ON vf.id = vm.food_id
      WHERE vm.group_id = g.id
        AND vm.is_ui_visible IS TRUE
        AND vf.is_visible IS TRUE
        AND vf.verification_status NOT IN ('deprecated', 'rejected')
        AND (vf.scope = 'global' OR vf.owner_user_id = auth.uid())
    ) variants ON true
    LEFT JOIN LATERAL (
      SELECT c.name
      FROM public.nutrition_food_categories fc
      JOIN public.nutrition_categories c ON c.id = fc.category_id
      WHERE fc.food_id = selected_food.id
      ORDER BY fc.is_primary DESC, c.category_level ASC, c.name ASC
      LIMIT 1
    ) category ON true
    LEFT JOIN LATERAL (
      SELECT
        MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'energy_kcal') AS calories_per_100g,
        MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'protein_g') AS protein_per_100g,
        MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'carbs_g') AS carbs_per_100g,
        MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'fat_g') AS fat_per_100g
      FROM public.nutrition_food_nutrients fn
      JOIN public.nutrition_nutrients n ON n.id = fn.nutrient_id
      WHERE fn.food_id = selected_food.id
        AND fn.verification_status NOT IN ('deprecated', 'rejected')
    ) nutrient ON true
    LEFT JOIN LATERAL (
      SELECT fs.*
      FROM public.nutrition_food_servings fs
      WHERE fs.food_id = selected_food.id
        AND fs.verification_status NOT IN ('deprecated', 'rejected')
      ORDER BY fs.is_default DESC, (fs.grams IS NOT NULL) DESC, fs.serving_label ASC
      LIMIT 1
    ) serving ON true
  )
  SELECT
    c.canonical_group_id,
    c.canonical_name,
    c.group_description,
    c.default_food_id,
    c.default_food_name,
    c.food_kind,
    c.variant_count,
    c.category_name,
    c.brand_name,
    c.calories_per_100g,
    c.protein_per_100g,
    c.carbs_per_100g,
    c.fat_per_100g,
    c.default_serving_id,
    c.default_serving_label,
    c.default_serving_quantity,
    c.default_serving_grams,
    c.default_serving_milliliters,
    c.verification_status,
    c.is_common,
    COUNT(*) OVER () AS total_count
  FROM cards c
  CROSS JOIN params p
  ORDER BY
    c.match_rank ASC,
    c.is_common DESC,
    c.visibility_priority ASC,
    c.canonical_name ASC,
    c.canonical_group_id ASC
  LIMIT (SELECT page_limit FROM params)
  OFFSET (SELECT page_offset FROM params)
$function$;

CREATE OR REPLACE FUNCTION public.get_nutrition_catalog_group(_canonical_group_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT jsonb_build_object(
    'id', g.id,
    'canonicalName', g.canonical_name,
    'description', g.description,
    'defaultFoodId', g.default_food_id,
    'status', g.status,
    'variants', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'displayName', f.display_name,
          'canonicalName', f.canonical_name,
          'description', f.description,
          'foodKind', f.food_kind,
          'verificationStatus', f.verification_status,
          'isVerified', f.is_verified,
          'isDefault', (f.id = g.default_food_id OR m.is_default),
          'variantType', m.variant_type,
          'physicalState', CASE WHEN ps.id IS NULL THEN NULL ELSE jsonb_build_object('code', ps.code, 'name', ps.name) END,
          'preparationMethod', CASE WHEN pm.id IS NULL THEN NULL ELSE jsonb_build_object('code', pm.code, 'name', pm.name) END,
          'brandName', b.name,
          'categories', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'isPrimary', fc.is_primary) ORDER BY fc.is_primary DESC, c.name)
            FROM public.nutrition_food_categories fc
            JOIN public.nutrition_categories c ON c.id = fc.category_id
            WHERE fc.food_id = f.id
          ), '[]'::jsonb),
          'servings', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', fs.id,
                'label', fs.serving_label,
                'quantity', fs.quantity,
                'grams', fs.grams,
                'milliliters', fs.milliliters,
                'isDefault', fs.is_default,
                'verificationStatus', fs.verification_status,
                'unit', jsonb_build_object(
                  'id', u.id,
                  'code', u.code,
                  'name', u.name,
                  'dimension', u.dimension,
                  'gramsMultiplier', u.grams_multiplier,
                  'millilitersMultiplier', u.milliliters_multiplier
                ),
                'isCalculable', (fs.grams IS NOT NULL OR u.grams_multiplier IS NOT NULL)
              )
              ORDER BY fs.is_default DESC, (fs.grams IS NOT NULL) DESC, fs.serving_label
            )
            FROM public.nutrition_food_servings fs
            JOIN public.nutrition_units u ON u.id = fs.unit_id
            WHERE fs.food_id = f.id
              AND fs.verification_status NOT IN ('deprecated', 'rejected')
          ), '[]'::jsonb),
          'nutrients', COALESCE((
            SELECT jsonb_object_agg(
              n.code,
              jsonb_build_object(
                'name', n.name,
                'unit', n.unit,
                'amountPer100g', fn.amount_per_100g,
                'verificationStatus', fn.verification_status
              )
            )
            FROM public.nutrition_food_nutrients fn
            JOIN public.nutrition_nutrients n ON n.id = fn.nutrient_id
            WHERE fn.food_id = f.id
              AND fn.verification_status NOT IN ('deprecated', 'rejected')
          ), '{}'::jsonb)
        )
        ORDER BY
          (f.id = g.default_food_id) DESC,
          m.is_default DESC,
          m.display_order ASC,
          f.display_name ASC
      )
      FROM public.nutrition_food_group_members m
      JOIN public.nutrition_foods f ON f.id = m.food_id
      LEFT JOIN public.nutrition_physical_states ps ON ps.id = COALESCE(m.physical_state_id, f.physical_state_id)
      LEFT JOIN public.nutrition_preparation_methods pm ON pm.id = COALESCE(m.preparation_method_id, f.preparation_method_id)
      LEFT JOIN public.nutrition_brands b ON b.id = f.brand_id
      WHERE m.group_id = g.id
        AND m.is_ui_visible IS TRUE
        AND f.is_visible IS TRUE
        AND f.verification_status NOT IN ('deprecated', 'rejected')
        AND (f.scope = 'global' OR f.owner_user_id = auth.uid())
    ), '[]'::jsonb)
  )
  FROM public.nutrition_canonical_food_groups g
  WHERE g.id = _canonical_group_id
    AND g.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.nutrition_food_group_members m
      JOIN public.nutrition_foods f ON f.id = m.food_id
      WHERE m.group_id = g.id
        AND m.is_ui_visible IS TRUE
        AND f.is_visible IS TRUE
        AND f.verification_status NOT IN ('deprecated', 'rejected')
        AND (f.scope = 'global' OR f.owner_user_id = auth.uid())
    )
$function$;

CREATE OR REPLACE FUNCTION public.register_nutrition_food_meal(
  _canonical_group_id uuid,
  _food_id uuid,
  _serving_id uuid,
  _quantity numeric,
  _meal_type text,
  _logged_date date,
  _client_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _nutrition_log_id uuid;
  _nutrition_item_id uuid;
  _legacy_meal_id uuid;
  _legacy_ingredient_id uuid;
  _legacy_food_id integer;
  _food_name text;
  _food_is_verified boolean;
  _group_name text;
  _serving_label text;
  _unit_id uuid;
  _serving_quantity numeric;
  _serving_grams numeric;
  _serving_milliliters numeric;
  _unit_grams_multiplier numeric;
  _unit_milliliters_multiplier numeric;
  _consumed_grams numeric;
  _consumed_milliliters numeric;
  _energy_100g numeric;
  _protein_100g numeric;
  _carbs_100g numeric;
  _fat_100g numeric;
  _fiber_100g numeric;
  _sugar_100g numeric;
  _sodium_100g numeric;
  _calories numeric;
  _protein numeric;
  _carbs numeric;
  _fat numeric;
  _fiber numeric;
  _sugar numeric;
  _sodium numeric;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _client_request_id IS NULL THEN
    RAISE EXCEPTION 'client_request_id_required';
  END IF;

  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 1000 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  IF _meal_type NOT IN ('desayuno', 'colacion_am', 'comida', 'colacion_pm', 'cena') THEN
    RAISE EXCEPTION 'invalid_meal_type';
  END IF;

  IF _logged_date IS NULL OR _logged_date < CURRENT_DATE - 3650 OR _logged_date > CURRENT_DATE + 3650 THEN
    RAISE EXCEPTION 'invalid_logged_date';
  END IF;

  SELECT
    f.legacy_food_id,
    f.display_name,
    f.is_verified,
    g.canonical_name,
    fs.serving_label,
    fs.unit_id,
    fs.quantity,
    fs.grams,
    fs.milliliters,
    u.grams_multiplier,
    u.milliliters_multiplier
  INTO
    _legacy_food_id,
    _food_name,
    _food_is_verified,
    _group_name,
    _serving_label,
    _unit_id,
    _serving_quantity,
    _serving_grams,
    _serving_milliliters,
    _unit_grams_multiplier,
    _unit_milliliters_multiplier
  FROM public.nutrition_foods f
  JOIN public.nutrition_food_group_members m
    ON m.food_id = f.id
   AND m.group_id = _canonical_group_id
  JOIN public.nutrition_canonical_food_groups g ON g.id = m.group_id
  JOIN public.nutrition_food_servings fs
    ON fs.id = _serving_id
   AND fs.food_id = f.id
  JOIN public.nutrition_units u ON u.id = fs.unit_id
  WHERE f.id = _food_id
    AND g.status = 'active'
    AND m.is_ui_visible IS TRUE
    AND f.is_visible IS TRUE
    AND f.verification_status NOT IN ('deprecated', 'rejected')
    AND fs.verification_status NOT IN ('deprecated', 'rejected')
    AND (f.scope = 'global' OR f.owner_user_id = _user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_catalog_selection';
  END IF;

  _serving_grams := COALESCE(_serving_grams, _serving_quantity * _unit_grams_multiplier);
  IF _serving_grams IS NULL OR _serving_grams <= 0 THEN
    RAISE EXCEPTION 'serving_without_gram_equivalence';
  END IF;

  _consumed_grams := round((_serving_grams * _quantity)::numeric, 4);
  _serving_milliliters := COALESCE(
    _serving_milliliters,
    _serving_quantity * _unit_milliliters_multiplier
  );
  _consumed_milliliters := CASE
    WHEN _serving_milliliters IS NULL THEN NULL
    ELSE round((_serving_milliliters * _quantity)::numeric, 4)
  END;

  SELECT
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'energy_kcal'),
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'protein_g'),
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'carbs_g'),
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'fat_g'),
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'fiber_g'),
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'sugar_g'),
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'sodium_mg')
  INTO
    _energy_100g,
    _protein_100g,
    _carbs_100g,
    _fat_100g,
    _fiber_100g,
    _sugar_100g,
    _sodium_100g
  FROM public.nutrition_food_nutrients fn
  JOIN public.nutrition_nutrients n ON n.id = fn.nutrient_id
  WHERE fn.food_id = _food_id
    AND fn.verification_status NOT IN ('deprecated', 'rejected');

  IF _energy_100g IS NULL OR _protein_100g IS NULL OR _carbs_100g IS NULL OR _fat_100g IS NULL THEN
    RAISE EXCEPTION 'food_missing_core_nutrients';
  END IF;

  _calories := round(_energy_100g * _consumed_grams / 100, 2);
  _protein := round(_protein_100g * _consumed_grams / 100, 2);
  _carbs := round(_carbs_100g * _consumed_grams / 100, 2);
  _fat := round(_fat_100g * _consumed_grams / 100, 2);
  _fiber := CASE WHEN _fiber_100g IS NULL THEN NULL ELSE round(_fiber_100g * _consumed_grams / 100, 2) END;
  _sugar := CASE WHEN _sugar_100g IS NULL THEN NULL ELSE round(_sugar_100g * _consumed_grams / 100, 2) END;
  _sodium := CASE WHEN _sodium_100g IS NULL THEN NULL ELSE round(_sodium_100g * _consumed_grams / 100, 2) END;

  INSERT INTO public.nutrition_meal_logs (
    user_id,
    meal_type,
    name,
    logged_date,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium_mg,
    source,
    client_request_id,
    metadata
  )
  VALUES (
    _user_id,
    _meal_type,
    _food_name,
    _logged_date,
    _calories,
    _protein,
    _carbs,
    _fat,
    _fiber,
    _sugar,
    _sodium,
    'nutrition_catalog',
    _client_request_id,
    jsonb_build_object(
      'canonicalGroupId', _canonical_group_id,
      'canonicalGroupName', _group_name,
      'foodId', _food_id,
      'foodName', _food_name,
      'servingId', _serving_id,
      'servingLabel', _serving_label,
      'quantity', _quantity,
      'consumedGrams', _consumed_grams,
      'consumedMilliliters', _consumed_milliliters
    )
  )
  ON CONFLICT (client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING
  RETURNING id INTO _nutrition_log_id;

  IF _nutrition_log_id IS NULL THEN
    SELECT id, legacy_meal_id
    INTO _nutrition_log_id, _legacy_meal_id
    FROM public.nutrition_meal_logs
    WHERE client_request_id = _client_request_id
      AND user_id = _user_id;

    IF _nutrition_log_id IS NULL THEN
      RAISE EXCEPTION 'client_request_conflict';
    END IF;

    RETURN jsonb_build_object(
      'nutritionMealLogId', _nutrition_log_id,
      'legacyMealId', _legacy_meal_id,
      'deduplicated', true
    );
  END IF;

  INSERT INTO public.meals (
    user_id,
    meal_type,
    name,
    calories,
    protein,
    carbs,
    fat,
    date
  )
  VALUES (
    _user_id,
    _meal_type::public.meal_type,
    _food_name || ' (' || trim(to_char(_quantity, 'FM999999990.####')) || ' x ' || _serving_label || ')',
    _calories,
    _protein,
    _carbs,
    _fat,
    _logged_date
  )
  RETURNING id INTO _legacy_meal_id;

  UPDATE public.nutrition_meal_logs
  SET legacy_meal_id = _legacy_meal_id
  WHERE id = _nutrition_log_id;

  INSERT INTO public.meal_ingredients (
    meal_id,
    user_id,
    food_id,
    ingredient_name,
    source,
    is_verified,
    quantity,
    unit,
    grams,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium_mg,
    metadata
  )
  VALUES (
    _legacy_meal_id,
    _user_id,
    _legacy_food_id,
    _food_name,
    'nutrition_catalog',
    _food_is_verified,
    _quantity,
    _serving_label,
    _consumed_grams,
    _calories,
    _protein,
    _carbs,
    _fat,
    _fiber,
    _sugar,
    _sodium,
    jsonb_build_object(
      'canonicalGroupId', _canonical_group_id,
      'canonicalGroupName', _group_name,
      'nutritionFoodId', _food_id,
      'servingId', _serving_id,
      'servingLabel', _serving_label,
      'quantity', _quantity,
      'consumedGrams', _consumed_grams,
      'consumedMilliliters', _consumed_milliliters,
      'nutritionMealLogId', _nutrition_log_id,
      'clientRequestId', _client_request_id
    )
  )
  RETURNING id INTO _legacy_ingredient_id;

  INSERT INTO public.nutrition_meal_log_items (
    legacy_meal_ingredient_id,
    meal_log_id,
    food_id,
    serving_id,
    unit_id,
    canonical_group_id,
    item_name,
    quantity,
    unit_label,
    grams,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium_mg,
    source,
    is_verified,
    metadata
  )
  VALUES (
    _legacy_ingredient_id,
    _nutrition_log_id,
    _food_id,
    _serving_id,
    _unit_id,
    _canonical_group_id,
    _food_name,
    _quantity,
    _serving_label,
    _consumed_grams,
    _calories,
    _protein,
    _carbs,
    _fat,
    _fiber,
    _sugar,
    _sodium,
    'nutrition_catalog',
    _food_is_verified,
    jsonb_build_object(
      'canonicalGroupName', _group_name,
      'foodNameSnapshot', _food_name,
      'servingLabelSnapshot', _serving_label,
      'consumedMilliliters', _consumed_milliliters,
      'clientRequestId', _client_request_id
    )
  )
  RETURNING id INTO _nutrition_item_id;

  RETURN jsonb_build_object(
    'nutritionMealLogId', _nutrition_log_id,
    'nutritionMealLogItemId', _nutrition_item_id,
    'legacyMealId', _legacy_meal_id,
    'legacyMealIngredientId', _legacy_ingredient_id,
    'canonicalGroupId', _canonical_group_id,
    'foodId', _food_id,
    'servingId', _serving_id,
    'quantity', _quantity,
    'consumedGrams', _consumed_grams,
    'consumedMilliliters', _consumed_milliliters,
    'calories', _calories,
    'protein', _protein,
    'carbs', _carbs,
    'fat', _fat,
    'fiber', _fiber,
    'sugar', _sugar,
    'sodiumMg', _sodium,
    'deduplicated', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_nutrition_meal_log(_nutrition_meal_log_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT jsonb_build_object(
    'id', ml.id,
    'legacyMealId', ml.legacy_meal_id,
    'mealType', ml.meal_type,
    'name', ml.name,
    'loggedDate', ml.logged_date,
    'calories', ml.calories,
    'protein', ml.protein,
    'carbs', ml.carbs,
    'fat', ml.fat,
    'fiber', ml.fiber,
    'sugar', ml.sugar,
    'sodiumMg', ml.sodium_mg,
    'source', ml.source,
    'metadata', ml.metadata,
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'canonicalGroupId', item.canonical_group_id,
          'foodId', item.food_id,
          'servingId', item.serving_id,
          'itemName', item.item_name,
          'quantity', item.quantity,
          'unitLabel', item.unit_label,
          'grams', item.grams,
          'calories', item.calories,
          'protein', item.protein,
          'carbs', item.carbs,
          'fat', item.fat,
          'fiber', item.fiber,
          'sugar', item.sugar,
          'sodiumMg', item.sodium_mg,
          'source', item.source,
          'metadata', item.metadata
        )
        ORDER BY item.created_at, item.id
      )
      FROM public.nutrition_meal_log_items item
      WHERE item.meal_log_id = ml.id
    ), '[]'::jsonb)
  )
  FROM public.nutrition_meal_logs ml
  WHERE ml.id = _nutrition_meal_log_id
    AND ml.user_id = auth.uid()
$function$;

REVOKE ALL ON FUNCTION public.search_nutrition_catalog(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_nutrition_catalog_group(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_nutrition_food_meal(uuid, uuid, uuid, numeric, text, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_nutrition_meal_log(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_nutrition_catalog(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nutrition_catalog_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_nutrition_food_meal(uuid, uuid, uuid, numeric, text, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nutrition_meal_log(uuid) TO authenticated;

COMMENT ON FUNCTION public.search_nutrition_catalog(text, integer, integer) IS
  'Paginated canonical nutrition catalog search for Beta Nutrition Sprint 2.';
COMMENT ON FUNCTION public.get_nutrition_catalog_group(uuid) IS
  'Returns visible variants, servings and active nutrients for one canonical food group.';
COMMENT ON FUNCTION public.register_nutrition_food_meal(uuid, uuid, uuid, numeric, text, date, uuid) IS
  'Validates and calculates a catalog selection server-side, then atomically writes nutrition and legacy meal history.';
COMMENT ON FUNCTION public.get_nutrition_meal_log(uuid) IS
  'Returns one nutrition meal snapshot and its items for the authenticated owner.';

COMMIT;
