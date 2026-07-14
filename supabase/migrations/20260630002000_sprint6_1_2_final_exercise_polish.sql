-- Sprint 6.1.2: final professional polish for the current exercise library.
-- Safe data migration: no deletes, no id changes, no routine/calendar changes.

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS instrucciones text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.exercises.instrucciones IS
  'Step-by-step execution instructions for the exercise. Used as the primary fallback when media is unavailable.';

-- Keep both RDL records because they may already be referenced. Convert id 39 into a real barbell variant.
UPDATE public.exercises
SET
  nombre = 'Peso muerto rumano con barra',
  aliases = ARRAY['barbell romanian deadlift', 'RDL con barra', 'peso muerto rumano barra'],
  nivel = 'intermedio',
  nivel_minimo = 'intermedio',
  lugar = 'gimnasio',
  objetivo = 'hipertrofia',
  tipo_entrenamiento = 'fuerza',
  grupo_muscular = 'piernas',
  musculo_principal = 'isquiosurales',
  musculos_secundarios = ARRAY['gluteo mayor', 'erectores espinales', 'antebrazos'],
  equipo_requerido = ARRAY['barra', 'discos'],
  equipamiento = 'barra, discos',
  patron_movimiento = 'bisagra de cadera',
  rango_reps_min = 6,
  rango_reps_max = 10,
  descanso_segundos_min = 120,
  descanso_segundos_max = 180,
  rir_recomendado = 2,
  estado_calidad = 'curado'
WHERE id = '39';

-- Make the cardio row explicit. This avoids confusing it with a strength row machine.
UPDATE public.exercises
SET
  nombre = 'Remo ergómetro',
  aliases = ARRAY['rowing machine', 'remo indoor', 'ergómetro', 'remo en máquina cardiovascular'],
  lugar = 'gimnasio',
  objetivo = 'cardio',
  tipo_entrenamiento = 'cardio',
  grupo_muscular = 'cardio',
  musculo_principal = 'sistema cardiovascular',
  musculos_secundarios = ARRAY['dorsal ancho', 'piernas', 'gluteos', 'core'],
  equipo_requerido = ARRAY['remo ergómetro'],
  equipamiento = 'remo ergómetro',
  patron_movimiento = 'locomoción/cardio',
  rango_reps_min = NULL,
  rango_reps_max = NULL,
  rir_recomendado = NULL,
  duracion_promedio_segundos = 1200,
  estado_calidad = 'curado'
WHERE id = '74';

-- Location polish: dumbbell/bodyweight movements can be done outside a commercial gym.
UPDATE public.exercises
SET lugar = 'cualquiera'
WHERE id IN ('1','4','5','6','7','8','9','10','11','13','14','15','16','22','24','27','46','70','71');

UPDATE public.exercises
SET lugar = 'exterior'
WHERE id = '75';

UPDATE public.exercises
SET lugar = 'piscina'
WHERE id = '77';

