-- Sprint 6.1: professional curation for the current 77 exercise records.
-- Safe data migration: no deletes, no reference-breaking id changes.

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_estado_calidad_check;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_estado_calidad_check
  CHECK (estado_calidad IN ('legacy', 'pendiente', 'basico', 'revisar', 'curado', 'deprecado', 'premium'));

WITH curated (
  id, nombre, aliases, lugar, objetivo, tipo_entrenamiento, musculo_principal,
  musculos_secundarios, equipo_requerido, patron_movimiento, rango_reps_min,
  rango_reps_max, descanso_segundos_min, descanso_segundos_max, rir_recomendado,
  duracion_promedio_segundos, estado_calidad
) AS (
  VALUES
  ('1','Press de banca con mancuernas',ARRAY['dumbbell bench press','press plano con mancuernas','press inclinado con mancuernas'],'gimnasio','hipertrofia','fuerza', 'pectoral mayor', ARRAY['tríceps','deltoides anterior'], ARRAY['mancuernas','banco'], 'empuje horizontal',8,12,90,150,2,NULL,'curado'),
  ('2','Lagartijas',ARRAY['push-ups','flexiones','push ups'],'cualquiera','general','fuerza', 'pectoral mayor', ARRAY['tríceps','deltoides anterior','core'], ARRAY['peso corporal'], 'empuje horizontal',8,20,45,90,2,NULL,'curado'),
  ('3','Aperturas con mancuernas',ARRAY['dumbbell fly','aperturas plano','aperturas inclinado'],'gimnasio','hipertrofia','fuerza', 'pectoral mayor', ARRAY['deltoides anterior'], ARRAY['mancuernas','banco'], 'apertura horizontal',10,15,60,90,2,NULL,'curado'),
  ('4','Press de hombro con mancuernas',ARRAY['dumbbell shoulder press','overhead dumbbell press'],'gimnasio','hipertrofia','fuerza', 'deltoides anterior', ARRAY['deltoides lateral','tríceps','core'], ARRAY['mancuernas','banco opcional'], 'empuje vertical',8,12,90,150,2,NULL,'curado'),
  ('5','Elevaciones laterales con mancuernas',ARRAY['dumbbell lateral raise','lateral raises'],'gimnasio','hipertrofia','fuerza', 'deltoides lateral', ARRAY['trapecio superior'], ARRAY['mancuernas'], 'elevación lateral',12,20,45,90,2,NULL,'curado'),
  ('6','Elevaciones frontales con mancuernas',ARRAY['front raise','dumbbell front raise'],'gimnasio','hipertrofia','fuerza', 'deltoides anterior', ARRAY['deltoides lateral','trapecio superior'], ARRAY['mancuernas'], 'flexión de hombro',10,15,45,90,2,NULL,'curado'),
  ('7','Pájaros con mancuernas',ARRAY['reverse fly','rear delt fly'],'gimnasio','hipertrofia','fuerza', 'deltoides posterior', ARRAY['romboides','trapecio medio'], ARRAY['mancuernas'], 'abducción horizontal',12,20,45,90,2,NULL,'curado'),
  ('8','Curl de bíceps con mancuernas',ARRAY['dumbbell curl','curl alternado'],'gimnasio','hipertrofia','fuerza', 'bíceps braquial', ARRAY['braquial','braquiorradial'], ARRAY['mancuernas'], 'curl de codo',10,15,45,90,2,NULL,'curado'),
  ('9','Curl martillo con mancuernas',ARRAY['hammer curl','dumbbell hammer curl'],'gimnasio','hipertrofia','fuerza', 'braquial', ARRAY['bíceps braquial','braquiorradial'], ARRAY['mancuernas'], 'curl de codo',10,15,45,90,2,NULL,'curado'),
  ('10','Extensión de tríceps sobre la cabeza con mancuerna',ARRAY['overhead triceps extension'],'gimnasio','hipertrofia','fuerza', 'tríceps cabeza larga', ARRAY['tríceps lateral','core'], ARRAY['mancuerna'], 'extensión de codo',10,15,45,90,2,NULL,'curado'),
  ('11','Patada de tríceps con mancuernas',ARRAY['triceps kickback','kickback'],'gimnasio','hipertrofia','fuerza', 'tríceps braquial', ARRAY['deltoides posterior'], ARRAY['mancuernas'], 'extensión de codo',12,20,45,75,2,NULL,'curado'),
  ('12','Sentadilla búlgara con mancuernas',ARRAY['bulgarian split squat','split squat'],'gimnasio','hipertrofia','fuerza', 'cuádriceps', ARRAY['glúteo mayor','isquiosurales','aductores','core'], ARRAY['mancuernas','banco'], 'zancada/unilateral',8,12,90,150,2,NULL,'curado'),
  ('13','Zancadas con mancuernas',ARRAY['lunges','dumbbell lunges','desplantes'],'gimnasio','hipertrofia','fuerza', 'cuádriceps', ARRAY['glúteo mayor','isquiosurales','core'], ARRAY['mancuernas'], 'zancada/unilateral',10,16,60,120,2,NULL,'curado'),
  ('14','Sentadilla goblet',ARRAY['goblet squat'],'gimnasio','hipertrofia','fuerza', 'cuádriceps', ARRAY['glúteos','aductores','core'], ARRAY['mancuerna o kettlebell'], 'sentadilla',10,15,60,120,2,NULL,'curado'),
  ('15','Elevación de talones de pie con mancuernas',ARRAY['standing calf raise','calf raise'],'gimnasio','hipertrofia','fuerza', 'gastrocnemio', ARRAY['sóleo'], ARRAY['mancuernas'], 'flexión plantar',12,20,45,90,2,NULL,'curado'),
  ('16','Peso muerto rumano con mancuernas',ARRAY['romanian deadlift','dumbbell rdl'],'gimnasio','hipertrofia','fuerza', 'isquiosurales', ARRAY['glúteos','erectores espinales','antebrazos'], ARRAY['mancuernas'], 'bisagra de cadera',8,12,90,150,2,NULL,'curado'),
  ('17','Puente de glúteo',ARRAY['glute bridge','puente gluteo'],'cualquiera','general','fuerza', 'glúteo mayor', ARRAY['isquiosurales','core'], ARRAY['peso corporal'], 'bisagra de cadera',12,20,45,90,2,NULL,'curado'),
  ('18','Plancha abdominal',ARRAY['plank','plancha'],'cualquiera','general','core', 'core', ARRAY['recto abdominal','transverso abdominal','glúteos','hombros'], ARRAY['peso corporal'], 'core anti-extensión',NULL,NULL,30,60,NULL,45,'curado'),
  ('19','Plancha lateral',ARRAY['side plank'],'cualquiera','general','core', 'oblicuos', ARRAY['transverso abdominal','glúteo medio','hombros'], ARRAY['peso corporal'], 'core anti-flexión lateral',NULL,NULL,30,60,NULL,35,'curado'),
  ('20','Abdominales bicicleta',ARRAY['bicycle crunches'],'cualquiera','general','core', 'oblicuos', ARRAY['recto abdominal','flexores de cadera'], ARRAY['peso corporal'], 'rotación de tronco',12,25,30,60,2,NULL,'curado'),
  ('21','Elevaciones de piernas',ARRAY['leg raises','hanging leg raises'],'cualquiera','general','core', 'recto abdominal inferior', ARRAY['flexores de cadera','core'], ARRAY['peso corporal','barra opcional'], 'flexión de tronco',8,15,45,90,2,NULL,'curado'),
  ('22','Giro ruso con mancuerna',ARRAY['russian twist','dumbbell russian twist'],'cualquiera','general','core', 'oblicuos', ARRAY['recto abdominal','transverso abdominal'], ARRAY['mancuerna'], 'rotación de tronco',12,24,30,75,2,NULL,'curado'),
  ('23','Remo con mancuerna a una mano',ARRAY['one-arm dumbbell row'],'gimnasio','hipertrofia','fuerza', 'dorsal ancho', ARRAY['romboides','trapecio medio','bíceps','deltoides posterior'], ARRAY['mancuerna','banco'], 'jalón horizontal',8,12,60,120,2,NULL,'curado'),
  ('24','Remo inclinado con mancuernas',ARRAY['bent-over dumbbell row'],'gimnasio','hipertrofia','fuerza', 'espalda media', ARRAY['dorsal ancho','romboides','bíceps','deltoides posterior'], ARRAY['mancuernas'], 'jalón horizontal',8,12,60,120,2,NULL,'curado'),
  ('25','Pullover con mancuerna',ARRAY['dumbbell pullover'],'gimnasio','hipertrofia','fuerza', 'dorsal ancho', ARRAY['pectoral mayor','serrato anterior','tríceps'], ARRAY['mancuerna','banco'], 'extensión de hombro',10,15,60,90,2,NULL,'curado'),
  ('26','Crunch abdominal',ARRAY['crunches','abdominal crunch'],'cualquiera','general','core', 'recto abdominal', ARRAY['oblicuos'], ARRAY['peso corporal'], 'flexión de tronco',12,25,30,60,2,NULL,'curado'),
  ('27','Superman en suelo',ARRAY['superman','floor back extension'],'cualquiera','general','fuerza', 'erectores espinales', ARRAY['glúteos','isquiosurales','trapecio medio'], ARRAY['peso corporal'], 'extensión lumbar',10,20,30,60,2,NULL,'curado'),
  ('28','Bird dog',ARRAY['bird dog','perro pajaro'],'cualquiera','general','core', 'core', ARRAY['glúteos','erectores espinales','hombros'], ARRAY['peso corporal'], 'core anti-rotación',8,12,30,60,2,NULL,'curado'),
  ('29','Escaladores',ARRAY['mountain climbers'],'cualquiera','resistencia','cardio', 'core', ARRAY['hombros','flexores de cadera','cuádriceps'], ARRAY['peso corporal'], 'locomoción/cardio',NULL,NULL,30,60,NULL,45,'curado'),
  ('30','Burpees',ARRAY['burpees'],'cualquiera','resistencia','cardio', 'cuerpo completo', ARRAY['pectorales','cuádriceps','glúteos','core','hombros'], ARRAY['peso corporal'], 'locomoción/cardio',NULL,NULL,45,90,NULL,60,'curado'),
  ('31','Press de banca con barra',ARRAY['bench press','barbell bench press','press banca'],'gimnasio','fuerza','fuerza', 'pectoral mayor', ARRAY['tríceps','deltoides anterior'], ARRAY['barra','banco','discos'], 'empuje horizontal',5,10,120,180,2,NULL,'curado'),
  ('32','Press inclinado con barra',ARRAY['incline bench press','incline barbell press'],'gimnasio','hipertrofia','fuerza', 'pectoral superior', ARRAY['deltoides anterior','tríceps'], ARRAY['barra','banco inclinado','discos'], 'empuje horizontal',6,10,120,180,2,NULL,'curado'),
  ('33','Fondos en paralelas para pecho',ARRAY['dips','chest dips'],'gimnasio','hipertrofia','fuerza', 'pectoral inferior', ARRAY['tríceps','deltoides anterior'], ARRAY['barras paralelas'], 'empuje vertical',6,12,90,150,2,NULL,'curado'),
  ('34','Press militar con barra',ARRAY['military press','barbell overhead press'],'gimnasio','fuerza','fuerza', 'deltoides anterior', ARRAY['deltoides lateral','tríceps','core'], ARRAY['barra','discos'], 'empuje vertical',6,10,120,180,2,NULL,'curado'),
  ('35','Remo con barra',ARRAY['barbell row','bent-over barbell row'],'gimnasio','fuerza','fuerza', 'espalda media', ARRAY['dorsal ancho','romboides','trapecio medio','bíceps','deltoides posterior'], ARRAY['barra','discos'], 'jalón horizontal',6,10,120,180,2,NULL,'curado'),
  ('36','Dominadas',ARRAY['pull-ups','dominadas pronas'],'gimnasio','fuerza','fuerza', 'dorsal ancho', ARRAY['bíceps','romboides','trapecio medio','core'], ARRAY['barra de dominadas'], 'jalón vertical',5,12,90,180,2,NULL,'curado'),
  ('37','Peso muerto convencional con barra',ARRAY['deadlift','barbell deadlift'],'gimnasio','fuerza','fuerza', 'cadena posterior', ARRAY['glúteos','isquiosurales','erectores espinales','trapecio','antebrazos'], ARRAY['barra','discos'], 'bisagra de cadera',3,8,150,240,2,NULL,'curado'),
  ('38','Sentadilla con barra',ARRAY['back squat','barbell squat'],'gimnasio','fuerza','fuerza', 'cuádriceps', ARRAY['glúteos','isquiosurales','aductores','core'], ARRAY['barra','rack','discos'], 'sentadilla',5,10,120,180,2,NULL,'curado'),
  ('39','Peso muerto rumano con mancuernas',ARRAY['dumbbell rdl','romanian deadlift'],'gimnasio','hipertrofia','fuerza', 'isquiosurales', ARRAY['glúteos','erectores espinales','antebrazos'], ARRAY['mancuernas'], 'bisagra de cadera',8,12,90,150,2,NULL,'curado'),
  ('40','Puente de glúteo con carga',ARRAY['weighted glute bridge','glute bridge con peso'],'gimnasio','hipertrofia','fuerza', 'glúteo mayor', ARRAY['isquiosurales','aductores','core'], ARRAY['mancuerna o disco','colchoneta'], 'bisagra de cadera',10,15,60,120,2,NULL,'curado'),
  ('41','Hip thrust con barra',ARRAY['barbell hip thrust','hip thrust'],'gimnasio','hipertrofia','fuerza', 'glúteo mayor', ARRAY['isquiosurales','aductores','core'], ARRAY['barra','banco','discos','protector de barra'], 'bisagra de cadera',8,12,90,150,2,NULL,'curado'),
  ('42','Prensa de piernas',ARRAY['leg press'],'gimnasio','hipertrofia','fuerza', 'cuádriceps', ARRAY['glúteos','isquiosurales','aductores'], ARRAY['máquina de prensa'], 'sentadilla',10,15,90,150,2,NULL,'curado'),
  ('43','Extensión de cuádriceps',ARRAY['leg extension'],'gimnasio','hipertrofia','fuerza', 'cuádriceps', ARRAY['recto femoral'], ARRAY['máquina de extensión de cuádriceps'], 'extensión de rodilla',10,15,60,90,2,NULL,'curado'),
  ('44','Curl femoral',ARRAY['leg curl','hamstring curl'],'gimnasio','hipertrofia','fuerza', 'isquiosurales', ARRAY['gastrocnemio'], ARRAY['máquina de curl femoral'], 'flexión de rodilla',10,15,60,90,2,NULL,'curado'),
  ('45','Curl de bíceps con barra',ARRAY['barbell curl','ez bar curl'],'gimnasio','hipertrofia','fuerza', 'bíceps braquial', ARRAY['braquial','braquiorradial'], ARRAY['barra recta o barra EZ'], 'curl de codo',8,12,60,90,2,NULL,'curado'),
  ('46','Fondos en banco para tríceps',ARRAY['bench dips'],'gimnasio','hipertrofia','fuerza', 'tríceps braquial', ARRAY['deltoides anterior','pectoral menor'], ARRAY['banco'], 'extensión de codo',8,15,60,90,2,NULL,'curado'),
  ('47','Press francés con barra',ARRAY['skull crushers','french press'],'gimnasio','hipertrofia','fuerza', 'tríceps cabeza larga', ARRAY['tríceps lateral','tríceps medial'], ARRAY['barra EZ o recta','banco'], 'extensión de codo',8,12,60,90,2,NULL,'curado'),
  ('48','Jalón al pecho',ARRAY['lat pulldown','jalon al pecho'],'gimnasio','hipertrofia','fuerza', 'dorsal ancho', ARRAY['bíceps','romboides','trapecio medio'], ARRAY['polea alta','máquina de jalón'], 'jalón vertical',8,12,60,120,2,NULL,'curado'),
  ('49','Remo en polea baja',ARRAY['seated cable row','cable row'],'gimnasio','hipertrofia','fuerza', 'espalda media', ARRAY['dorsal ancho','romboides','trapecio medio','bíceps'], ARRAY['polea baja','agarre'], 'jalón horizontal',8,12,60,120,2,NULL,'curado'),
  ('50','Aperturas en polea',ARRAY['cable fly','cable flyes'],'gimnasio','hipertrofia','fuerza', 'pectoral mayor', ARRAY['deltoides anterior'], ARRAY['poleas','agarres'], 'apertura horizontal',10,15,45,90,2,NULL,'curado'),
  ('51','Elevaciones laterales en polea',ARRAY['cable lateral raise'],'gimnasio','hipertrofia','fuerza', 'deltoides lateral', ARRAY['trapecio superior'], ARRAY['polea baja','agarre'], 'elevación lateral',12,20,45,90,2,NULL,'curado'),
  ('52','Face pull en polea alta',ARRAY['face pulls','cable face pull'],'gimnasio','hipertrofia','fuerza', 'deltoides posterior', ARRAY['trapecio medio','rotadores externos','romboides'], ARRAY['polea alta','cuerda'], 'jalón horizontal',12,20,45,90,2,NULL,'curado'),
  ('53','Crunch en polea',ARRAY['cable crunch'],'gimnasio','general','core', 'recto abdominal', ARRAY['oblicuos','transverso abdominal'], ARRAY['polea','cuerda'], 'flexión de tronco',10,20,45,90,2,NULL,'curado'),
  ('54','Giro ruso en polea',ARRAY['russian twist cable','cable russian twist'],'gimnasio','general','core', 'oblicuos', ARRAY['recto abdominal','transverso abdominal'], ARRAY['polea','agarre'], 'rotación de tronco',10,16,45,90,2,NULL,'curado'),
  ('55','Sentadilla frontal con barra',ARRAY['front squat'],'gimnasio','fuerza','fuerza', 'cuádriceps', ARRAY['glúteos','core','espalda alta'], ARRAY['barra','rack','discos'], 'sentadilla',5,10,120,180,2,NULL,'curado'),
  ('56','Peso muerto sumo',ARRAY['sumo deadlift'],'gimnasio','fuerza','fuerza', 'glúteo mayor', ARRAY['aductores','isquiosurales','cuádriceps','erectores espinales'], ARRAY['barra','discos'], 'bisagra de cadera',3,8,150,240,2,NULL,'curado'),
  ('57','Cargada y press',ARRAY['clean and press'],'gimnasio','potencia','potencia', 'cuerpo completo', ARRAY['hombros','trapecio','glúteos','cuádriceps','core'], ARRAY['barra','discos'], 'potencia/empuje vertical',3,6,120,180,2,NULL,'revisar'),
  ('58','Arrancada',ARRAY['snatch','barbell snatch'],'gimnasio','potencia','potencia', 'cuerpo completo', ARRAY['glúteos','isquiosurales','hombros','trapecio','core'], ARRAY['barra','discos'], 'potencia',2,5,150,240,2,NULL,'revisar'),
  ('59','Muscle-up',ARRAY['muscle up'],'gimnasio','habilidad','fuerza', 'dorsal ancho', ARRAY['pectoral','tríceps','bíceps','core'], ARRAY['barra de dominadas o anillas'], 'jalón vertical/empuje',3,8,120,180,2,NULL,'revisar'),
  ('60','Sentadilla a una pierna',ARRAY['pistol squat'],'cualquiera','habilidad','fuerza', 'cuádriceps', ARRAY['glúteos','isquiosurales','core','aductores'], ARRAY['peso corporal'], 'sentadilla unilateral',3,8,90,150,2,NULL,'curado'),
  ('61','Dragon flag',ARRAY['dragon flag'],'gimnasio','habilidad','core', 'core', ARRAY['recto abdominal','dorsal ancho','flexores de cadera'], ARRAY['banco o barra fija'], 'core anti-extensión',3,8,90,150,2,NULL,'revisar'),
  ('62','L-sit',ARRAY['l sit'],'gimnasio','habilidad','core', 'core', ARRAY['flexores de cadera','tríceps','hombros'], ARRAY['paralelas o suelo'], 'core isométrico',NULL,NULL,60,120,NULL,20,'curado'),
  ('63','Planche',ARRAY['planche'],'cualquiera','habilidad','fuerza', 'hombros', ARRAY['pectoral','tríceps','core','serrato anterior'], ARRAY['peso corporal'], 'empuje isométrico',NULL,NULL,120,180,NULL,10,'revisar'),
  ('64','Front lever',ARRAY['front lever'],'gimnasio','habilidad','fuerza', 'dorsal ancho', ARRAY['core','bíceps','deltoides posterior'], ARRAY['barra de dominadas o anillas'], 'jalón isométrico',NULL,NULL,120,180,NULL,10,'revisar'),
  ('65','Back lever',ARRAY['back lever'],'gimnasio','habilidad','fuerza', 'hombros', ARRAY['pectoral','dorsal ancho','core','bíceps'], ARRAY['barra de dominadas o anillas'], 'empuje/jalón isométrico',NULL,NULL,120,180,NULL,10,'revisar'),
  ('66','Flexiones en pino',ARRAY['handstand push-up','hspu'],'cualquiera','habilidad','fuerza', 'deltoides anterior', ARRAY['tríceps','trapecio','core'], ARRAY['peso corporal','pared opcional'], 'empuje vertical',3,8,120,180,2,NULL,'curado'),
  ('67','Dominada a una mano',ARRAY['one-arm pull-up','one arm pull up'],'gimnasio','habilidad','fuerza', 'dorsal ancho', ARRAY['bíceps','braquial','core','romboides'], ARRAY['barra de dominadas'], 'jalón vertical',1,5,150,240,2,NULL,'revisar'),
  ('68','Flexiones con palmada',ARRAY['clapping push-ups','plyometric push-up'],'cualquiera','potencia','potencia', 'pectoral mayor', ARRAY['tríceps','deltoides anterior','core'], ARRAY['peso corporal'], 'salto/potencia',5,10,90,150,2,NULL,'curado'),
  ('69','Saltos a caja',ARRAY['box jumps'],'gimnasio','potencia','potencia', 'cuádriceps', ARRAY['glúteos','isquiosurales','pantorrillas','core'], ARRAY['caja pliométrica'], 'salto/potencia',5,10,90,150,2,NULL,'curado'),
  ('70','Thruster',ARRAY['thrusters','sentadilla con press'],'gimnasio','potencia','fuerza', 'cuerpo completo', ARRAY['cuádriceps','glúteos','hombros','tríceps','core'], ARRAY['barra o mancuernas'], 'sentadilla/empuje vertical',6,12,90,150,2,NULL,'curado'),
  ('71','Levantamiento turco',ARRAY['turkish get-up','tgu'],'gimnasio','habilidad','fuerza', 'core', ARRAY['hombros','glúteos','cuádriceps','antebrazos'], ARRAY['kettlebell o mancuerna'], 'levantamiento complejo',1,5,90,180,2,NULL,'curado'),
  ('72','Sprints',ARRAY['sprints','carreras de velocidad'],'exterior','cardio','cardio intervalo', 'sistema cardiovascular', ARRAY['glúteos','isquiosurales','cuádriceps','pantorrillas'], ARRAY['pista o espacio abierto'], 'locomoción/cardio',NULL,NULL,90,180,NULL,20,'curado'),
  ('73','Saltar cuerda',ARRAY['jump rope','cuerda'],'cualquiera','cardio','cardio', 'sistema cardiovascular', ARRAY['pantorrillas','hombros','core'], ARRAY['cuerda'], 'locomoción/cardio',NULL,NULL,30,90,NULL,600,'curado'),
  ('74','Remo en máquina',ARRAY['rowing machine','ergometer row'],'gimnasio','cardio','cardio', 'sistema cardiovascular', ARRAY['dorsal ancho','piernas','glúteos','core'], ARRAY['máquina de remo'], 'locomoción/cardio',NULL,NULL,60,120,NULL,1200,'curado'),
  ('75','Ciclismo',ARRAY['cycling','bicicleta estática','bike'],'exterior','cardio','cardio', 'sistema cardiovascular', ARRAY['cuádriceps','glúteos','pantorrillas'], ARRAY['bicicleta o bicicleta estática'], 'locomoción/cardio',NULL,NULL,60,120,NULL,1800,'curado'),
  ('76','Elíptica',ARRAY['elliptical machine','elliptical'],'gimnasio','cardio','cardio', 'sistema cardiovascular', ARRAY['cuádriceps','glúteos','pantorrillas','hombros'], ARRAY['máquina elíptica'], 'locomoción/cardio',NULL,NULL,60,120,NULL,1500,'curado'),
  ('77','Natación',ARRAY['swimming'],'piscina','cardio','cardio', 'sistema cardiovascular', ARRAY['dorsal ancho','hombros','core','piernas'], ARRAY['piscina'], 'locomoción/cardio',NULL,NULL,60,120,NULL,1800,'curado')
)
UPDATE public.exercises e
SET
  nombre = curated.nombre,
  aliases = curated.aliases,
  lugar = curated.lugar,
  objetivo = curated.objetivo,
  tipo_entrenamiento = curated.tipo_entrenamiento,
  musculo_principal = curated.musculo_principal,
  musculos_secundarios = curated.musculos_secundarios,
  equipo_requerido = curated.equipo_requerido,
  equipamiento = array_to_string(curated.equipo_requerido, ', '),
  patron_movimiento = curated.patron_movimiento,
  nivel_minimo = e.nivel,
  rango_reps_min = curated.rango_reps_min,
  rango_reps_max = curated.rango_reps_max,
  descanso_segundos_min = curated.descanso_segundos_min,
  descanso_segundos_max = curated.descanso_segundos_max,
  rir_recomendado = curated.rir_recomendado,
  duracion_promedio_segundos = curated.duracion_promedio_segundos,
  estado_calidad = curated.estado_calidad
