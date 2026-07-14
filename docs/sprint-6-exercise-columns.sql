-- Sprint 6: list real current columns from public.exercises.
-- Read-only query.

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exercises'
ORDER BY ordinal_position;
