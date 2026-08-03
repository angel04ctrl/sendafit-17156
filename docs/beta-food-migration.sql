-- Beta Nutrition Sprint 1B - Arquitectura nueva de nutricion.
-- Ejecutar en Supabase SQL Editor solo cuando se apruebe el diseno.
-- Seguro por diseno: no borra ni reemplaza tablas legacy; crea tablas nutrition_* y copia referencias.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nutrition_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'catalog',
  license text,
  version text,
  url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_sources_type_check
    CHECK (source_type IN ('catalog', 'legacy', 'user', 'ai', 'manual', 'external_api'))
);

CREATE TABLE IF NOT EXISTS public.nutrition_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL,
  brand_type text NOT NULL DEFAULT 'brand',
  country_code text,
  website_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_brands_type_check
    CHECK (brand_type IN ('brand', 'restaurant', 'store', 'manufacturer', 'unknown'))
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_brands_normalized_name_idx
  ON public.nutrition_brands (normalized_name);

CREATE TABLE IF NOT EXISTS public.nutrition_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.nutrition_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  category_level text NOT NULL DEFAULT 'category',
  locale text NOT NULL DEFAULT 'es-MX',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_categories_level_check
    CHECK (category_level IN ('category', 'subcategory', 'preparation', 'dietary_tag'))
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_categories_parent_normalized_idx
  ON public.nutrition_categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), normalized_name, category_level);

CREATE TABLE IF NOT EXISTS public.nutrition_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  dimension text NOT NULL DEFAULT 'custom',
  grams_multiplier numeric,
  milliliters_multiplier numeric,
  is_metric boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_units_dimension_check
    CHECK (dimension IN ('mass', 'volume', 'count', 'energy', 'custom'))
);

CREATE TABLE IF NOT EXISTS public.nutrition_nutrients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  unit text NOT NULL,
  nutrient_group text NOT NULL DEFAULT 'macro',
  display_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_nutrients_group_check
    CHECK (nutrient_group IN ('energy', 'macro', 'fiber', 'mineral', 'vitamin', 'other'))
);

CREATE TABLE IF NOT EXISTS public.nutrition_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_food_id integer UNIQUE REFERENCES public.foods(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.nutrition_sources(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.nutrition_brands(id) ON DELETE SET NULL,
  source_external_id text,
  food_kind text NOT NULL DEFAULT 'generic',
  scope text NOT NULL DEFAULT 'global',
  canonical_name text NOT NULL,
  display_name text NOT NULL,
  normalized_name text NOT NULL,
  locale text NOT NULL DEFAULT 'es-MX',
  description text,
  preparation_state text,
  search_text text,
  confidence_score numeric,
  is_verified boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  is_common boolean NOT NULL DEFAULT false,
  visibility_priority integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_foods_kind_check
    CHECK (food_kind IN ('generic', 'branded', 'restaurant', 'recipe', 'user_custom', 'ai_estimated')),
  CONSTRAINT nutrition_foods_scope_check
    CHECK (scope IN ('global', 'user')),
  CONSTRAINT nutrition_foods_owner_scope_check
    CHECK ((scope = 'global' AND owner_user_id IS NULL) OR (scope = 'user' AND owner_user_id IS NOT NULL)),
  CONSTRAINT nutrition_foods_confidence_check
    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS nutrition_foods_search_idx
  ON public.nutrition_foods (scope, owner_user_id, is_visible, normalized_name);
CREATE INDEX IF NOT EXISTS nutrition_foods_legacy_food_id_idx
  ON public.nutrition_foods (legacy_food_id);

CREATE TABLE IF NOT EXISTS public.nutrition_food_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  locale text NOT NULL DEFAULT 'es-MX',
  source text NOT NULL DEFAULT 'catalog',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (food_id, normalized_alias, locale)
);

CREATE TABLE IF NOT EXISTS public.nutrition_food_categories (
  food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.nutrition_categories(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (food_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.nutrition_food_servings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.nutrition_units(id) ON DELETE RESTRICT,
  serving_label text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  grams numeric,
  milliliters numeric,
  is_default boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'catalog',
  confidence_score numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_food_servings_quantity_check CHECK (quantity > 0),
  CONSTRAINT nutrition_food_servings_weight_check CHECK (grams IS NULL OR grams > 0),
  CONSTRAINT nutrition_food_servings_volume_check CHECK (milliliters IS NULL OR milliliters > 0),
  CONSTRAINT nutrition_food_servings_confidence_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_food_servings_food_label_idx
  ON public.nutrition_food_servings (food_id, lower(serving_label));

CREATE TABLE IF NOT EXISTS public.nutrition_food_nutrients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  nutrient_id uuid NOT NULL REFERENCES public.nutrition_nutrients(id) ON DELETE RESTRICT,
  source_id uuid REFERENCES public.nutrition_sources(id) ON DELETE SET NULL,
  amount_per_100g numeric NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  confidence_score numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (food_id, nutrient_id),
  CONSTRAINT nutrition_food_nutrients_amount_check CHECK (amount_per_100g >= 0),
  CONSTRAINT nutrition_food_nutrients_confidence_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS public.nutrition_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  symbology text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barcode)
);

CREATE TABLE IF NOT EXISTS public.nutrition_food_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  prepared_food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  preparation_state text NOT NULL,
  yield_factor numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_food_id, prepared_food_id, preparation_state),
  CONSTRAINT nutrition_food_preparations_yield_check CHECK (yield_factor IS NULL OR yield_factor > 0)
);