FROM curated
WHERE e.id = curated.id;

UPDATE public.exercises
SET descripcion = CASE
  WHEN tipo_entrenamiento ILIKE 'cardio%' THEN 'Ejercicio cardiovascular orientado a mejorar resistencia, capacidad aeróbica y acondicionamiento general. Se programa por duración, intervalos o intensidad, no por repeticiones de fuerza.'
  WHEN patron_movimiento LIKE '%core%' OR tipo_entrenamiento = 'core' THEN 'Ejercicio de core para mejorar control del tronco, estabilidad y transferencia de fuerza. Prioriza postura, respiración y control antes que velocidad.'
  WHEN patron_movimiento LIKE '%sentadilla%' THEN 'Ejercicio dominante de rodilla para fortalecer piernas con énfasis en control, profundidad adecuada y estabilidad del tronco.'
  WHEN patron_movimiento LIKE '%bisagra%' THEN 'Ejercicio dominante de cadera para trabajar cadena posterior. Prioriza columna neutra, cadera atrás y control de la carga.'
  WHEN patron_movimiento LIKE '%jalón vertical%' THEN 'Ejercicio de tracción vertical para espalda. Enfócate en llevar los codos hacia abajo y mantener hombros controlados.'
  WHEN patron_movimiento LIKE '%jalón horizontal%' THEN 'Ejercicio de tracción horizontal para espalda media y dorsal. Prioriza retracción escapular y control del torso.'
  WHEN patron_movimiento LIKE '%empuje horizontal%' THEN 'Ejercicio de empuje horizontal para pecho, tríceps y hombro anterior. Controla la bajada y evita rebotar la carga.'
  WHEN patron_movimiento LIKE '%empuje vertical%' THEN 'Ejercicio de empuje vertical para hombros y tríceps. Mantén costillas abajo y evita compensar con la zona lumbar.'
  ELSE 'Ejercicio de fuerza o habilidad que requiere control técnico, progresión gradual y ejecución sin dolor.'
