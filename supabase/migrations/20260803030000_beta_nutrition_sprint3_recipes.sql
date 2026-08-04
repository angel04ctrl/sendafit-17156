-- Beta Nutrition Sprint 3 - Versioned recipes, server-side calculation and meal logging.
-- Additive migration. Existing nutrition and legacy history remains untouched.

BEGIN;

ALTER TABLE public.nutrition_recipes
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-MX',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS meal_types text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dietary_labels text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS allergens text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS attribute_evaluation_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_recipe_id uuid REFERENCES public.nutrition_recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_version_id uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.nutrition_recipes
  DROP CONSTRAINT IF EXISTS nutrition_recipes_status_check,
  DROP CONSTRAINT IF EXISTS nutrition_recipes_origin_check,
  DROP CONSTRAINT IF EXISTS nutrition_recipes_difficulty_check;

ALTER TABLE public.nutrition_recipes
  ADD CONSTRAINT nutrition_recipes_status_check
  CHECK (status IN ('active', 'archived')),
  ADD CONSTRAINT nutrition_recipes_origin_check
  CHECK (origin IN ('user', 'system', 'duplicated')),
  ADD CONSTRAINT nutrition_recipes_difficulty_check
  CHECK (difficulty IS NULL OR difficulty IN ('facil', 'intermedia', 'avanzada'));

UPDATE public.nutrition_recipes
SET origin = 'system'
WHERE user_id IS NULL
  AND visibility = 'global'
  AND origin = 'user';

CREATE TABLE IF NOT EXISTS public.nutrition_recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.nutrition_recipes(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status text NOT NULL DEFAULT 'published',
  servings numeric NOT NULL DEFAULT 1,
  yield_quantity numeric,
  yield_unit text,
  total_weight_g numeric,
  total_volume_ml numeric,
  ingredient_weight_g numeric,
  prep_time_minutes integer,
  cook_time_minutes integer,
  notes text,
  calculation_complete boolean NOT NULL DEFAULT false,
  missing_nutrient_codes text[] NOT NULL DEFAULT '{}'::text[],
  calculated_at timestamptz,
  client_request_id uuid UNIQUE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT nutrition_recipe_versions_number_check CHECK (version_number >= 1),
  CONSTRAINT nutrition_recipe_versions_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT nutrition_recipe_versions_servings_check CHECK (servings > 0 AND servings <= 1000),
  CONSTRAINT nutrition_recipe_versions_yield_check CHECK (yield_quantity IS NULL OR yield_quantity > 0),
  CONSTRAINT nutrition_recipe_versions_weight_check CHECK (total_weight_g IS NULL OR total_weight_g > 0),
  CONSTRAINT nutrition_recipe_versions_volume_check CHECK (total_volume_ml IS NULL OR total_volume_ml > 0),
  CONSTRAINT nutrition_recipe_versions_ingredient_weight_check CHECK (ingredient_weight_g IS NULL OR ingredient_weight_g > 0),
  CONSTRAINT nutrition_recipe_versions_prep_time_check CHECK (prep_time_minutes IS NULL OR prep_time_minutes BETWEEN 0 AND 10080),
  CONSTRAINT nutrition_recipe_versions_cook_time_check CHECK (cook_time_minutes IS NULL OR cook_time_minutes BETWEEN 0 AND 10080),
  UNIQUE (recipe_id, version_number)
);

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'nutrition_recipes_current_version_fk'
      AND conrelid = 'public.nutrition_recipes'::regclass
  ) THEN
    ALTER TABLE public.nutrition_recipes
      ADD CONSTRAINT nutrition_recipes_current_version_fk
      FOREIGN KEY (current_version_id)
      REFERENCES public.nutrition_recipe_versions(id)
      ON DELETE SET NULL;
  END IF;
END
$constraint$;

ALTER TABLE public.nutrition_recipe_ingredients
  ADD COLUMN IF NOT EXISTS recipe_version_id uuid REFERENCES public.nutrition_recipe_versions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS canonical_group_id uuid REFERENCES public.nutrition_canonical_food_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS serving_id uuid REFERENCES public.nutrition_food_servings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS food_name_snapshot text,
  ADD COLUMN IF NOT EXISTS serving_label_snapshot text,
  ADD COLUMN IF NOT EXISTS unit_label_snapshot text,
  ADD COLUMN IF NOT EXISTS milliliters numeric,
  ADD COLUMN IF NOT EXISTS nutrient_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.nutrition_recipe_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id uuid NOT NULL REFERENCES public.nutrition_recipe_versions(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  instruction text NOT NULL,
  duration_minutes integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_recipe_steps_number_check CHECK (step_number >= 1),
  CONSTRAINT nutrition_recipe_steps_instruction_check CHECK (char_length(btrim(instruction)) BETWEEN 1 AND 2000),
  CONSTRAINT nutrition_recipe_steps_duration_check CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 1440),
  UNIQUE (recipe_version_id, step_number)
);

CREATE TABLE IF NOT EXISTS public.nutrition_recipe_nutrients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id uuid NOT NULL REFERENCES public.nutrition_recipe_versions(id) ON DELETE CASCADE,
  nutrient_id uuid NOT NULL REFERENCES public.nutrition_nutrients(id) ON DELETE RESTRICT,
  total_amount numeric NOT NULL,
  amount_per_serving numeric NOT NULL,
  amount_per_100g numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_recipe_nutrients_total_check CHECK (total_amount >= 0),
  CONSTRAINT nutrition_recipe_nutrients_serving_check CHECK (amount_per_serving >= 0),
  CONSTRAINT nutrition_recipe_nutrients_per_100g_check CHECK (amount_per_100g IS NULL OR amount_per_100g >= 0),
  UNIQUE (recipe_version_id, nutrient_id)
);

ALTER TABLE public.nutrition_meal_log_items
  ADD COLUMN IF NOT EXISTS recipe_version_id uuid
    REFERENCES public.nutrition_recipe_versions(id) ON DELETE SET NULL;

ALTER TABLE public.nutrition_meal_log_items
  DROP CONSTRAINT IF EXISTS nutrition_meal_log_items_unambiguous_source_check;

