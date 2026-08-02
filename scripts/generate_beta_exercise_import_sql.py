import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "BD-sendaFit" / "senda-fit-professional-exercise-curation-patch.csv"
DOCS = ROOT / "docs"

with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

columns = list(rows[0].keys()) if rows else []
patch_json = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))

json_block = f"$patch_json$\n{patch_json}\n$patch_json$::jsonb"
record_cols = ",\n  ".join(f"{column} text" for column in columns)
select_cols = ",\n  ".join(columns)
concat_cols = ", ".join(columns)

COMMON_SQL = f"""CREATE OR REPLACE FUNCTION pg_temp.be2_null_text(value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(btrim(value), '')
$$;

CREATE OR REPLACE FUNCTION pg_temp.be2_norm(value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(btrim(COALESCE(value, '')), '\\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION pg_temp.be2_has_mojibake(value text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(value, '') ~ '(Ã|Â|â€|â€“|â€œ|�)'
$$;

CREATE OR REPLACE FUNCTION pg_temp.be2_is_json_text_array(value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  parsed jsonb;
BEGIN
  IF pg_temp.be2_null_text(value) IS NULL THEN
    RETURN true;
  END IF;
  parsed := value::jsonb;
  RETURN jsonb_typeof(parsed) = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(parsed) AS item(value)
      WHERE jsonb_typeof(item.value) <> 'string'
    );
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.be2_text_array(value text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  parsed jsonb;
  result text[];
BEGIN
  IF pg_temp.be2_null_text(value) IS NULL THEN
    RETURN NULL;
  END IF;
  parsed := value::jsonb;
  IF jsonb_typeof(parsed) <> 'array' THEN
    RETURN NULL;
  END IF;
  SELECT array_agg(NULLIF(btrim(item), ''))
  INTO result
  FROM jsonb_array_elements_text(parsed) AS item
  WHERE NULLIF(btrim(item), '') IS NOT NULL;
  IF cardinality(COALESCE(result, '{{}}'::text[])) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN result;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.be2_is_numeric(value text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT pg_temp.be2_null_text(value) IS NULL OR btrim(value) ~ '^-?[0-9]+(\\.[0-9]+)?$'
$$;

CREATE OR REPLACE FUNCTION pg_temp.be2_int(value text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF pg_temp.be2_null_text(value) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN round(value::numeric)::integer;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.be2_numeric(value text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF pg_temp.be2_null_text(value) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN value::numeric;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.be2_is_machine_like(
  _nombre text,
  _equipamiento text,
  _equipo_requerido text[],
  _patron text,
  _tipo text
)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(concat_ws(' ', _nombre, _equipamiento, array_to_string(_equipo_requerido, ' '), _patron, _tipo))
    ~ '(m.quina|polea|prensa|smith|hack|pec[ -]?deck|caminadora|cinta de correr|bicicleta|el.ptica|escaladora|stair|remo erg.metro|erg.metro|banco predicador|predicador|asistid[ao]|assisted|multipower|cable|jal.n|leg press|leg curl|leg extension|curl femoral|extensi.n de cu.driceps|press en m.quina|remo en m.quina)'
$$;

CREATE TEMP TABLE exercise_import_staging_raw AS
SELECT
  elem.ordinality::integer AS row_number,
  {select_cols}
FROM jsonb_array_elements({json_block}) WITH ORDINALITY AS elem(data, ordinality)
CROSS JOIN LATERAL jsonb_to_record(elem.data) AS patch (
  {record_cols}
);

CREATE TEMP TABLE exercise_import_staging AS
SELECT
  row_number,
  lower(pg_temp.be2_null_text(action)) AS action,
  pg_temp.be2_null_text(id) AS id,
  pg_temp.be2_null_text(nombre) AS nombre,
  pg_temp.be2_text_array(aliases) AS aliases,
  pg_temp.be2_null_text(nivel) AS nivel,
  pg_temp.be2_null_text(nivel_minimo) AS nivel_minimo,
  pg_temp.be2_null_text(grupo_muscular) AS grupo_muscular,
  pg_temp.be2_null_text(musculo_principal) AS musculo_principal,
  pg_temp.be2_text_array(musculos_secundarios) AS musculos_secundarios,
  pg_temp.be2_null_text(equipamiento) AS equipamiento,
  pg_temp.be2_text_array(equipo_requerido) AS equipo_requerido,
  pg_temp.be2_null_text(tipo_entrenamiento) AS tipo_entrenamiento,
  pg_temp.be2_null_text(patron_movimiento) AS patron_movimiento,
  pg_temp.be2_null_text(descripcion) AS descripcion,
  pg_temp.be2_text_array(instrucciones) AS instrucciones,
  pg_temp.be2_text_array(cues_tecnicos) AS cues_tecnicos,
  pg_temp.be2_text_array(errores_comunes) AS errores_comunes,
  pg_temp.be2_text_array(contraindicaciones) AS contraindicaciones,
  pg_temp.be2_text_array(sustituciones) AS sustituciones,
  pg_temp.be2_text_array(progresiones) AS progresiones,
  pg_temp.be2_text_array(regresiones) AS regresiones,
  pg_temp.be2_null_text(lugar) AS lugar,
  pg_temp.be2_null_text(objetivo) AS objetivo,
  pg_temp.be2_int(series_sugeridas) AS series_sugeridas,
  pg_temp.be2_int(repeticiones_sugeridas) AS repeticiones_sugeridas,
  pg_temp.be2_int(rango_reps_min) AS rango_reps_min,
  pg_temp.be2_int(rango_reps_max) AS rango_reps_max,
  pg_temp.be2_int(descanso_segundos_min) AS descanso_segundos_min,
  pg_temp.be2_int(descanso_segundos_max) AS descanso_segundos_max,
  pg_temp.be2_numeric(rir_recomendado) AS rir_recomendado,
  pg_temp.be2_int(duracion_promedio_segundos) AS duracion_promedio_segundos,
  pg_temp.be2_null_text(maquina_gym) AS maquina_gym,
  pg_temp.be2_null_text(estado_calidad) AS estado_calidad
FROM exercise_import_staging_raw;

CREATE TEMP TABLE exercise_import_validation_errors (
  row_number integer,
  action text,
  id text,
  nombre text,
  error_code text,
  error_detail text
);

CREATE TEMP TABLE exercise_import_warnings (
  row_number integer,
  action text,
  id text,
  nombre text,
  warning_code text,
  warning_detail text
);

INSERT INTO exercise_import_validation_errors
SELECT row_number, lower(pg_temp.be2_null_text(action)), pg_temp.be2_null_text(id), pg_temp.be2_null_text(nombre), 'invalid_action', COALESCE(action, '')
FROM exercise_import_staging_raw
WHERE lower(COALESCE(pg_temp.be2_null_text(action), '')) NOT IN ('update', 'insert', 'deprecate_review');

INSERT INTO exercise_import_validation_errors
SELECT row_number, lower(pg_temp.be2_null_text(action)), pg_temp.be2_null_text(id), pg_temp.be2_null_text(nombre), 'invalid_json_array', column_name
FROM exercise_import_staging_raw
CROSS JOIN LATERAL (VALUES
  ('aliases', aliases),
  ('musculos_secundarios', musculos_secundarios),
  ('equipo_requerido', equipo_requerido),
  ('instrucciones', instrucciones),
  ('cues_tecnicos', cues_tecnicos),
  ('errores_comunes', errores_comunes),
  ('contraindicaciones', contraindicaciones),
  ('sustituciones', sustituciones),
  ('progresiones', progresiones),
  ('regresiones', regresiones)
) AS arrays(column_name, raw_value)
WHERE NOT pg_temp.be2_is_json_text_array(raw_value);

INSERT INTO exercise_import_validation_errors
SELECT row_number, lower(pg_temp.be2_null_text(action)), pg_temp.be2_null_text(id), pg_temp.be2_null_text(nombre), 'invalid_numeric', column_name
FROM exercise_import_staging_raw
CROSS JOIN LATERAL (VALUES
  ('series_sugeridas', series_sugeridas),
  ('repeticiones_sugeridas', repeticiones_sugeridas),
  ('rango_reps_min', rango_reps_min),
  ('rango_reps_max', rango_reps_max),
  ('descanso_segundos_min', descanso_segundos_min),
  ('descanso_segundos_max', descanso_segundos_max),
  ('rir_recomendado', rir_recomendado),
  ('duracion_promedio_segundos', duracion_promedio_segundos)
) AS nums(column_name, raw_value)
WHERE NOT pg_temp.be2_is_numeric(raw_value);

INSERT INTO exercise_import_validation_errors
SELECT row_number, lower(pg_temp.be2_null_text(action)), pg_temp.be2_null_text(id), pg_temp.be2_null_text(nombre), 'mojibake_detected', 'Texto parece tener caracteres mal codificados'
FROM exercise_import_staging_raw
WHERE pg_temp.be2_has_mojibake(concat_ws(' ', {concat_cols}));

INSERT INTO exercise_import_validation_errors
SELECT s.row_number, s.action, s.id, s.nombre, 'missing_id_for_existing_action', 'update/deprecate_review requieren id'
FROM exercise_import_staging s
WHERE s.action IN ('update', 'deprecate_review')
  AND s.id IS NULL;

INSERT INTO exercise_import_validation_errors
SELECT s.row_number, s.action, s.id, s.nombre, 'target_exercise_not_found', 'No existe public.exercises.id para update/deprecate_review'
FROM exercise_import_staging s
LEFT JOIN public.exercises e ON e.id = s.id
WHERE s.action IN ('update', 'deprecate_review')
  AND s.id IS NOT NULL
  AND e.id IS NULL;

CREATE TEMP TABLE exercise_import_effective AS
SELECT
  s.*,
  e.id AS existing_id,
  COALESCE(s.nombre, e.nombre) AS eff_nombre,
  COALESCE(s.nivel, e.nivel) AS eff_nivel,
  COALESCE(s.nivel_minimo, e.nivel_minimo) AS eff_nivel_minimo,
  COALESCE(s.grupo_muscular, e.grupo_muscular) AS eff_grupo_muscular,
  COALESCE(s.musculo_principal, e.musculo_principal) AS eff_musculo_principal,
  COALESCE(s.tipo_entrenamiento, e.tipo_entrenamiento) AS eff_tipo_entrenamiento,
  COALESCE(s.patron_movimiento, e.patron_movimiento) AS eff_patron_movimiento,
  COALESCE(s.descripcion, e.descripcion) AS eff_descripcion,
  COALESCE(s.instrucciones, e.instrucciones) AS eff_instrucciones,
  COALESCE(s.cues_tecnicos, e.cues_tecnicos) AS eff_cues_tecnicos,
  COALESCE(s.errores_comunes, e.errores_comunes) AS eff_errores_comunes,
  COALESCE(s.sustituciones, e.sustituciones) AS eff_sustituciones,
  COALESCE(s.aliases, e.aliases) AS eff_aliases,
  COALESCE(s.equipamiento, e.equipamiento) AS eff_equipamiento,
  COALESCE(s.equipo_requerido, e.equipo_requerido) AS eff_equipo_requerido,
  COALESCE(s.lugar, e.lugar) AS eff_lugar,
  COALESCE(s.maquina_gym, e.maquina_gym) AS eff_maquina_gym,
  COALESCE(s.estado_calidad, e.estado_calidad) AS eff_estado_calidad,
  COALESCE(
    CASE WHEN s.action = 'update' THEN NULLIF(s.series_sugeridas, 0) ELSE s.series_sugeridas END,
    e.series_sugeridas,
    CASE
      WHEN s.action = 'update'
       AND lower(COALESCE(s.tipo_entrenamiento, e.tipo_entrenamiento, '')) NOT LIKE '%cardio%'
      THEN 3
    END
  ) AS eff_series_sugeridas,
  COALESCE(CASE WHEN s.action = 'update' THEN NULLIF(s.repeticiones_sugeridas, 0) ELSE s.repeticiones_sugeridas END, e.repeticiones_sugeridas) AS eff_repeticiones_sugeridas,
  COALESCE(CASE WHEN s.action = 'update' THEN NULLIF(s.rango_reps_min, 0) ELSE s.rango_reps_min END, e.rango_reps_min) AS eff_rango_reps_min,
  COALESCE(CASE WHEN s.action = 'update' THEN NULLIF(s.rango_reps_max, 0) ELSE s.rango_reps_max END, e.rango_reps_max) AS eff_rango_reps_max,
  COALESCE(CASE WHEN s.action = 'update' THEN NULLIF(s.descanso_segundos_min, 0) ELSE s.descanso_segundos_min END, e.descanso_segundos_min) AS eff_descanso_segundos_min,
  COALESCE(CASE WHEN s.action = 'update' THEN NULLIF(s.descanso_segundos_max, 0) ELSE s.descanso_segundos_max END, e.descanso_segundos_max) AS eff_descanso_segundos_max,
  COALESCE(s.rir_recomendado, e.rir_recomendado) AS eff_rir_recomendado,
  COALESCE(CASE WHEN s.action = 'update' THEN NULLIF(s.duracion_promedio_segundos, 0) ELSE s.duracion_promedio_segundos END, e.duracion_promedio_segundos) AS eff_duracion_promedio_segundos
FROM exercise_import_staging s
LEFT JOIN public.exercises e ON e.id = s.id
WHERE s.action IN ('update', 'insert');

INSERT INTO exercise_import_validation_errors
SELECT row_number, action, id, nombre, error_code, error_detail
FROM exercise_import_effective
CROSS JOIN LATERAL (VALUES
  ('missing_nombre', CASE WHEN pg_temp.be2_null_text(eff_nombre) IS NULL THEN 'nombre vacio' END),
  ('missing_grupo_muscular', CASE WHEN pg_temp.be2_null_text(eff_grupo_muscular) IS NULL THEN 'grupo_muscular vacio' END),
  ('missing_musculo_principal', CASE WHEN pg_temp.be2_null_text(eff_musculo_principal) IS NULL THEN 'musculo_principal vacio' END),
  ('missing_patron_movimiento', CASE WHEN pg_temp.be2_null_text(eff_patron_movimiento) IS NULL THEN 'patron_movimiento vacio' END),
  ('missing_nivel', CASE WHEN pg_temp.be2_null_text(eff_nivel) IS NULL THEN 'nivel vacio' END),
  ('missing_estado_calidad', CASE WHEN pg_temp.be2_null_text(eff_estado_calidad) IS NULL THEN 'estado_calidad vacio' END),
  ('missing_descripcion', CASE WHEN pg_temp.be2_null_text(eff_descripcion) IS NULL THEN 'descripcion vacia' END),
  ('missing_instrucciones', CASE WHEN cardinality(COALESCE(eff_instrucciones, '{{}}'::text[])) = 0 THEN 'instrucciones vacias' END),
  ('missing_cues', CASE WHEN cardinality(COALESCE(eff_cues_tecnicos, '{{}}'::text[])) = 0 THEN 'cues_tecnicos vacios' END),
  ('missing_errores', CASE WHEN cardinality(COALESCE(eff_errores_comunes, '{{}}'::text[])) = 0 THEN 'errores_comunes vacios' END),
  ('missing_sustituciones', CASE WHEN cardinality(COALESCE(eff_sustituciones, '{{}}'::text[])) = 0 THEN 'sustituciones vacias' END),
  ('missing_aliases', CASE WHEN cardinality(COALESCE(eff_aliases, '{{}}'::text[])) = 0 THEN 'aliases vacios' END),
  ('invalid_estado_calidad', CASE WHEN lower(COALESCE(eff_estado_calidad, '')) NOT IN ('legacy', 'pendiente', 'basico', 'básico', 'revisar', 'curado', 'deprecado', 'premium') THEN COALESCE(eff_estado_calidad, '') END),
  ('invalid_level', CASE WHEN lower(COALESCE(eff_nivel, '')) NOT IN ('principiante', 'intermedio', 'avanzado', 'b', 'i', 'p') THEN COALESCE(eff_nivel, '') END),
  ('invalid_min_level', CASE WHEN eff_nivel_minimo IS NOT NULL AND lower(eff_nivel_minimo) NOT IN ('principiante', 'intermedio', 'avanzado', 'b', 'i', 'p') THEN eff_nivel_minimo END),
  ('invalid_rep_range', CASE WHEN action = 'insert' AND eff_rango_reps_min IS NOT NULL AND eff_rango_reps_max IS NOT NULL AND eff_rango_reps_min > eff_rango_reps_max THEN concat(eff_rango_reps_min, '>', eff_rango_reps_max) END),
  ('invalid_rest_range', CASE WHEN action = 'insert' AND eff_descanso_segundos_min IS NOT NULL AND eff_descanso_segundos_max IS NOT NULL AND eff_descanso_segundos_min > eff_descanso_segundos_max THEN concat(eff_descanso_segundos_min, '>', eff_descanso_segundos_max) END),
  ('invalid_rest_seconds', CASE WHEN action = 'insert' AND ((eff_descanso_segundos_min IS NOT NULL AND (eff_descanso_segundos_min < 15 OR eff_descanso_segundos_min > 600)) OR (eff_descanso_segundos_max IS NOT NULL AND (eff_descanso_segundos_max < 15 OR eff_descanso_segundos_max > 600))) THEN concat('min=', eff_descanso_segundos_min, ', max=', eff_descanso_segundos_max) END),
  ('invalid_rir', CASE WHEN action = 'insert' AND eff_rir_recomendado IS NOT NULL AND (eff_rir_recomendado < 0 OR eff_rir_recomendado > 5) THEN eff_rir_recomendado::text END),
  ('invalid_series', CASE WHEN action = 'insert' AND eff_series_sugeridas IS NOT NULL AND (eff_series_sugeridas < 1 OR eff_series_sugeridas > 10) THEN eff_series_sugeridas::text END),
  ('invalid_duration', CASE WHEN action = 'insert' AND eff_duracion_promedio_segundos IS NOT NULL AND (eff_duracion_promedio_segundos < 5 OR eff_duracion_promedio_segundos > 7200) THEN eff_duracion_promedio_segundos::text END),
  ('strength_missing_programming', CASE WHEN action = 'insert' AND lower(COALESCE(eff_tipo_entrenamiento, '')) NOT LIKE '%cardio%' AND (eff_series_sugeridas IS NULL OR eff_rango_reps_min IS NULL OR eff_rango_reps_max IS NULL OR eff_descanso_segundos_min IS NULL OR eff_descanso_segundos_max IS NULL OR eff_rir_recomendado IS NULL) THEN 'fuerza sin series/reps/descanso/RIR completos' END),
  ('cardio_has_strength_prescription', CASE WHEN action = 'insert' AND lower(COALESCE(eff_tipo_entrenamiento, '')) LIKE '%cardio%' AND (eff_rir_recomendado IS NOT NULL OR eff_rango_reps_min IS NOT NULL OR eff_rango_reps_max IS NOT NULL OR eff_repeticiones_sugeridas IS NOT NULL) THEN concat('rir=', eff_rir_recomendado, ', reps=', eff_rango_reps_min, '-', eff_rango_reps_max) END),
  ('cardio_missing_duration', CASE WHEN action = 'insert' AND lower(COALESCE(eff_tipo_entrenamiento, '')) LIKE '%cardio%' AND eff_duracion_promedio_segundos IS NULL THEN 'cardio sin duracion' END)
) AS validations(error_code, error_detail)
WHERE error_detail IS NOT NULL;

INSERT INTO exercise_import_warnings
SELECT row_number, action, id, nombre, 'maquina_gym_vacia', 'Ejercicio de gimnasio parece usar maquina/equipo especifico pero maquina_gym esta vacia'
FROM exercise_import_effective
WHERE lower(COALESCE(eff_lugar, '')) = 'gimnasio'
  AND pg_temp.be2_null_text(eff_maquina_gym) IS NULL
  AND pg_temp.be2_is_machine_like(eff_nombre, eff_equipamiento, eff_equipo_requerido, eff_patron_movimiento, eff_tipo_entrenamiento);

INSERT INTO exercise_import_warnings
SELECT row_number, action, id, nombre, 'update_programming_incomplete', 'Update importable, pero la programacion efectiva queda incompleta; revisar series/reps/descanso/RIR despues del import'
FROM exercise_import_effective
WHERE action = 'update'
  AND lower(COALESCE(eff_tipo_entrenamiento, '')) NOT LIKE '%cardio%'
  AND (
    eff_series_sugeridas IS NULL
    OR eff_rango_reps_min IS NULL
    OR eff_rango_reps_max IS NULL
    OR eff_descanso_segundos_min IS NULL
    OR eff_descanso_segundos_max IS NULL
    OR eff_rir_recomendado IS NULL
  );

INSERT INTO exercise_import_warnings
SELECT row_number, action, id, nombre, 'update_zero_programming_ignored', 'Uno o mas campos de programacion vinieron en 0 y se trataran como vacios para no sobrescribir datos buenos'
FROM exercise_import_staging
WHERE action = 'update'
  AND (
    series_sugeridas = 0
    OR repeticiones_sugeridas = 0
    OR rango_reps_min = 0
    OR rango_reps_max = 0
    OR descanso_segundos_min = 0
    OR descanso_segundos_max = 0
    OR duracion_promedio_segundos = 0
  );

CREATE TEMP TABLE exercise_import_valid AS
SELECT s.*
FROM exercise_import_staging s
WHERE NOT EXISTS (
  SELECT 1 FROM exercise_import_validation_errors err
  WHERE err.row_number = s.row_number
);

CREATE TEMP TABLE exercise_import_insert_conflicts AS
WITH insert_rows AS (
  SELECT v.*, pg_temp.be2_norm(v.nombre) AS normalized_nombre
  FROM exercise_import_valid v
  WHERE v.action = 'insert'
), existing_aliases AS (
  SELECT e.id, e.nombre, pg_temp.be2_norm(alias) AS alias_norm
  FROM public.exercises e
  CROSS JOIN LATERAL unnest(COALESCE(e.aliases, '{{}}'::text[])) AS alias
), insert_aliases AS (
  SELECT r.row_number, pg_temp.be2_norm(alias) AS alias_norm
  FROM insert_rows r
  CROSS JOIN LATERAL unnest(COALESCE(r.aliases, '{{}}'::text[])) AS alias
), name_conflicts AS (
  SELECT DISTINCT r.row_number, r.action, r.id, r.nombre, e.id AS conflicting_id, e.nombre AS conflicting_nombre, 'duplicate_normalized_nombre' AS conflict_reason
  FROM insert_rows r
  JOIN public.exercises e ON pg_temp.be2_norm(e.nombre) = r.normalized_nombre
), alias_conflicts AS (
  SELECT DISTINCT r.row_number, r.action, r.id, r.nombre, ea.id AS conflicting_id, ea.nombre AS conflicting_nombre, 'duplicate_alias' AS conflict_reason
  FROM insert_rows r
  JOIN insert_aliases ia ON ia.row_number = r.row_number AND ia.alias_norm <> ''
  JOIN existing_aliases ea ON ea.alias_norm = ia.alias_norm
)
SELECT * FROM name_conflicts
UNION
SELECT * FROM alias_conflicts;

CREATE TEMP TABLE exercise_import_update_diff AS
SELECT
  v.row_number,
  v.id,
  array_remove(ARRAY[
    CASE WHEN v.nombre IS NOT NULL AND v.nombre IS DISTINCT FROM e.nombre THEN 'nombre' END,
    CASE WHEN v.aliases IS NOT NULL AND v.aliases IS DISTINCT FROM e.aliases THEN 'aliases' END,
    CASE WHEN v.nivel IS NOT NULL AND v.nivel IS DISTINCT FROM e.nivel THEN 'nivel' END,
    CASE WHEN v.nivel_minimo IS NOT NULL AND v.nivel_minimo IS DISTINCT FROM e.nivel_minimo THEN 'nivel_minimo' END,
    CASE WHEN v.grupo_muscular IS NOT NULL AND v.grupo_muscular IS DISTINCT FROM e.grupo_muscular THEN 'grupo_muscular' END,
    CASE WHEN v.musculo_principal IS NOT NULL AND v.musculo_principal IS DISTINCT FROM e.musculo_principal THEN 'musculo_principal' END,
    CASE WHEN v.musculos_secundarios IS NOT NULL AND v.musculos_secundarios IS DISTINCT FROM e.musculos_secundarios THEN 'musculos_secundarios' END,
    CASE WHEN v.equipamiento IS NOT NULL AND v.equipamiento IS DISTINCT FROM e.equipamiento THEN 'equipamiento' END,
    CASE WHEN v.equipo_requerido IS NOT NULL AND v.equipo_requerido IS DISTINCT FROM e.equipo_requerido THEN 'equipo_requerido' END,
    CASE WHEN v.tipo_entrenamiento IS NOT NULL AND v.tipo_entrenamiento IS DISTINCT FROM e.tipo_entrenamiento THEN 'tipo_entrenamiento' END,
    CASE WHEN v.patron_movimiento IS NOT NULL AND v.patron_movimiento IS DISTINCT FROM e.patron_movimiento THEN 'patron_movimiento' END,
    CASE WHEN v.descripcion IS NOT NULL AND v.descripcion IS DISTINCT FROM e.descripcion THEN 'descripcion' END,
    CASE WHEN v.instrucciones IS NOT NULL AND v.instrucciones IS DISTINCT FROM e.instrucciones THEN 'instrucciones' END,
    CASE WHEN v.cues_tecnicos IS NOT NULL AND v.cues_tecnicos IS DISTINCT FROM e.cues_tecnicos THEN 'cues_tecnicos' END,
    CASE WHEN v.errores_comunes IS NOT NULL AND v.errores_comunes IS DISTINCT FROM e.errores_comunes THEN 'errores_comunes' END,
    CASE WHEN v.contraindicaciones IS NOT NULL AND v.contraindicaciones IS DISTINCT FROM e.contraindicaciones THEN 'contraindicaciones' END,
    CASE WHEN v.sustituciones IS NOT NULL AND v.sustituciones IS DISTINCT FROM e.sustituciones THEN 'sustituciones' END,
    CASE WHEN v.progresiones IS NOT NULL AND v.progresiones IS DISTINCT FROM e.progresiones THEN 'progresiones' END,
    CASE WHEN v.regresiones IS NOT NULL AND v.regresiones IS DISTINCT FROM e.regresiones THEN 'regresiones' END,
    CASE WHEN v.lugar IS NOT NULL AND v.lugar IS DISTINCT FROM e.lugar THEN 'lugar' END,
    CASE WHEN v.objetivo IS NOT NULL AND v.objetivo IS DISTINCT FROM e.objetivo THEN 'objetivo' END,
    CASE
      WHEN COALESCE(
        NULLIF(v.series_sugeridas, 0),
        CASE
          WHEN e.series_sugeridas IS NULL
           AND lower(COALESCE(v.tipo_entrenamiento, e.tipo_entrenamiento, '')) NOT LIKE '%cardio%'
          THEN 3
        END
      ) IS NOT NULL
      AND COALESCE(
        NULLIF(v.series_sugeridas, 0),
        CASE
          WHEN e.series_sugeridas IS NULL
           AND lower(COALESCE(v.tipo_entrenamiento, e.tipo_entrenamiento, '')) NOT LIKE '%cardio%'
          THEN 3
        END
      ) IS DISTINCT FROM e.series_sugeridas
      THEN 'series_sugeridas'
    END,
    CASE WHEN NULLIF(v.repeticiones_sugeridas, 0) IS NOT NULL AND NULLIF(v.repeticiones_sugeridas, 0) IS DISTINCT FROM e.repeticiones_sugeridas THEN 'repeticiones_sugeridas' END,
    CASE WHEN NULLIF(v.rango_reps_min, 0) IS NOT NULL AND NULLIF(v.rango_reps_min, 0) IS DISTINCT FROM e.rango_reps_min THEN 'rango_reps_min' END,
    CASE WHEN NULLIF(v.rango_reps_max, 0) IS NOT NULL AND NULLIF(v.rango_reps_max, 0) IS DISTINCT FROM e.rango_reps_max THEN 'rango_reps_max' END,
    CASE WHEN NULLIF(v.descanso_segundos_min, 0) IS NOT NULL AND NULLIF(v.descanso_segundos_min, 0) IS DISTINCT FROM e.descanso_segundos_min THEN 'descanso_segundos_min' END,
    CASE WHEN NULLIF(v.descanso_segundos_max, 0) IS NOT NULL AND NULLIF(v.descanso_segundos_max, 0) IS DISTINCT FROM e.descanso_segundos_max THEN 'descanso_segundos_max' END,
    CASE WHEN v.rir_recomendado IS NOT NULL AND v.rir_recomendado IS DISTINCT FROM e.rir_recomendado THEN 'rir_recomendado' END,
    CASE WHEN NULLIF(v.duracion_promedio_segundos, 0) IS NOT NULL AND NULLIF(v.duracion_promedio_segundos, 0) IS DISTINCT FROM e.duracion_promedio_segundos THEN 'duracion_promedio_segundos' END,
    CASE WHEN v.maquina_gym IS NOT NULL AND v.maquina_gym IS DISTINCT FROM e.maquina_gym THEN 'maquina_gym' END,
    CASE WHEN v.estado_calidad IS NOT NULL AND v.estado_calidad IS DISTINCT FROM e.estado_calidad THEN 'estado_calidad' END
  ], NULL) AS modified_columns
FROM exercise_import_valid v
JOIN public.exercises e ON e.id = v.id
WHERE v.action = 'update';

CREATE TEMP TABLE exercise_import_deprecate_diff AS
SELECT v.row_number, v.id, ARRAY['estado_calidad']::text[] AS modified_columns
FROM exercise_import_valid v
JOIN public.exercises e ON e.id = v.id
WHERE v.action = 'deprecate_review'
  AND e.estado_calidad IS DISTINCT FROM COALESCE(v.estado_calidad, 'revisar');
"""

