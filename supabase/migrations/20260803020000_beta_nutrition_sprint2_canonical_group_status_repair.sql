-- Beta Nutrition Sprint 2 - Repair canonical groups hidden by deprecated variants.
-- Safe and idempotent: only reactivates deprecated groups that already contain
-- at least one global, visible, non-deprecated UI variant.

BEGIN;

WITH eligible_groups AS (
  SELECT DISTINCT m.group_id
  FROM public.nutrition_food_group_members m
  JOIN public.nutrition_foods f ON f.id = m.food_id
  WHERE m.is_ui_visible IS TRUE
    AND f.scope = 'global'
    AND f.is_visible IS TRUE
    AND f.verification_status NOT IN ('deprecated', 'rejected')
)
UPDATE public.nutrition_canonical_food_groups g
SET
  status = 'active',
  metadata = COALESCE(g.metadata, '{}'::jsonb) || jsonb_build_object(
    'sprint2_group_status_repair', true,
    'sprint2_group_status_repaired_at', now()
  ),
  updated_at = now()
FROM eligible_groups eligible
WHERE g.id = eligible.group_id
  AND g.status = 'deprecated';

DO $validation$
DECLARE
  unresolved_count integer;
  unresolved_names text;
BEGIN
  SELECT
    COUNT(*),
    string_agg(f.display_name, ', ' ORDER BY f.display_name)
  INTO unresolved_count, unresolved_names
  FROM public.nutrition_foods f
  WHERE f.scope = 'global'
    AND f.is_visible IS TRUE
    AND f.verification_status NOT IN ('deprecated', 'rejected')
    AND NOT EXISTS (
      SELECT 1
      FROM public.nutrition_food_group_members m
      JOIN public.nutrition_canonical_food_groups g ON g.id = m.group_id
      WHERE m.food_id = f.id
        AND m.is_ui_visible IS TRUE
        AND g.status = 'active'
    );

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'Sprint 2 canonical group repair left % visible foods unresolved: %',
      unresolved_count,
      unresolved_names;
  END IF;
END
$validation$;

COMMIT;