-- Specific professional copy for key exercises and ambiguous rows.
WITH specific_copy (id, descripcion, cues_tecnicos, errores_comunes, instrucciones) AS (
  VALUES
  (
    '31',
    'Ejercicio compuesto de empuje horizontal enfocado en el pectoral mayor. Tambien involucra triceps y deltoides anterior, y se usa principalmente para fuerza e hipertrofia del tren superior.',
    ARRAY['Retrae y deprime las escapulas antes de bajar la barra', 'Mantén los pies firmes en el suelo', 'Baja la barra con control hacia la parte media o baja del pecho', 'Empuja sin perder estabilidad en hombros'],
    ARRAY['Rebotar la barra en el pecho', 'Abrir demasiado los codos', 'Levantar los gluteos del banco', 'Perder tension escapular', 'Usar mas peso del que se puede controlar'],
    ARRAY['Acuestate en el banco con los ojos debajo de la barra', 'Toma la barra con un agarre ligeramente mas ancho que los hombros', 'Retrae las escapulas y mantén los pies firmes', 'Baja la barra con control hacia la parte media o baja del pecho', 'Empuja la barra hacia arriba sin perder estabilidad']
  ),
  (
    '48',
    'Ejercicio de jalon vertical para desarrollar dorsal ancho y espalda alta. Es util para hipertrofia, control escapular y como alternativa escalable a las dominadas.',
    ARRAY['Ajusta el soporte para fijar los muslos', 'Inicia bajando los hombros antes de flexionar los codos', 'Jala la barra hacia la parte alta del pecho', 'Controla el regreso sin soltar la tension'],
    ARRAY['Jalar la barra detras del cuello', 'Balancear el torso para mover mas peso', 'Encoger los hombros al jalar', 'Soltar la carga en la fase de regreso'],
    ARRAY['Ajusta el asiento y fija los muslos bajo el soporte', 'Toma la barra con agarre amplio o medio', 'Inicia el movimiento llevando los hombros hacia abajo', 'Jala la barra hacia la parte alta del pecho', 'Regresa con control sin soltar la tension']
  ),
  (
    '42',
    'Ejercicio de maquina para entrenar principalmente cuadriceps con apoyo de gluteos e isquiosurales. Permite acumular volumen de piernas con mayor estabilidad que una sentadilla libre.',
    ARRAY['Apoya toda la espalda en el respaldo', 'Coloca los pies a una anchura comoda', 'Baja hasta un rango controlado sin despegar la cadera', 'Empuja la plataforma sin bloquear violentamente las rodillas'],
    ARRAY['Bajar demasiado y despegar la cadera', 'Juntar las rodillas hacia adentro', 'Bloquear las rodillas con golpe', 'Usar recorrido muy corto por exceso de carga'],
    ARRAY['Ajusta el asiento para que cadera y rodillas se muevan sin molestia', 'Coloca los pies firmes en la plataforma', 'Libera los seguros y baja con control', 'Empuja la plataforma manteniendo rodillas alineadas con los pies', 'Vuelve a asegurar la maquina al terminar']
  ),
  (
    '2',
    'Ejercicio de empuje horizontal con peso corporal para pecho, triceps, hombros y core. Es una base practica para fuerza general y control del tronco.',
    ARRAY['Mantén el cuerpo en linea de cabeza a talones', 'Coloca manos ligeramente mas abiertas que hombros', 'Baja con codos controlados', 'Empuja el suelo sin hundir la cadera'],
    ARRAY['Dejar caer la cadera', 'Abrir demasiado los codos', 'Hacer repeticiones parciales sin control', 'Perder tension abdominal'],
    ARRAY['Coloca manos en el suelo a una anchura comoda', 'Extiende piernas y activa abdomen y gluteos', 'Baja el pecho hacia el suelo con control', 'Mantén codos cerca de una linea natural', 'Empuja el suelo hasta volver a la posicion inicial']
  ),
  (
    '76',
    'Ejercicio cardiovascular de bajo impacto que mejora resistencia aerobica y acondicionamiento general. Es util cuando se busca cardio continuo con menor impacto articular que correr.',
    ARRAY['Mantén postura erguida', 'Usa una resistencia que permita respirar de forma estable', 'Empuja y jala con brazos sin encoger hombros', 'Aumenta intensidad de forma gradual'],
    ARRAY['Inclinarse demasiado sobre los agarres', 'Usar resistencia excesiva desde el inicio', 'Moverse sin rango completo', 'Terminar de golpe sin bajar el ritmo'],
    ARRAY['Ajusta la resistencia a un nivel comodo', 'Mantén postura erguida y agarre relajado', 'Empieza con ritmo suave durante los primeros minutos', 'Mantén una intensidad sostenible segun tu objetivo', 'Reduce el ritmo gradualmente al terminar']
  ),
  (
    '74',
    'Ejercicio cardiovascular en remo ergometro que combina piernas, cadera, espalda y brazos. Se programa por tiempo o intervalos para resistencia y acondicionamiento.',
    ARRAY['Empuja primero con las piernas', 'Mantén el tronco firme durante la extension', 'Jala el mango al final del recorrido', 'Regresa con control antes de la siguiente palada'],
    ARRAY['Jalar solo con brazos', 'Redondear la espalda baja', 'Subir demasiado los hombros', 'Acelerar perdiendo coordinacion'],
    ARRAY['Ajusta los soportes de pies y toma el mango con agarre relajado', 'Inicia con rodillas flexionadas y espalda larga', 'Empuja con las piernas, extiende cadera y termina jalando el mango', 'Regresa brazos, tronco y piernas en orden controlado', 'Mantén un ritmo sostenible y baja la intensidad al finalizar']
  ),
  (
    '16',
    'Bisagra de cadera con mancuernas para trabajar isquiosurales, gluteos y erectores espinales. Es una variante accesible para aprender control de cadera y tension posterior.',
    ARRAY['Lleva la cadera hacia atras antes de flexionar rodillas', 'Mantén las mancuernas cerca de las piernas', 'Conserva columna neutra', 'Sube apretando gluteos sin hiperextender espalda'],
    ARRAY['Redondear la espalda', 'Bajar como si fuera sentadilla', 'Alejar las mancuernas del cuerpo', 'Forzar rango si se pierde postura'],
    ARRAY['Sostén las mancuernas frente a los muslos', 'Flexiona ligeramente las rodillas y lleva la cadera hacia atras', 'Baja las mancuernas cerca de las piernas hasta sentir tension en isquiosurales', 'Mantén espalda neutra y abdomen activo', 'Vuelve a subir extendiendo la cadera con control']
  ),
  (
    '39',
    'Bisagra de cadera con barra orientada a isquiosurales y gluteos. Permite usar mas carga que la variante con mancuernas, por lo que exige mejor control tecnico.',
    ARRAY['Mantén la barra pegada al cuerpo', 'Empuja la cadera hacia atras', 'Conserva rodillas semiflexionadas', 'Sube extendiendo cadera sin arquear la zona lumbar'],
    ARRAY['Dejar la barra lejos del cuerpo', 'Redondear la espalda', 'Convertirlo en sentadilla', 'Bajar mas alla del rango controlable'],
    ARRAY['Toma la barra con agarre firme frente a los muslos', 'Activa abdomen y coloca los pies al ancho de cadera', 'Lleva la cadera hacia atras mientras la barra baja pegada a las piernas', 'Detente cuando sientas tension en isquiosurales sin perder espalda neutra', 'Sube extendiendo la cadera y manteniendo la barra cerca']
  )
)
UPDATE public.exercises e
SET
  descripcion = specific_copy.descripcion,
  cues_tecnicos = specific_copy.cues_tecnicos,
  errores_comunes = specific_copy.errores_comunes,
  instrucciones = specific_copy.instrucciones