REPORT_SELECT = """SELECT
  'summary' AS report_type,
  metric,
  value::text AS value,
  NULL::integer AS row_number,
  NULL::text AS action,
  NULL::text AS id,
  NULL::text AS nombre,
  NULL::text AS detail
FROM (VALUES
  ('csv_rows', (SELECT count(*) FROM exercise_import_staging_raw)::bigint),
  ('valid_rows', (SELECT count(*) FROM exercise_import_valid)::bigint),
  ('blocking_validation_errors', (SELECT count(*) FROM exercise_import_validation_errors)::bigint),
  ('warnings', (SELECT count(*) FROM exercise_import_warnings)::bigint),
  ('updates_that_would_change', (SELECT count(*) FROM exercise_import_update_diff WHERE cardinality(modified_columns) > 0)::bigint),
  ('updates_no_change', (SELECT count(*) FROM exercise_import_update_diff WHERE cardinality(modified_columns) = 0)::bigint),
  ('inserts_that_would_apply', (SELECT count(*) FROM exercise_import_valid v WHERE v.action = 'insert' AND NOT EXISTS (SELECT 1 FROM exercise_import_insert_conflicts c WHERE c.row_number = v.row_number))::bigint),
  ('insert_conflicts_ignored', (SELECT count(DISTINCT row_number) FROM exercise_import_insert_conflicts)::bigint),
  ('deprecate_review_that_would_apply', (SELECT count(*) FROM exercise_import_deprecate_diff)::bigint)
) AS metrics(metric, value)

UNION ALL
SELECT 'update_diff', 'modified_columns', array_to_string(modified_columns, ', '), d.row_number, v.action, v.id, v.nombre, NULL::text
FROM exercise_import_update_diff d
JOIN exercise_import_valid v ON v.row_number = d.row_number
WHERE cardinality(d.modified_columns) > 0

UNION ALL
SELECT 'insert_candidate', 'will_insert', 'true', v.row_number, v.action, v.id, v.nombre, concat('nuevo id uuid se generara al aplicar; musculo=', v.musculo_principal, ', patron=', v.patron_movimiento)
FROM exercise_import_valid v
WHERE v.action = 'insert'
  AND NOT EXISTS (SELECT 1 FROM exercise_import_insert_conflicts c WHERE c.row_number = v.row_number)

UNION ALL
SELECT 'deprecate_candidate', 'will_deprecate_review', COALESCE(v.estado_calidad, 'revisar'), v.row_number, v.action, v.id, v.nombre, 'estado_calidad permitido por constraint'
FROM exercise_import_valid v
JOIN exercise_import_deprecate_diff d ON d.row_number = v.row_number

UNION ALL
SELECT 'ignored', error_code, 'validation_error', row_number, action, id, nombre, error_detail
FROM exercise_import_validation_errors

UNION ALL
SELECT DISTINCT 'ignored', conflict_reason, 'insert_conflict', row_number, action, id, nombre, concat('conflicts_with=', conflicting_id, ' ', conflicting_nombre)
FROM exercise_import_insert_conflicts

UNION ALL
SELECT 'warning', warning_code, 'non_blocking', row_number, action, id, nombre, warning_detail
FROM exercise_import_warnings

ORDER BY report_type, metric, row_number NULLS FIRST, id NULLS LAST;
"""

