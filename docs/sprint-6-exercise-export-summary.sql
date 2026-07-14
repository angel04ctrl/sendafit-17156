-- Sprint 6 exercise export summary.
-- Read-only audit script: does not update or delete exercise data.
-- It uses temporary tables only so it can handle missing optional columns safely.

DROP TABLE IF EXISTS pg_temp.sprint6_exercise_audit_results;

CREATE TEMP TABLE sprint6_exercise_audit_results (
  section text NOT NULL,
  metric text NOT NULL,
  value bigint,
  details jsonb DEFAULT '{}'::jsonb
);

DO $$
DECLARE
  has_nombre boolean;
  has_name boolean;
  has_display_name boolean;
  has_nivel boolean;
  has_level boolean;
  has_descripcion boolean;
  has_description boolean;
  has_instructions boolean;
  has_instrucciones boolean;
  has_cues_tecnicos boolean;
  has_consejos_tecnica boolean;
  has_musculo_principal boolean;
  has_primary_muscles boolean;
  has_muscle_group boolean;
  has_grupo_muscular boolean;
  has_equipment boolean;
  has_equipo_requerido boolean;
  has_equipamiento boolean;
  name_expr text;
  level_expr text;
  description_expr text;
  instructions_expr text;
  primary_muscle_expr text;
  equipment_expr text;
  muscle_group_expr text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'nombre') INTO has_nombre;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'name') INTO has_name;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'display_name') INTO has_display_name;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'nivel') INTO has_nivel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'level') INTO has_level;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'descripcion') INTO has_descripcion;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'description') INTO has_description;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'instructions') INTO has_instructions;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'instrucciones') INTO has_instrucciones;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'cues_tecnicos') INTO has_cues_tecnicos;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'consejos_tecnica') INTO has_consejos_tecnica;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'musculo_principal') INTO has_musculo_principal;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'primary_muscles') INTO has_primary_muscles;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'muscle_group') INTO has_muscle_group;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'grupo_muscular') INTO has_grupo_muscular;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'equipment') INTO has_equipment;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'equipo_requerido') INTO has_equipo_requerido;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'equipamiento') INTO has_equipamiento;

  name_expr := concat_ws(
    ', ',
    CASE WHEN has_name THEN 'name' END,
    CASE WHEN has_display_name THEN 'display_name' END,
    CASE WHEN has_nombre THEN 'nombre' END
  );
  name_expr := CASE WHEN name_expr = '' THEN 'NULL::text' ELSE 'coalesce(' || name_expr || ')' END;

  level_expr := concat_ws(', ', CASE WHEN has_level THEN 'level' END, CASE WHEN has_nivel THEN 'nivel' END);
  level_expr := CASE WHEN level_expr = '' THEN 'NULL::text' ELSE 'coalesce(' || level_expr || ')' END;

  description_expr := concat_ws(', ', CASE WHEN has_description THEN 'description' END, CASE WHEN has_descripcion THEN 'descripcion' END);
  description_expr := CASE WHEN description_expr = '' THEN 'NULL::text' ELSE 'coalesce(' || description_expr || ')' END;

  instructions_expr := concat_ws(
    ', ',
    CASE WHEN has_instructions THEN 'instructions' END,
    CASE WHEN has_instrucciones THEN 'instrucciones' END,
    CASE WHEN has_cues_tecnicos THEN 'array_to_string(cues_tecnicos, '', '')' END,
    CASE WHEN has_consejos_tecnica THEN 'array_to_string(consejos_tecnica, '', '')' END
  );
  instructions_expr := CASE WHEN instructions_expr = '' THEN 'NULL::text' ELSE 'coalesce(' || instructions_expr || ')' END;

  primary_muscle_expr := concat_ws(
    ', ',
    CASE WHEN has_musculo_principal THEN 'musculo_principal' END,
    CASE WHEN has_primary_muscles THEN 'array_to_string(primary_muscles, '', '')' END,
    CASE WHEN has_muscle_group THEN 'muscle_group' END,
    CASE WHEN has_grupo_muscular THEN 'grupo_muscular' END
  );
  primary_muscle_expr := CASE WHEN primary_muscle_expr = '' THEN 'NULL::text' ELSE 'coalesce(' || primary_muscle_expr || ')' END;

  equipment_expr := concat_ws(
    ', ',
    CASE WHEN has_equipment THEN 'array_to_string(equipment, '', '')' END,
    CASE WHEN has_equipo_requerido THEN 'array_to_string(equipo_requerido, '', '')' END,
    CASE WHEN has_equipamiento THEN 'equipamiento' END
  );
  equipment_expr := CASE WHEN equipment_expr = '' THEN 'NULL::text' ELSE 'coalesce(' || equipment_expr || ')' END;

  muscle_group_expr := concat_ws(', ', CASE WHEN has_muscle_group THEN 'muscle_group' END, CASE WHEN has_grupo_muscular THEN 'grupo_muscular' END);
  muscle_group_expr := CASE WHEN muscle_group_expr = '' THEN 'NULL::text' ELSE 'coalesce(' || muscle_group_expr || ')' END;

  INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
  SELECT 'coverage', 'total_exercises', count(*), '{}'::jsonb
  FROM public.exercises;

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, %L, count(*), jsonb_build_object(%L, %L)
     FROM public.exercises
     WHERE %s IS NULL OR trim(%s) = ''''',
    'coverage', 'exercises_without_name', 'expression_used', name_expr, name_expr, name_expr
  );

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, %L, count(*), jsonb_build_object(%L, %L)
     FROM public.exercises
     WHERE %s IS NULL OR trim(%s) = ''''',
    'coverage', 'exercises_without_level', 'expression_used', level_expr, level_expr, level_expr
  );

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, %L, count(*), jsonb_build_object(%L, %L)
     FROM public.exercises
     WHERE %s IS NULL OR trim(%s) = ''''',
    'coverage', 'exercises_without_description', 'expression_used', description_expr, description_expr, description_expr
  );

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, %L, count(*), jsonb_build_object(%L, %L, %L, %L)
     FROM public.exercises
     WHERE %s IS NULL OR trim(%s) = ''''',
    'coverage',
    'exercises_without_instructions',
    'expression_used',
    instructions_expr,
    'note',
    CASE
      WHEN has_instructions OR has_instrucciones THEN 'instructions/instrucciones column found'
      WHEN has_cues_tecnicos THEN 'no instructions/instrucciones column exists; using cues_tecnicos as technical instruction content'
      WHEN has_consejos_tecnica THEN 'no instructions/instrucciones column exists; using consejos_tecnica as technical instruction content'
      ELSE 'no instructions/instrucciones/cues_tecnicos/consejos_tecnica column exists'
    END,
    instructions_expr,
    instructions_expr
  );

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, %L, count(*), jsonb_build_object(%L, %L)
     FROM public.exercises
     WHERE %s IS NULL OR trim(%s) = ''''',
    'coverage', 'exercises_without_primary_muscle', 'expression_used', primary_muscle_expr, primary_muscle_expr, primary_muscle_expr
  );

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, %L, count(*), jsonb_build_object(%L, %L)
     FROM public.exercises
     WHERE %s IS NULL OR trim(%s) = ''''',
    'coverage', 'exercises_without_equipment', 'expression_used', equipment_expr, equipment_expr, equipment_expr
  );

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, coalesce(nullif(lower(trim(%s)), ''''), %L), count(*), jsonb_build_object(%L, %L)
     FROM public.exercises
     GROUP BY coalesce(nullif(lower(trim(%s)), ''''), %L)
     ORDER BY 2',
    'distribution_by_level', level_expr, 'missing_level', 'expression_used', level_expr, level_expr, 'missing_level'
  );

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, coalesce(nullif(lower(trim(%s)), ''''), %L), count(*), jsonb_build_object(%L, %L)
     FROM public.exercises
     GROUP BY coalesce(nullif(lower(trim(%s)), ''''), %L)
     ORDER BY 2',
    'distribution_by_muscle_group', muscle_group_expr, 'missing_muscle_group', 'expression_used', muscle_group_expr, muscle_group_expr, 'missing_muscle_group'
  );

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, normalized_name, count(*), jsonb_build_object(%L, array_agg(id ORDER BY id))
     FROM (
       SELECT id, lower(trim(%s)) AS normalized_name
       FROM public.exercises
       WHERE %s IS NOT NULL AND trim(%s) <> ''''
     ) duplicates
     GROUP BY normalized_name
     HAVING count(*) > 1
     ORDER BY count(*) DESC, normalized_name',
    'possible_duplicates_by_name', 'exercise_ids', name_expr, name_expr, name_expr
  );

  INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
  SELECT
    'data_quality',
    'exercises_with_mojibake',
    count(*),
    jsonb_build_object(
      'pattern', 'row JSON contains Ã, Â, or replacement character',
      'exercise_ids', coalesce(jsonb_agg(id ORDER BY id) FILTER (
        WHERE row_to_json(e)::text LIKE '%' || chr(195) || '%'
           OR row_to_json(e)::text LIKE '%' || chr(194) || '%'
           OR row_to_json(e)::text LIKE '%' || chr(65533) || '%'
      ), '[]'::jsonb)
    )
  FROM public.exercises e
  WHERE row_to_json(e)::text LIKE '%' || chr(195) || '%'
     OR row_to_json(e)::text LIKE '%' || chr(194) || '%'
     OR row_to_json(e)::text LIKE '%' || chr(65533) || '%';

  EXECUTE format(
    'INSERT INTO sprint6_exercise_audit_results(section, metric, value, details)
     SELECT %L, %L, count(*), jsonb_build_object(%L, coalesce(jsonb_agg(id ORDER BY id), ''[]''::jsonb), %L, %L)
     FROM public.exercises
     WHERE upper(trim(%s)) IN (''B'', ''I'', ''P'')',
    'data_quality', 'exercises_with_legacy_level_b_i_p', 'exercise_ids', 'expression_used', level_expr, level_expr
  );
END $$;

SELECT section, metric, value, details
FROM sprint6_exercise_audit_results
ORDER BY section, metric;
