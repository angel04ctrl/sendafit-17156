-- Beta Nutrition - Correccion arquitectonica dirigida.
-- Ejecutar despues de Beta Nutrition Sprint 1B.
-- No importa CSV curado, no borra alimentos, no modifica informacion nutricional.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nutrition_physical_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 100,
  is_visible boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nutrition_preparation_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 100,
  is_visible boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nutrition_canonical_food_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key text UNIQUE,
  canonical_name text NOT NULL,
  normalized_name text NOT NULL,
  description text,
  locale text NOT NULL DEFAULT 'es-MX',
  default_food_id uuid REFERENCES public.nutrition_foods(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_canonical_food_groups_status_check
    CHECK (status IN ('active', 'needs_review', 'deprecated'))
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_canonical_food_groups_normalized_idx
  ON public.nutrition_canonical_food_groups (normalized_name, locale);

CREATE TABLE IF NOT EXISTS public.nutrition_food_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.nutrition_canonical_food_groups(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  variant_type text NOT NULL DEFAULT 'unclassified',
  display_order integer NOT NULL DEFAULT 100,
  is_default boolean NOT NULL DEFAULT false,
  is_ui_visible boolean NOT NULL DEFAULT true,
  physical_state_id uuid REFERENCES public.nutrition_physical_states(id) ON DELETE SET NULL,
  preparation_method_id uuid REFERENCES public.nutrition_preparation_methods(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_food_group_members_variant_type_check
    CHECK (variant_type IN (
      'ingredient',
      'prepared_variant',
      'component',
      'composite_food',
      'recipe',
      'branded_product',
      'restaurant_item',
      'supplement',
      'beverage',
      'unclassified',
      'legacy_generic'
    )),
  CONSTRAINT nutrition_food_group_members_order_check CHECK (display_order >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_food_group_members_group_food_idx
  ON public.nutrition_food_group_members (group_id, food_id);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_food_group_members_one_group_per_food_idx
  ON public.nutrition_food_group_members (food_id);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_food_group_members_one_default_idx
  ON public.nutrition_food_group_members (group_id)
  WHERE is_default IS TRUE;

CREATE TABLE IF NOT EXISTS public.nutrition_food_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  child_food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  display_order integer NOT NULL DEFAULT 100,
  is_default boolean NOT NULL DEFAULT false,
  is_ui_visible boolean NOT NULL DEFAULT true,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_food_relationships_type_check
    CHECK (relationship_type IN (
      'variant_of',
      'preparation_of',
      'component_of',
      'part_of',
      'derived_from',
      'cut_of',
      'equivalent_to',
      'related_to'
    )),
  CONSTRAINT nutrition_food_relationships_not_self_check CHECK (parent_food_id <> child_food_id),
  CONSTRAINT nutrition_food_relationships_order_check CHECK (display_order >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_food_relationships_unique_idx
  ON public.nutrition_food_relationships (parent_food_id, child_food_id, relationship_type);

ALTER TABLE public.nutrition_foods
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS physical_state_id uuid REFERENCES public.nutrition_physical_states(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preparation_method_id uuid REFERENCES public.nutrition_preparation_methods(id) ON DELETE SET NULL;

ALTER TABLE public.nutrition_food_servings
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

ALTER TABLE public.nutrition_food_nutrients
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

ALTER TABLE public.nutrition_foods
  DROP CONSTRAINT IF EXISTS nutrition_foods_kind_check,
  DROP CONSTRAINT IF EXISTS nutrition_foods_verification_status_check;

ALTER TABLE public.nutrition_foods
  ADD CONSTRAINT nutrition_foods_kind_check
  CHECK (food_kind IN (
    'ingredient',
    'prepared_variant',
    'component',
    'composite_food',
    'recipe',
    'branded_product',
    'restaurant_item',
    'supplement',
    'beverage',
    'unclassified',
    'generic',
    'branded',
    'restaurant',
    'user_custom',
    'ai_estimated'
  )),
  ADD CONSTRAINT nutrition_foods_verification_status_check
  CHECK (verification_status IN (
    'unverified',
    'needs_review',
    'partially_verified',
    'verified',
    'rejected',
    'deprecated'
  ));

ALTER TABLE public.nutrition_food_servings
  DROP CONSTRAINT IF EXISTS nutrition_food_servings_verification_status_check;

ALTER TABLE public.nutrition_food_servings
  ADD CONSTRAINT nutrition_food_servings_verification_status_check
  CHECK (verification_status IN (
    'unverified',
    'needs_review',
    'partially_verified',
    'verified',
    'rejected',
    'deprecated'
  ));

ALTER TABLE public.nutrition_food_nutrients
  DROP CONSTRAINT IF EXISTS nutrition_food_nutrients_verification_status_check;

ALTER TABLE public.nutrition_food_nutrients
  ADD CONSTRAINT nutrition_food_nutrients_verification_status_check
  CHECK (verification_status IN (
    'unverified',
    'needs_review',
    'partially_verified',
    'verified',
    'rejected',
    'deprecated'
  ));

UPDATE public.nutrition_foods
SET verification_status = CASE WHEN is_verified IS TRUE THEN 'verified' ELSE 'unverified' END
WHERE verification_status = 'unverified';

UPDATE public.nutrition_food_nutrients
SET verification_status = CASE WHEN is_verified IS TRUE THEN 'verified' ELSE 'unverified' END
WHERE verification_status = 'unverified';

UPDATE public.nutrition_food_servings
SET verification_status = 'unverified'
WHERE verification_status IS NULL;

INSERT INTO public.nutrition_physical_states (code, name, description, display_order)
VALUES
  ('raw', 'Crudo', 'Sin coccion ni tratamiento termico.', 10),
  ('cooked', 'Cocido', 'Preparado con calor sin metodo especificado.', 20),
  ('dried', 'Seco', 'Deshidratado o seco.', 30),
  ('frozen', 'Congelado', 'Conservado congelado.', 40),
  ('canned', 'Enlatado', 'Conservado en lata o envase equivalente.', 50),
  ('drained', 'Escurrido', 'Alimento escurrido despues de conservarse en liquido.', 60),
  ('ready_to_eat', 'Listo para comer', 'Producto listo para consumo.', 70),
  ('unknown', 'Desconocido', 'Estado fisico no especificado.', 999)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

INSERT INTO public.nutrition_preparation_methods (code, name, description, display_order)
VALUES
  ('none', 'Sin metodo', 'No aplica metodo de preparacion.', 5),
  ('boiled', 'Hervido', 'Coccion en agua o liquido caliente.', 10),
  ('steamed', 'Al vapor', 'Coccion por vapor.', 20),
  ('grilled', 'A la parrilla', 'Coccion sobre parrilla.', 30),
  ('roasted', 'Asado', 'Coccion con calor seco.', 40),
  ('baked', 'Horneado', 'Coccion en horno.', 50),
  ('pan_seared', 'Sellado en sarten', 'Coccion en sarten con contacto directo.', 60),
  ('fried', 'Frito', 'Coccion por fritura.', 70),
  ('air_fried', 'Freidora de aire', 'Coccion con aire caliente circulante.', 80),
  ('poached', 'Escalfado', 'Coccion suave en liquido.', 90),
  ('scrambled', 'Revuelto', 'Preparacion revuelta durante coccion.', 100),
  ('microwaved', 'Microondas', 'Preparado en microondas.', 110),
  ('unknown', 'Desconocido', 'Metodo no especificado.', 999)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

INSERT INTO public.nutrition_units (code, name, dimension, grams_multiplier, milliliters_multiplier, is_metric)
VALUES
  ('oz', 'onza', 'mass', 28.3495, NULL, false),
  ('lb', 'libra', 'mass', 453.592, NULL, false),
  ('fl_oz', 'onza fluida', 'volume', NULL, 29.5735, false),
  ('slice', 'rebanada', 'count', NULL, NULL, false),
  ('package', 'paquete', 'count', NULL, NULL, false),
  ('can', 'lata', 'count', NULL, NULL, false),
  ('bottle', 'botella', 'count', NULL, NULL, false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  dimension = EXCLUDED.dimension,
  grams_multiplier = EXCLUDED.grams_multiplier,
  milliliters_multiplier = EXCLUDED.milliliters_multiplier,
  is_metric = EXCLUDED.is_metric;

INSERT INTO public.nutrition_categories (name, normalized_name, category_level, locale, metadata)
SELECT v.name, v.normalized_name, 'category', 'es-MX', jsonb_build_object('source', 'architecture_correction_base_taxonomy')
FROM (
  VALUES
    ('Huevos', 'huevos'),
    ('Carnes y aves', 'carnes y aves'),
    ('Pescados y mariscos', 'pescados y mariscos'),
    ('Lacteos', 'lacteos'),
    ('Cereales y granos', 'cereales y granos'),
    ('Panes y tortillas', 'panes y tortillas'),
    ('Legumbres', 'legumbres'),
    ('Frutas', 'frutas'),
    ('Verduras', 'verduras'),
    ('Tuberculos', 'tuberculos'),
    ('Frutos secos y semillas', 'frutos secos y semillas'),
    ('Aceites y grasas', 'aceites y grasas'),
    ('Bebidas', 'bebidas'),
    ('Condimentos', 'condimentos'),
    ('Suplementos', 'suplementos'),
    ('Comidas preparadas', 'comidas preparadas'),
    ('Productos comerciales', 'productos comerciales'),
    ('Restaurantes', 'restaurantes')
) AS v(name, normalized_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.nutrition_categories c
  WHERE c.normalized_name = v.normalized_name
    AND c.category_level = 'category'
    AND c.locale = 'es-MX'
);

ALTER TABLE public.nutrition_physical_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_preparation_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_canonical_food_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_food_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_food_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutrition physical states read" ON public.nutrition_physical_states;
CREATE POLICY "Nutrition physical states read"
ON public.nutrition_physical_states
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Nutrition preparation methods read" ON public.nutrition_preparation_methods;
CREATE POLICY "Nutrition preparation methods read"
ON public.nutrition_preparation_methods
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Nutrition canonical groups read" ON public.nutrition_canonical_food_groups;
CREATE POLICY "Nutrition canonical groups read"
ON public.nutrition_canonical_food_groups
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Nutrition group members read" ON public.nutrition_food_group_members;
CREATE POLICY "Nutrition group members read"
ON public.nutrition_food_group_members
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Nutrition food relationships read" ON public.nutrition_food_relationships;
CREATE POLICY "Nutrition food relationships read"
ON public.nutrition_food_relationships
FOR SELECT
USING (true);

GRANT SELECT ON public.nutrition_physical_states TO authenticated, anon;
GRANT SELECT ON public.nutrition_preparation_methods TO authenticated, anon;
GRANT SELECT ON public.nutrition_canonical_food_groups TO authenticated, anon;
GRANT SELECT ON public.nutrition_food_group_members TO authenticated, anon;
GRANT SELECT ON public.nutrition_food_relationships TO authenticated, anon;

COMMENT ON TABLE public.nutrition_canonical_food_groups IS
  'Canonical food concepts used to group nutrition_foods variants without merging their nutrient records.';
COMMENT ON TABLE public.nutrition_food_group_members IS
  'Membership of nutrition_foods inside canonical groups, including variant role, UI visibility, physical state and preparation method.';
COMMENT ON TABLE public.nutrition_food_relationships IS
  'Explicit food-to-food relationships such as components, variants, preparations and derivatives.';
COMMENT ON COLUMN public.nutrition_foods.verification_status IS
  'Editorial verification state. Keep is_verified for legacy compatibility; verified maps to true, other states map to false.';

COMMIT;