APPLY_TAIL = """CREATE TEMP TABLE exercise_import_run_meta AS
SELECT clock_timestamp() AS started_at;

CREATE TEMP TABLE exercise_import_applied_updates AS
WITH changed AS (
  SELECT d.row_number
  FROM exercise_import_update_diff d
  WHERE cardinality(d.modified_columns) > 0
), updated AS (
  UPDATE public.exercises e
  SET
    nombre = COALESCE(v.nombre, e.nombre),
    aliases = COALESCE(v.aliases, e.aliases),
    nivel = COALESCE(v.nivel, e.nivel),
    nivel_minimo = COALESCE(v.nivel_minimo, e.nivel_minimo),
    grupo_muscular = COALESCE(v.grupo_muscular, e.grupo_muscular),
    musculo_principal = COALESCE(v.musculo_principal, e.musculo_principal),
    musculos_secundarios = COALESCE(v.musculos_secundarios, e.musculos_secundarios),
    equipamiento = COALESCE(v.equipamiento, e.equipamiento),
    equipo_requerido = COALESCE(v.equipo_requerido, e.equipo_requerido),
    tipo_entrenamiento = COALESCE(v.tipo_entrenamiento, e.tipo_entrenamiento),
    patron_movimiento = COALESCE(v.patron_movimiento, e.patron_movimiento),
    descripcion = COALESCE(v.descripcion, e.descripcion),
    instrucciones = COALESCE(v.instrucciones, e.instrucciones),
    cues_tecnicos = COALESCE(v.cues_tecnicos, e.cues_tecnicos),
    errores_comunes = COALESCE(v.errores_comunes, e.errores_comunes),
    contraindicaciones = COALESCE(v.contraindicaciones, e.contraindicaciones),
    sustituciones = COALESCE(v.sustituciones, e.sustituciones),
    progresiones = COALESCE(v.progresiones, e.progresiones),
    regresiones = COALESCE(v.regresiones, e.regresiones),
    lugar = COALESCE(v.lugar, e.lugar),
    objetivo = COALESCE(v.objetivo, e.objetivo),
    series_sugeridas = COALESCE(
      NULLIF(v.series_sugeridas, 0),
      e.series_sugeridas,
      CASE
        WHEN lower(COALESCE(v.tipo_entrenamiento, e.tipo_entrenamiento, '')) NOT LIKE '%cardio%'
        THEN 3
      END
    ),
    repeticiones_sugeridas = COALESCE(NULLIF(v.repeticiones_sugeridas, 0), e.repeticiones_sugeridas),
    rango_reps_min = COALESCE(NULLIF(v.rango_reps_min, 0), e.rango_reps_min),
    rango_reps_max = COALESCE(NULLIF(v.rango_reps_max, 0), e.rango_reps_max),
    descanso_segundos_min = COALESCE(NULLIF(v.descanso_segundos_min, 0), e.descanso_segundos_min),
    descanso_segundos_max = COALESCE(NULLIF(v.descanso_segundos_max, 0), e.descanso_segundos_max),
    rir_recomendado = COALESCE(v.rir_recomendado, e.rir_recomendado),
    duracion_promedio_segundos = COALESCE(NULLIF(v.duracion_promedio_segundos, 0), e.duracion_promedio_segundos),
    maquina_gym = COALESCE(v.maquina_gym, e.maquina_gym),
    estado_calidad = COALESCE(v.estado_calidad, e.estado_calidad)
  FROM exercise_import_valid v
  JOIN changed c ON c.row_number = v.row_number
  WHERE e.id = v.id
    AND v.action = 'update'
  RETURNING e.id, e.nombre
)
SELECT * FROM updated;

CREATE TEMP TABLE exercise_import_applied_deprecates AS
WITH updated AS (
  UPDATE public.exercises e
  SET estado_calidad = COALESCE(v.estado_calidad, 'revisar')
  FROM exercise_import_valid v
  JOIN exercise_import_deprecate_diff d ON d.row_number = v.row_number
  WHERE e.id = v.id
    AND v.action = 'deprecate_review'
  RETURNING e.id, e.nombre
)
SELECT * FROM updated;

CREATE TEMP TABLE exercise_import_applied_inserts AS
WITH insert_rows AS (
  SELECT v.*
  FROM exercise_import_valid v
  WHERE v.action = 'insert'
    AND NOT EXISTS (SELECT 1 FROM exercise_import_insert_conflicts c WHERE c.row_number = v.row_number)
), inserted AS (
  INSERT INTO public.exercises (
    id, nombre, aliases, nivel, nivel_minimo, grupo_muscular, musculo_principal,
    musculos_secundarios, equipamiento, equipo_requerido, tipo_entrenamiento,
    patron_movimiento, descripcion, instrucciones, cues_tecnicos, errores_comunes,
    contraindicaciones, sustituciones, progresiones, regresiones, lugar, objetivo,
    series_sugeridas, repeticiones_sugeridas, rango_reps_min, rango_reps_max,
    descanso_segundos_min, descanso_segundos_max, rir_recomendado,
    duracion_promedio_segundos, maquina_gym, estado_calidad
  )
  SELECT
    gen_random_uuid()::text, nombre, COALESCE(aliases, '{}'::text[]), nivel,
    nivel_minimo, grupo_muscular, musculo_principal,
    COALESCE(musculos_secundarios, '{}'::text[]), equipamiento,
    COALESCE(equipo_requerido, '{}'::text[]), tipo_entrenamiento,
    patron_movimiento, descripcion, COALESCE(instrucciones, '{}'::text[]),
    COALESCE(cues_tecnicos, '{}'::text[]), COALESCE(errores_comunes, '{}'::text[]),
    COALESCE(contraindicaciones, '{}'::text[]), COALESCE(sustituciones, '{}'::text[]),
    COALESCE(progresiones, '{}'::text[]), COALESCE(regresiones, '{}'::text[]),
    lugar, objetivo, series_sugeridas, repeticiones_sugeridas, rango_reps_min,
    rango_reps_max, descanso_segundos_min, descanso_segundos_max, rir_recomendado,
    duracion_promedio_segundos, maquina_gym, COALESCE(estado_calidad, 'curado')
  FROM insert_rows
  RETURNING id, nombre
)
SELECT * FROM inserted;

SELECT
  'summary' AS report_type,
  metric,
  value::text AS value,
  NULL::integer AS row_number,
  NULL::text AS action,
  NULL::text AS id,
  NULL::text AS nombre,
  NULL::text AS detail
FROM (VALUES
  ('csv_rows', (SELECT count(*) FROM exercise_import_staging_raw)::bigint),
  ('valid_rows', (SELECT count(*) FROM exercise_import_valid)::bigint),
  ('updates_applied', (SELECT count(*) FROM exercise_import_applied_updates)::bigint),
  ('inserts_applied', (SELECT count(*) FROM exercise_import_applied_inserts)::bigint),
  ('deprecate_review_applied', (SELECT count(*) FROM exercise_import_applied_deprecates)::bigint),
  ('records_ignored_validation', (SELECT count(DISTINCT row_number) FROM exercise_import_validation_errors)::bigint),
  ('records_ignored_insert_conflict', (SELECT count(DISTINCT row_number) FROM exercise_import_insert_conflicts)::bigint),
  ('warnings', (SELECT count(*) FROM exercise_import_warnings)::bigint),
  ('execution_ms', (SELECT round(extract(epoch FROM (clock_timestamp() - started_at)) * 1000)::bigint FROM exercise_import_run_meta)::bigint)
) AS metrics(metric, value)

UNION ALL
SELECT 'applied_update', 'updated_columns', array_to_string(d.modified_columns, ', '), d.row_number, v.action, v.id, v.nombre, NULL::text
FROM exercise_import_update_diff d
JOIN exercise_import_valid v ON v.row_number = d.row_number
WHERE cardinality(d.modified_columns) > 0

UNION ALL
SELECT 'applied_insert', 'inserted', 'true', NULL::integer, 'insert', id, nombre, 'id generado por gen_random_uuid()'
FROM exercise_import_applied_inserts

UNION ALL
SELECT 'applied_deprecate_review', 'estado_calidad', COALESCE(v.estado_calidad, 'revisar'), d.row_number, v.action, v.id, v.nombre, 'accion deprecate_review mapeada a estado permitido'
FROM exercise_import_deprecate_diff d
JOIN exercise_import_valid v ON v.row_number = d.row_number

UNION ALL
SELECT 'ignored', error_code, 'validation_error', row_number, action, id, nombre, error_detail
FROM exercise_import_validation_errors

UNION ALL
SELECT DISTINCT 'ignored', conflict_reason, 'insert_conflict', row_number, action, id, nombre, concat('conflicts_with=', conflicting_id, ' ', conflicting_nombre)
FROM exercise_import_insert_conflicts

UNION ALL
SELECT 'warning', warning_code, 'non_blocking', row_number, action, id, nombre, warning_detail
FROM exercise_import_warnings

ORDER BY report_type, metric, row_number NULLS FIRST, id NULLS LAST;

COMMIT;
"""

