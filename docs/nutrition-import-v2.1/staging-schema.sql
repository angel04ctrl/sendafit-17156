-- Nutrition import v2.1 - staging and audit infrastructure.
-- Safe to run multiple times. Does not modify catalog data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nutrition_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_name text NOT NULL,
  file_sha256 text NOT NULL,
  mode text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT nutrition_import_batches_status_check
  CHECK (status IN ('pending', 'dry_run', 'applying', 'committed', 'rolled_back', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.nutrition_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL REFERENCES public.nutrition_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  client_key text,
  food_id uuid,
  row_checksum text NOT NULL,
  raw_row jsonb NOT NULL,
  parsed_json jsonb NOT NULL,
  parse_status text NOT NULL DEFAULT 'valid',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, row_number)
);

CREATE TABLE IF NOT EXISTS public.nutrition_import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid REFERENCES public.nutrition_import_batches(id) ON DELETE CASCADE,
  row_number integer,
  severity text NOT NULL,
  check_name text NOT NULL,
  details text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nutrition_import_entity_map (
  import_batch_id uuid NOT NULL REFERENCES public.nutrition_import_batches(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  client_key text NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (import_batch_id, entity_type, client_key)
);

CREATE TABLE IF NOT EXISTS public.nutrition_import_backups (
  import_batch_id uuid NOT NULL REFERENCES public.nutrition_import_batches(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  entity_id text NOT NULL,
  operation text NOT NULL,
  before_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (import_batch_id, table_name, entity_id)
);

CREATE INDEX IF NOT EXISTS nutrition_import_batches_name_created_idx
  ON public.nutrition_import_batches (import_name, started_at DESC);

CREATE INDEX IF NOT EXISTS nutrition_import_rows_batch_client_key_idx
  ON public.nutrition_import_rows (import_batch_id, client_key);

COMMIT;
