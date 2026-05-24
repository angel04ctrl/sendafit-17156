-- Rebuild predesigned plan exercises by anatomical split.
-- The previous seed mixed unrelated muscle groups inside the same plan day
-- (for example: Pecho days containing Piernas/Core exercises).

CREATE TABLE IF NOT EXISTS plan_ejercicios_backup_20260524 AS
SELECT *
FROM plan_ejercicios;

CREATE TEMP TABLE sf_plan_day_groups (
  plan_id text NOT NULL,
  dia integer NOT NULL,
  group_order integer NOT NULL,
  grupo text NOT NULL,
  take_count integer NOT NULL
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.sf_add_day(
  p_plan_id text,
  p_dia integer,
  p_groups text[],
  p_counts integer[]
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO sf_plan_day_groups (plan_id, dia, group_order, grupo, take_count)
  SELECT p_plan_id, p_dia, group_order::integer, grupo, p_counts[group_order::integer]
  FROM unnest(p_groups) WITH ORDINALITY AS groups(grupo, group_order);
$$;

-- 1 day: Full Body
SELECT pg_temp.sf_add_day(id, 1, ARRAY['Pecho','Espalda','Piernas','Hombros','Core'], ARRAY[1,1,1,1,1])
FROM predesigned_plans
WHERE id IN ('101','201','202','301','302');

-- 2 days: Torso / Pierna or Full Body A/B
SELECT pg_temp.sf_add_day(id, 1, ARRAY['Pecho','Espalda','Hombros','Brazos'], ARRAY[2,2,1,1])
FROM predesigned_plans
WHERE id IN ('102','203','204','303','304');
SELECT pg_temp.sf_add_day(id, 2, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('102','203','204','303','304');

-- 3 days: PPL or Full Body variants
SELECT pg_temp.sf_add_day(id, 1, ARRAY['Pecho','Hombros','Brazos'], ARRAY[2,2,1])
FROM predesigned_plans
WHERE id IN ('103','205','206','207','208','305','306');
SELECT pg_temp.sf_add_day(id, 2, ARRAY['Espalda','Brazos'], ARRAY[3,2])
FROM predesigned_plans
WHERE id IN ('103','205','206','207','208','305','306');
SELECT pg_temp.sf_add_day(id, 3, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('103','205','206','207','208','305','306');

-- 4 days: Torso / Pierna x2
SELECT pg_temp.sf_add_day(id, 1, ARRAY['Pecho','Espalda','Hombros','Brazos'], ARRAY[2,2,1,1])
FROM predesigned_plans
WHERE id IN ('104','209','210','307','308');
SELECT pg_temp.sf_add_day(id, 2, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('104','209','210','307','308');
SELECT pg_temp.sf_add_day(id, 3, ARRAY['Pecho','Espalda','Hombros','Brazos'], ARRAY[2,2,1,1])
FROM predesigned_plans
WHERE id IN ('104','209','210','307','308');
SELECT pg_temp.sf_add_day(id, 4, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('104','209','210','307','308');

-- 5 days: Bro split and PPL + Torso/Pierna
SELECT pg_temp.sf_add_day(id, 1, ARRAY['Pecho'], ARRAY[5])
FROM predesigned_plans
WHERE id IN ('105','211');
SELECT pg_temp.sf_add_day(id, 2, ARRAY['Espalda'], ARRAY[5])
FROM predesigned_plans
WHERE id IN ('105','211');
SELECT pg_temp.sf_add_day(id, 3, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('105','211');
SELECT pg_temp.sf_add_day(id, 4, ARRAY['Hombros'], ARRAY[5])
FROM predesigned_plans
WHERE id IN ('105','211');
SELECT pg_temp.sf_add_day(id, 5, ARRAY['Brazos'], ARRAY[5])
FROM predesigned_plans
WHERE id IN ('105','211');

SELECT pg_temp.sf_add_day(id, 1, ARRAY['Pecho','Hombros','Brazos'], ARRAY[2,2,1])
FROM predesigned_plans
WHERE id IN ('212','309','310');
SELECT pg_temp.sf_add_day(id, 2, ARRAY['Espalda','Brazos'], ARRAY[3,2])
FROM predesigned_plans
WHERE id IN ('212','309','310');
SELECT pg_temp.sf_add_day(id, 3, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('212','309','310');
SELECT pg_temp.sf_add_day(id, 4, ARRAY['Pecho','Espalda','Hombros','Brazos'], ARRAY[2,2,1,1])
FROM predesigned_plans
WHERE id IN ('212','309','310');
SELECT pg_temp.sf_add_day(id, 5, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('212','309','310');

-- 6 days: PPL x2
SELECT pg_temp.sf_add_day(id, 1, ARRAY['Pecho','Hombros','Brazos'], ARRAY[2,2,1])
FROM predesigned_plans
WHERE id IN ('213','214','311','312');
SELECT pg_temp.sf_add_day(id, 2, ARRAY['Espalda','Brazos'], ARRAY[3,2])
FROM predesigned_plans
WHERE id IN ('213','214','311','312');
SELECT pg_temp.sf_add_day(id, 3, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('213','214','311','312');
SELECT pg_temp.sf_add_day(id, 4, ARRAY['Pecho','Hombros','Brazos'], ARRAY[2,2,1])
FROM predesigned_plans
WHERE id IN ('213','214','311','312');
SELECT pg_temp.sf_add_day(id, 5, ARRAY['Espalda','Brazos'], ARRAY[3,2])
FROM predesigned_plans
WHERE id IN ('213','214','311','312');
SELECT pg_temp.sf_add_day(id, 6, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('213','214','311','312');

-- 7 days: PPL x2 + active recovery
SELECT pg_temp.sf_add_day(id, 1, ARRAY['Pecho','Hombros','Brazos'], ARRAY[2,2,1])
FROM predesigned_plans
WHERE id IN ('215','216','313','314');
SELECT pg_temp.sf_add_day(id, 2, ARRAY['Espalda','Brazos'], ARRAY[3,2])
FROM predesigned_plans
WHERE id IN ('215','216','313','314');
SELECT pg_temp.sf_add_day(id, 3, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('215','216','313','314');
SELECT pg_temp.sf_add_day(id, 4, ARRAY['Pecho','Hombros','Brazos'], ARRAY[2,2,1])
FROM predesigned_plans
WHERE id IN ('215','216','313','314');
SELECT pg_temp.sf_add_day(id, 5, ARRAY['Espalda','Brazos'], ARRAY[3,2])
FROM predesigned_plans
WHERE id IN ('215','216','313','314');
SELECT pg_temp.sf_add_day(id, 6, ARRAY['Piernas','Core'], ARRAY[4,1])
FROM predesigned_plans
WHERE id IN ('215','216','313','314');
SELECT pg_temp.sf_add_day(id, 7, ARRAY['Cardio','Core'], ARRAY[2,2])
FROM predesigned_plans
WHERE id IN ('215','216','313','314');

DELETE FROM plan_ejercicios
WHERE plan_id IN (SELECT DISTINCT plan_id FROM sf_plan_day_groups);

WITH plan_levels AS (
  SELECT
    id AS plan_id,
    CASE nivel
      WHEN 'B' THEN ARRAY['Principiante']
      WHEN 'I' THEN ARRAY['Intermedio','Principiante']
      WHEN 'P' THEN ARRAY['Avanzado','Intermedio']
      ELSE ARRAY['Principiante','Intermedio','Avanzado']
    END AS allowed_levels,
    CASE nivel
      WHEN 'B' THEN 'Principiante'
      WHEN 'I' THEN 'Intermedio'
      WHEN 'P' THEN 'Avanzado'
      ELSE 'Principiante'
    END AS preferred_level
  FROM predesigned_plans
),
ranked_exercises AS (
  SELECT
    s.plan_id,
    s.dia,
    s.group_order,
    s.grupo,
    e.id AS ejercicio_id,
    row_number() OVER (
      PARTITION BY s.plan_id, s.dia, s.grupo
      ORDER BY
        CASE WHEN e.nivel = pl.preferred_level THEN 0 ELSE 1 END,
        NULLIF(regexp_replace(e.id, '\D', '', 'g'), '')::integer,
        e.nombre
    ) AS rn
  FROM sf_plan_day_groups s
  JOIN plan_levels pl ON pl.plan_id = s.plan_id
  JOIN exercises e
    ON e.grupo_muscular = s.grupo
   AND e.nivel = ANY(pl.allowed_levels)
),
selected_exercises AS (
  SELECT
    r.plan_id,
    r.dia,
    r.group_order,
    r.ejercicio_id,
    r.rn
  FROM ranked_exercises r
  JOIN sf_plan_day_groups s
    ON s.plan_id = r.plan_id
   AND s.dia = r.dia
   AND s.grupo = r.grupo
  WHERE r.rn <= s.take_count
),
ordered_exercises AS (
  SELECT
    plan_id,
    dia,
    ejercicio_id,
    row_number() OVER (
      PARTITION BY plan_id, dia
      ORDER BY group_order, rn, ejercicio_id
    ) AS orden
  FROM selected_exercises
)
INSERT INTO plan_ejercicios (id, plan_id, ejercicio_id, dia, orden)
SELECT gen_random_uuid(), plan_id, ejercicio_id, dia, orden
FROM ordered_exercises
ORDER BY plan_id, dia, orden;