ALTER TABLE public.nutrition_meal_log_items
  ADD CONSTRAINT nutrition_meal_log_items_unambiguous_source_check
  CHECK (
    NOT (food_id IS NOT NULL AND recipe_id IS NOT NULL)
    AND (recipe_version_id IS NULL OR recipe_id IS NOT NULL)
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS nutrition_recipes_owner_status_idx
  ON public.nutrition_recipes (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS nutrition_recipes_global_idx
  ON public.nutrition_recipes (visibility, status, updated_at DESC)
  WHERE visibility = 'global' AND status = 'active';

CREATE INDEX IF NOT EXISTS nutrition_recipe_versions_recipe_idx
  ON public.nutrition_recipe_versions (recipe_id, version_number DESC);

CREATE INDEX IF NOT EXISTS nutrition_recipe_ingredients_version_order_idx
  ON public.nutrition_recipe_ingredients (recipe_version_id, order_index);

CREATE INDEX IF NOT EXISTS nutrition_recipe_steps_version_idx
  ON public.nutrition_recipe_steps (recipe_version_id, step_number);

CREATE INDEX IF NOT EXISTS nutrition_recipe_nutrients_version_idx
  ON public.nutrition_recipe_nutrients (recipe_version_id);

CREATE INDEX IF NOT EXISTS nutrition_meal_log_items_recipe_version_idx
  ON public.nutrition_meal_log_items (recipe_version_id)
  WHERE recipe_version_id IS NOT NULL;

-- Backfill a first immutable version for any recipe created by the foundational schema.
INSERT INTO public.nutrition_recipe_versions (
  recipe_id,
  version_number,
  status,
  servings,
  yield_quantity,
  yield_unit,
  total_weight_g,
  calculation_complete,
  missing_nutrient_codes,
  calculated_at,
  created_by,
  created_at,
  published_at,
  metadata
)
SELECT
  r.id,
  1,
  'published',
  r.servings,
  r.servings,
  'porciones',
  r.total_weight_g,
  false,
  ARRAY['energy_kcal', 'protein_g', 'carbs_g', 'fat_g']::text[],
  now(),
  r.user_id,
  r.created_at,
  COALESCE(r.published_at, r.created_at),
  jsonb_build_object('backfilled_by', 'beta_nutrition_sprint3')
FROM public.nutrition_recipes r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.nutrition_recipe_versions v
  WHERE v.recipe_id = r.id
);

UPDATE public.nutrition_recipe_ingredients ingredient
SET
  recipe_version_id = version.id,
  canonical_group_id = COALESCE(
    ingredient.canonical_group_id,
    (SELECT member.group_id FROM public.nutrition_food_group_members member WHERE member.food_id = ingredient.food_id LIMIT 1)
  ),
  food_name_snapshot = COALESCE(
    ingredient.food_name_snapshot,
    (SELECT food.display_name FROM public.nutrition_foods food WHERE food.id = ingredient.food_id),
    ingredient.ingredient_name
  ),
  serving_label_snapshot = COALESCE(
    ingredient.serving_label_snapshot,
    (SELECT serving.serving_label FROM public.nutrition_food_servings serving WHERE serving.id = ingredient.serving_id)
  ),
  unit_label_snapshot = COALESCE(
    ingredient.unit_label_snapshot,
    (SELECT unit.name FROM public.nutrition_units unit WHERE unit.id = ingredient.unit_id)
  ),
  updated_at = now()
FROM public.nutrition_recipe_versions version
WHERE version.recipe_id = ingredient.recipe_id
  AND version.version_number = 1
  AND ingredient.recipe_version_id IS NULL;

UPDATE public.nutrition_recipe_ingredients ingredient
SET nutrient_snapshot = COALESCE((
  SELECT jsonb_object_agg(
    nutrient.code,
    jsonb_build_object(
      'name', nutrient.name,
      'unit', nutrient.unit,
      'amount', round((food_nutrient.amount_per_100g * ingredient.grams / 100)::numeric, 4)
    )
  )
  FROM public.nutrition_food_nutrients food_nutrient
  JOIN public.nutrition_nutrients nutrient ON nutrient.id = food_nutrient.nutrient_id
  WHERE food_nutrient.food_id = ingredient.food_id
    AND ingredient.grams IS NOT NULL
    AND food_nutrient.verification_status NOT IN ('deprecated', 'rejected')
), '{}'::jsonb)
WHERE ingredient.recipe_version_id IS NOT NULL
  AND ingredient.nutrient_snapshot = '{}'::jsonb;

INSERT INTO public.nutrition_recipe_steps (recipe_version_id, step_number, instruction, metadata)
SELECT
  version.id,
  instruction.ordinality::integer,
  instruction.value,
  jsonb_build_object('backfilled_by', 'beta_nutrition_sprint3')
FROM public.nutrition_recipes recipe
JOIN public.nutrition_recipe_versions version
  ON version.recipe_id = recipe.id
 AND version.version_number = 1
CROSS JOIN LATERAL unnest(recipe.instructions) WITH ORDINALITY AS instruction(value, ordinality)
WHERE btrim(instruction.value) <> ''
ON CONFLICT (recipe_version_id, step_number) DO NOTHING;

INSERT INTO public.nutrition_recipe_nutrients (
  recipe_version_id,
  nutrient_id,
  total_amount,
  amount_per_serving,
  amount_per_100g
)
SELECT
  ingredient.recipe_version_id,
  food_nutrient.nutrient_id,
  round(SUM(food_nutrient.amount_per_100g * ingredient.grams / 100)::numeric, 4),
  round((SUM(food_nutrient.amount_per_100g * ingredient.grams / 100) / version.servings)::numeric, 4),
  CASE
    WHEN version.total_weight_g IS NULL THEN NULL
    ELSE round((SUM(food_nutrient.amount_per_100g * ingredient.grams / 100) / version.total_weight_g * 100)::numeric, 4)
  END
FROM public.nutrition_recipe_ingredients ingredient
JOIN public.nutrition_recipe_versions version ON version.id = ingredient.recipe_version_id
JOIN public.nutrition_food_nutrients food_nutrient ON food_nutrient.food_id = ingredient.food_id
WHERE ingredient.grams IS NOT NULL
  AND food_nutrient.verification_status NOT IN ('deprecated', 'rejected')
GROUP BY ingredient.recipe_version_id, food_nutrient.nutrient_id, version.servings, version.total_weight_g
ON CONFLICT (recipe_version_id, nutrient_id) DO UPDATE SET
  total_amount = EXCLUDED.total_amount,
  amount_per_serving = EXCLUDED.amount_per_serving,
  amount_per_100g = EXCLUDED.amount_per_100g;

UPDATE public.nutrition_recipe_versions version
SET
  ingredient_weight_g = (
    SELECT SUM(ingredient.grams)
    FROM public.nutrition_recipe_ingredients ingredient
    WHERE ingredient.recipe_version_id = version.id
  ),
  calculation_complete = EXISTS (
    SELECT 1 FROM public.nutrition_recipe_ingredients ingredient
    WHERE ingredient.recipe_version_id = version.id
  ) AND NOT EXISTS (
    SELECT 1
    FROM unnest(ARRAY['energy_kcal', 'protein_g', 'carbs_g', 'fat_g']) required(code)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.nutrition_recipe_ingredients ingredient
      WHERE ingredient.recipe_version_id = version.id
    ) OR EXISTS (
      SELECT 1
      FROM public.nutrition_recipe_ingredients ingredient
      WHERE ingredient.recipe_version_id = version.id
        AND NOT (ingredient.nutrient_snapshot ? required.code)
    )
  ),
  missing_nutrient_codes = ARRAY(
    SELECT required.code
    FROM unnest(ARRAY['energy_kcal', 'protein_g', 'carbs_g', 'fat_g']) required(code)
    WHERE EXISTS (
      SELECT 1
      FROM public.nutrition_recipe_ingredients ingredient
      WHERE ingredient.recipe_version_id = version.id
        AND NOT (ingredient.nutrient_snapshot ? required.code)
    )
    ORDER BY required.code
  ),
  calculated_at = now()
WHERE version.metadata ->> 'backfilled_by' = 'beta_nutrition_sprint3';

UPDATE public.nutrition_recipes recipe
SET
  current_version_id = (
    SELECT version.id
    FROM public.nutrition_recipe_versions version
    WHERE version.recipe_id = recipe.id
    ORDER BY version.version_number DESC
    LIMIT 1
  ),
  published_at = COALESCE(recipe.published_at, (
    SELECT COALESCE(version.published_at, version.created_at)
    FROM public.nutrition_recipe_versions version
    WHERE version.recipe_id = recipe.id
    ORDER BY version.version_number DESC
    LIMIT 1
  ))
WHERE recipe.current_version_id IS NULL;

