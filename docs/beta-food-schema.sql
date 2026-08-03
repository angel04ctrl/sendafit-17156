-- Beta Nutrition Sprint 1A - Schema real del sistema nutricional.
-- Read-only. Ejecutar en Supabase SQL Editor.
-- Devuelve columnas, tipos, defaults, constraints, PK, FK, indices, triggers, policies, vistas, funciones y enums relacionados con nutricion.

WITH nutrition_keywords AS (
  SELECT ARRAY[
    'food','foods','meal','meals','nutrition','nutri','macro','macros','calorie','calories','caloria','calorias',
    'protein','proteina','proteinas','carb','carbs','carbohidrato','carbohidratos','fat','grasas','grasa',
    'recipe','receta','ingredient','ingrediente','ingredients','ingredientes','portion','porcion','porciones',
    'serving','unit','unidad','barcode','brand','marca','micronutrient','vitamin','mineral','sodium','fiber','sugar',
    'fdc','usda','source_license','meal_plan'
  ]::text[] AS terms
), known_tables AS (
  SELECT 'public'::text AS table_schema, unnest(ARRAY[
    'foods',
    'meals',
    'meal_ingredients',
    'food_analysis_logs',
    'profiles',
    'ai_trainer_conversations',
    'coach_actions',
    'ai_function_usage'
  ]::text[]) AS table_name
), keyword_tables AS (
  SELECT DISTINCT c.table_schema, c.table_name
  FROM information_schema.columns c
  CROSS JOIN nutrition_keywords k
  WHERE c.table_schema = 'public'
    AND (
      EXISTS (SELECT 1 FROM unnest(k.terms) term WHERE lower(c.table_name) LIKE '%' || term || '%')
      OR EXISTS (SELECT 1 FROM unnest(k.terms) term WHERE lower(c.column_name) LIKE '%' || term || '%')
    )
), selected_tables AS (
  SELECT * FROM known_tables
  UNION
  SELECT * FROM keyword_tables
), existing_tables AS (
  SELECT st.table_schema, st.table_name
  FROM selected_tables st
  JOIN information_schema.tables t
    ON t.table_schema = st.table_schema
   AND t.table_name = st.table_name
), columns AS (
  SELECT
    'column'::text AS object_kind,
    c.table_schema,
    c.table_name,
    c.column_name AS object_name,
    c.ordinal_position,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    NULL::text AS constraint_name,
    NULL::text AS constraint_type,
    NULL::text AS constraint_definition,
    NULL::text AS foreign_table,
    NULL::text AS foreign_column,
    NULL::text AS index_name,
    NULL::text AS index_definition,
    NULL::text AS trigger_name,
    NULL::text AS trigger_definition,
    NULL::text AS policy_name,
    NULL::text AS policy_command,
    NULL::text AS policy_roles,
    NULL::text AS policy_using,
    NULL::text AS policy_check
  FROM information_schema.columns c
  JOIN existing_tables et
    ON et.table_schema = c.table_schema
   AND et.table_name = c.table_name
), constraints AS (
  SELECT
    'constraint'::text AS object_kind,
    n.nspname AS table_schema,
    cls.relname AS table_name,
    a.attname AS object_name,
    NULL::integer AS ordinal_position,
    NULL::text AS data_type,
    NULL::text AS udt_name,
    NULL::text AS is_nullable,
    NULL::text AS column_default,
    con.conname AS constraint_name,
    CASE con.contype
      WHEN 'p' THEN 'PRIMARY KEY'
      WHEN 'f' THEN 'FOREIGN KEY'
      WHEN 'u' THEN 'UNIQUE'
      WHEN 'c' THEN 'CHECK'
      WHEN 'x' THEN 'EXCLUDE'
      ELSE con.contype::text
    END AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition,
    nf.nspname || '.' || cf.relname AS foreign_table,
    af.attname AS foreign_column,
    NULL::text AS index_name,
    NULL::text AS index_definition,
    NULL::text AS trigger_name,
    NULL::text AS trigger_definition,
    NULL::text AS policy_name,
    NULL::text AS policy_command,
    NULL::text AS policy_roles,
    NULL::text AS policy_using,
    NULL::text AS policy_check
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cls.relnamespace
  JOIN existing_tables et ON et.table_schema = n.nspname AND et.table_name = cls.relname
  LEFT JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
  LEFT JOIN pg_attribute a ON a.attrelid = cls.oid AND a.attnum = ck.attnum
  LEFT JOIN pg_class cf ON cf.oid = con.confrelid
  LEFT JOIN pg_namespace nf ON nf.oid = cf.relnamespace
  LEFT JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = ck.ord
  LEFT JOIN pg_attribute af ON af.attrelid = cf.oid AND af.attnum = fk.attnum
), indexes AS (
  SELECT
    'index'::text AS object_kind,
    schemaname AS table_schema,
    tablename AS table_name,
    NULL::text AS object_name,
    NULL::integer AS ordinal_position,
    NULL::text AS data_type,
    NULL::text AS udt_name,
    NULL::text AS is_nullable,
    NULL::text AS column_default,
    NULL::text AS constraint_name,
    NULL::text AS constraint_type,
    NULL::text AS constraint_definition,
    NULL::text AS foreign_table,
    NULL::text AS foreign_column,
    indexname AS index_name,
    indexdef AS index_definition,
    NULL::text AS trigger_name,
    NULL::text AS trigger_definition,
    NULL::text AS policy_name,
    NULL::text AS policy_command,
    NULL::text AS policy_roles,
    NULL::text AS policy_using,
    NULL::text AS policy_check
  FROM pg_indexes i
  JOIN existing_tables et ON et.table_schema = i.schemaname AND et.table_name = i.tablename
), triggers AS (
  SELECT
    'trigger'::text AS object_kind,
    event_object_schema AS table_schema,
    event_object_table AS table_name,
    NULL::text AS object_name,
    NULL::integer AS ordinal_position,
    NULL::text AS data_type,
    NULL::text AS udt_name,
    NULL::text AS is_nullable,
    NULL::text AS column_default,
    NULL::text AS constraint_name,
    NULL::text AS constraint_type,
    NULL::text AS constraint_definition,
    NULL::text AS foreign_table,
    NULL::text AS foreign_column,
    NULL::text AS index_name,
    NULL::text AS index_definition,
    trigger_name,
    action_timing || ' ' || event_manipulation || ' EXECUTE ' || action_statement AS trigger_definition,
    NULL::text AS policy_name,
    NULL::text AS policy_command,
    NULL::text AS policy_roles,
    NULL::text AS policy_using,
    NULL::text AS policy_check
  FROM information_schema.triggers t
  JOIN existing_tables et ON et.table_schema = t.event_object_schema AND et.table_name = t.event_object_table
), policies AS (
  SELECT
    'policy'::text AS object_kind,
    schemaname AS table_schema,
    tablename AS table_name,
    NULL::text AS object_name,
    NULL::integer AS ordinal_position,
    NULL::text AS data_type,
    NULL::text AS udt_name,
    NULL::text AS is_nullable,
    NULL::text AS column_default,
    NULL::text AS constraint_name,
    NULL::text AS constraint_type,
    NULL::text AS constraint_definition,
    NULL::text AS foreign_table,
    NULL::text AS foreign_column,
    NULL::text AS index_name,
    NULL::text AS index_definition,
    NULL::text AS trigger_name,
    NULL::text AS trigger_definition,
    policyname AS policy_name,
    cmd AS policy_command,
    roles::text AS policy_roles,
    qual AS policy_using,
    with_check AS policy_check
  FROM pg_policies p
  JOIN existing_tables et ON et.table_schema = p.schemaname AND et.table_name = p.tablename
), enums AS (
  SELECT
    'enum'::text AS object_kind,
    n.nspname AS table_schema,
    t.typname AS table_name,
    e.enumlabel AS object_name,
    e.enumsortorder::integer AS ordinal_position,
    'enum_value'::text AS data_type,
    t.typname AS udt_name,
    NULL::text AS is_nullable,
    NULL::text AS column_default,
    NULL::text AS constraint_name,
    NULL::text AS constraint_type,
    NULL::text AS constraint_definition,
    NULL::text AS foreign_table,
    NULL::text AS foreign_column,
    NULL::text AS index_name,
    NULL::text AS index_definition,
    NULL::text AS trigger_name,
    NULL::text AS trigger_definition,
    NULL::text AS policy_name,
    NULL::text AS policy_command,
    NULL::text AS policy_roles,
    NULL::text AS policy_using,
    NULL::text AS policy_check
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname IN ('meal_type')
)
SELECT * FROM columns
UNION ALL SELECT * FROM constraints
UNION ALL SELECT * FROM indexes
UNION ALL SELECT * FROM triggers
UNION ALL SELECT * FROM policies
UNION ALL SELECT * FROM enums
ORDER BY table_schema, table_name, object_kind, ordinal_position NULLS LAST, object_name NULLS LAST, constraint_name NULLS LAST, index_name NULLS LAST, trigger_name NULLS LAST, policy_name NULLS LAST;