END,
cues_tecnicos = CASE
  WHEN tipo_entrenamiento ILIKE 'cardio%' THEN ARRAY['Mantén una intensidad sostenible', 'Respira de forma constante', 'Aumenta duración o ritmo de manera gradual']
  WHEN patron_movimiento LIKE '%core%' THEN ARRAY['Activa abdomen antes de iniciar', 'Mantén columna neutra', 'Detén la serie si pierdes postura']
  WHEN patron_movimiento LIKE '%sentadilla%' THEN ARRAY['Pie completo apoyado', 'Rodillas siguen la línea de los pies', 'Mantén el tronco firme']
  WHEN patron_movimiento LIKE '%bisagra%' THEN ARRAY['Cadera hacia atrás', 'Columna neutra', 'Siente tensión en glúteos e isquiosurales']
  WHEN patron_movimiento LIKE '%jalón%' THEN ARRAY['Inicia con escápulas controladas', 'Lleva los codos hacia el cuerpo', 'Controla el regreso completo']
  WHEN patron_movimiento LIKE '%empuje%' THEN ARRAY['Escápulas firmes', 'Controla la bajada', 'Empuja sin perder alineación']
  ELSE ARRAY['Controla la fase de ida y vuelta', 'Evita impulsos excesivos', 'Mantén respiración y postura estables']