CREATE TABLE IF NOT EXISTS public.nutrition_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  visibility text NOT NULL DEFAULT 'private',
  servings numeric NOT NULL DEFAULT 1,
  total_weight_g numeric,
  instructions text[] NOT NULL DEFAULT '{}'::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_recipes_visibility_check CHECK (visibility IN ('private', 'shared', 'global')),
  CONSTRAINT nutrition_recipes_servings_check CHECK (servings > 0),
  CONSTRAINT nutrition_recipes_weight_check CHECK (total_weight_g IS NULL OR total_weight_g > 0)
);

CREATE TABLE IF NOT EXISTS public.nutrition_recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.nutrition_recipes(id) ON DELETE CASCADE,
  food_id uuid REFERENCES public.nutrition_foods(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.nutrition_units(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  grams numeric,
  order_index integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_recipe_ingredients_quantity_check CHECK (quantity > 0),
  CONSTRAINT nutrition_recipe_ingredients_grams_check CHECK (grams IS NULL OR grams > 0),
  CONSTRAINT nutrition_recipe_ingredients_order_check CHECK (order_index >= 1)
);

CREATE TABLE IF NOT EXISTS public.nutrition_ai_analysis_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_food_analysis_log_id uuid UNIQUE REFERENCES public.food_analysis_logs(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.nutrition_sources(id) ON DELETE SET NULL,
  provider text,
  model_used text,
  image_url text,
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'completed',
  detected_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  adjusted_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_to_daily boolean NOT NULL DEFAULT false,
  confidence_score numeric,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_ai_logs_status_check CHECK (status IN ('pending', 'completed', 'failed', 'saved')),
  CONSTRAINT nutrition_ai_logs_confidence_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS public.nutrition_ai_detected_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.nutrition_ai_analysis_logs(id) ON DELETE CASCADE,
  matched_food_id uuid REFERENCES public.nutrition_foods(id) ON DELETE SET NULL,
  detected_name text NOT NULL,
  normalized_name text NOT NULL,
  estimated_grams numeric,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  confidence_score numeric,
  position_index integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_ai_detected_items_grams_check CHECK (estimated_grams IS NULL OR estimated_grams > 0),
  CONSTRAINT nutrition_ai_detected_items_macros_check CHECK (
    (calories IS NULL OR calories >= 0)
    AND (protein IS NULL OR protein >= 0)
    AND (carbs IS NULL OR carbs >= 0)
    AND (fat IS NULL OR fat >= 0)
  ),
  CONSTRAINT nutrition_ai_detected_items_confidence_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_ai_detected_items_analysis_position_idx
  ON public.nutrition_ai_detected_items (analysis_id, position_index, normalized_name);

CREATE TABLE IF NOT EXISTS public.nutrition_meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_meal_id uuid UNIQUE REFERENCES public.meals(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ai_analysis_id uuid REFERENCES public.nutrition_ai_analysis_logs(id) ON DELETE SET NULL,
  meal_type text NOT NULL,
  name text NOT NULL,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric,
  sugar numeric,
  sodium_mg numeric,
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_meal_logs_type_check CHECK (meal_type IN ('desayuno', 'colacion_am', 'comida', 'colacion_pm', 'cena')),
  CONSTRAINT nutrition_meal_logs_macros_check CHECK (calories >= 0 AND protein >= 0 AND carbs >= 0 AND fat >= 0)
);

CREATE INDEX IF NOT EXISTS nutrition_meal_logs_user_date_idx
  ON public.nutrition_meal_logs (user_id, logged_date DESC);

CREATE TABLE IF NOT EXISTS public.nutrition_meal_log_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_meal_ingredient_id uuid UNIQUE REFERENCES public.meal_ingredients(id) ON DELETE SET NULL,
  meal_log_id uuid NOT NULL REFERENCES public.nutrition_meal_logs(id) ON DELETE CASCADE,
  food_id uuid REFERENCES public.nutrition_foods(id) ON DELETE SET NULL,
  recipe_id uuid REFERENCES public.nutrition_recipes(id) ON DELETE SET NULL,
  serving_id uuid REFERENCES public.nutrition_food_servings(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.nutrition_units(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_label text,
  grams numeric,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric,
  sugar numeric,
  sodium_mg numeric,
  source text NOT NULL DEFAULT 'manual',
  is_verified boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_meal_log_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT nutrition_meal_log_items_grams_check CHECK (grams IS NULL OR grams > 0),
  CONSTRAINT nutrition_meal_log_items_macros_check CHECK (calories >= 0 AND protein >= 0 AND carbs >= 0 AND fat >= 0)
);

CREATE TABLE IF NOT EXISTS public.nutrition_user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  fiber_g integer,
  sodium_mg integer,
  source text NOT NULL DEFAULT 'profile_snapshot',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_user_goals_dates_check CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT nutrition_user_goals_values_check CHECK (
    (calories IS NULL OR calories >= 0)
    AND (protein_g IS NULL OR protein_g >= 0)
    AND (carbs_g IS NULL OR carbs_g >= 0)
    AND (fat_g IS NULL OR fat_g >= 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_user_goals_snapshot_idx
  ON public.nutrition_user_goals (user_id, effective_from, source);

CREATE TABLE IF NOT EXISTS public.nutrition_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  food_id uuid REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.nutrition_recipes(id) ON DELETE CASCADE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_favorites_target_check CHECK (
    (food_id IS NOT NULL AND recipe_id IS NULL)
    OR (food_id IS NULL AND recipe_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_favorites_food_idx
  ON public.nutrition_favorites (user_id, food_id) WHERE food_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nutrition_favorites_recipe_idx
  ON public.nutrition_favorites (user_id, recipe_id) WHERE recipe_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.nutrition_ingredient_substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  substitute_food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  reason text,
  context text,
  score numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (original_food_id, substitute_food_id),
  CONSTRAINT nutrition_substitutions_score_check CHECK (score IS NULL OR score BETWEEN 0 AND 1),
  CONSTRAINT nutrition_substitutions_not_same_check CHECK (original_food_id <> substitute_food_id)
);

CREATE TABLE IF NOT EXISTS public.nutrition_meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  objective text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_meal_plans_status_check CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT nutrition_meal_plans_dates_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.nutrition_meal_plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.nutrition_meal_plans(id) ON DELETE CASCADE,
  plan_date date,
  day_index integer NOT NULL,
  calorie_target integer,
  protein_target_g integer,
  carbs_target_g integer,
  fat_target_g integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_meal_plan_days_index_check CHECK (day_index >= 1)
);

CREATE TABLE IF NOT EXISTS public.nutrition_meal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_day_id uuid NOT NULL REFERENCES public.nutrition_meal_plan_days(id) ON DELETE CASCADE,
  food_id uuid REFERENCES public.nutrition_foods(id) ON DELETE SET NULL,
  recipe_id uuid REFERENCES public.nutrition_recipes(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.nutrition_units(id) ON DELETE SET NULL,
  meal_type text NOT NULL,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  grams numeric,
  order_index integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_meal_plan_items_target_check CHECK (food_id IS NOT NULL OR recipe_id IS NOT NULL),
  CONSTRAINT nutrition_meal_plan_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT nutrition_meal_plan_items_order_check CHECK (order_index >= 1)
);

CREATE TABLE IF NOT EXISTS public.nutrition_shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_shopping_lists_status_check CHECK (status IN ('active', 'completed', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.nutrition_shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id uuid NOT NULL REFERENCES public.nutrition_shopping_lists(id) ON DELETE CASCADE,
  food_id uuid REFERENCES public.nutrition_foods(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.nutrition_units(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  checked boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_shopping_items_quantity_check CHECK (quantity > 0)
);

CREATE OR REPLACE FUNCTION public.nutrition_normalize_text(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(btrim(COALESCE(_value, '')), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.nutrition_can_read_food(_food_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.nutrition_foods f
    WHERE f.id = _food_id
      AND (f.scope = 'global' OR f.owner_user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.nutrition_can_write_food(_food_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.nutrition_foods f
    WHERE f.id = _food_id
      AND f.scope = 'user'
      AND f.owner_user_id = auth.uid()
  )
$$;

-- RLS
ALTER TABLE public.nutrition_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_food_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_food_servings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_food_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_food_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_ai_analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_ai_detected_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meal_log_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_ingredient_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meal_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_shopping_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutrition reference read" ON public.nutrition_sources;
CREATE POLICY "Nutrition reference read" ON public.nutrition_sources FOR SELECT USING (true);
DROP POLICY IF EXISTS "Nutrition brands read" ON public.nutrition_brands;
CREATE POLICY "Nutrition brands read" ON public.nutrition_brands FOR SELECT USING (true);
DROP POLICY IF EXISTS "Nutrition categories read" ON public.nutrition_categories;
CREATE POLICY "Nutrition categories read" ON public.nutrition_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Nutrition units read" ON public.nutrition_units;
CREATE POLICY "Nutrition units read" ON public.nutrition_units FOR SELECT USING (true);
DROP POLICY IF EXISTS "Nutrition nutrients read" ON public.nutrition_nutrients;
CREATE POLICY "Nutrition nutrients read" ON public.nutrition_nutrients FOR SELECT USING (true);

DROP POLICY IF EXISTS "Nutrition foods readable" ON public.nutrition_foods;
CREATE POLICY "Nutrition foods readable" ON public.nutrition_foods
FOR SELECT USING (scope = 'global' OR owner_user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert custom nutrition foods" ON public.nutrition_foods;
CREATE POLICY "Users can insert custom nutrition foods" ON public.nutrition_foods
FOR INSERT WITH CHECK (scope = 'user' AND owner_user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update custom nutrition foods" ON public.nutrition_foods;
CREATE POLICY "Users can update custom nutrition foods" ON public.nutrition_foods
FOR UPDATE USING (scope = 'user' AND owner_user_id = auth.uid())
WITH CHECK (scope = 'user' AND owner_user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete custom nutrition foods" ON public.nutrition_foods;
CREATE POLICY "Users can delete custom nutrition foods" ON public.nutrition_foods
FOR DELETE USING (scope = 'user' AND owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Nutrition food aliases readable" ON public.nutrition_food_aliases;
CREATE POLICY "Nutrition food aliases readable" ON public.nutrition_food_aliases
FOR SELECT USING (public.nutrition_can_read_food(food_id));
DROP POLICY IF EXISTS "Nutrition food servings readable" ON public.nutrition_food_servings;
CREATE POLICY "Nutrition food servings readable" ON public.nutrition_food_servings
FOR SELECT USING (public.nutrition_can_read_food(food_id));
DROP POLICY IF EXISTS "Nutrition food nutrients readable" ON public.nutrition_food_nutrients;
CREATE POLICY "Nutrition food nutrients readable" ON public.nutrition_food_nutrients
FOR SELECT USING (public.nutrition_can_read_food(food_id));
DROP POLICY IF EXISTS "Nutrition food categories readable" ON public.nutrition_food_categories;
CREATE POLICY "Nutrition food categories readable" ON public.nutrition_food_categories
FOR SELECT USING (public.nutrition_can_read_food(food_id));
DROP POLICY IF EXISTS "Nutrition barcodes readable" ON public.nutrition_barcodes;
CREATE POLICY "Nutrition barcodes readable" ON public.nutrition_barcodes
FOR SELECT USING (public.nutrition_can_read_food(food_id));
DROP POLICY IF EXISTS "Nutrition preparations readable" ON public.nutrition_food_preparations;
CREATE POLICY "Nutrition preparations readable" ON public.nutrition_food_preparations
FOR SELECT USING (
  public.nutrition_can_read_food(base_food_id)
  AND public.nutrition_can_read_food(prepared_food_id)
);

DROP POLICY IF EXISTS "Users can manage own recipes" ON public.nutrition_recipes;
DROP POLICY IF EXISTS "Users can read nutrition recipes" ON public.nutrition_recipes;
CREATE POLICY "Users can read nutrition recipes" ON public.nutrition_recipes
FOR SELECT USING (user_id = auth.uid() OR visibility = 'global');
DROP POLICY IF EXISTS "Users can insert own nutrition recipes" ON public.nutrition_recipes;
CREATE POLICY "Users can insert own nutrition recipes" ON public.nutrition_recipes
FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own nutrition recipes" ON public.nutrition_recipes;
CREATE POLICY "Users can update own nutrition recipes" ON public.nutrition_recipes
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete own nutrition recipes" ON public.nutrition_recipes;
CREATE POLICY "Users can delete own nutrition recipes" ON public.nutrition_recipes
FOR DELETE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can read own recipe ingredients" ON public.nutrition_recipe_ingredients;
DROP POLICY IF EXISTS "Users can read nutrition recipe ingredients" ON public.nutrition_recipe_ingredients;
CREATE POLICY "Users can read nutrition recipe ingredients" ON public.nutrition_recipe_ingredients
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes r
    WHERE r.id = recipe_id AND (r.user_id = auth.uid() OR r.visibility = 'global')
  )
);
DROP POLICY IF EXISTS "Users can insert own nutrition recipe ingredients" ON public.nutrition_recipe_ingredients;
CREATE POLICY "Users can insert own nutrition recipe ingredients" ON public.nutrition_recipe_ingredients
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes r
    WHERE r.id = recipe_id AND r.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Users can update own nutrition recipe ingredients" ON public.nutrition_recipe_ingredients;
CREATE POLICY "Users can update own nutrition recipe ingredients" ON public.nutrition_recipe_ingredients
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes r
    WHERE r.id = recipe_id AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes r
    WHERE r.id = recipe_id AND r.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Users can delete own nutrition recipe ingredients" ON public.nutrition_recipe_ingredients;
CREATE POLICY "Users can delete own nutrition recipe ingredients" ON public.nutrition_recipe_ingredients
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes r
    WHERE r.id = recipe_id AND r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage own AI analysis logs" ON public.nutrition_ai_analysis_logs;
CREATE POLICY "Users can manage own AI analysis logs" ON public.nutrition_ai_analysis_logs
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can read own AI detected items" ON public.nutrition_ai_detected_items;
CREATE POLICY "Users can read own AI detected items" ON public.nutrition_ai_detected_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_ai_analysis_logs l
    WHERE l.id = analysis_id AND l.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nutrition_ai_analysis_logs l
    WHERE l.id = analysis_id AND l.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage own nutrition meal logs" ON public.nutrition_meal_logs;
CREATE POLICY "Users can manage own nutrition meal logs" ON public.nutrition_meal_logs
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can read own nutrition meal items" ON public.nutrition_meal_log_items;
CREATE POLICY "Users can read own nutrition meal items" ON public.nutrition_meal_log_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_meal_logs m
    WHERE m.id = meal_log_id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nutrition_meal_logs m
    WHERE m.id = meal_log_id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage own nutrition goals" ON public.nutrition_user_goals;
CREATE POLICY "Users can manage own nutrition goals" ON public.nutrition_user_goals
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can manage own nutrition favorites" ON public.nutrition_favorites;
CREATE POLICY "Users can manage own nutrition favorites" ON public.nutrition_favorites
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Nutrition substitutions readable" ON public.nutrition_ingredient_substitutions;
CREATE POLICY "Nutrition substitutions readable" ON public.nutrition_ingredient_substitutions
FOR SELECT USING (
  public.nutrition_can_read_food(original_food_id)
  AND public.nutrition_can_read_food(substitute_food_id)
);
DROP POLICY IF EXISTS "Users can manage own meal plans" ON public.nutrition_meal_plans;
CREATE POLICY "Users can manage own meal plans" ON public.nutrition_meal_plans
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can read own meal plan days" ON public.nutrition_meal_plan_days;
CREATE POLICY "Users can read own meal plan days" ON public.nutrition_meal_plan_days
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_meal_plans p
    WHERE p.id = plan_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nutrition_meal_plans p
    WHERE p.id = plan_id AND p.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Users can read own meal plan items" ON public.nutrition_meal_plan_items;
CREATE POLICY "Users can read own meal plan items" ON public.nutrition_meal_plan_items
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.nutrition_meal_plan_days d
    JOIN public.nutrition_meal_plans p ON p.id = d.plan_id
    WHERE d.id = plan_day_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.nutrition_meal_plan_days d
    JOIN public.nutrition_meal_plans p ON p.id = d.plan_id
    WHERE d.id = plan_day_id AND p.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Users can manage own shopping lists" ON public.nutrition_shopping_lists;
CREATE POLICY "Users can manage own shopping lists" ON public.nutrition_shopping_lists
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can read own shopping list items" ON public.nutrition_shopping_list_items;
CREATE POLICY "Users can read own shopping list items" ON public.nutrition_shopping_list_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_shopping_lists s
    WHERE s.id = shopping_list_id AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nutrition_shopping_lists s
    WHERE s.id = shopping_list_id AND s.user_id = auth.uid()
  )
);

-- Catalogos base idempotentes.
INSERT INTO public.nutrition_sources (code, name, source_type, license, version, url)
VALUES
  ('legacy_seed', 'SendaFit legacy seed', 'legacy', NULL, NULL, NULL),
  ('USDA_FDC', 'USDA FoodData Central', 'external_api', 'CC0_1_0', NULL, 'https://fdc.nal.usda.gov/'),
  ('user_custom', 'User custom entry', 'user', NULL, NULL, NULL),
  ('ai_estimated', 'AI estimated food analysis', 'ai', NULL, NULL, NULL)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  license = COALESCE(EXCLUDED.license, public.nutrition_sources.license),
  url = COALESCE(EXCLUDED.url, public.nutrition_sources.url),
  updated_at = now();

INSERT INTO public.nutrition_units (code, name, dimension, grams_multiplier, milliliters_multiplier, is_metric)
VALUES
  ('g', 'gramo', 'mass', 1, NULL, true),
  ('kg', 'kilogramo', 'mass', 1000, NULL, true),
  ('mg', 'miligramo', 'mass', 0.001, NULL, true),
  ('ml', 'mililitro', 'volume', NULL, 1, true),
  ('l', 'litro', 'volume', NULL, 1000, true),
  ('unit', 'unidad', 'count', NULL, NULL, false),
  ('piece', 'pieza', 'count', NULL, NULL, false),
  ('serving', 'porcion', 'count', NULL, NULL, false),
  ('cup', 'taza', 'volume', NULL, NULL, false),
  ('tbsp', 'cucharada', 'volume', NULL, NULL, false),
  ('tsp', 'cucharadita', 'volume', NULL, NULL, false),
  ('scoop', 'scoop', 'count', NULL, NULL, false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.nutrition_nutrients (code, name, unit, nutrient_group, display_order)
VALUES
  ('energy_kcal', 'Energia', 'kcal', 'energy', 1),
  ('protein_g', 'Proteina', 'g', 'macro', 2),
  ('carbs_g', 'Carbohidratos', 'g', 'macro', 3),
  ('fat_g', 'Grasas', 'g', 'macro', 4),
  ('fiber_g', 'Fibra', 'g', 'fiber', 5),
  ('sugar_g', 'Azucares', 'g', 'macro', 6),
  ('sodium_mg', 'Sodio', 'mg', 'mineral', 7)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  unit = EXCLUDED.unit,
  nutrient_group = EXCLUDED.nutrient_group,
  display_order = EXCLUDED.display_order;

INSERT INTO public.nutrition_units (code, name, dimension)
SELECT DISTINCT
  public.nutrition_normalize_text(unit_value) AS code,
  btrim(unit_value) AS name,
  'custom'
FROM (
  SELECT unidad AS unit_value FROM public.foods
  UNION ALL
  SELECT serving_unit FROM public.foods
  UNION ALL
  SELECT unit FROM public.meal_ingredients
) u
WHERE NULLIF(btrim(COALESCE(unit_value, '')), '') IS NOT NULL
ON CONFLICT (code) DO NOTHING;

-- Backfill de categorias.
INSERT INTO public.nutrition_categories (name, normalized_name, category_level, locale)
SELECT DISTINCT
  btrim(category),
  public.nutrition_normalize_text(category),
  'category',
  COALESCE(NULLIF(locale, ''), 'es-MX')
FROM public.foods
WHERE NULLIF(btrim(COALESCE(category, '')), '') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.nutrition_categories (name, normalized_name, category_level, locale)
SELECT DISTINCT
  btrim(group_name),
  public.nutrition_normalize_text(group_name),
  'subcategory',
  COALESCE(NULLIF(locale, ''), 'es-MX')
FROM public.foods
WHERE NULLIF(btrim(COALESCE(group_name, '')), '') IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill de alimentos.
INSERT INTO public.nutrition_foods (
  legacy_food_id,
  source_id,
  source_external_id,
  food_kind,
  scope,
  canonical_name,
  display_name,
  normalized_name,
  locale,
  description,
  preparation_state,
  search_text,
  is_verified,
  is_visible,
  is_common,
  visibility_priority,
  metadata,
  created_at,
  updated_at
)
SELECT
  f.id,
  s.id,
  f.fdc_id::text,
  CASE WHEN f.fdc_id IS NOT NULL THEN 'generic' ELSE 'generic' END,
  'global',
  COALESCE(NULLIF(f.name, ''), f.nombre),
  COALESCE(NULLIF(f.display_name, ''), NULLIF(f.name, ''), f.nombre),
  public.nutrition_normalize_text(COALESCE(NULLIF(f.normalized_name, ''), NULLIF(f.name, ''), f.nombre)),
  COALESCE(NULLIF(f.locale, ''), 'es-MX'),
  f.description,
  f.preparation_state,
  COALESCE(NULLIF(f.search_name, ''), concat_ws(' ', f.nombre, f.name, f.display_name, f.category, f.group_name)),
  f.is_verified,
  f.is_visible,
  f.is_common,
  f.visibility_priority,
  jsonb_build_object(
    'legacy_payload', to_jsonb(f),
    'source', f.source,
    'source_license', f.source_license,
    'source_version', f.source_version,
    'source_url', f.source_url,
    'data_type', f.data_type
  ),
  f.created_at,
  f.updated_at
FROM public.foods f
LEFT JOIN public.nutrition_sources s ON s.code = f.source
ON CONFLICT (legacy_food_id) DO UPDATE SET
  source_id = EXCLUDED.source_id,
  source_external_id = EXCLUDED.source_external_id,
  canonical_name = EXCLUDED.canonical_name,
  display_name = EXCLUDED.display_name,
  normalized_name = EXCLUDED.normalized_name,
  locale = EXCLUDED.locale,
  description = EXCLUDED.description,
  preparation_state = EXCLUDED.preparation_state,
  search_text = EXCLUDED.search_text,
  is_verified = EXCLUDED.is_verified,
  is_visible = EXCLUDED.is_visible,
  is_common = EXCLUDED.is_common,
  visibility_priority = EXCLUDED.visibility_priority,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO public.nutrition_food_aliases (food_id, alias, normalized_alias, locale, source)
SELECT nf.id, alias_value, public.nutrition_normalize_text(alias_value), nf.locale, 'legacy_aliases'
FROM public.foods f
JOIN public.nutrition_foods nf ON nf.legacy_food_id = f.id
CROSS JOIN LATERAL unnest(f.aliases) AS a(alias_value)
WHERE NULLIF(btrim(alias_value), '') IS NOT NULL
ON CONFLICT (food_id, normalized_alias, locale) DO NOTHING;

INSERT INTO public.nutrition_food_categories (food_id, category_id, is_primary)
SELECT nf.id, c.id, true
FROM public.foods f
JOIN public.nutrition_foods nf ON nf.legacy_food_id = f.id
JOIN public.nutrition_categories c
  ON c.normalized_name = public.nutrition_normalize_text(f.category)
 AND c.category_level = 'category'
WHERE NULLIF(btrim(COALESCE(f.category, '')), '') IS NOT NULL
ON CONFLICT (food_id, category_id) DO UPDATE SET is_primary = true;

INSERT INTO public.nutrition_food_categories (food_id, category_id, is_primary)
SELECT nf.id, c.id, false
FROM public.foods f
JOIN public.nutrition_foods nf ON nf.legacy_food_id = f.id
JOIN public.nutrition_categories c
  ON c.normalized_name = public.nutrition_normalize_text(f.group_name)
 AND c.category_level = 'subcategory'
WHERE NULLIF(btrim(COALESCE(f.group_name, '')), '') IS NOT NULL
ON CONFLICT (food_id, category_id) DO NOTHING;

INSERT INTO public.nutrition_food_servings (
  food_id,
  unit_id,
  serving_label,
  quantity,
  grams,
  is_default,
  source,
  metadata
)
SELECT
  nf.id,
  u.id,
  concat_ws(' ', COALESCE(f.serving_size, f.racion)::text, COALESCE(NULLIF(f.serving_unit, ''), f.unidad)),
  COALESCE(f.serving_size, f.racion, 1),
  COALESCE(f.grams_per_serving, CASE WHEN COALESCE(f.serving_unit, f.unidad) = 'g' THEN COALESCE(f.serving_size, f.racion) END),
  true,
  'legacy_default',
  jsonb_build_object('legacy_unidad', f.unidad, 'legacy_racion', f.racion)
FROM public.foods f
JOIN public.nutrition_foods nf ON nf.legacy_food_id = f.id
JOIN public.nutrition_units u ON u.code = public.nutrition_normalize_text(COALESCE(NULLIF(f.serving_unit, ''), f.unidad))
WHERE COALESCE(f.serving_size, f.racion) IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.nutrition_food_nutrients (food_id, nutrient_id, source_id, amount_per_100g, is_verified)
SELECT
  nf.id,
  n.id,
  nf.source_id,
  v.amount,
  nf.is_verified
FROM public.foods f
JOIN public.nutrition_foods nf ON nf.legacy_food_id = f.id
JOIN LATERAL (
  VALUES
    ('energy_kcal', COALESCE(f.calories_per_100g, f.calorias)),
    ('protein_g', COALESCE(f.protein_per_100g, f.proteinas)),
    ('carbs_g', COALESCE(f.carbs_per_100g, f.carbohidratos)),
    ('fat_g', COALESCE(f.fat_per_100g, f.grasas)),
    ('fiber_g', f.fiber_per_100g),
    ('sugar_g', f.sugar_per_100g),
    ('sodium_mg', f.sodium_mg_per_100g)
) AS v(code, amount) ON true
JOIN public.nutrition_nutrients n ON n.code = v.code
WHERE v.amount IS NOT NULL
ON CONFLICT (food_id, nutrient_id) DO UPDATE SET
  amount_per_100g = EXCLUDED.amount_per_100g,
  is_verified = EXCLUDED.is_verified,
  updated_at = now();

-- Backfill de analisis IA.
INSERT INTO public.nutrition_ai_analysis_logs (
  legacy_food_analysis_log_id,
  user_id,
  source_id,
  provider,
  image_url,
  analysis_date,
  status,
  detected_payload,
  estimated_totals,
  adjusted_totals,
  saved_to_daily,
  raw_response,
  created_at,
  updated_at
)
SELECT
  l.id,
  l.user_id,
  s.id,
  'unknown',
  l.image_url,
  l.analysis_date,
  CASE WHEN COALESCE(l.saved_to_daily, false) THEN 'saved' ELSE 'completed' END,
  COALESCE(l.detected_foods, '[]'::jsonb),
  COALESCE(l.estimated_macros, '{}'::jsonb),
  COALESCE(l.adjusted_macros, '{}'::jsonb),
  COALESCE(l.saved_to_daily, false),
  to_jsonb(l),
  l.created_at,
  l.updated_at
FROM public.food_analysis_logs l
LEFT JOIN public.nutrition_sources s ON s.code = 'ai_estimated'
ON CONFLICT (legacy_food_analysis_log_id) DO UPDATE SET
  detected_payload = EXCLUDED.detected_payload,
  estimated_totals = EXCLUDED.estimated_totals,
  adjusted_totals = EXCLUDED.adjusted_totals,
  saved_to_daily = EXCLUDED.saved_to_daily,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO public.nutrition_ai_detected_items (
  analysis_id,
  matched_food_id,
  detected_name,
  normalized_name,
  estimated_grams,
  calories,
  protein,
  carbs,
  fat,
  position_index,
  metadata
)
SELECT
  nal.id,
  nf.id,
  COALESCE(item.value ->> 'name', item.value ->> 'foodName', 'Alimento detectado'),
  public.nutrition_normalize_text(COALESCE(item.value ->> 'name', item.value ->> 'foodName', 'Alimento detectado')),
  CASE WHEN COALESCE(item.value ->> 'estimatedWeightGrams', item.value ->> 'grams') ~ '^[0-9]+(\.[0-9]+)?$'
    THEN COALESCE(item.value ->> 'estimatedWeightGrams', item.value ->> 'grams')::numeric
  END,
  CASE WHEN COALESCE(item.value ->> 'calories', item.value ->> 'kcal') ~ '^[0-9]+(\.[0-9]+)?$'
    THEN COALESCE(item.value ->> 'calories', item.value ->> 'kcal')::numeric
  END,
  CASE WHEN item.value ->> 'protein' ~ '^[0-9]+(\.[0-9]+)?$' THEN (item.value ->> 'protein')::numeric END,
  CASE WHEN COALESCE(item.value ->> 'carbs', item.value ->> 'carbohydrates') ~ '^[0-9]+(\.[0-9]+)?$'
    THEN COALESCE(item.value ->> 'carbs', item.value ->> 'carbohydrates')::numeric
  END,
  CASE WHEN COALESCE(item.value ->> 'fat', item.value ->> 'fats') ~ '^[0-9]+(\.[0-9]+)?$'
    THEN COALESCE(item.value ->> 'fat', item.value ->> 'fats')::numeric
  END,
  item.ordinality::integer,
  item.value
FROM public.nutrition_ai_analysis_logs nal
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(nal.detected_payload) = 'array' THEN nal.detected_payload ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
LEFT JOIN public.nutrition_foods nf
  ON nf.normalized_name = public.nutrition_normalize_text(COALESCE(item.value ->> 'name', item.value ->> 'foodName'))
ON CONFLICT (analysis_id, position_index, normalized_name) DO UPDATE SET
  matched_food_id = COALESCE(EXCLUDED.matched_food_id, public.nutrition_ai_detected_items.matched_food_id),
  estimated_grams = EXCLUDED.estimated_grams,
  calories = EXCLUDED.calories,
  protein = EXCLUDED.protein,
  carbs = EXCLUDED.carbs,
  fat = EXCLUDED.fat,
  metadata = EXCLUDED.metadata;

-- Backfill de comidas y sus ingredientes.
INSERT INTO public.nutrition_meal_logs (
  legacy_meal_id,
  user_id,
  meal_type,
  name,
  logged_date,
  calories,
  protein,
  carbs,
  fat,
  source,
  metadata,
  created_at
)
SELECT
  m.id,
  m.user_id,
  m.meal_type::text,
  m.name,
  m.date,
  m.calories,
  m.protein,
  m.carbs,
  m.fat,
  'legacy_meals',
  to_jsonb(m),
  m.created_at
FROM public.meals m
ON CONFLICT (legacy_meal_id) DO UPDATE SET
  meal_type = EXCLUDED.meal_type,
  name = EXCLUDED.name,
  logged_date = EXCLUDED.logged_date,
  calories = EXCLUDED.calories,
  protein = EXCLUDED.protein,
  carbs = EXCLUDED.carbs,
  fat = EXCLUDED.fat,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO public.nutrition_meal_log_items (
  legacy_meal_ingredient_id,
  meal_log_id,
  food_id,
  unit_id,
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
  metadata,
  created_at,
  updated_at
)
SELECT
  mi.id,
  nml.id,
  nf.id,
  u.id,
  mi.ingredient_name,
  mi.quantity,
  mi.unit,
  mi.grams,
  mi.calories,
  mi.protein,
  mi.carbs,
  mi.fat,
  mi.fiber,
  mi.sugar,
  mi.sodium_mg,
  mi.source,
  mi.is_verified,
  mi.metadata,
  mi.created_at,
  mi.updated_at
FROM public.meal_ingredients mi
JOIN public.nutrition_meal_logs nml ON nml.legacy_meal_id = mi.meal_id
LEFT JOIN public.nutrition_foods nf ON nf.legacy_food_id = mi.food_id
LEFT JOIN public.nutrition_units u ON u.code = public.nutrition_normalize_text(mi.unit)
ON CONFLICT (legacy_meal_ingredient_id) DO UPDATE SET
  food_id = EXCLUDED.food_id,
  unit_id = EXCLUDED.unit_id,
  item_name = EXCLUDED.item_name,
  quantity = EXCLUDED.quantity,
  unit_label = EXCLUDED.unit_label,
  grams = EXCLUDED.grams,
  calories = EXCLUDED.calories,
  protein = EXCLUDED.protein,
  carbs = EXCLUDED.carbs,
  fat = EXCLUDED.fat,
  fiber = EXCLUDED.fiber,
  sugar = EXCLUDED.sugar,
  sodium_mg = EXCLUDED.sodium_mg,
  source = EXCLUDED.source,
  is_verified = EXCLUDED.is_verified,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO public.nutrition_user_goals (
  user_id,
  effective_from,
  calories,
  protein_g,
  carbs_g,
  fat_g,
  source,
  metadata
)
SELECT
  p.id,
  CURRENT_DATE,
  p.daily_calorie_goal,
  p.daily_protein_goal,
  p.daily_carbs_goal,
  p.daily_fat_goal,
  'profile_snapshot',
  jsonb_build_object('captured_from', 'profiles')
FROM public.profiles p
WHERE p.daily_calorie_goal IS NOT NULL
   OR p.daily_protein_goal IS NOT NULL
   OR p.daily_carbs_goal IS NOT NULL
   OR p.daily_fat_goal IS NOT NULL
ON CONFLICT (user_id, effective_from, source) DO UPDATE SET
  calories = EXCLUDED.calories,
  protein_g = EXCLUDED.protein_g,
  carbs_g = EXCLUDED.carbs_g,
  fat_g = EXCLUDED.fat_g,
  metadata = EXCLUDED.metadata;

CREATE OR REPLACE VIEW public.nutrition_foods_search_v
WITH (security_invoker = true) AS
SELECT
  f.id,
  f.legacy_food_id,
  f.owner_user_id,
  f.scope,
  f.display_name,
  f.normalized_name,
  f.description,
  f.locale,
  f.is_verified,
  f.is_visible,
  f.is_common,
  f.visibility_priority,
  b.name AS brand_name,
  array_remove(array_agg(DISTINCT a.alias), NULL) AS aliases,
  array_remove(array_agg(DISTINCT c.name), NULL) AS categories
FROM public.nutrition_foods f
LEFT JOIN public.nutrition_brands b ON b.id = f.brand_id
LEFT JOIN public.nutrition_food_aliases a ON a.food_id = f.id
LEFT JOIN public.nutrition_food_categories fc ON fc.food_id = f.id
LEFT JOIN public.nutrition_categories c ON c.id = fc.category_id
GROUP BY f.id, b.name;

CREATE OR REPLACE VIEW public.nutrition_daily_totals_v
WITH (security_invoker = true) AS
SELECT
  user_id,
  logged_date,
  SUM(calories) AS calories,
  SUM(protein) AS protein,
  SUM(carbs) AS carbs,
  SUM(fat) AS fat,
  SUM(COALESCE(fiber, 0)) AS fiber,
  SUM(COALESCE(sugar, 0)) AS sugar,
  SUM(COALESCE(sodium_mg, 0)) AS sodium_mg,
  COUNT(*) AS meal_count
FROM public.nutrition_meal_logs
GROUP BY user_id, logged_date;

GRANT SELECT ON public.nutrition_sources TO authenticated, anon;
GRANT SELECT ON public.nutrition_brands TO authenticated, anon;
GRANT SELECT ON public.nutrition_categories TO authenticated, anon;
GRANT SELECT ON public.nutrition_units TO authenticated, anon;
GRANT SELECT ON public.nutrition_nutrients TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_foods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_food_aliases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_food_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_food_servings TO authenticated;
GRANT SELECT ON public.nutrition_food_nutrients TO authenticated;
GRANT SELECT ON public.nutrition_barcodes TO authenticated;
GRANT SELECT ON public.nutrition_food_preparations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_recipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_recipe_ingredients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_ai_analysis_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_ai_detected_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_meal_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_meal_log_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_user_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_favorites TO authenticated;
GRANT SELECT ON public.nutrition_ingredient_substitutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_meal_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_meal_plan_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_meal_plan_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_shopping_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_shopping_list_items TO authenticated;
GRANT SELECT ON public.nutrition_foods_search_v TO authenticated;
GRANT SELECT ON public.nutrition_daily_totals_v TO authenticated;

COMMENT ON TABLE public.nutrition_foods IS 'Canonical food catalog introduced in Beta Nutrition Sprint 1B. Legacy foods are linked by legacy_food_id.';
COMMENT ON TABLE public.nutrition_meal_logs IS 'Nutrition meal log headers with macro snapshots. Legacy meals are linked by legacy_meal_id.';
COMMENT ON TABLE public.nutrition_meal_log_items IS 'Nutrition meal log item snapshots. Legacy meal_ingredients are linked by legacy_meal_ingredient_id.';
COMMENT ON TABLE public.nutrition_ai_analysis_logs IS 'Normalized AI food analysis history linked to legacy food_analysis_logs.';

COMMIT;
