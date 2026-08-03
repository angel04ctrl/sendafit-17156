-- Nutrition import v2.1 - batch-specific rollback helper.
--
-- Replace __BATCH_ID__ with the import_batch_id shown in import-report.json.
-- This rollback is scoped to one import batch. It does not touch users,
-- logs, legacy tables, workouts, subscriptions or frontend state.
--
-- Prefer the script rollback when possible:
-- npx tsx scripts/nutrition/import-nutrition-v2.1.ts --mode rollback --batch-id <uuid> --confirm ROLLBACK_NUTRITION_V2_1

BEGIN;

WITH target_batch AS (
  SELECT '__BATCH_ID__'::uuid AS id
)
DELETE FROM public.nutrition_food_relationships r
USING target_batch b
WHERE r.metadata ->> 'import_batch_id' = b.id::text;

WITH target_batch AS (
  SELECT '__BATCH_ID__'::uuid AS id
)
DELETE FROM public.nutrition_food_group_members m
USING target_batch b
WHERE m.metadata ->> 'import_batch_id' = b.id::text;

WITH target_batch AS (
  SELECT '__BATCH_ID__'::uuid AS id
)
DELETE FROM public.nutrition_canonical_food_groups g
USING target_batch b
WHERE g.metadata ->> 'import_batch_id' = b.id::text;

WITH target_batch AS (
  SELECT '__BATCH_ID__'::uuid AS id
)
DELETE FROM public.nutrition_foods f
USING target_batch b
WHERE f.metadata ->> 'import_batch_id' = b.id::text
  AND f.legacy_food_id IS NULL;

WITH target_batch AS (
  SELECT '__BATCH_ID__'::uuid AS id
)
UPDATE public.nutrition_import_batches i
SET status = 'rolled_back',
    finished_at = now()
FROM target_batch b
WHERE i.id = b.id;

COMMIT;

-- Verification: should return the batch as rolled_back.
SELECT id, import_name, status, started_at, finished_at
FROM public.nutrition_import_batches
WHERE id = '__BATCH_ID__'::uuid;