END,
errores_comunes = CASE
  WHEN tipo_entrenamiento ILIKE 'cardio%' THEN ARRAY['Empezar demasiado fuerte', 'Perder técnica por fatiga', 'Ignorar molestias articulares']
  WHEN patron_movimiento LIKE '%core%' THEN ARRAY['Arquear la zona lumbar', 'Contener la respiración', 'Moverse demasiado rápido']
  WHEN patron_movimiento LIKE '%sentadilla%' THEN ARRAY['Colapsar rodillas hacia adentro', 'Levantar talones', 'Perder estabilidad del tronco']
  WHEN patron_movimiento LIKE '%bisagra%' THEN ARRAY['Redondear la espalda', 'Convertirlo en sentadilla', 'Alejar demasiado la carga del cuerpo']
  WHEN patron_movimiento LIKE '%jalón%' THEN ARRAY['Usar impulso excesivo', 'Encoger hombros', 'Jalar solo con brazos']
  WHEN patron_movimiento LIKE '%empuje%' THEN ARRAY['Rebotar la carga', 'Perder tensión escapular', 'Usar peso excesivo']
  ELSE ARRAY['Usar impulso excesivo', 'Perder postura', 'Ignorar dolor agudo']
END,
contraindicaciones = CASE
  WHEN tipo_entrenamiento ILIKE 'cardio%' THEN ARRAY['Reducir intensidad si aparece mareo, dolor torácico o falta de aire inusual', 'Si hay dolor agudo, detén el ejercicio y consulta a un profesional']
  WHEN patron_movimiento LIKE '%empuje%' THEN ARRAY['Evitar si provoca dolor agudo en hombro, muñeca o codo', 'Reducir rango o usar alternativa si genera molestia']
  WHEN patron_movimiento LIKE '%sentadilla%' OR patron_movimiento LIKE '%bisagra%' THEN ARRAY['Evitar si provoca dolor agudo en rodilla, cadera o espalda baja', 'Reducir carga o rango si hay molestia']
  ELSE ARRAY['Si hay dolor agudo, detén el ejercicio y consulta a un profesional']
