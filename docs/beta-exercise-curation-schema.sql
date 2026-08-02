-- Beta Exercise Sprint 1 - Schema real de public.exercises.
-- Read-only. Ejecutar en Supabase SQL Editor.

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exercises'
ORDER BY ordinal_position;