VALIDATION_SQL = """-- Beta Exercise Sprint 2 - Validacion posterior al import de curaduria de ejercicios.
-- Read-only. Resultado esperado para cierre: 0 filas critical.

WITH exercise_scope AS (
  SELECT
    e.*,
    lower(regexp_replace(trim(COALESCE(e.nombre, '')), '\\s+', ' ', 'g')) AS normalized_nombre,
    lower(concat_ws(' ', e.nombre, e.equipamiento, array_to_string(e.equipo_requerido, ' '), e.patron_movimiento, e.tipo_entrenamiento)) AS machine_search_text,
    lower(concat_ws(' ', e.nombre, e.equipamiento, array_to_string(e.equipo_requerido, ' '), e.patron_movimiento, e.tipo_entrenamiento)) ~
      '(m.quina|polea|prensa|smith|hack|pec[ -]?deck|caminadora|cinta de correr|bicicleta est.tica|spinning|el.ptica|escaladora|stair|remo erg.metro|erg.metro|banco predicador|predicador|asistid[ao]|assisted|multipower|cable|jal.n|leg press|leg curl|leg extension|curl femoral|extensi.n de cu.driceps|press en m.quina|remo en m.quina)' AS is_machine_exercise
  FROM public.exercises e
), alias_scope AS (
  SELECT id, nombre, lower(regexp_replace(trim(alias), '\\s+', ' ', 'g')) AS normalized_alias
  FROM exercise_scope
  CROSS JOIN LATERAL unnest(COALESCE(aliases, '{}'::text[])) AS alias
), array_item_scope AS (
  SELECT id, nombre, column_name, item
  FROM exercise_scope
  CROSS JOIN LATERAL (
    VALUES
      ('aliases', aliases),
      ('musculos_secundarios', musculos_secundarios),
      ('equipo_requerido', equipo_requerido),
      ('instrucciones', instrucciones),
      ('cues_tecnicos', cues_tecnicos),
      ('errores_comunes', errores_comunes),
      ('contraindicaciones', contraindicaciones),
      ('sustituciones', sustituciones),
      ('progresiones', progresiones),
      ('regresiones', regresiones)
  ) AS arrays(column_name, values_array)
  CROSS JOIN LATERAL unnest(COALESCE(values_array, '{}'::text[])) AS item
), normalized_duplicates AS (
  SELECT normalized_nombre, count(*) AS duplicate_count, array_agg(id ORDER BY id) AS ids, array_agg(nombre ORDER BY nombre) AS nombres
  FROM exercise_scope
  WHERE normalized_nombre <> ''
  GROUP BY normalized_nombre
  HAVING count(*) > 1
), duplicate_aliases_same_exercise AS (
  SELECT id, nombre, normalized_alias, count(*) AS alias_count
  FROM alias_scope
  WHERE normalized_alias <> ''
  GROUP BY id, nombre, normalized_alias
  HAVING count(*) > 1
), alias_conflicts AS (
  SELECT normalized_alias, count(DISTINCT id) AS exercise_count, array_agg(DISTINCT id ORDER BY id) AS ids, array_agg(DISTINCT nombre ORDER BY nombre) AS nombres
  FROM alias_scope
  WHERE normalized_alias <> ''
  GROUP BY normalized_alias
  HAVING count(DISTINCT id) > 1
), relation_orphans AS (
  SELECT 'plan_ejercicios' AS source_table, pe.ejercicio_id AS exercise_id
  FROM public.plan_ejercicios pe
  LEFT JOIN public.exercises e ON e.id = pe.ejercicio_id
  WHERE e.id IS NULL
  UNION ALL
  SELECT 'workout_exercises', we.exercise_id
  FROM public.workout_exercises we
  LEFT JOIN public.exercises e ON e.id = we.exercise_id
  WHERE we.exercise_id IS NOT NULL
    AND e.id IS NULL
), validation_rows AS (
  SELECT 'critical' AS severity, 'duplicate_exercise_id' AS check_name, id AS exercise_id, nombre, 'id duplicado' AS details
  FROM exercise_scope
  GROUP BY id, nombre
  HAVING count(*) > 1
  UNION ALL
  SELECT 'critical', 'duplicate_normalized_nombre', array_to_string(ids, ', '), array_to_string(nombres, ' | '), normalized_nombre FROM normalized_duplicates
  UNION ALL
  SELECT 'critical', 'alias_conflict', array_to_string(ids, ', '), array_to_string(nombres, ' | '), normalized_alias FROM alias_conflicts
  UNION ALL
  SELECT 'critical', 'duplicate_alias_same_exercise', id, nombre, normalized_alias FROM duplicate_aliases_same_exercise
  UNION ALL
  SELECT 'critical', 'empty_array_item', id, nombre, column_name
  FROM array_item_scope
  WHERE COALESCE(length(btrim(item)), 0) = 0
  UNION ALL
  SELECT 'critical', 'invalid_estado_calidad', id, nombre, estado_calidad
  FROM exercise_scope
  WHERE lower(COALESCE(estado_calidad, '')) NOT IN ('legacy', 'pendiente', 'basico', 'básico', 'revisar', 'curado', 'deprecado', 'premium')
  UNION ALL
  SELECT 'critical', 'invalid_level', id, nombre, nivel
  FROM exercise_scope
  WHERE lower(COALESCE(nivel, '')) NOT IN ('principiante', 'intermedio', 'avanzado', 'b', 'i', 'p')
  UNION ALL
  SELECT 'critical', 'mojibake_detected', id, nombre, 'texto con posible encoding roto'
  FROM exercise_scope
  WHERE concat_ws(' ', nombre, descripcion, array_to_string(instrucciones, ' '), array_to_string(cues_tecnicos, ' '), array_to_string(errores_comunes, ' '), array_to_string(sustituciones, ' ')) ~ '(Ã|Â|â€|â€“|â€œ|�)'
  UNION ALL SELECT 'critical', 'missing_descripcion', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(descripcion)), 0) = 0
  UNION ALL SELECT 'critical', 'missing_instrucciones', id, nombre, NULL::text FROM exercise_scope WHERE cardinality(COALESCE(instrucciones, '{}'::text[])) = 0
  UNION ALL SELECT 'critical', 'missing_cues', id, nombre, NULL::text FROM exercise_scope WHERE cardinality(COALESCE(cues_tecnicos, '{}'::text[])) = 0
  UNION ALL SELECT 'critical', 'missing_errores_comunes', id, nombre, NULL::text FROM exercise_scope WHERE cardinality(COALESCE(errores_comunes, '{}'::text[])) = 0
  UNION ALL SELECT 'critical', 'missing_sustituciones', id, nombre, NULL::text FROM exercise_scope WHERE cardinality(COALESCE(sustituciones, '{}'::text[])) = 0
  UNION ALL SELECT 'critical', 'missing_musculo_principal', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(musculo_principal)), 0) = 0
  UNION ALL SELECT 'critical', 'missing_patron_movimiento', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(patron_movimiento)), 0) = 0
  UNION ALL SELECT 'critical', 'missing_nivel', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(nivel)), 0) = 0
  UNION ALL SELECT 'critical', 'missing_estado_calidad', id, nombre, NULL::text FROM exercise_scope WHERE COALESCE(length(btrim(estado_calidad)), 0) = 0
  UNION ALL
  SELECT 'critical', 'curado_with_critical_empty_fields', id, nombre, concat('estado=', estado_calidad)
  FROM exercise_scope
  WHERE lower(COALESCE(estado_calidad, '')) = 'curado'
    AND (
      COALESCE(length(btrim(descripcion)), 0) = 0
      OR cardinality(COALESCE(instrucciones, '{}'::text[])) = 0
      OR cardinality(COALESCE(cues_tecnicos, '{}'::text[])) = 0
      OR cardinality(COALESCE(errores_comunes, '{}'::text[])) = 0
      OR cardinality(COALESCE(sustituciones, '{}'::text[])) = 0
      OR COALESCE(length(btrim(musculo_principal)), 0) = 0
      OR COALESCE(length(btrim(patron_movimiento)), 0) = 0
      OR COALESCE(length(btrim(nivel)), 0) = 0
    )
  UNION ALL
  SELECT 'warning', 'gym_machine_missing_maquina_gym', id, nombre, concat('equipamiento=', COALESCE(equipamiento, ''), ', equipo=', array_to_string(equipo_requerido, ', '))
  FROM exercise_scope
  WHERE lower(COALESCE(lugar, '')) = 'gimnasio'
    AND COALESCE(length(btrim(maquina_gym)), 0) = 0
    AND is_machine_exercise
  UNION ALL
  SELECT 'warning', 'machine_exercise_without_adjustment_instruction', id, nombre, NULL::text
  FROM exercise_scope
  WHERE is_machine_exercise
    AND array_to_string(COALESCE(instrucciones, '{}'::text[]), ' ') !~* '(ajusta|regula|coloca|asiento|respaldo|rodillo|polea|agarre|soporte)'
  UNION ALL
  SELECT 'warning', 'equipment_inconsistent', id, nombre, concat('lugar=', COALESCE(lugar, ''), ', equipamiento=', COALESCE(equipamiento, ''), ', equipo=', array_to_string(equipo_requerido, ', '))
  FROM exercise_scope
  WHERE COALESCE(length(btrim(equipamiento)), 0) = 0
    AND cardinality(COALESCE(equipo_requerido, '{}'::text[])) = 0
    AND lower(COALESCE(tipo_entrenamiento, '')) NOT LIKE '%cardio%'
  UNION ALL
  SELECT 'critical', 'strength_missing_programming', id, nombre, concat('series=', series_sugeridas, ', reps=', rango_reps_min, '-', rango_reps_max, ', descanso=', descanso_segundos_min, '-', descanso_segundos_max, ', rir=', rir_recomendado)
  FROM exercise_scope
  WHERE lower(COALESCE(tipo_entrenamiento, '')) NOT LIKE '%cardio%'
    AND lower(COALESCE(tipo_entrenamiento, '')) NOT LIKE '%core%'
    AND lower(COALESCE(patron_movimiento, '')) !~ '(isometr|anti-|estabilidad|control motor)'
    AND lower(COALESCE(estado_calidad, '')) NOT IN ('revisar', 'deprecado')
    AND (
      series_sugeridas IS NULL
      OR descanso_segundos_min IS NULL
      OR descanso_segundos_max IS NULL
      OR descanso_segundos_min > descanso_segundos_max
      OR (
        rir_recomendado IS NULL
        AND lower(COALESCE(patron_movimiento, '')) !~ '(carga|carry|traslado)'
      )
      OR (
        duracion_promedio_segundos IS NULL
        AND (
          rango_reps_min IS NULL
          OR rango_reps_max IS NULL
          OR rango_reps_min > rango_reps_max
        )
      )
    )
  UNION ALL
  SELECT 'critical', 'cardio_has_strength_prescription', id, nombre, concat('reps=', rango_reps_min, '-', rango_reps_max, ', repeticiones=', repeticiones_sugeridas, ', rir=', rir_recomendado)
  FROM exercise_scope
  WHERE lower(COALESCE(tipo_entrenamiento, '')) LIKE '%cardio%'
    AND lower(COALESCE(estado_calidad, '')) NOT IN ('revisar', 'deprecado')
    AND (rir_recomendado IS NOT NULL OR rango_reps_min IS NOT NULL OR rango_reps_max IS NOT NULL OR repeticiones_sugeridas IS NOT NULL)
  UNION ALL
  SELECT 'critical', 'cardio_missing_or_invalid_duration', id, nombre, concat('duration=', duracion_promedio_segundos)
  FROM exercise_scope
  WHERE lower(COALESCE(tipo_entrenamiento, '')) LIKE '%cardio%'
    AND lower(COALESCE(estado_calidad, '')) NOT IN ('revisar', 'deprecado')
    AND (duracion_promedio_segundos IS NULL OR duracion_promedio_segundos < 20 OR duracion_promedio_segundos > 7200)
  UNION ALL
  SELECT 'critical', 'orphan_exercise_reference', exercise_id, NULL::text, source_table
  FROM relation_orphans
)
SELECT *
FROM validation_rows
ORDER BY severity, check_name, exercise_id;
"""