END,
progresiones = CASE
  WHEN tipo_entrenamiento ILIKE 'cardio%' THEN ARRAY['Aumentar duración', 'Aumentar ritmo gradualmente', 'Agregar intervalos controlados']
  WHEN nombre = 'Lagartijas' THEN ARRAY['Flexiones declinadas', 'Flexiones con pausa', 'Flexiones lastradas']
  WHEN nombre = 'Sentadilla con barra' THEN ARRAY['Sentadilla con pausa', 'Sentadilla frontal', 'Aumentar carga gradualmente']
  WHEN nombre = 'Puente de glúteo' THEN ARRAY['Hip thrust con barra', 'Pausa arriba', 'Versión a una pierna']
  ELSE ARRAY['Aumentar repeticiones dentro del rango', 'Aumentar carga gradualmente', 'Controlar mejor el tempo']
END,
regresiones = CASE
  WHEN tipo_entrenamiento ILIKE 'cardio%' THEN ARRAY['Reducir duración', 'Bajar ritmo', 'Usar intervalos más cortos']
  WHEN nombre = 'Lagartijas' THEN ARRAY['Flexiones inclinadas', 'Flexiones con rodillas apoyadas']
  WHEN nombre = 'Sentadilla con barra' THEN ARRAY['Sentadilla goblet', 'Sentadilla a caja', 'Prensa de piernas']
  WHEN nombre = 'Puente de glúteo' THEN ARRAY['Puente de glúteo con pausa corta', 'Puente bilateral sin carga']
  ELSE ARRAY['Reducir carga', 'Usar una variante más estable', 'Reducir rango temporalmente']