FROM specific_copy
WHERE e.id = specific_copy.id;

-- Pattern-based copy and step-by-step instructions for every remaining exercise.
UPDATE public.exercises
SET
  descripcion = CASE
    WHEN instrucciones <> '{}'::text[] THEN descripcion
    WHEN tipo_entrenamiento ILIKE 'cardio%' THEN 'Ejercicio cardiovascular para mejorar resistencia, capacidad aerobica y acondicionamiento general. Se programa por duracion, ritmo o intervalos segun el objetivo.'
    WHEN patron_movimiento LIKE '%sentadilla%' THEN 'Ejercicio dominante de rodilla para fortalecer piernas con enfasis en cuadriceps, gluteos y estabilidad del tronco. Se usa para fuerza, hipertrofia o control unilateral segun la variante.'
    WHEN patron_movimiento LIKE '%bisagra%' THEN 'Ejercicio dominante de cadera para entrenar cadena posterior, especialmente gluteos e isquiosurales. Prioriza control de cadera, columna neutra y carga cercana al cuerpo.'
    WHEN patron_movimiento LIKE '%jalon vertical%' THEN 'Ejercicio de traccion vertical para espalda, dorsal ancho y flexores del codo. Se usa para fuerza e hipertrofia del tren superior.'
    WHEN patron_movimiento LIKE '%jalon horizontal%' THEN 'Ejercicio de traccion horizontal para espalda media, dorsal y control escapular. Ayuda a equilibrar el trabajo de empuje y mejorar postura.'
    WHEN patron_movimiento LIKE '%empuje horizontal%' THEN 'Ejercicio de empuje horizontal para pecho, triceps y deltoides anterior. Se usa para fuerza, hipertrofia y control del tren superior.'
    WHEN patron_movimiento LIKE '%empuje vertical%' THEN 'Ejercicio de empuje vertical para hombros y triceps. Requiere estabilidad de core y control de escapulas para proteger hombros y espalda baja.'
    WHEN patron_movimiento LIKE '%curl%' THEN 'Ejercicio de aislamiento para flexores del codo. Se usa para desarrollar biceps, braquial o braquiorradial segun el agarre.'
    WHEN patron_movimiento LIKE '%extension de codo%' THEN 'Ejercicio de aislamiento para triceps. Ayuda a desarrollar fuerza de empuje y volumen del brazo con control del codo.'
    WHEN tipo_entrenamiento = 'core' OR patron_movimiento LIKE '%core%' OR patron_movimiento LIKE '%rotacion%' THEN 'Ejercicio de core para mejorar estabilidad, control del tronco y transferencia de fuerza. Prioriza respiracion y postura antes que velocidad.'
    ELSE 'Ejercicio de fuerza o habilidad orientado a mejorar control corporal, coordinacion y capacidad fisica. Debe progresarse gradualmente y ejecutarse sin dolor.'
  END,
  cues_tecnicos = CASE
    WHEN instrucciones <> '{}'::text[] THEN cues_tecnicos
    WHEN tipo_entrenamiento ILIKE 'cardio%' THEN ARRAY['Empieza con ritmo suave', 'Respira de forma constante', 'Mantén una intensidad sostenible', 'Reduce el ritmo gradualmente al terminar']
    WHEN patron_movimiento LIKE '%sentadilla%' THEN ARRAY['Apoya el pie completo', 'Mantén rodillas alineadas con los pies', 'Controla la profundidad', 'Sube empujando el suelo']
    WHEN patron_movimiento LIKE '%bisagra%' THEN ARRAY['Lleva la cadera hacia atras', 'Mantén columna neutra', 'Conserva la carga cerca del cuerpo', 'Sube extendiendo la cadera']
    WHEN patron_movimiento LIKE '%jalon%' THEN ARRAY['Controla las escapulas', 'Lleva los codos hacia el cuerpo', 'Evita balancear el torso', 'Regresa con control']
    WHEN patron_movimiento LIKE '%empuje%' THEN ARRAY['Estabiliza hombros antes de empujar', 'Controla la bajada', 'Mantén abdomen activo', 'Empuja sin perder alineacion']
    WHEN patron_movimiento LIKE '%curl%' THEN ARRAY['Mantén codos estables', 'Sube sin balancear el tronco', 'Aprieta al final del recorrido', 'Baja con control']
    WHEN patron_movimiento LIKE '%extension de codo%' THEN ARRAY['Fija los codos', 'Mueve principalmente el antebrazo', 'Evita arquear la espalda', 'Controla el regreso']
    ELSE ARRAY['Prepara postura antes de iniciar', 'Ejecuta con rango controlado', 'Respira de forma estable', 'Detente si aparece dolor agudo']
  END,
  errores_comunes = CASE
    WHEN instrucciones <> '{}'::text[] THEN errores_comunes
    WHEN tipo_entrenamiento ILIKE 'cardio%' THEN ARRAY['Empezar demasiado fuerte', 'Perder tecnica por fatiga', 'Ignorar molestias articulares', 'Terminar sin bajar intensidad']
    WHEN patron_movimiento LIKE '%sentadilla%' THEN ARRAY['Colapsar rodillas hacia adentro', 'Levantar talones', 'Perder estabilidad del tronco', 'Usar mas carga de la controlable']
    WHEN patron_movimiento LIKE '%bisagra%' THEN ARRAY['Redondear la espalda', 'Convertirlo en sentadilla', 'Alejar la carga del cuerpo', 'Forzar rango sin control']
    WHEN patron_movimiento LIKE '%jalon%' THEN ARRAY['Usar impulso excesivo', 'Encoger hombros', 'Jalar solo con brazos', 'Soltar la carga en el regreso']
    WHEN patron_movimiento LIKE '%empuje%' THEN ARRAY['Perder tension escapular', 'Compensar con zona lumbar', 'Rebotar la carga', 'Bloquear articulaciones con golpe']
    WHEN patron_movimiento LIKE '%curl%' THEN ARRAY['Balancear el cuerpo', 'Mover los codos hacia adelante', 'Bajar sin control', 'Usar carga excesiva']
    WHEN patron_movimiento LIKE '%extension de codo%' THEN ARRAY['Abrir demasiado los codos', 'Mover hombros en exceso', 'Arquear espalda', 'Hacer repeticiones parciales sin control']
    ELSE ARRAY['Apresurar la ejecucion', 'Perder postura', 'Ignorar dolor agudo', 'Progresar demasiado rapido']
  END,
  instrucciones = CASE
    WHEN instrucciones <> '{}'::text[] THEN instrucciones
    WHEN tipo_entrenamiento ILIKE 'cardio%' THEN ARRAY['Ajusta equipo, espacio o resistencia a un nivel comodo', 'Empieza con ritmo suave durante los primeros minutos', 'Mantén respiracion constante y postura estable', 'Sostén la intensidad indicada por tiempo o intervalos', 'Reduce el ritmo gradualmente al terminar']
    WHEN patron_movimiento LIKE '%sentadilla%' THEN ARRAY['Coloca los pies a una anchura comoda', 'Mantén torso firme y mirada al frente', 'Desciende flexionando cadera y rodillas', 'Mantén rodillas alineadas con los pies', 'Sube empujando el suelo con control']
    WHEN patron_movimiento LIKE '%bisagra%' THEN ARRAY['Coloca la carga cerca del cuerpo o prepara la posicion inicial', 'Flexiona ligeramente las rodillas', 'Lleva la cadera hacia atras manteniendo espalda neutra', 'Baja hasta sentir tension controlada en cadena posterior', 'Regresa extendiendo la cadera sin perder postura']
    WHEN patron_movimiento LIKE '%jalon vertical%' THEN ARRAY['Ajusta agarre o soporte antes de iniciar', 'Activa espalda llevando hombros hacia abajo', 'Jala llevando codos hacia el torso', 'Pausa brevemente con control', 'Regresa lento sin perder tension']
    WHEN patron_movimiento LIKE '%jalon horizontal%' THEN ARRAY['Prepara una posicion estable con torso firme', 'Toma el agarre y extiende brazos sin perder postura', 'Jala llevando codos hacia atras', 'Junta escapulas sin encoger hombros', 'Regresa con control hasta estirar espalda']
    WHEN patron_movimiento LIKE '%empuje horizontal%' THEN ARRAY['Prepara manos, banco o carga en posicion estable', 'Activa core y estabiliza hombros', 'Baja con control hacia el rango indicado', 'Empuja alejando la carga o el suelo', 'Repite sin perder alineacion']
    WHEN patron_movimiento LIKE '%empuje vertical%' THEN ARRAY['Coloca la carga a la altura inicial segura', 'Activa abdomen y gluteos para estabilizar tronco', 'Empuja verticalmente sin arquear la espalda', 'Termina con control sobre hombros', 'Baja lentamente a la posicion inicial']
    WHEN patron_movimiento LIKE '%curl%' THEN ARRAY['Sujeta la carga con brazos extendidos y codos cerca del cuerpo', 'Flexiona los codos sin balancear el tronco', 'Pausa brevemente arriba', 'Baja la carga con control', 'Repite manteniendo codos estables']
    WHEN patron_movimiento LIKE '%extension de codo%' THEN ARRAY['Coloca hombros y codos en posicion estable', 'Extiende los codos hasta contraer triceps', 'Evita mover el tronco o abrir demasiado los codos', 'Regresa con control al rango inicial', 'Repite sin perder tension']
    ELSE ARRAY['Prepara una posicion inicial estable', 'Activa abdomen y controla respiracion', 'Ejecuta el movimiento principal con rango seguro', 'Regresa con control a la posicion inicial', 'Repite solo mientras mantengas buena tecnica']
  END