WITH ranked_ingredients AS (
  SELECT
    ingredient.id,
    row_number() OVER (
      PARTITION BY ingredient.recipe_version_id
      ORDER BY ingredient.order_index, ingredient.created_at, ingredient.id
    )::integer AS normalized_order
  FROM public.nutrition_recipe_ingredients ingredient
)
UPDATE public.nutrition_recipe_ingredients ingredient
SET order_index = ranked.normalized_order
FROM ranked_ingredients ranked
WHERE ranked.id = ingredient.id
  AND ingredient.order_index IS DISTINCT FROM ranked.normalized_order;

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_recipe_ingredients_version_order_unique_idx
  ON public.nutrition_recipe_ingredients (recipe_version_id, order_index)
  WHERE recipe_version_id IS NOT NULL;

ALTER TABLE public.nutrition_recipe_ingredients
  ALTER COLUMN recipe_version_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.nutrition_can_read_recipe(_recipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.nutrition_recipes recipe
    WHERE recipe.id = _recipe_id
      AND (
        recipe.user_id = auth.uid()
        OR (
          recipe.visibility = 'global'
          AND recipe.status = 'active'
        )
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.nutrition_can_edit_recipe(_recipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.nutrition_recipes recipe
    WHERE recipe.id = _recipe_id
      AND recipe.user_id = auth.uid()
      AND recipe.status = 'active'
  )
$function$;

ALTER TABLE public.nutrition_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_recipe_nutrients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read nutrition recipes" ON public.nutrition_recipes;
CREATE POLICY "Users can read nutrition recipes"
ON public.nutrition_recipes
FOR SELECT
USING (
  user_id = auth.uid()
  OR (visibility = 'global' AND status = 'active')
);

DROP POLICY IF EXISTS "Users can insert own nutrition recipes" ON public.nutrition_recipes;
CREATE POLICY "Users can insert own nutrition recipes"
ON public.nutrition_recipes
FOR INSERT
WITH CHECK (user_id = auth.uid() AND visibility IN ('private', 'shared'));

DROP POLICY IF EXISTS "Users can update own nutrition recipes" ON public.nutrition_recipes;
CREATE POLICY "Users can update own nutrition recipes"
ON public.nutrition_recipes
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND visibility IN ('private', 'shared'));

DROP POLICY IF EXISTS "Users can delete own nutrition recipes" ON public.nutrition_recipes;
CREATE POLICY "Users can delete own nutrition recipes"
ON public.nutrition_recipes
FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read nutrition recipe ingredients" ON public.nutrition_recipe_ingredients;
DROP POLICY IF EXISTS "Users can insert own nutrition recipe ingredients" ON public.nutrition_recipe_ingredients;
DROP POLICY IF EXISTS "Users can update own nutrition recipe ingredients" ON public.nutrition_recipe_ingredients;
DROP POLICY IF EXISTS "Users can delete own nutrition recipe ingredients" ON public.nutrition_recipe_ingredients;
CREATE POLICY "Users can read nutrition recipe ingredients"
ON public.nutrition_recipe_ingredients
FOR SELECT
USING (public.nutrition_can_read_recipe(recipe_id));

DROP POLICY IF EXISTS "Users can read nutrition recipe versions" ON public.nutrition_recipe_versions;
CREATE POLICY "Users can read nutrition recipe versions"
ON public.nutrition_recipe_versions
FOR SELECT
USING (public.nutrition_can_read_recipe(recipe_id));

DROP POLICY IF EXISTS "Users can read nutrition recipe steps" ON public.nutrition_recipe_steps;
CREATE POLICY "Users can read nutrition recipe steps"
ON public.nutrition_recipe_steps
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.nutrition_recipe_versions version
    WHERE version.id = recipe_version_id
      AND public.nutrition_can_read_recipe(version.recipe_id)
  )
);

DROP POLICY IF EXISTS "Users can read nutrition recipe nutrients" ON public.nutrition_recipe_nutrients;
CREATE POLICY "Users can read nutrition recipe nutrients"
ON public.nutrition_recipe_nutrients
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.nutrition_recipe_versions version
    WHERE version.id = recipe_version_id
      AND public.nutrition_can_read_recipe(version.recipe_id)
  )
);

DROP TRIGGER IF EXISTS handle_nutrition_recipes_updated_at ON public.nutrition_recipes;
CREATE TRIGGER handle_nutrition_recipes_updated_at
  BEFORE UPDATE ON public.nutrition_recipes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_nutrition_recipe_ingredients_updated_at ON public.nutrition_recipe_ingredients;
CREATE TRIGGER handle_nutrition_recipe_ingredients_updated_at
  BEFORE UPDATE ON public.nutrition_recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.search_nutrition_recipes(
  _query text DEFAULT NULL,
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  recipe_id uuid,
  name text,
  description text,
  origin text,
  category text,
  difficulty text,
  meal_types text[],
  visibility text,
  is_owner boolean,
  current_version_id uuid,
  version_number integer,
  servings numeric,
  yield_quantity numeric,
  yield_unit text,
  prep_time_minutes integer,
  cook_time_minutes integer,
  total_time_minutes integer,
  ingredient_count bigint,
  calculation_complete boolean,
  missing_nutrient_codes text[],
  calories_per_serving numeric,
  protein_per_serving numeric,
  carbs_per_serving numeric,
  fat_per_serving numeric,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  WITH params AS (
    SELECT
      COALESCE(public.nutrition_search_normalize(_query), '') AS q,
      LEAST(GREATEST(COALESCE(_limit, 20), 1), 50) AS page_limit,
      GREATEST(COALESCE(_offset, 0), 0) AS page_offset
  ),
  visible AS (
    SELECT recipe.*, version.version_number, version.servings AS version_servings,
           version.yield_quantity, version.yield_unit,
           version.prep_time_minutes, version.cook_time_minutes,
           version.calculation_complete, version.missing_nutrient_codes
    FROM public.nutrition_recipes recipe
    JOIN public.nutrition_recipe_versions version ON version.id = recipe.current_version_id
    CROSS JOIN params
    WHERE recipe.status = 'active'
      AND version.status = 'published'
      AND (recipe.user_id = auth.uid() OR recipe.visibility = 'global')
      AND (
        params.q = ''
        OR public.nutrition_search_normalize(recipe.name) LIKE '%' || params.q || '%'
        OR public.nutrition_search_normalize(recipe.description) LIKE '%' || params.q || '%'
        OR public.nutrition_search_normalize(recipe.category) LIKE '%' || params.q || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(recipe.tags) tag
          WHERE public.nutrition_search_normalize(tag) LIKE '%' || params.q || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM public.nutrition_recipe_ingredients ingredient
          WHERE ingredient.recipe_version_id = version.id
            AND public.nutrition_search_normalize(ingredient.food_name_snapshot) LIKE '%' || params.q || '%'
        )
      )
  )
  SELECT
    visible.id,
    visible.name,
    visible.description,
    visible.origin,
    visible.category,
    visible.difficulty,
    visible.meal_types,
    visible.visibility,
    visible.user_id = auth.uid(),
    visible.current_version_id,
    visible.version_number,
    visible.version_servings,
    visible.yield_quantity,
    visible.yield_unit,
    visible.prep_time_minutes,
    visible.cook_time_minutes,
    COALESCE(visible.prep_time_minutes, 0) + COALESCE(visible.cook_time_minutes, 0),
    (SELECT COUNT(*) FROM public.nutrition_recipe_ingredients ingredient WHERE ingredient.recipe_version_id = visible.current_version_id),
    visible.calculation_complete,
    visible.missing_nutrient_codes,
    (SELECT nutrient.amount_per_serving FROM public.nutrition_recipe_nutrients nutrient JOIN public.nutrition_nutrients definition ON definition.id = nutrient.nutrient_id WHERE nutrient.recipe_version_id = visible.current_version_id AND definition.code = 'energy_kcal'),
    (SELECT nutrient.amount_per_serving FROM public.nutrition_recipe_nutrients nutrient JOIN public.nutrition_nutrients definition ON definition.id = nutrient.nutrient_id WHERE nutrient.recipe_version_id = visible.current_version_id AND definition.code = 'protein_g'),
    (SELECT nutrient.amount_per_serving FROM public.nutrition_recipe_nutrients nutrient JOIN public.nutrition_nutrients definition ON definition.id = nutrient.nutrient_id WHERE nutrient.recipe_version_id = visible.current_version_id AND definition.code = 'carbs_g'),
    (SELECT nutrient.amount_per_serving FROM public.nutrition_recipe_nutrients nutrient JOIN public.nutrition_nutrients definition ON definition.id = nutrient.nutrient_id WHERE nutrient.recipe_version_id = visible.current_version_id AND definition.code = 'fat_g'),
    COUNT(*) OVER ()
  FROM visible
  CROSS JOIN params
  ORDER BY (visible.user_id = auth.uid()) DESC, visible.updated_at DESC, visible.name ASC
  LIMIT (SELECT page_limit FROM params)
  OFFSET (SELECT page_offset FROM params)