END;

UPDATE public.exercises
SET sustituciones = CASE
  WHEN patron_movimiento = 'empuje horizontal' THEN ARRAY['Press de banca con mancuernas', 'Press de banca con barra', 'Lagartijas', 'Aperturas en polea']
  WHEN patron_movimiento = 'empuje vertical' THEN ARRAY['Press de hombro con mancuernas', 'Press militar con barra', 'Flexiones en pino']
  WHEN patron_movimiento = 'jalón vertical' THEN ARRAY['Jalón al pecho', 'Dominadas', 'Dominada a una mano']
  WHEN patron_movimiento = 'jalón horizontal' THEN ARRAY['Remo con mancuerna a una mano', 'Remo con barra', 'Remo en polea baja']
  WHEN patron_movimiento = 'sentadilla' THEN ARRAY['Sentadilla goblet', 'Sentadilla con barra', 'Prensa de piernas', 'Sentadilla búlgara con mancuernas']
  WHEN patron_movimiento = 'bisagra de cadera' THEN ARRAY['Peso muerto rumano con mancuernas', 'Peso muerto convencional con barra', 'Hip thrust con barra', 'Puente de glúteo']
  WHEN patron_movimiento = 'zancada/unilateral' THEN ARRAY['Zancadas con mancuernas', 'Sentadilla búlgara con mancuernas', 'Sentadilla a una pierna']
  WHEN patron_movimiento = 'curl de codo' THEN ARRAY['Curl de bíceps con mancuernas', 'Curl martillo con mancuernas', 'Curl de bíceps con barra']
  WHEN patron_movimiento = 'extensión de codo' THEN ARRAY['Extensión de tríceps sobre la cabeza con mancuerna', 'Patada de tríceps con mancuernas', 'Press francés con barra', 'Fondos en banco para tríceps']
  WHEN tipo_entrenamiento ILIKE 'cardio%' THEN ARRAY['Elíptica', 'Ciclismo', 'Remo en máquina', 'Saltar cuerda']
  ELSE sustituciones
END;

-- Keep aliases searchable but do not break references. The duplicate glute bridge ids are intentionally disambiguated:
-- id 17 = bodyweight bridge, id 40 = weighted glute bridge, id 41 = barbell hip thrust.
COMMENT ON COLUMN public.exercises.aliases IS 'Search aliases, including English exercise names. Main nombre should remain Spanish for visible UI.';