WHERE instrucciones = '{}'::text[];

-- Safer substitutions: no self-references and more specific alternatives.
UPDATE public.exercises
SET sustituciones = CASE id
  WHEN '31' THEN ARRAY['Press de banca con mancuernas','Lagartijas','Press inclinado con barra','Aperturas en polea']
  WHEN '1' THEN ARRAY['Press de banca con barra','Lagartijas','Aperturas con mancuernas','Aperturas en polea']
  WHEN '45' THEN ARRAY['Curl de bíceps con mancuernas','Curl martillo con mancuernas']
  WHEN '8' THEN ARRAY['Curl martillo con mancuernas','Curl de bíceps con barra']
  WHEN '9' THEN ARRAY['Curl de bíceps con mancuernas','Curl de bíceps con barra']
  WHEN '48' THEN ARRAY['Dominadas','Remo en polea baja','Pullover con mancuerna']
  WHEN '42' THEN ARRAY['Sentadilla goblet','Sentadilla con barra','Zancadas con mancuernas','Sentadilla búlgara con mancuernas']
  WHEN '16' THEN ARRAY['Peso muerto rumano con barra','Peso muerto convencional con barra','Hip thrust con barra','Puente de glúteo con carga']
  WHEN '39' THEN ARRAY['Peso muerto rumano con mancuernas','Peso muerto convencional con barra','Hip thrust con barra','Puente de glúteo con carga']
  WHEN '74' THEN ARRAY['Elíptica','Ciclismo','Saltar cuerda','Sprints']
  ELSE sustituciones
END;

-- Remove accidental self-references and duplicate substitutions across all exercises.
UPDATE public.exercises e
SET sustituciones = cleaned.items
FROM (
  SELECT
    id,
    COALESCE(array_agg(item ORDER BY first_seen) FILTER (WHERE item IS NOT NULL), '{}'::text[]) AS items
  FROM (
    SELECT
      e.id,
      s.item,
      min(s.ordinality) AS first_seen
    FROM public.exercises e
    LEFT JOIN LATERAL unnest(e.sustituciones) WITH ORDINALITY AS s(item, ordinality) ON true
    WHERE s.item IS NULL
       OR lower(trim(s.item)) <> lower(trim(e.nombre))
    GROUP BY e.id, s.item
  ) deduped
  GROUP BY id
) cleaned
WHERE e.id = cleaned.id;

-- Keep cardio modeled by duration.
UPDATE public.exercises
SET rango_reps_min = NULL,
    rango_reps_max = NULL,
    rir_recomendado = NULL
WHERE tipo_entrenamiento ILIKE 'cardio%';