$function$;

CREATE OR REPLACE FUNCTION public.get_nutrition_recipe(_recipe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.nutrition_can_read_recipe(_recipe_id) THEN
    RAISE EXCEPTION 'recipe_not_found';
  END IF;

  SELECT jsonb_build_object(
    'id', recipe.id,
    'name', recipe.name,
    'description', recipe.description,
    'origin', recipe.origin,
    'locale', recipe.locale,
    'category', recipe.category,
    'difficulty', recipe.difficulty,
    'imageUrl', recipe.image_url,
    'visibility', recipe.visibility,
    'status', recipe.status,
    'tags', to_jsonb(recipe.tags),
    'mealTypes', to_jsonb(recipe.meal_types),
    'dietaryLabels', to_jsonb(recipe.dietary_labels),
    'allergens', to_jsonb(recipe.allergens),
    'attributeEvaluationComplete', recipe.attribute_evaluation_complete,
    'isOwner', recipe.user_id = auth.uid(),
    'sourceRecipeId', recipe.source_recipe_id,
    'currentVersionId', version.id,
    'version', jsonb_build_object(
      'id', version.id,
      'versionNumber', version.version_number,
      'status', version.status,
      'servings', version.servings,
      'yieldQuantity', version.yield_quantity,
      'yieldUnit', version.yield_unit,
      'finalWeightGrams', version.total_weight_g,
      'finalVolumeMilliliters', version.total_volume_ml,
      'ingredientWeightGrams', version.ingredient_weight_g,
      'prepTimeMinutes', version.prep_time_minutes,
      'cookTimeMinutes', version.cook_time_minutes,
      'totalTimeMinutes', COALESCE(version.prep_time_minutes, 0) + COALESCE(version.cook_time_minutes, 0),
      'calculationComplete', version.calculation_complete,
      'missingNutrientCodes', to_jsonb(version.missing_nutrient_codes),
      'calculatedAt', version.calculated_at,
      'notes', version.notes,
      'createdAt', version.created_at,
      'publishedAt', version.published_at
    ),
    'ingredients', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ingredient.id,
          'canonicalGroupId', ingredient.canonical_group_id,
          'foodId', ingredient.food_id,
          'servingId', ingredient.serving_id,
          'unitId', ingredient.unit_id,
          'foodName', ingredient.food_name_snapshot,
          'servingLabel', ingredient.serving_label_snapshot,
          'unitLabel', ingredient.unit_label_snapshot,
          'quantity', ingredient.quantity,
          'grams', ingredient.grams,
          'milliliters', ingredient.milliliters,
          'orderIndex', ingredient.order_index,
          'notes', ingredient.notes,
          'nutrients', ingredient.nutrient_snapshot,
          'verificationStatus', food.verification_status
        )
        ORDER BY ingredient.order_index
      )
      FROM public.nutrition_recipe_ingredients ingredient
      LEFT JOIN public.nutrition_foods food ON food.id = ingredient.food_id
      WHERE ingredient.recipe_version_id = version.id
    ), '[]'::jsonb),
    'steps', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', step.id,
          'stepNumber', step.step_number,
          'instruction', step.instruction,
          'durationMinutes', step.duration_minutes
        )
        ORDER BY step.step_number
      )
      FROM public.nutrition_recipe_steps step
      WHERE step.recipe_version_id = version.id
    ), '[]'::jsonb),
    'nutrients', COALESCE((
      SELECT jsonb_object_agg(
        definition.code,
        jsonb_build_object(
          'name', definition.name,
          'unit', definition.unit,
          'total', nutrient.total_amount,
          'perServing', nutrient.amount_per_serving,
          'per100g', nutrient.amount_per_100g
        )
      )
      FROM public.nutrition_recipe_nutrients nutrient
      JOIN public.nutrition_nutrients definition ON definition.id = nutrient.nutrient_id
      WHERE nutrient.recipe_version_id = version.id
    ), '{}'::jsonb)
  )
  INTO result
  FROM public.nutrition_recipes recipe
  JOIN public.nutrition_recipe_versions version ON version.id = recipe.current_version_id
  WHERE recipe.id = _recipe_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'recipe_version_not_found';
  END IF;

  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION public.save_nutrition_recipe(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_id_value uuid := auth.uid();
  recipe_id_value uuid;
  version_id_value uuid;
  prior_version_id uuid;
  client_request_id_value uuid;
  recipe_name_value text;
  recipe_description_value text;
  recipe_category_value text;
  recipe_difficulty_value text;
  visibility_value text;
  servings_value numeric;
  yield_quantity_value numeric;
  yield_unit_value text;
  final_weight_value numeric;
  final_volume_value numeric;
  prep_time_value integer;
  cook_time_value integer;
  notes_value text;
  tags_value text[];
  meal_types_value text[];
  source_recipe_id_value uuid;
  ingredients_value jsonb;
  steps_value jsonb;
  ingredient_value jsonb;
  ingredient_order integer := 0;
  food_id_value uuid;
  group_id_value uuid;
  serving_id_value uuid;
  unit_id_value uuid;
  quantity_value numeric;
  serving_quantity_value numeric;
  serving_grams_value numeric;
  serving_milliliters_value numeric;
  unit_grams_multiplier_value numeric;
  unit_milliliters_multiplier_value numeric;
  consumed_grams_value numeric;
  consumed_milliliters_value numeric;
  food_name_value text;
  serving_label_value text;
  unit_label_value text;
  nutrient_snapshot_value jsonb;
  total_weight_value numeric;
  version_number_value integer;
  missing_nutrient_codes_value text[];
BEGIN
  IF user_id_value IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_recipe_payload';
  END IF;

  client_request_id_value := NULLIF(_payload ->> 'clientRequestId', '')::uuid;
  IF client_request_id_value IS NULL THEN
    RAISE EXCEPTION 'client_request_id_required';
  END IF;

  SELECT version.id, recipe.id, version.version_number
  INTO version_id_value, recipe_id_value, version_number_value
  FROM public.nutrition_recipe_versions version
  JOIN public.nutrition_recipes recipe ON recipe.id = version.recipe_id
  WHERE version.client_request_id = client_request_id_value
    AND recipe.user_id = user_id_value;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'recipeId', recipe_id_value,
      'recipeVersionId', version_id_value,
      'versionNumber', version_number_value,
      'deduplicated', true
    );
  END IF;

  recipe_name_value := NULLIF(btrim(_payload ->> 'name'), '');
  recipe_description_value := NULLIF(btrim(_payload ->> 'description'), '');
  recipe_category_value := NULLIF(btrim(_payload ->> 'category'), '');
  recipe_difficulty_value := NULLIF(btrim(_payload ->> 'difficulty'), '');
  -- User recipes remain private until a moderated sharing flow exists.
  visibility_value := 'private';
  servings_value := COALESCE(NULLIF(_payload ->> 'servings', '')::numeric, 1);
  yield_quantity_value := NULLIF(_payload ->> 'yieldQuantity', '')::numeric;
  yield_unit_value := NULLIF(btrim(_payload ->> 'yieldUnit'), '');
  final_weight_value := NULLIF(_payload ->> 'finalWeightGrams', '')::numeric;
  final_volume_value := NULLIF(_payload ->> 'finalVolumeMilliliters', '')::numeric;
  prep_time_value := NULLIF(_payload ->> 'prepTimeMinutes', '')::integer;
  cook_time_value := NULLIF(_payload ->> 'cookTimeMinutes', '')::integer;
  notes_value := NULLIF(btrim(_payload ->> 'notes'), '');
  ingredients_value := COALESCE(_payload -> 'ingredients', '[]'::jsonb);
  steps_value := COALESCE(_payload -> 'steps', '[]'::jsonb);

  IF jsonb_typeof(COALESCE(_payload -> 'tags', '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(_payload -> 'mealTypes', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid_recipe_classification';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT btrim(value)) FILTER (WHERE btrim(value) <> ''), '{}'::text[])
  INTO tags_value
  FROM jsonb_array_elements_text(COALESCE(_payload -> 'tags', '[]'::jsonb)) tag(value);

  SELECT COALESCE(array_agg(DISTINCT value) FILTER (
    WHERE value IN ('desayuno', 'colacion_am', 'comida', 'colacion_pm', 'cena')
  ), '{}'::text[])
  INTO meal_types_value
  FROM jsonb_array_elements_text(COALESCE(_payload -> 'mealTypes', '[]'::jsonb)) meal_type(value);

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(_payload -> 'mealTypes', '[]'::jsonb)) meal_type(value)
    WHERE value NOT IN ('desayuno', 'colacion_am', 'comida', 'colacion_pm', 'cena')
  ) THEN
    RAISE EXCEPTION 'invalid_recipe_meal_type';
  END IF;

  IF recipe_name_value IS NULL OR char_length(recipe_name_value) > 120 THEN
    RAISE EXCEPTION 'invalid_recipe_name';
  END IF;
  IF recipe_description_value IS NOT NULL AND char_length(recipe_description_value) > 2000 THEN
    RAISE EXCEPTION 'invalid_recipe_description';
  END IF;
  IF visibility_value NOT IN ('private', 'shared') THEN
    RAISE EXCEPTION 'invalid_recipe_visibility';
  END IF;
  IF recipe_difficulty_value IS NOT NULL
     AND recipe_difficulty_value NOT IN ('facil', 'intermedia', 'avanzada') THEN
    RAISE EXCEPTION 'invalid_recipe_difficulty';
  END IF;
  IF servings_value <= 0 OR servings_value > 1000 THEN
    RAISE EXCEPTION 'invalid_recipe_servings';
  END IF;
  IF yield_quantity_value IS NOT NULL AND yield_quantity_value <= 0 THEN
    RAISE EXCEPTION 'invalid_recipe_yield';
  END IF;
  IF final_weight_value IS NOT NULL AND final_weight_value <= 0 THEN
    RAISE EXCEPTION 'invalid_recipe_final_weight';
  END IF;
  IF final_volume_value IS NOT NULL AND final_volume_value <= 0 THEN
    RAISE EXCEPTION 'invalid_recipe_final_volume';
  END IF;
  IF prep_time_value IS NOT NULL AND (prep_time_value < 0 OR prep_time_value > 10080) THEN
    RAISE EXCEPTION 'invalid_recipe_prep_time';
  END IF;
  IF cook_time_value IS NOT NULL AND (cook_time_value < 0 OR cook_time_value > 10080) THEN
    RAISE EXCEPTION 'invalid_recipe_cook_time';
  END IF;
  IF jsonb_typeof(ingredients_value) <> 'array'
     OR jsonb_array_length(ingredients_value) < 1
     OR jsonb_array_length(ingredients_value) > 100 THEN
    RAISE EXCEPTION 'invalid_recipe_ingredients';
  END IF;
  IF jsonb_typeof(steps_value) <> 'array'
     OR jsonb_array_length(steps_value) < 1
     OR jsonb_array_length(steps_value) > 50 THEN
    RAISE EXCEPTION 'invalid_recipe_steps';
  END IF;

  recipe_id_value := NULLIF(_payload ->> 'recipeId', '')::uuid;
  source_recipe_id_value := NULLIF(_payload ->> 'sourceRecipeId', '')::uuid;

  IF source_recipe_id_value IS NOT NULL
     AND NOT public.nutrition_can_read_recipe(source_recipe_id_value) THEN
    source_recipe_id_value := NULL;
  END IF;

  IF recipe_id_value IS NULL THEN
    INSERT INTO public.nutrition_recipes (
      user_id,
      name,
      normalized_name,
      description,
      origin,
      locale,
      category,
      difficulty,
      visibility,
      status,
      servings,
      tags,
      meal_types,
      dietary_labels,
      allergens,
      attribute_evaluation_complete,
      source_recipe_id,
      metadata
    )
    VALUES (
      user_id_value,
      recipe_name_value,
      public.nutrition_search_normalize(recipe_name_value),
      recipe_description_value,
      CASE WHEN source_recipe_id_value IS NULL THEN 'user' ELSE 'duplicated' END,
      'es-MX',
      recipe_category_value,
      recipe_difficulty_value,
      visibility_value,
      'active',
      servings_value,
      tags_value,
      meal_types_value,
      '{}'::text[],
      '{}'::text[],
      false,
      source_recipe_id_value,
      jsonb_build_object('created_by', 'beta_nutrition_sprint3')
    )
    RETURNING id INTO recipe_id_value;
    version_number_value := 1;
    prior_version_id := NULL;
  ELSE
    SELECT recipe.current_version_id
    INTO prior_version_id
    FROM public.nutrition_recipes recipe
    WHERE recipe.id = recipe_id_value
      AND recipe.user_id = user_id_value
      AND recipe.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'recipe_not_editable';
    END IF;

    SELECT COALESCE(MAX(version.version_number), 0) + 1
    INTO version_number_value
    FROM public.nutrition_recipe_versions version
    WHERE version.recipe_id = recipe_id_value;
  END IF;

  INSERT INTO public.nutrition_recipe_versions (
    recipe_id,
    version_number,
    status,
    servings,
    yield_quantity,
    yield_unit,
    total_weight_g,
    total_volume_ml,
    prep_time_minutes,
    cook_time_minutes,
    notes,
    client_request_id,
    created_by,
    published_at,
    metadata
  )
  VALUES (
    recipe_id_value,
    version_number_value,
    'published',
    servings_value,
    yield_quantity_value,
    yield_unit_value,
    final_weight_value,
    final_volume_value,
    prep_time_value,
    cook_time_value,
    notes_value,
    client_request_id_value,
    user_id_value,
    now(),
    jsonb_build_object('calculation_basis', 'food_nutrients_per_100g')
  )
  RETURNING id INTO version_id_value;

  FOR ingredient_value IN
    SELECT value FROM jsonb_array_elements(ingredients_value)
  LOOP
    ingredient_order := ingredient_order + 1;
    group_id_value := NULLIF(ingredient_value ->> 'canonicalGroupId', '')::uuid;
    food_id_value := NULLIF(ingredient_value ->> 'foodId', '')::uuid;
    serving_id_value := NULLIF(ingredient_value ->> 'servingId', '')::uuid;
    quantity_value := NULLIF(ingredient_value ->> 'quantity', '')::numeric;

    IF group_id_value IS NULL OR food_id_value IS NULL OR serving_id_value IS NULL
       OR quantity_value IS NULL OR quantity_value <= 0 OR quantity_value > 1000 THEN
      RAISE EXCEPTION 'invalid_recipe_ingredient_at_position_%', ingredient_order;
    END IF;

    SELECT
      serving.unit_id,
      serving.quantity,
      serving.grams,
      serving.milliliters,
      unit.grams_multiplier,
      unit.milliliters_multiplier,
      food.display_name,
      serving.serving_label,
      unit.name
    INTO
      unit_id_value,
      serving_quantity_value,
      serving_grams_value,
      serving_milliliters_value,
      unit_grams_multiplier_value,
      unit_milliliters_multiplier_value,
      food_name_value,
      serving_label_value,
      unit_label_value
    FROM public.nutrition_foods food
    JOIN public.nutrition_food_group_members member
      ON member.food_id = food.id
     AND member.group_id = group_id_value
    JOIN public.nutrition_canonical_food_groups food_group ON food_group.id = member.group_id
    JOIN public.nutrition_food_servings serving
      ON serving.id = serving_id_value
     AND serving.food_id = food.id
    JOIN public.nutrition_units unit ON unit.id = serving.unit_id
    WHERE food.id = food_id_value
      AND food_group.status = 'active'
      AND member.is_ui_visible IS TRUE
      AND food.is_visible IS TRUE
      AND food.verification_status NOT IN ('deprecated', 'rejected')
      AND serving.verification_status NOT IN ('deprecated', 'rejected')
      AND (food.scope = 'global' OR food.owner_user_id = user_id_value);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_recipe_catalog_selection_at_position_%', ingredient_order;
    END IF;

    serving_grams_value := COALESCE(serving_grams_value, serving_quantity_value * unit_grams_multiplier_value);
    IF serving_grams_value IS NULL OR serving_grams_value <= 0 THEN
      RAISE EXCEPTION 'recipe_serving_without_gram_equivalence_at_position_%', ingredient_order;
    END IF;

    consumed_grams_value := round((serving_grams_value * quantity_value)::numeric, 4);
    serving_milliliters_value := COALESCE(
      serving_milliliters_value,
      serving_quantity_value * unit_milliliters_multiplier_value
    );
    consumed_milliliters_value := CASE
      WHEN serving_milliliters_value IS NULL THEN NULL
      ELSE round((serving_milliliters_value * quantity_value)::numeric, 4)
    END;

    SELECT COALESCE(
      jsonb_object_agg(
        nutrient.code,
        jsonb_build_object(
          'name', nutrient.name,
          'unit', nutrient.unit,
          'amount', round((food_nutrient.amount_per_100g * consumed_grams_value / 100)::numeric, 4)
        )
      ),
      '{}'::jsonb
    )
    INTO nutrient_snapshot_value
    FROM public.nutrition_food_nutrients food_nutrient
    JOIN public.nutrition_nutrients nutrient ON nutrient.id = food_nutrient.nutrient_id
    WHERE food_nutrient.food_id = food_id_value
      AND food_nutrient.verification_status NOT IN ('deprecated', 'rejected');

    INSERT INTO public.nutrition_recipe_ingredients (
      recipe_id,
      recipe_version_id,
      canonical_group_id,
      food_id,
      serving_id,
      unit_id,
      ingredient_name,
      food_name_snapshot,
      serving_label_snapshot,
      unit_label_snapshot,
      quantity,
      grams,
      milliliters,
      order_index,
      notes,
      nutrient_snapshot
    )
    VALUES (
      recipe_id_value,
      version_id_value,
      group_id_value,
      food_id_value,
      serving_id_value,
      unit_id_value,
      food_name_value,
      food_name_value,
      serving_label_value,
      unit_label_value,
      quantity_value,
      consumed_grams_value,
      consumed_milliliters_value,
      ingredient_order,
      NULLIF(btrim(ingredient_value ->> 'notes'), ''),
      nutrient_snapshot_value
    );
  END LOOP;

  INSERT INTO public.nutrition_recipe_steps (recipe_version_id, step_number, instruction)
  SELECT
    version_id_value,
    step.ordinality::integer,
    btrim(step.value)
  FROM jsonb_array_elements_text(steps_value) WITH ORDINALITY AS step(value, ordinality)
  WHERE btrim(step.value) <> '';

  IF (SELECT COUNT(*) FROM public.nutrition_recipe_steps WHERE recipe_version_id = version_id_value) <> jsonb_array_length(steps_value) THEN
    RAISE EXCEPTION 'recipe_steps_cannot_be_empty';
  END IF;

  INSERT INTO public.nutrition_recipe_nutrients (
    recipe_version_id,
    nutrient_id,
    total_amount,
    amount_per_serving,
    amount_per_100g
  )
  SELECT
    version_id_value,
    food_nutrient.nutrient_id,
    round(SUM(food_nutrient.amount_per_100g * ingredient.grams / 100)::numeric, 4),
    round((SUM(food_nutrient.amount_per_100g * ingredient.grams / 100) / servings_value)::numeric, 4),
    CASE
      WHEN final_weight_value IS NULL THEN NULL
      ELSE round((SUM(food_nutrient.amount_per_100g * ingredient.grams / 100) / final_weight_value * 100)::numeric, 4)
    END
  FROM public.nutrition_recipe_ingredients ingredient
  JOIN public.nutrition_food_nutrients food_nutrient ON food_nutrient.food_id = ingredient.food_id
  WHERE ingredient.recipe_version_id = version_id_value
    AND food_nutrient.verification_status NOT IN ('deprecated', 'rejected')
  GROUP BY food_nutrient.nutrient_id;

  SELECT ARRAY(
    SELECT required.code
    FROM unnest(ARRAY['energy_kcal', 'protein_g', 'carbs_g', 'fat_g']) required(code)
    WHERE EXISTS (
      SELECT 1
      FROM public.nutrition_recipe_ingredients ingredient
      WHERE ingredient.recipe_version_id = version_id_value
        AND NOT (ingredient.nutrient_snapshot ? required.code)
    )
    ORDER BY required.code
  )
  INTO missing_nutrient_codes_value;

  SELECT SUM(ingredient.grams)
  INTO total_weight_value
  FROM public.nutrition_recipe_ingredients ingredient
  WHERE ingredient.recipe_version_id = version_id_value;

  UPDATE public.nutrition_recipe_versions
  SET
    ingredient_weight_g = total_weight_value,
    calculation_complete = cardinality(missing_nutrient_codes_value) = 0,
    missing_nutrient_codes = missing_nutrient_codes_value,
    calculated_at = now()
  WHERE id = version_id_value;

  IF prior_version_id IS NOT NULL THEN
    UPDATE public.nutrition_recipe_versions
    SET status = 'archived'
    WHERE id = prior_version_id
      AND status = 'published';
  END IF;

  UPDATE public.nutrition_recipes
  SET
    name = recipe_name_value,
    normalized_name = public.nutrition_search_normalize(recipe_name_value),
    description = recipe_description_value,
    category = recipe_category_value,
    difficulty = recipe_difficulty_value,
    visibility = visibility_value,
    servings = servings_value,
    total_weight_g = final_weight_value,
    instructions = ARRAY(
      SELECT step.value
      FROM jsonb_array_elements_text(steps_value) WITH ORDINALITY AS step(value, ordinality)
      ORDER BY step.ordinality
    ),
    tags = tags_value,
    meal_types = meal_types_value,
    dietary_labels = '{}'::text[],
    allergens = '{}'::text[],
    attribute_evaluation_complete = false,
    current_version_id = version_id_value,
    published_at = COALESCE(published_at, now()),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_version_number', version_number_value),
    updated_at = now()
  WHERE id = recipe_id_value;

  RETURN jsonb_build_object(
    'recipeId', recipe_id_value,
    'recipeVersionId', version_id_value,
    'versionNumber', version_number_value,
    'deduplicated', false
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.duplicate_nutrition_recipe(
  _recipe_id uuid,
  _client_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  source_recipe public.nutrition_recipes%ROWTYPE;
  source_version public.nutrition_recipe_versions%ROWTYPE;
  payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _client_request_id IS NULL THEN
    RAISE EXCEPTION 'client_request_id_required';
  END IF;
  IF NOT public.nutrition_can_read_recipe(_recipe_id) THEN
    RAISE EXCEPTION 'recipe_not_found';
  END IF;

  SELECT * INTO source_recipe
  FROM public.nutrition_recipes
  WHERE id = _recipe_id;

  SELECT * INTO source_version
  FROM public.nutrition_recipe_versions
  WHERE id = source_recipe.current_version_id;

  payload := jsonb_build_object(
    'clientRequestId', _client_request_id,
    'name', left('Copia de ' || source_recipe.name, 120),
    'description', source_recipe.description,
    'category', source_recipe.category,
    'difficulty', source_recipe.difficulty,
    'visibility', 'private',
    'servings', source_version.servings,
    'yieldQuantity', source_version.yield_quantity,
    'yieldUnit', source_version.yield_unit,
    'finalWeightGrams', source_version.total_weight_g,
    'finalVolumeMilliliters', source_version.total_volume_ml,
    'prepTimeMinutes', source_version.prep_time_minutes,
    'cookTimeMinutes', source_version.cook_time_minutes,
    'notes', source_version.notes,
    'tags', to_jsonb(source_recipe.tags),
    'mealTypes', to_jsonb(source_recipe.meal_types),
    'sourceRecipeId', source_recipe.id,
    'ingredients', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'canonicalGroupId', ingredient.canonical_group_id,
          'foodId', ingredient.food_id,
          'servingId', ingredient.serving_id,
          'quantity', ingredient.quantity,
          'notes', ingredient.notes
        )
        ORDER BY ingredient.order_index
      )
      FROM public.nutrition_recipe_ingredients ingredient
      WHERE ingredient.recipe_version_id = source_version.id
    ), '[]'::jsonb),
    'steps', COALESCE((
      SELECT jsonb_agg(to_jsonb(step.instruction) ORDER BY step.step_number)
      FROM public.nutrition_recipe_steps step
      WHERE step.recipe_version_id = source_version.id
    ), '[]'::jsonb)
  );

  RETURN public.save_nutrition_recipe(payload);