ROLLBACK_SQL = """-- Beta Exercise Sprint 2 - Rollback notes.
-- La importacion apply es transaccional: si falla durante ejecucion, PostgreSQL hace rollback completo.
-- No se crea tabla backup permanente para respetar la restriccion de no modificar schema.
--
-- Si todavia estas dentro de una transaccion abierta manualmente, puedes ejecutar:
ROLLBACK;
--
-- Si ya ejecutaste beta-exercise-curation-import-apply.sql y llego a COMMIT,
-- no existe un rollback automatico seguro sin una copia previa de public.exercises.
-- En ese caso usa una restauracion de backup/PITR de Supabase o un export previo verificado.
"""

preview_sql = """-- Beta Exercise Sprint 2 - PREVIEW / reporte previo de importacion.
-- Read-only: no modifica public.exercises.
-- Ejecutar primero en Supabase SQL Editor para revisar cambios, ignorados y conflictos.

BEGIN;

""" + COMMON_SQL + REPORT_SELECT + "\nROLLBACK;\n"

apply_sql = """-- Beta Exercise Sprint 2 - APPLY import seguro de CSV curado de ejercicios.
-- Transaccional, idempotente y con staging temporal.
-- No TRUNCATE, no DELETE, no cambios de schema, no toca workouts/sesiones/planes.
-- Ejecutar solo despues de revisar beta-exercise-curation-import-preview.sql.

BEGIN;

""" + COMMON_SQL + APPLY_TAIL

