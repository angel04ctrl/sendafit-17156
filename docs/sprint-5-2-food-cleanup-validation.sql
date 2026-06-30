-- Sprint 5.2 food cleanup validation queries.

-- 1. Mojibake in visible food fields.
-- Catches double-encoded and simple mojibake, e.g. ArÃ¡ndanos, Muffin de arÃ¡ndano.
SELECT id, nombre, name, display_name, search_name, description
FROM public.foods
WHERE coalesce(nombre, '') ~ '(Ã|Â|ï¿½|â€)'
   OR coalesce(name, '') ~ '(Ã|Â|ï¿½|â€)'
   OR coalesce(display_name, '') ~ '(Ã|Â|ï¿½|â€)'
   OR coalesce(search_name, '') ~ '(Ã|Â|ï¿½|â€)'
   OR coalesce(description, '') ~ '(Ã|Â|ï¿½|â€)';

-- 2. Foods missing display/search names.
SELECT id, nombre, name, display_name, search_name
FROM public.foods
WHERE display_name IS NULL
   OR trim(display_name) = ''
   OR search_name IS NULL
   OR trim(search_name) = '';

-- 3. USDA foods without FDC ID or source metadata.
SELECT id, display_name, source, source_license, fdc_id
FROM public.foods
WHERE source = 'USDA_FDC'
  AND (fdc_id IS NULL OR source_license IS NULL OR source_license <> 'CC0_1_0');

-- 4. Foods without source.
SELECT id, nombre, display_name, source
FROM public.foods
WHERE source IS NULL OR source = '';

-- 5. Foods without usable macros per 100 g.
SELECT id, display_name, source, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
FROM public.foods
WHERE calories_per_100g IS NULL
   OR protein_per_100g IS NULL
   OR carbs_per_100g IS NULL
   OR fat_per_100g IS NULL;

-- 6. Duplicate USDA FDC IDs.
SELECT fdc_id, count(*) AS duplicate_count
FROM public.foods
WHERE fdc_id IS NOT NULL
GROUP BY fdc_id
HAVING count(*) > 1;

-- 7. Duplicate visible display names.
SELECT lower(display_name) AS display_name_key, count(*) AS duplicate_count, array_agg(id ORDER BY id) AS food_ids
FROM public.foods
WHERE is_visible = true
  AND display_name IS NOT NULL
GROUP BY lower(display_name)
HAVING count(*) > 1;

-- 8. Visible raw meats or foods that should not appear in normal beta search.
SELECT id, display_name, name, description, source, is_visible
FROM public.foods
WHERE is_visible = true
  AND (
    search_name LIKE '%raw chicken%'
    OR search_name LIKE '%chicken raw%'
    OR search_name LIKE '%raw beef%'
    OR search_name LIKE '%beef raw%'
    OR search_name LIKE '%raw turkey%'
    OR search_name LIKE '%turkey raw%'
    OR search_name LIKE '%raw pork%'
    OR search_name LIKE '%pork raw%'
    OR search_name LIKE '%ground beef raw%'
    OR search_name LIKE '%pollo crudo%'
    OR search_name LIKE '%pechuga de pollo cruda%'
    OR search_name LIKE '%carne cruda%'
    OR search_name LIKE '%pavo crudo%'
    OR search_name LIKE '%cerdo crudo%'
    OR search_name LIKE '%arroz crudo%'
    OR search_name LIKE '%pasta seca%'
    OR search_name LIKE '%papa cruda%'
  );

-- 9. Visible foods with technical names that need manual review.
SELECT id, display_name, name, description, length(display_name) AS display_name_length
FROM public.foods
WHERE is_visible = true
  AND (
    length(display_name) > 70
    OR display_name ILIKE '%,%,%'
    OR display_name ILIKE '%skinless%'
    OR display_name ILIKE '%boneless%'
    OR display_name ILIKE '%without salt%'
  )
ORDER BY visibility_priority, display_name;

-- 10. Search priority preview for pollo/res/arandanos.
SELECT id, display_name, search_name, is_visible, is_common, visibility_priority, source, fdc_id
FROM public.foods
WHERE search_name LIKE '%pollo%'
   OR search_name LIKE '%chicken%'
   OR search_name LIKE '%res%'
   OR search_name LIKE '%beef%'
   OR search_name LIKE '%arandano%'
   OR search_name LIKE '%blueberr%'
ORDER BY is_visible DESC, is_common DESC, visibility_priority ASC, display_name ASC;
