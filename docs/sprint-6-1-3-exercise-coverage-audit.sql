-- Sprint 6.1.3 exercise coverage audit.
-- Read-only coverage summary after applying the Sprint 6.1.3 migration.

WITH research_catalog(nombre, category, expected_action, added, reason) AS (
  VALUES
  ('Remo ergómetro','espalda/cardio','existing_corrected',true,NULL),
  ('Remo en polea sentado','espalda','existing_renamed',true,NULL),
  ('Remo con barra inclinado','espalda','existing_renamed',true,NULL),
  ('Remo con mancuerna a una mano','espalda','existing_improved',true,NULL),
  ('Remo en T','espalda','added',true,NULL),
  ('Remo pecho apoyado','espalda','added',true,NULL),
  ('Curl de bíceps con barra','biceps','existing_improved',true,NULL),
  ('Curl inclinado con mancuernas','biceps','added',true,NULL),
  ('Curl martillo con mancuernas','biceps','existing_improved',true,NULL),
  ('Curl predicador','biceps','added',true,NULL),
  ('Curl concentrado','biceps','added',true,NULL),
  ('Curl en polea baja','biceps','added',true,NULL),
  ('Curl invertido con barra','biceps/antebrazo','added',true,NULL),
  ('Pushdown de tríceps en polea','triceps','added',true,NULL),
  ('Extensión de tríceps por encima de la cabeza con mancuerna','triceps','existing_renamed',true,NULL),
  ('Press francés con barra','triceps','existing_improved',true,NULL),
  ('Fondos en paralelas para pecho','pecho/triceps','existing',true,NULL),
  ('Fondos en banco para tríceps','triceps','existing',true,NULL),
  ('Patada de tríceps con mancuernas','triceps','existing',true,NULL),
  ('Press de banca con barra','pecho','existing',true,NULL),
  ('Press de banca con mancuernas','pecho','existing',true,NULL),
  ('Press inclinado con barra','pecho','existing_improved',true,NULL),
  ('Press inclinado con mancuernas','pecho','added',true,NULL),
  ('Press declinado','pecho','not_added',false,'Variante util pero menos prioritaria para beta; cubierta por press plano/inclinado y fondos.'),
  ('Aperturas con mancuernas','pecho','existing_improved',true,NULL),
  ('Aperturas en polea','pecho','existing',true,NULL),
  ('Press en máquina de pecho','pecho','added',true,NULL),
  ('Lagartijas','pecho','existing',true,NULL),
  ('Lagartijas inclinadas','pecho','added',true,NULL),
  ('Lagartijas declinadas','pecho','added',true,NULL),
  ('Press militar con barra','hombros','existing_improved',true,NULL),
  ('Press de hombro con mancuernas','hombros','existing',true,NULL),
  ('Arnold press','hombros','added',true,NULL),
  ('Landmine press','hombros','added',true,NULL),
  ('Remo vertical con barra EZ','hombros','added_review',true,'Marcado revisar por posible molestia de hombro en algunos usuarios.'),
  ('Sentadilla con peso corporal','piernas','added',true,NULL),
  ('Sentadilla con barra','piernas','existing',true,NULL),
  ('Sentadilla goblet','piernas','existing',true,NULL),
  ('Prensa de piernas','piernas','existing_improved',true,NULL),
  ('Extensión de cuadríceps','piernas','existing',true,NULL),
  ('Zancadas con mancuernas','piernas','existing',true,NULL),
  ('Desplantes caminando','piernas','added',true,NULL),
  ('Sentadilla búlgara con mancuernas','piernas','existing',true,NULL),
  ('Step-ups','piernas','added',true,NULL),
  ('Peso muerto rumano con mancuernas','piernas','existing_improved',true,NULL),
  ('Peso muerto rumano con barra','piernas','converted_existing',true,NULL),
  ('Peso muerto rumano a una pierna con mancuerna','piernas','added',true,NULL),
  ('Curl femoral en máquina','piernas','existing_renamed',true,NULL),
  ('Curl femoral con pelota','piernas','added',true,NULL),
  ('Puente de glúteo','gluteos','existing',true,NULL),
  ('Puente de glúteo con carga','gluteos','existing',true,NULL),
  ('Hip thrust con barra','gluteos','existing',true,NULL),
  ('Patada de glúteo en polea','gluteos','added',true,NULL),
  ('Abducción de cadera con banda','gluteos','added',true,NULL),
  ('Elevación de talones de pie con mancuernas','pantorrillas','existing_renamed',true,NULL),
  ('Elevación de talones sentado','pantorrillas','added',true,NULL),
  ('Elevación de talones en escalón','pantorrillas','added',true,NULL),
  ('Elevación de talones en máquina','pantorrillas','not_added',false,'Cubierta por elevacion de pie/sentado/escalon; se puede agregar cuando haya mas maquina-specific UX.'),
  ('Caminata del granjero','antebrazos','added',true,NULL),
  ('Curl de muñeca con barra','antebrazos','added',true,NULL),
  ('Curl inverso de muñeca','antebrazos','added',true,NULL),
  ('Plancha abdominal','core','existing',true,NULL),
  ('Crunch abdominal','core','existing_improved',true,NULL),
  ('Crunch en polea','core','existing',true,NULL),
  ('Giro ruso con mancuerna','core','existing',true,NULL),
  ('Elevaciones de piernas','core','existing',true,NULL),
  ('Escaladores','core','existing',true,NULL),
  ('Bird dog','core','existing_improved',true,NULL),
  ('Dead bug','core','added',true,NULL),
  ('Hollow hold','core','added',true,NULL),
  ('Dragon flag','core','existing',true,NULL)
),
normalized_exercises AS (
  SELECT id, nombre, lower(regexp_replace(trim(nombre), '\s+', ' ', 'g')) AS normalized_name, estado_calidad
  FROM public.exercises
)
SELECT 'summary' AS section, 'total_exercises' AS metric, count(*)::text AS value, NULL::text AS detail
FROM public.exercises
UNION ALL
SELECT 'summary', 'sprint_6_1_3_added_exercises', count(*)::text, NULL
FROM public.exercises
WHERE id LIKE 'sf-%'
UNION ALL
SELECT 'summary', 'research_items_existing_or_added', count(*)::text, NULL
FROM research_catalog
WHERE added = true
UNION ALL
SELECT 'summary', 'research_items_not_added', count(*)::text, string_agg(nombre || ': ' || reason, ' | ')
FROM research_catalog
WHERE added = false
UNION ALL
SELECT 'coverage', 'research_item_missing_in_db', count(*)::text, string_agg(rc.nombre, ', ')
FROM research_catalog rc
LEFT JOIN normalized_exercises e ON e.normalized_name = lower(regexp_replace(trim(rc.nombre), '\s+', ' ', 'g'))
WHERE rc.added = true AND e.id IS NULL
UNION ALL
SELECT 'quality', 'potential_duplicate_names', count(*)::text, NULL
FROM (
  SELECT lower(regexp_replace(trim(nombre), '\s+', ' ', 'g'))
  FROM public.exercises
  GROUP BY 1
  HAVING count(*) > 1
) duplicates
UNION ALL
SELECT 'quality', 'metadata_incomplete', count(*)::text, NULL
FROM public.exercises
WHERE musculo_principal IS NULL
   OR patron_movimiento IS NULL
   OR array_length(instrucciones, 1) IS NULL
   OR array_length(sustituciones, 1) IS NULL
   OR array_length(progresiones, 1) IS NULL
   OR array_length(regresiones, 1) IS NULL
UNION ALL
SELECT 'quality', 'generic_descriptions', count(*)::text, NULL
FROM public.exercises
WHERE descripcion ILIKE '%requiere control tecnico%'
   OR descripcion ILIKE '%requiere control técnico%'
UNION ALL
SELECT 'quality', 'general_muscle_groups', count(*)::text, string_agg(id || ':' || nombre, ', ')
FROM public.exercises
WHERE lower(coalesce(musculo_principal, '')) IN ('pecho','espalda','piernas','brazos','hombros','gluteos','core','cardio')
UNION ALL
SELECT 'review', 'variant_name_metadata_mismatch', count(*)::text, string_agg(id || ':' || nombre, ', ')
FROM public.exercises
WHERE (nombre ILIKE '%mancuerna%' AND array_to_string(equipo_requerido, ',') NOT ILIKE '%mancuerna%')
   OR (nombre ILIKE '%barra%' AND array_to_string(equipo_requerido, ',') NOT ILIKE '%barra%')
   OR (nombre ILIKE '%polea%' AND array_to_string(equipo_requerido, ',') NOT ILIKE '%polea%');