report_md = f"""# Beta Exercise Sprint 2 - Reporte local de preparacion

Fuente CSV: `BD-sendaFit/senda-fit-professional-exercise-curation-patch.csv`

## Conteo del CSV

- Filas totales: {len(rows)}
- Updates solicitados: {sum(1 for row in rows if (row.get('action') or '').strip().lower() == 'update')}
- Inserts solicitados: {sum(1 for row in rows if (row.get('action') or '').strip().lower() == 'insert')}
- Deprecate review solicitados: {sum(1 for row in rows if (row.get('action') or '').strip().lower() == 'deprecate_review')}

## Archivos generados

- `docs/beta-exercise-curation-import-preview.sql`: reporte previo, no modifica datos.
- `docs/beta-exercise-curation-import-apply.sql`: import transaccional con staging temporal.
- `docs/beta-exercise-curation-import-validation.sql`: validacion posterior read-only.
- `docs/beta-exercise-curation-import-rollback.sql`: notas de rollback seguro.

## Seguridad aplicada

- No TRUNCATE.
- No DELETE.
- No cambios de schema.
- No modificaciones a workouts, workout_exercises, sesiones, planes ni historial.
- Updates no cambian `id` ni `created_at`.
- Campos vacios del CSV no sobrescriben valores existentes.
- Inserts generan `gen_random_uuid()::text` y se ignoran si parecen duplicados.
- `deprecate_review` solo actualiza `estado_calidad`; se guarda como `revisar` si el CSV no trae otro estado permitido por el constraint actual.
- La importacion puede ejecutarse varias veces: updates son idempotentes e inserts se bloquean por deteccion de duplicados.

## Pendiente antes de aplicar

Ejecuta primero el preview en Supabase y revisa:

- `blocking_validation_errors`
- `insert_conflicts_ignored`
- `updates_that_would_change`
- `warnings`

No ejecutes el apply si el preview muestra errores bloqueantes inesperados.
"""

DOCS.mkdir(exist_ok=True)
(DOCS / "beta-exercise-curation-import-preview.sql").write_text(preview_sql, encoding="utf-8")
(DOCS / "beta-exercise-curation-import-apply.sql").write_text(apply_sql, encoding="utf-8")
(DOCS / "beta-exercise-curation-import-validation.sql").write_text(VALIDATION_SQL, encoding="utf-8")
(DOCS / "beta-exercise-curation-import-rollback.sql").write_text(ROLLBACK_SQL, encoding="utf-8")
(DOCS / "beta-exercise-curation-import-report.md").write_text(report_md, encoding="utf-8")

print(json.dumps({
    "rows": len(rows),
    "actions": dict(Counter((row.get("action") or "").strip().lower() for row in rows)),
    "files": [
        "docs/beta-exercise-curation-import-preview.sql",
        "docs/beta-exercise-curation-import-apply.sql",
        "docs/beta-exercise-curation-import-validation.sql",
        "docs/beta-exercise-curation-import-rollback.sql",
        "docs/beta-exercise-curation-import-report.md",
    ],
}, ensure_ascii=False, indent=2))