END
$function$;

CREATE OR REPLACE FUNCTION public.archive_nutrition_recipe(_recipe_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.nutrition_can_edit_recipe(_recipe_id) THEN
    RAISE EXCEPTION 'recipe_not_editable';
  END IF;

  UPDATE public.nutrition_recipes
  SET status = 'archived', archived_at = now(), updated_at = now()
  WHERE id = _recipe_id
    AND user_id = auth.uid();
END
$function$;

CREATE OR REPLACE FUNCTION public.register_nutrition_recipe_meal(
  _recipe_id uuid,
  _recipe_version_id uuid,
  _servings numeric,
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
  user_id_value uuid := auth.uid();
  recipe_name_value text;
  version_id_value uuid;
  version_servings_value numeric;
  total_weight_value numeric;
  consumed_weight_value numeric;
  calories_value numeric;
  protein_value numeric;
  carbs_value numeric;
  fat_value numeric;
  fiber_value numeric;
  sugar_value numeric;
  sodium_value numeric;
  all_verified_value boolean;
  calculation_complete_value boolean;
  nutrition_log_id_value uuid;
  nutrition_item_id_value uuid;
  legacy_meal_id_value uuid;
  legacy_ingredient_id_value uuid;
BEGIN
  IF user_id_value IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _client_request_id IS NULL THEN
    RAISE EXCEPTION 'client_request_id_required';
  END IF;
  IF _servings IS NULL OR _servings <= 0 OR _servings > 1000 THEN
    RAISE EXCEPTION 'invalid_recipe_registration_servings';
  END IF;
  IF _meal_type NOT IN ('desayuno', 'colacion_am', 'comida', 'colacion_pm', 'cena') THEN
    RAISE EXCEPTION 'invalid_meal_type';
  END IF;
  IF _logged_date IS NULL OR _logged_date < CURRENT_DATE - 3650 OR _logged_date > CURRENT_DATE + 3650 THEN
    RAISE EXCEPTION 'invalid_logged_date';
  END IF;
  IF NOT public.nutrition_can_read_recipe(_recipe_id) THEN
    RAISE EXCEPTION 'recipe_not_found';
  END IF;

  SELECT
    recipe.name,
    version.id,
    version.servings,
    version.total_weight_g,
    version.calculation_complete
  INTO
    recipe_name_value,
    version_id_value,
    version_servings_value,
    total_weight_value,
    calculation_complete_value
  FROM public.nutrition_recipes recipe
  JOIN public.nutrition_recipe_versions version
    ON version.id = COALESCE(_recipe_version_id, recipe.current_version_id)
   AND version.recipe_id = recipe.id
  WHERE recipe.id = _recipe_id
    AND recipe.status = 'active'
    AND version.status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipe_version_not_available';
  END IF;

  IF calculation_complete_value IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'recipe_calculation_incomplete';
  END IF;

  SELECT
    MAX(nutrient.amount_per_serving) FILTER (WHERE definition.code = 'energy_kcal'),
    MAX(nutrient.amount_per_serving) FILTER (WHERE definition.code = 'protein_g'),
    MAX(nutrient.amount_per_serving) FILTER (WHERE definition.code = 'carbs_g'),
    MAX(nutrient.amount_per_serving) FILTER (WHERE definition.code = 'fat_g'),
    MAX(nutrient.amount_per_serving) FILTER (WHERE definition.code = 'fiber_g'),
    MAX(nutrient.amount_per_serving) FILTER (WHERE definition.code = 'sugar_g'),
    MAX(nutrient.amount_per_serving) FILTER (WHERE definition.code = 'sodium_mg')
  INTO
    calories_value,
    protein_value,
    carbs_value,
    fat_value,
    fiber_value,
    sugar_value,
    sodium_value
  FROM public.nutrition_recipe_nutrients nutrient
  JOIN public.nutrition_nutrients definition ON definition.id = nutrient.nutrient_id
  WHERE nutrient.recipe_version_id = version_id_value;

  IF calories_value IS NULL OR protein_value IS NULL OR carbs_value IS NULL OR fat_value IS NULL THEN
    RAISE EXCEPTION 'recipe_missing_core_nutrients';
  END IF;

  calories_value := round((calories_value * _servings)::numeric, 2);
  protein_value := round((protein_value * _servings)::numeric, 2);
  carbs_value := round((carbs_value * _servings)::numeric, 2);
  fat_value := round((fat_value * _servings)::numeric, 2);
  fiber_value := CASE WHEN fiber_value IS NULL THEN NULL ELSE round((fiber_value * _servings)::numeric, 2) END;
  sugar_value := CASE WHEN sugar_value IS NULL THEN NULL ELSE round((sugar_value * _servings)::numeric, 2) END;
  sodium_value := CASE WHEN sodium_value IS NULL THEN NULL ELSE round((sodium_value * _servings)::numeric, 2) END;
  consumed_weight_value := CASE
    WHEN total_weight_value IS NULL THEN NULL
    ELSE round((total_weight_value / version_servings_value * _servings)::numeric, 4)
  END;

  SELECT COALESCE(bool_and(food.is_verified), false)
  INTO all_verified_value
  FROM public.nutrition_recipe_ingredients ingredient
  JOIN public.nutrition_foods food ON food.id = ingredient.food_id
  WHERE ingredient.recipe_version_id = version_id_value;

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
    user_id_value,
    _meal_type,
    recipe_name_value,
    _logged_date,
    calories_value,
    protein_value,
    carbs_value,
    fat_value,
    fiber_value,
    sugar_value,
    sodium_value,
    'nutrition_recipe',
    _client_request_id,
    jsonb_build_object(
      'recipeId', _recipe_id,
      'recipeVersionId', version_id_value,
      'recipeNameSnapshot', recipe_name_value,
      'servingsConsumed', _servings,
      'consumedWeightGrams', consumed_weight_value
    )
  )
  ON CONFLICT (client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING
  RETURNING id INTO nutrition_log_id_value;

  IF nutrition_log_id_value IS NULL THEN
    SELECT id, legacy_meal_id
    INTO nutrition_log_id_value, legacy_meal_id_value
    FROM public.nutrition_meal_logs
    WHERE client_request_id = _client_request_id
      AND user_id = user_id_value;

    IF nutrition_log_id_value IS NULL THEN
      RAISE EXCEPTION 'client_request_conflict';
    END IF;

    RETURN jsonb_build_object(
      'nutritionMealLogId', nutrition_log_id_value,
      'legacyMealId', legacy_meal_id_value,
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
    user_id_value,
    _meal_type::public.meal_type,
    recipe_name_value || ' (' || trim(to_char(_servings, 'FM999999990.####')) || ' porciones)',
    calories_value,
    protein_value,
    carbs_value,
    fat_value,
    _logged_date
  )
  RETURNING id INTO legacy_meal_id_value;

  UPDATE public.nutrition_meal_logs
  SET legacy_meal_id = legacy_meal_id_value
  WHERE id = nutrition_log_id_value;

  INSERT INTO public.meal_ingredients (
    meal_id,
    user_id,
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
    legacy_meal_id_value,
    user_id_value,
    recipe_name_value,
    'nutrition_recipe',
    all_verified_value,
    _servings,
    'porción',
    COALESCE(consumed_weight_value, 1),
    calories_value,
    protein_value,
    carbs_value,
    fat_value,
    fiber_value,
    sugar_value,
    sodium_value,
    jsonb_build_object(
      'recipeId', _recipe_id,
      'recipeVersionId', version_id_value,
      'nutritionMealLogId', nutrition_log_id_value,
      'clientRequestId', _client_request_id
    )
  )
  RETURNING id INTO legacy_ingredient_id_value;

  INSERT INTO public.nutrition_meal_log_items (
    legacy_meal_ingredient_id,
    meal_log_id,
    recipe_id,
    recipe_version_id,
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
    legacy_ingredient_id_value,
    nutrition_log_id_value,
    _recipe_id,
    version_id_value,
    recipe_name_value,
    _servings,
    'porción',
    consumed_weight_value,
    calories_value,
    protein_value,
    carbs_value,
    fat_value,
    fiber_value,
    sugar_value,
    sodium_value,
    'nutrition_recipe',
    all_verified_value,
    jsonb_build_object(
      'recipeNameSnapshot', recipe_name_value,
      'servingsConsumed', _servings,
      'clientRequestId', _client_request_id
    )
  )
  RETURNING id INTO nutrition_item_id_value;

  RETURN jsonb_build_object(
    'nutritionMealLogId', nutrition_log_id_value,
    'nutritionMealLogItemId', nutrition_item_id_value,
    'legacyMealId', legacy_meal_id_value,
    'legacyMealIngredientId', legacy_ingredient_id_value,
    'recipeId', _recipe_id,
    'recipeVersionId', version_id_value,
    'servings', _servings,
    'calories', calories_value,
    'protein', protein_value,
    'carbs', carbs_value,
    'fat', fat_value,
    'deduplicated', false
  );
END
$function$;

REVOKE ALL ON FUNCTION public.nutrition_can_read_recipe(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nutrition_can_edit_recipe(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_nutrition_recipes(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_nutrition_recipe(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_nutrition_recipe(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.duplicate_nutrition_recipe(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_nutrition_recipe(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_nutrition_recipe_meal(uuid, uuid, numeric, text, date, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.nutrition_can_read_recipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nutrition_can_edit_recipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_nutrition_recipes(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nutrition_recipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_nutrition_recipe(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_nutrition_recipe(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_nutrition_recipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_nutrition_recipe_meal(uuid, uuid, numeric, text, date, uuid) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.nutrition_recipe_versions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.nutrition_recipes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.nutrition_recipe_ingredients FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.nutrition_recipe_steps FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.nutrition_recipe_nutrients FROM authenticated;

GRANT SELECT ON public.nutrition_recipes TO authenticated;
GRANT SELECT ON public.nutrition_recipe_versions TO authenticated;
GRANT SELECT ON public.nutrition_recipe_ingredients TO authenticated;
GRANT SELECT ON public.nutrition_recipe_steps TO authenticated;
GRANT SELECT ON public.nutrition_recipe_nutrients TO authenticated;

COMMENT ON TABLE public.nutrition_recipe_versions IS
  'Immutable recipe revisions used to preserve composition and historical meal references.';
COMMENT ON TABLE public.nutrition_recipe_steps IS
  'Ordered preparation instructions for an immutable recipe version.';
COMMENT ON TABLE public.nutrition_recipe_nutrients IS
  'Server-calculated nutrient totals and per-serving amounts for a recipe version.';
COMMENT ON FUNCTION public.save_nutrition_recipe(jsonb) IS
  'Creates a recipe or publishes a new immutable version after validating catalog selections and recalculating nutrients.';
COMMENT ON FUNCTION public.register_nutrition_recipe_meal(uuid, uuid, numeric, text, date, uuid) IS
  'Registers recipe portions using immutable version nutrients and writes the nutrition plus legacy snapshots atomically.';

COMMIT;
