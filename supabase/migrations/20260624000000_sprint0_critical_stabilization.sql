-- Sprint 0: critical stabilization for routine assignment, AI image privacy, and minimal plans.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS routine_assignment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS routine_assignment_error text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_routine_assignment_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_routine_assignment_status_check
  CHECK (routine_assignment_status IN ('pending', 'assigned', 'failed', 'not_needed'));

UPDATE storage.buckets
SET public = false
WHERE id = 'ai-analysis-images';

DROP POLICY IF EXISTS "Anyone can view AI analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Public read ai-analysis-images" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload ai-analysis-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload AI analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own AI analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own AI analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own AI analysis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own AI analysis images" ON storage.objects;

CREATE POLICY "Users can read own AI analysis images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ai-analysis-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own AI analysis images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ai-analysis-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own AI analysis images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ai-analysis-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'ai-analysis-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own AI analysis images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ai-analysis-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

INSERT INTO public.predesigned_plans (
  id,
  nombre_plan,
  objetivo,
  nivel,
  lugar,
  dias_semana,
  descripcion_plan,
  ejercicios_ids_ordenados
)
VALUES
  ('sf-min-beginner-3', 'Base Principiante 3 dias', 'Mantener, Tonificar, Perder Grasa', 'B', 'mixto', 3, 'Plan minimo funcional de cuerpo completo para iniciar de forma segura.', '[]'::jsonb),
  ('sf-min-beginner-4', 'Base Principiante 4 dias', 'Mantener, Tonificar, Perder Grasa', 'B', 'mixto', 4, 'Plan minimo funcional con distribucion superior/inferior para principiantes.', '[]'::jsonb),
  ('sf-min-intermediate-4', 'Base Intermedio 4 dias', 'Ganar Masa, Fuerza, Mantener', 'I', 'mixto', 4, 'Plan minimo funcional torso pierna para nivel intermedio.', '[]'::jsonb),
  ('sf-min-intermediate-5', 'Base Intermedio 5 dias', 'Ganar Masa, Definir, Mantener', 'I', 'mixto', 5, 'Plan minimo funcional con mayor frecuencia semanal.', '[]'::jsonb),
  ('sf-min-advanced-5', 'Base Avanzado 5 dias', 'Ganar Masa, Fuerza, Definir', 'P', 'mixto', 5, 'Plan minimo funcional para usuarios avanzados con control de volumen moderado.', '[]'::jsonb),
  ('sf-min-home-3', 'Casa Funcional 3 dias', 'Mantener, Tonificar, Perder Grasa', 'B', 'casa', 3, 'Plan minimo para entrenar en casa con ejercicios de peso corporal y mancuernas.', '[]'::jsonb),
  ('sf-min-gym-4', 'Gimnasio Base 4 dias', 'Ganar Masa, Fuerza, Mantener', 'I', 'gimnasio', 4, 'Plan minimo para gimnasio con estructura torso pierna.', '[]'::jsonb),
  ('sf-min-gym-5', 'Gimnasio Base 5 dias', 'Ganar Masa, Fuerza, Definir', 'I', 'gimnasio', 5, 'Plan minimo para gimnasio con cinco sesiones semanales.', '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  nombre_plan = EXCLUDED.nombre_plan,
  objetivo = EXCLUDED.objetivo,
  nivel = EXCLUDED.nivel,
  lugar = EXCLUDED.lugar,
  dias_semana = EXCLUDED.dias_semana,
  descripcion_plan = EXCLUDED.descripcion_plan;

WITH plan_exercises(plan_id, dia, orden, ejercicio_id) AS (
  VALUES
    ('sf-min-beginner-3', 1, 1, '14'), ('sf-min-beginner-3', 1, 2, '2'), ('sf-min-beginner-3', 1, 3, '23'), ('sf-min-beginner-3', 1, 4, '18'),
    ('sf-min-beginner-3', 2, 1, '13'), ('sf-min-beginner-3', 2, 2, '4'), ('sf-min-beginner-3', 2, 3, '24'), ('sf-min-beginner-3', 2, 4, '20'),
    ('sf-min-beginner-3', 3, 1, '16'), ('sf-min-beginner-3', 3, 2, '1'), ('sf-min-beginner-3', 3, 3, '25'), ('sf-min-beginner-3', 3, 4, '73'),

    ('sf-min-beginner-4', 1, 1, '2'), ('sf-min-beginner-4', 1, 2, '1'), ('sf-min-beginner-4', 1, 3, '4'), ('sf-min-beginner-4', 1, 4, '10'),
    ('sf-min-beginner-4', 2, 1, '14'), ('sf-min-beginner-4', 2, 2, '13'), ('sf-min-beginner-4', 2, 3, '16'), ('sf-min-beginner-4', 2, 4, '18'),
    ('sf-min-beginner-4', 3, 1, '23'), ('sf-min-beginner-4', 3, 2, '24'), ('sf-min-beginner-4', 3, 3, '8'), ('sf-min-beginner-4', 3, 4, '19'),
    ('sf-min-beginner-4', 4, 1, '17'), ('sf-min-beginner-4', 4, 2, '15'), ('sf-min-beginner-4', 4, 3, '30'), ('sf-min-beginner-4', 4, 4, '20'),

    ('sf-min-intermediate-4', 1, 1, '31'), ('sf-min-intermediate-4', 1, 2, '32'), ('sf-min-intermediate-4', 1, 3, '34'), ('sf-min-intermediate-4', 1, 4, '47'),
    ('sf-min-intermediate-4', 2, 1, '38'), ('sf-min-intermediate-4', 2, 2, '39'), ('sf-min-intermediate-4', 2, 3, '41'), ('sf-min-intermediate-4', 2, 4, '18'),
    ('sf-min-intermediate-4', 3, 1, '35'), ('sf-min-intermediate-4', 3, 2, '36'), ('sf-min-intermediate-4', 3, 3, '45'), ('sf-min-intermediate-4', 3, 4, '52'),
    ('sf-min-intermediate-4', 4, 1, '40'), ('sf-min-intermediate-4', 4, 2, '42'), ('sf-min-intermediate-4', 4, 3, '15'), ('sf-min-intermediate-4', 4, 4, '29'),

    ('sf-min-intermediate-5', 1, 1, '31'), ('sf-min-intermediate-5', 1, 2, '32'), ('sf-min-intermediate-5', 1, 3, '50'), ('sf-min-intermediate-5', 1, 4, '47'),
    ('sf-min-intermediate-5', 2, 1, '35'), ('sf-min-intermediate-5', 2, 2, '36'), ('sf-min-intermediate-5', 2, 3, '48'), ('sf-min-intermediate-5', 2, 4, '45'),
    ('sf-min-intermediate-5', 3, 1, '38'), ('sf-min-intermediate-5', 3, 2, '39'), ('sf-min-intermediate-5', 3, 3, '40'), ('sf-min-intermediate-5', 3, 4, '15'),
    ('sf-min-intermediate-5', 4, 1, '34'), ('sf-min-intermediate-5', 4, 2, '51'), ('sf-min-intermediate-5', 4, 3, '52'), ('sf-min-intermediate-5', 4, 4, '46'),
    ('sf-min-intermediate-5', 5, 1, '30'), ('sf-min-intermediate-5', 5, 2, '18'), ('sf-min-intermediate-5', 5, 3, '21'), ('sf-min-intermediate-5', 5, 4, '73'),

    ('sf-min-advanced-5', 1, 1, '68'), ('sf-min-advanced-5', 1, 2, '31'), ('sf-min-advanced-5', 1, 3, '34'), ('sf-min-advanced-5', 1, 4, '47'),
    ('sf-min-advanced-5', 2, 1, '37'), ('sf-min-advanced-5', 2, 2, '36'), ('sf-min-advanced-5', 2, 3, '35'), ('sf-min-advanced-5', 2, 4, '45'),
    ('sf-min-advanced-5', 3, 1, '38'), ('sf-min-advanced-5', 3, 2, '39'), ('sf-min-advanced-5', 3, 3, '57'), ('sf-min-advanced-5', 3, 4, '71'),
    ('sf-min-advanced-5', 4, 1, '66'), ('sf-min-advanced-5', 4, 2, '51'), ('sf-min-advanced-5', 4, 3, '52'), ('sf-min-advanced-5', 4, 4, '59'),
    ('sf-min-advanced-5', 5, 1, '70'), ('sf-min-advanced-5', 5, 2, '72'), ('sf-min-advanced-5', 5, 3, '63'), ('sf-min-advanced-5', 5, 4, '21'),

    ('sf-min-home-3', 1, 1, '14'), ('sf-min-home-3', 1, 2, '2'), ('sf-min-home-3', 1, 3, '23'), ('sf-min-home-3', 1, 4, '18'),
    ('sf-min-home-3', 2, 1, '13'), ('sf-min-home-3', 2, 2, '4'), ('sf-min-home-3', 2, 3, '8'), ('sf-min-home-3', 2, 4, '20'),
    ('sf-min-home-3', 3, 1, '16'), ('sf-min-home-3', 3, 2, '17'), ('sf-min-home-3', 3, 3, '30'), ('sf-min-home-3', 3, 4, '73'),

    ('sf-min-gym-4', 1, 1, '31'), ('sf-min-gym-4', 1, 2, '32'), ('sf-min-gym-4', 1, 3, '34'), ('sf-min-gym-4', 1, 4, '47'),
    ('sf-min-gym-4', 2, 1, '38'), ('sf-min-gym-4', 2, 2, '39'), ('sf-min-gym-4', 2, 3, '41'), ('sf-min-gym-4', 2, 4, '18'),
    ('sf-min-gym-4', 3, 1, '35'), ('sf-min-gym-4', 3, 2, '36'), ('sf-min-gym-4', 3, 3, '48'), ('sf-min-gym-4', 3, 4, '45'),
    ('sf-min-gym-4', 4, 1, '40'), ('sf-min-gym-4', 4, 2, '42'), ('sf-min-gym-4', 4, 3, '15'), ('sf-min-gym-4', 4, 4, '29'),

    ('sf-min-gym-5', 1, 1, '31'), ('sf-min-gym-5', 1, 2, '32'), ('sf-min-gym-5', 1, 3, '50'), ('sf-min-gym-5', 1, 4, '47'),
    ('sf-min-gym-5', 2, 1, '35'), ('sf-min-gym-5', 2, 2, '36'), ('sf-min-gym-5', 2, 3, '48'), ('sf-min-gym-5', 2, 4, '45'),
    ('sf-min-gym-5', 3, 1, '38'), ('sf-min-gym-5', 3, 2, '39'), ('sf-min-gym-5', 3, 3, '41'), ('sf-min-gym-5', 3, 4, '15'),
    ('sf-min-gym-5', 4, 1, '34'), ('sf-min-gym-5', 4, 2, '51'), ('sf-min-gym-5', 4, 3, '52'), ('sf-min-gym-5', 4, 4, '46'),
    ('sf-min-gym-5', 5, 1, '74'), ('sf-min-gym-5', 5, 2, '18'), ('sf-min-gym-5', 5, 3, '21'), ('sf-min-gym-5', 5, 4, '75')
)
INSERT INTO public.plan_ejercicios (plan_id, dia, orden, ejercicio_id)
SELECT pe.plan_id, pe.dia, pe.orden, pe.ejercicio_id
FROM plan_exercises pe
WHERE EXISTS (SELECT 1 FROM public.exercises e WHERE e.id = pe.ejercicio_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.plan_ejercicios existing
    WHERE existing.plan_id = pe.plan_id
      AND existing.dia = pe.dia
      AND existing.ejercicio_id = pe.ejercicio_id
  );

DELETE FROM public.plan_ejercicios pe
WHERE NOT EXISTS (
  SELECT 1
  FROM public.predesigned_plans pp
  WHERE pp.id = pe.plan_id
);

COMMENT ON COLUMN public.profiles.routine_assignment_status IS 'Estado de asignacion automatica de rutina: pending, assigned, failed, not_needed.';
COMMENT ON COLUMN public.profiles.routine_assignment_error IS 'Ultimo error legible de asignacion automatica de rutina.';
