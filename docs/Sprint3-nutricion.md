Inicia Beta Nutrition Sprint 3: Sistema completo de recetas, cálculo nutricional y registro en comidas de SendaFit.

────────────────────────────────────────
## Contexto confirmado
────────────────────────────────────────

Los sprints anteriores están terminados.

### Sprint 1

La arquitectura nutrition_* fue creada, poblada y validada.

Estado final:

- 304 alimentos;
- 875 porciones;
- 1,974 valores nutricionales activos aplicados;
- 235 grupos canónicos;
- 71 relaciones alimentarias;
- 0 critical;
- 0 warning.

### Sprint 2

La aplicación ya utiliza nutrition_* para:

- listar alimentos;
- buscar por nombres y aliases;
- mostrar grupos canónicos;
- elegir variantes;
- elegir preparaciones;
- elegir porciones;
- calcular nutrientes;
- registrar alimentos en comidas;
- mantener compatibilidad con el historial existente.

El Sprint 2 quedó completado y validado.

────────────────────────────────────────
## Objetivo general
────────────────────────────────────────

Crear un sistema completo de recetas dentro de SendaFit.

Una receta debe ser una entidad reutilizable compuesta por:

- alimentos o variantes concretas de nutrition_foods;
- cantidades;
- porciones;
- instrucciones;
- rendimiento;
- número de porciones;
- tiempos;
- nutrientes calculados automáticamente;
- metadata necesaria para futuros planes alimenticios;
- información suficiente para generar listas de compras posteriormente.

El usuario debe poder:

1. Explorar recetas disponibles.
2. Buscar recetas.
3. Crear una receta propia.
4. Seleccionar ingredientes desde el catálogo nutrition_*.
5. Elegir la variante y porción exactas de cada ingrediente.
6. Indicar cantidades.
7. Añadir instrucciones.
8. Definir el rendimiento y número de porciones.
9. Ver los nutrientes totales.
10. Ver los nutrientes por porción.
11. Guardar la receta.
12. Editar una receta propia sin modificar el historial anterior.
13. Duplicar una receta.
14. Añadir una o varias porciones de la receta a una comida.
15. Consultar posteriormente el registro realizado.

Este sprint incluye:

- arquitectura de recetas;
- migraciones;
- backend;
- servicios;
- cálculos;
- frontend;
- UI/UX;
- RLS;
- integración con meal logs;
- pruebas;
- validación.

Este sprint no incluye:

- generación de planes alimenticios;
- coach nutricional con IA;
- regeneración automática de comidas;
- sustituciones inteligentes;
- lista de compras;
- planificación semanal;
- expansión masiva de recetas públicas.

────────────────────────────────────────
## Contexto disponible en el repositorio
────────────────────────────────────────

El agente desarrollador ya creó la arquitectura nutrition_*, la importación del catálogo y la integración del Sprint 2.

Antes de escribir código debes buscar recursivamente dentro del proyecto y leer todo el contexto existente relacionado con nutrición.

Localiza como mínimo:

- documentación del modelo nutrition_*;
- documentación de relaciones;
- migraciones nutrition_*;
- correcciones arquitectónicas;
- archivos de importación del catálogo v2.1;
- informes de importación;
- documentación del Sprint 2;
- servicios de alimentos;
- hooks de búsqueda;
- selectores de alimentos;
- selector de variantes;
- selector de porciones;
- cálculo nutricional;
- registro de comidas;
- tablas de meal logs;
- tipos generados de Supabase;
- policies RLS;
- funciones RPC o Edge Functions relacionadas.

Busca especialmente dentro de:

- docs/;
- src/;
- components/;
- hooks/;
- services/;
- lib/;
- supabase/;
- supabase/migrations/;
- supabase/functions/;
- scripts/;
- cualquier ruta equivalente usada realmente por el proyecto.

No asumas rutas exactas.

Documenta cuáles archivos y tablas encontraste.

No pidas al usuario documentos que tú mismo creaste y que siguen disponibles dentro del repositorio.

Si encuentras varias versiones de un archivo:

1. identifica la versión realmente aplicada;
2. compárala con el esquema actual;
3. utiliza la versión más reciente compatible;
4. documenta la ruta seleccionada;
5. no mezcles modelos incompatibles.

La fuente de verdad será:

1. esquema real aplicado en Supabase;
2. migraciones vigentes;
3. código funcional del Sprint 2;
4. documentación vigente;
5. tipos actuales generados desde Supabase.

────────────────────────────────────────
## Restricciones
────────────────────────────────────────

No modificar innecesariamente:

- catálogo curado de alimentos;
- valores nutricionales;
- grupos canónicos;
- porciones existentes;
- aliases;
- categorías de alimentos;
- ejercicios;
- entrenamientos;
- autenticación;
- perfiles;
- progreso;
- suscripciones;
- módulos no nutricionales.

No eliminar:

- foods legacy;
- meals legacy;
- meal_ingredients legacy;
- food_analysis_logs legacy;
- tablas nutrition_* existentes;
- meal logs existentes;
- registros históricos.

No volver a importar el catálogo.

No realizar otra curación nutricional.

No agregar cientos de recetas de producción.

No comenzar el Sprint 4.

No comenzar el Sprint 5.

Puedes modificar exclusivamente el ecosistema nutricional necesario para implementar recetas y registrarlas correctamente.

────────────────────────────────────────
## Fase 1 — Auditoría previa
────────────────────────────────────────

Antes de diseñar o implementar, analiza:

1. Si ya existen tablas de recetas.
2. Si existe algún concepto legacy similar a receta.
3. Cómo funcionan actualmente meals y meal logs.
4. Cómo se registra un alimento individual.
5. Qué columnas se almacenan como snapshot.
6. Cómo se calculan los nutrientes en el Sprint 2.
7. Cómo se resuelven food_id, serving_id y cantidades.
8. Cómo se gestionan usuarios y RLS.
9. Qué componentes pueden reutilizarse.
10. Qué partes requieren nueva arquitectura.

No crees tablas duplicadas si ya existe una implementación válida.

Crea:

docs/beta-nutrition-sprint-3-audit.md

Debe incluir:

- arquitectura actual;
- archivos localizados;
- tablas existentes;
- flujo actual de registro;
- componentes reutilizables;
- carencias detectadas;
- arquitectura de recetas propuesta;
- plan de implementación;
- riesgos.

────────────────────────────────────────
## Fase 2 — Modelo de recetas
────────────────────────────────────────

Diseña e implementa un modelo normalizado y compatible con nutrition_*.

La arquitectura debe distinguir como mínimo:

- identidad de la receta;
- versión de la receta;
- ingredientes de la versión;
- pasos de preparación;
- nutrientes calculados;
- propiedad de usuario;
- visibilidad;
- estado;
- rendimiento;
- porciones.

Evalúa y crea únicamente si no existen equivalentes adecuados entidades conceptuales como:

- nutrition_recipes;
- nutrition_recipe_versions;
- nutrition_recipe_ingredients;
- nutrition_recipe_steps;
- nutrition_recipe_nutrients;
- relaciones de recetas con categorías o etiquetas.

Los nombres concretos deben respetar las convenciones actuales.

No crees tablas con nombres redundantes si el modelo existente ya cubre una entidad.

────────────────────────────────────────
## Receta y versión
────────────────────────────────────────

Una receta debe representar su identidad general.

Ejemplo:

```text
Avena con plátano

Una versión debe representar una composición concreta:

Versión 1
- 50 g de avena
- 250 ml de leche
- 1 plátano mediano

Si posteriormente el usuario edita la receta:

Versión 2
- 60 g de avena
- 200 ml de leche
- 1 plátano pequeño

La versión anterior debe conservarse si ya fue utilizada en un registro de comida.

No sobrescribas destructivamente una receta que ya forma parte del historial.

Editar una receta publicada o utilizada debe crear una nueva versión.

Los borradores que nunca fueron utilizados pueden actualizarse según las reglas que definas.

────────────────────────────────────────

Campos mínimos de receta

────────────────────────────────────────

La receta debe poder almacenar, según el modelo final:

recipe_id;
owner_user_id nullable para recetas del sistema;
nombre;
descripción;
imagen opcional si la infraestructura ya lo permite;
visibilidad;
estado;
origen;
idioma o locale;
categoría;
etiquetas;
dificultad;
tiempo de preparación;
tiempo de cocción;
tiempo total;
porciones predeterminadas;
rendimiento total;
unidad de rendimiento;
peso final opcional;
volumen final opcional;
versión activa;
created_at;
updated_at;
archived_at cuando corresponda.

No obligues a utilizar una imagen.

No implementes un sistema nuevo de almacenamiento de imágenes si no existe y no es necesario para cerrar el sprint.

────────────────────────────────────────

Estados de receta

────────────────────────────────────────

Diseña estados claros, por ejemplo:

draft;
active;
archived;
deprecated.

La visibilidad puede distinguir:

private;
system;
public o unlisted solamente si existe una necesidad real y segura.

Las recetas creadas por usuarios deben ser privadas por defecto.

No implementes todavía una comunidad pública de recetas sin moderación.

Las recetas del sistema deben ser visibles para todos, pero editables únicamente por procesos o roles autorizados.

────────────────────────────────────────

Fase 3 — Ingredientes de una receta

────────────────────────────────────────

Cada ingrediente debe apuntar a un alimento o variante nutricional concreta de nutrition_foods.

Ejemplo correcto:

Pechuga de pollo cocida, sin piel

Ejemplo insuficiente:

Pollo

cuando existen varias variantes con valores diferentes.

Cada ingrediente debe conservar como mínimo:

recipe_version_id;
orden;
food_id;
canonical_group_id cuando resulte útil;
serving_id;
cantidad de porciones o unidades;
gramos calculados;
mililitros calculados;
nota opcional;
indicador opcional si el ingrediente es decorativo o no afecta el cálculo, solo si existe una justificación clara.

El cálculo nutricional siempre debe utilizar el food_id de la variante concreta.

No utilices únicamente canonical_group_id para calcular nutrientes.

────────────────────────────────────────

Selección de ingredientes

────────────────────────────────────────

Reutiliza el buscador y selector desarrollado en el Sprint 2.

El flujo debe permitir:

Buscar ingrediente
→ seleccionar grupo
→ elegir variante o preparación
→ elegir porción
→ indicar cantidad
→ añadir a la receta

No dupliques la lógica de búsqueda del Sprint 2.

No crees un segundo buscador incompatible.

Los ingredientes ya agregados deben poder:

editar cantidad;
cambiar porción;
cambiar variante;
reordenarse;
eliminarse;
mostrar un resumen nutricional.

No permitas guardar una receta sin ingredientes.

────────────────────────────────────────

Cantidades

────────────────────────────────────────

Cada cantidad debe cumplir:

mayor que cero;
numérica;
permitir decimales;
unidad válida;
porción válida;
equivalencia resoluble;
alimento activo y visible o permitido para historial.

No permitas:

NaN;
Infinity;
valores negativos;
cero;
unidades inexistentes;
alimentos deprecated como nuevos ingredientes;
porciones que no pertenecen al alimento seleccionado.

No realices conversiones utilizando supuestos no registrados.

Utiliza las equivalencias existentes en nutrition_*.

────────────────────────────────────────

Ingredientes añadidos y preparación

────────────────────────────────────────

La receta debe representar explícitamente todos los ingredientes que aportan nutrientes.

Ejemplo:

Huevo revuelto con aceite

debe construirse como:

huevo o variante adecuada;
aceite en la cantidad correspondiente.

No atribuyas aceite, mantequilla, leche, queso o salsa de forma implícita a un método de preparación.

No calcules grasa añadida basándote únicamente en términos como:

frito;
a la plancha;
revuelto;
air fryer.

El usuario debe añadir los ingredientes reales utilizados.

────────────────────────────────────────

Fase 4 — Pasos de preparación

────────────────────────────────────────

Cada versión de receta debe permitir instrucciones ordenadas.

Cada paso debe almacenar:

step_id;
recipe_version_id;
número de paso;
instrucción;
duración opcional;
título opcional si el diseño lo necesita.

Las instrucciones deben:

aceptar UTF-8;
conservar acentos;
permitir texto suficientemente largo;
mostrarse en orden;
no contener HTML inseguro;
validarse y sanearse según las prácticas actuales del proyecto.

Debe ser posible:

agregar pasos;
editar pasos;
eliminar pasos;
reordenarlos.

No permitas dos pasos con el mismo número dentro de la misma versión.

────────────────────────────────────────

Fase 5 — Rendimiento y porciones

────────────────────────────────────────

Cada versión debe definir como mínimo:

número de porciones;
rendimiento total opcional;
peso final opcional;
volumen final opcional.

El número de porciones debe ser mayor que cero.

Ejemplo:

Receta total: 4 porciones
Peso final: 800 g
Peso aproximado por porción: 200 g

Si se proporciona peso final:

peso por porción = peso final / número de porciones

Si no se proporciona peso final, la receta puede calcularse por número de porciones.

No supongas que el peso final es igual a la suma de los ingredientes.

La cocción puede modificar el peso por pérdida o absorción de agua.

El usuario puede indicar el peso final cuando lo conozca.

No inventes automáticamente un factor de rendimiento.

────────────────────────────────────────

Fase 6 — Cálculo nutricional

────────────────────────────────────────

El motor debe calcular automáticamente:

Nutrientes de cada ingrediente.
Nutrientes totales de la receta.
Nutrientes por porción.
Nutrientes por 100 g cuando exista peso final.
Nutrientes según el número de porciones consumidas.

Utiliza únicamente los nutrientes activos de nutrition_food_nutrients o la entidad real equivalente.

Se consideran inactivos:

deprecated;
rejected.

No selecciones arbitrariamente el primer valor nutricional.

Respeta:

nutrient_code;
amount;
unit;
basis_amount;
basis_unit;
gramos;
mililitros;
porciones;
valores null.

Fórmula conceptual por ingrediente:

cantidad consumida normalizada
=
cantidad seleccionada × equivalencia de la porción

nutriente del ingrediente
=
valor de referencia × cantidad normalizada / base de referencia

Total de receta:

nutriente total
=
suma del nutriente de todos los ingredientes

Por porción:

nutriente por porción
=
nutriente total / número de porciones

No hardcodees siempre 100 g si el alimento tiene otra base válida.

────────────────────────────────────────

Valores nutricionales ausentes

────────────────────────────────────────

No conviertas automáticamente null en cero.

Distingue:

valor cero;
no reportado;
no disponible.

Si un ingrediente carece de un macronutriente obligatorio, la receta debe marcar el cálculo como incompleto.

El frontend debe poder mostrar:

Información nutricional parcialmente disponible

No debe mostrar un total aparentemente exacto si faltan valores fundamentales.

Documenta qué nutrientes están incompletos.

────────────────────────────────────────

Nutrientes mínimos

────────────────────────────────────────

Muestra como mínimo:

calorías;
proteína;
carbohidratos;
grasa.

Cuando estén disponibles:

fibra;
azúcares;
sodio.

El modelo debe permitir otros micronutrientes sin requerir una nueva migración por cada nutriente.

No crees columnas físicas nuevas para cada vitamina si la arquitectura actual ya utiliza una tabla normalizada de nutrientes.

────────────────────────────────────────

Fuente de verdad del cálculo

────────────────────────────────────────

Debe existir una única implementación autoritativa del cálculo.

El frontend puede calcular una vista previa inmediata.

El backend o una función transaccional debe volver a calcular y validar antes de guardar.

No confíes exclusivamente en nutrientes enviados por el cliente.

El usuario no debe poder alterar manualmente las calorías o macros calculados mediante una petición manipulada.

Los valores guardados deben provenir del catálogo y de las cantidades verificadas en servidor.

────────────────────────────────────────

Snapshot y versionado nutricional

────────────────────────────────────────

Los nutrientes de una versión deben poder conservarse como snapshot.

Esto es necesario porque:

los alimentos pueden actualizarse;
una receta puede editarse;
el historial no debe cambiar retroactivamente;
un meal log debe conservar lo registrado originalmente.

Al guardar o publicar una versión:

calcula nutrientes;
almacena el resultado;
registra la fecha de cálculo;
registra la versión;
registra si el cálculo está completo;
conserva la composición de ingredientes utilizada.

Define claramente cuándo debe recalcularse:

al modificar un ingrediente;
al modificar cantidad;
al modificar porción;
al modificar rendimiento;
al modificar número de porciones;
al crear una nueva versión.

No recalcules automáticamente versiones históricas ya utilizadas sin una acción explícita.

────────────────────────────────────────

Fase 7 — API, RPC o servicios

────────────────────────────────────────

Crea o adapta una capa centralizada de recetas.

Debe ofrecer operaciones equivalentes a:

listar recetas disponibles;
buscar recetas;
obtener detalle;
crear receta;
crear borrador;
actualizar borrador;
crear nueva versión;
guardar ingredientes;
guardar pasos;
calcular vista previa;
publicar o activar versión;
duplicar receta;
archivar receta;
añadir receta a una comida;
consultar nutrientes totales;
consultar nutrientes por porción.

Los nombres concretos deben ajustarse a las convenciones del proyecto.

No distribuyas escrituras complejas entre varios componentes.

Guardar una receta completa debe realizarse mediante una transacción lógica.

────────────────────────────────────────

Transacciones

────────────────────────────────────────

La creación o publicación debe aplicar conjuntamente:

receta
→ versión
→ ingredientes
→ pasos
→ nutrientes calculados
→ versión activa

Si falla cualquiera de estos elementos, no debe quedar una receta incompleta parcialmente guardada.

Utiliza:

función PostgreSQL;
RPC;
transacción desde backend;
mecanismo equivalente compatible con la arquitectura actual.

No realices commits parciales sin recuperación.

────────────────────────────────────────

Fase 8 — RLS y permisos

────────────────────────────────────────

Configura RLS de forma segura.

Recetas del sistema
visibles para usuarios permitidos;
no editables por usuarios normales;
modificables únicamente por roles o procesos autorizados.
Recetas del usuario

El usuario propietario debe poder:

crear;
leer;
editar;
versionar;
duplicar;
archivar.

Otros usuarios no deben poder acceder a recetas privadas.

No confíes únicamente en comprobaciones del frontend.

Las policies deben validar ownership en la base de datos.

Ingredientes, pasos y versiones

Las policies deben heredar o comprobar la propiedad de la receta padre.

Un usuario no debe poder insertar ingredientes dentro de la receta privada de otra persona.

────────────────────────────────────────

Fase 9 — Interfaz de recetas

────────────────────────────────────────

Crea una sección de recetas coherente con el diseño actual de SendaFit.

Debe permitir como mínimo:

listado;
buscador;
detalle;
crear;
editar;
duplicar;
archivar;
añadir a comida.

No rediseñes toda la aplicación.

Mantén:

tipografía;
colores;
componentes;
espaciado;
navegación;
estilo visual actual.

────────────────────────────────────────

Listado de recetas

────────────────────────────────────────

El listado debe mostrar información útil, por ejemplo:

nombre;
descripción breve;
tiempo total;
porciones;
calorías por porción;
proteína por porción;
categoría;
origen: sistema o propia;
estado;
imagen opcional cuando exista.

Debe soportar:

scroll o paginación;
búsqueda;
carga;
estado vacío;
error;
resultados sin duplicados.

No cargues todos los ingredientes y pasos de todas las recetas en la consulta inicial.

Carga detalles al seleccionar una receta.

────────────────────────────────────────

Búsqueda de recetas

────────────────────────────────────────

La búsqueda debe funcionar por:

nombre;
descripción;
categoría;
etiquetas;
ingredientes, solamente si puede implementarse sin consultas costosas o inconsistentes.

Debe tolerar:

mayúsculas;
minúsculas;
acentos;
espacios adicionales.

No debe buscar únicamente sobre la primera página ya descargada.

────────────────────────────────────────

Detalle de receta

────────────────────────────────────────

La vista de detalle debe mostrar:

nombre;
descripción;
porciones;
tiempos;
dificultad;
ingredientes;
cantidades;
porciones utilizadas;
pasos ordenados;
nutrientes totales;
nutrientes por porción;
estado de información incompleta cuando aplique;
botón para añadir a una comida;
acciones permitidas para el propietario.

No muestres códigos internos como:

recipe_version;
prepared_variant;
basis_amount;
active;
private.

Utiliza etiquetas naturales para el usuario.

────────────────────────────────────────

Formulario de creación

────────────────────────────────────────

El flujo recomendado es:

Datos generales
→ Ingredientes
→ Instrucciones
→ Rendimiento y porciones
→ Resumen nutricional
→ Guardar

No es obligatorio crear un wizard de varias páginas si el diseño actual funciona mejor con una sola vista.

El formulario debe validar:

nombre;
al menos un ingrediente;
cantidades;
porciones;
orden de pasos;
número de porciones;
tiempos no negativos;
campos obligatorios.

Debe advertir antes de salir si existen cambios sin guardar.

────────────────────────────────────────

Fase 10 — Añadir receta a una comida

────────────────────────────────────────

Integra recetas en el flujo nutricional del Sprint 2.

El usuario debe poder elegir:

Alimentos | Recetas

o un patrón equivalente coherente con la interfaz actual.

Al seleccionar una receta debe poder indicar:

cantidad de porciones consumidas;
porción decimal cuando tenga sentido;
comida del día;
fecha;
otros datos ya soportados por el registro actual.

Ejemplos:

1 porción;
0.5 porciones;
1.5 porciones;
2 porciones.

No obligues a registrar cada ingrediente individualmente.

────────────────────────────────────────

Persistencia del registro de receta

────────────────────────────────────────

El registro debe conservar como mínimo:

recipe_id;
recipe_version_id;
cantidad de porciones consumidas;
nombre de receta como snapshot;
nutrientes consumidos como snapshot;
fecha;
comida;
usuario;
timestamps.

No guardes únicamente recipe_id sin versión.

No dependas de la versión activa actual para reconstruir un registro histórico.

Si una receta cambia, los registros anteriores deben conservar sus nutrientes originales.

────────────────────────────────────────

Integración con meal logs

────────────────────────────────────────

Inspecciona la arquitectura real y selecciona la solución mínima compatible.

Puede requerirse:

agregar recipe_version_id nullable al item del meal log;
agregar un tipo de origen food/recipe;
crear una relación específica de log de receta;
almacenar snapshots.

La implementación debe garantizar que un item represente exactamente una de estas fuentes:

alimento individual;
receta.

No permitas un item ambiguo que apunte simultáneamente a un alimento y una receta, salvo que el modelo existente tenga una razón explícita.

Utiliza constraints cuando sea posible.

No rompas los registros creados en el Sprint 2.

────────────────────────────────────────

No duplicar nutrientes en el diario

────────────────────────────────────────

Si una receta se registra como un solo item:

contabiliza sus nutrientes una sola vez;
no vuelvas a contabilizar sus ingredientes como items independientes.

Los ingredientes pueden conservarse como snapshot para detalle, pero no deben duplicar el total diario.

Evita:

Receta: 500 kcal
+
ingredientes de la receta: 500 kcal
=
1,000 kcal incorrectas

────────────────────────────────────────

Fase 11 — Categorías, etiquetas y alérgenos

────────────────────────────────────────

La receta debe quedar preparada para futuros filtros del coach.

Utiliza únicamente información disponible y verificable.

Puede almacenar o derivar:

categoría de receta;
etiquetas alimentarias;
posibles alérgenos;
tipo de comida;
vegetariana;
vegana;
sin gluten;
sin lactosa;
alta en proteína;

solo cuando la información de ingredientes permita determinarlo de forma segura.

No inventes etiquetas.

No declares una receta “sin gluten” si algún ingrediente no tiene información suficiente.

Cuando exista incertidumbre:

no asignes la etiqueta;
marca la evaluación como incompleta.

No implementes todavía preferencias personales o alergias del usuario.

Eso pertenece al Sprint 4.

────────────────────────────────────────

Preparación para el Sprint 4

────────────────────────────────────────

Sin implementar el coach, el sistema de recetas debe exponer datos suficientes para que posteriormente pueda filtrar por:

calorías;
proteína;
carbohidratos;
grasa;
porciones;
tiempo;
categoría;
ingredientes;
alérgenos;
etiquetas dietéticas;
tipo de comida;
propietario o sistema;
visibilidad;
estado.

No construyas todavía algoritmos de recomendación.

No llames modelos de IA.

────────────────────────────────────────

Preparación para el Sprint 5

────────────────────────────────────────

Sin crear aún la lista de compras, cada ingrediente debe conservar suficiente información para calcular posteriormente:

cantidad por receta
× porciones utilizadas
× número de días

Debe poder recuperarse:

food_id;
nombre;
cantidad;
unidad;
gramos o mililitros;
serving_id;
número de porciones de receta;
rendimiento.

No generes todavía listas de compras.

No agregues cantidades semanales.

────────────────────────────────────────

Fase 12 — Historial y cambios

────────────────────────────────────────

Verifica los siguientes escenarios:

Una receta se crea.
Se registra una porción en una comida.
La receta se edita.
Se crea una nueva versión.
El registro anterior sigue mostrando la versión antigua.
Un registro nuevo utiliza la nueva versión.
Archivar la receta no elimina el historial.
Eliminar al usuario no produce cascadas destructivas inesperadas según las reglas actuales.

No sobrescribas snapshots históricos.

────────────────────────────────────────

Fase 13 — UTF-8

────────────────────────────────────────

Todo debe conservar UTF-8.

Verifica textos como:

proteína;
cocción;
porción;
México;
plátano;
salmón;
jalapeño;
puré;
sauté, si existe legítimamente;
µg.

No uses:

Latin-1;
Windows-1252;
transliteración a ASCII;
eliminación de acentos.

Busca patrones de mojibake:

Ã;
Â;
â€;
�.

No los reemplaces silenciosamente.

Identifica su origen si aparecen.

Los nombres, descripciones e instrucciones deben conservar Unicode normalizado.

────────────────────────────────────────

Fase 14 — Accesibilidad y UI

────────────────────────────────────────

El sistema debe funcionar con:

teclado;
mouse;
pantalla táctil;
lectores de pantalla cuando la infraestructura actual lo soporte.

Incluye:

labels;
focus visible;
mensajes de error;
botones accesibles;
orden lógico de tabulación;
confirmación al archivar;
estados disabled;
feedback al guardar;
estados de carga.

Los campos dinámicos de ingredientes y pasos deben anunciar correctamente:

agregado;
eliminado;
reordenado;
error.

────────────────────────────────────────

Fase 15 — Rendimiento

────────────────────────────────────────

Evita:

N+1 al cargar ingredientes;
obtener nutrientes individualmente por ingrediente;
recalcular en cada render sin necesidad;
descargar todas las recetas completas en el listado;
guardar con decenas de peticiones independientes;
duplicar consultas del Sprint 2.

Prefiere consultas agrupadas o funciones transaccionales.

Mide y documenta:

carga inicial del listado;
búsqueda;
apertura de detalle;
cálculo de una receta de varios ingredientes;
guardado;
registro en una comida.

────────────────────────────────────────

Fase 16 — Pruebas obligatorias

────────────────────────────────────────

Crea pruebas unitarias, de integración y de interfaz según la infraestructura existente.

Arquitectura
Se puede crear una receta.
Se puede crear una versión.
Se pueden agregar ingredientes.
Se pueden agregar pasos.
RLS impide editar recetas ajenas.
Los usuarios normales no editan recetas del sistema.
Ingredientes
Solo se permiten food_id válidos.
La porción pertenece al alimento.
No se acepta cantidad cero.
No se acepta cantidad negativa.
Se aceptan decimales válidos.
No se permiten alimentos deprecated para nuevas recetas.
Cálculo
Los nutrientes del ingrediente se calculan correctamente.
Los totales son la suma de ingredientes.
Los valores por porción son correctos.
Los valores por 100 g son correctos cuando existe peso final.
Los null no se convierten en cero.
Un nutriente faltante marca cálculo incompleto.
El backend rechaza nutrientes manipulados por el cliente.
Versionado
Editar una receta usada crea nueva versión.
La versión anterior permanece.
El historial usa recipe_version_id.
Archivar no elimina versiones.
El snapshot nutricional no cambia retroactivamente.
Interfaz
Se puede buscar un ingrediente.
Se puede elegir variante.
Se puede elegir porción.
Se puede editar cantidad.
Se pueden ordenar ingredientes.
Se pueden ordenar pasos.
El resumen se actualiza.
Se muestran errores comprensibles.
Registro en comida
Se puede registrar una porción.
Se puede registrar 0.5 porciones.
Se guarda recipe_id.
Se guarda recipe_version_id.
Se guardan nutrientes como snapshot.
No se duplican nutrientes mediante ingredientes.
El item aparece en el historial.
El total diario se actualiza correctamente.
Regresión
La búsqueda de alimentos del Sprint 2 sigue funcionando.
El registro de alimentos sigue funcionando.
El historial legacy sigue visible.
No se rompe autenticación.
No se rompen ejercicios.
No hay errores de TypeScript.
No hay errores críticos de RLS.
No aparece mojibake.

────────────────────────────────────────

Migraciones y validaciones

────────────────────────────────────────

Crea migraciones seguras únicamente para las entidades de recetas necesarias.

Las migraciones deben:

ser revisables;
conservar datos existentes;
no usar TRUNCATE;
no eliminar tablas legacy;
configurar FK;
configurar constraints;
configurar índices;
configurar RLS;
configurar policies;
documentar rollback.

Crea validaciones posteriores que revisen:

recetas sin versión;
versiones sin receta;
ingredientes sin alimento;
porciones no pertenecientes al alimento;
pasos duplicados;
versiones con cero porciones;
nutrientes huérfanos;
recetas privadas accesibles por otros usuarios;
logs sin versión;
snapshots incompletos;
FK huérfanas;
duplicación de nutrientes.

La validación debe clasificar:

critical;
warning;
info.

El sprint solo se aprueba con:

0 critical

────────────────────────────────────────

Entregables

────────────────────────────────────────

Crea o actualiza los archivos necesarios según la estructura real.

Como mínimo entrega:

docs/beta-nutrition-sprint-3-audit.md
docs/beta-nutrition-sprint-3-data-model.md
docs/beta-nutrition-sprint-3-implementation.md
docs/beta-nutrition-sprint-3-validation.md

Además:

migración de recetas;
validación SQL;
rollback;
tipos Supabase actualizados;
servicios de recetas;
hooks;
componentes;
cálculo nutricional;
integración con meal logs;
pruebas.

La documentación debe incluir:

Arquitectura final.
Tablas creadas o reutilizadas.
Relaciones.
Estrategia de versionado.
Estrategia de snapshots.
Fórmula de cálculo.
Manejo de valores ausentes.
Políticas RLS.
Flujo del usuario.
Integración con Sprint 2.
Preparación para Sprint 4.
Preparación para Sprint 5.
Archivos modificados.
Pruebas ejecutadas.
Resultado de validación.
Problemas pendientes.

────────────────────────────────────────

Criterios de aceptación

────────────────────────────────────────

El Sprint 3 se considera completo únicamente si:

Existe una arquitectura normalizada de recetas.
Las recetas tienen versiones.
Los ingredientes apuntan a variantes reales de nutrition_*.
Las cantidades y porciones son válidas.
Existen instrucciones ordenadas.
Se define el número de porciones.
Los nutrientes totales se calculan correctamente.
Los nutrientes por porción se calculan correctamente.
El backend valida los cálculos.
Se conservan snapshots nutricionales.
El historial no cambia al editar una receta.
Las recetas privadas están protegidas por RLS.
Las recetas del sistema no pueden editarse por usuarios normales.
Se puede crear una receta desde la UI.
Se puede editar mediante una nueva versión.
Se puede duplicar.
Se puede archivar.
Se puede buscar.
Se puede ver el detalle.
Se puede añadir a una comida.
Se pueden registrar porciones decimales.
No existe doble contabilización de nutrientes.
El historial anterior permanece.
El Sprint 2 continúa funcionando.
No hay errores de TypeScript.
No hay mojibake.
Las pruebas pasan.
La validación devuelve 0 critical.
No se implementó todavía el coach.
No se implementó todavía la lista de compras.

────────────────────────────────────────

Entrega final

────────────────────────────────────────

Al terminar entrega:

Resumen ejecutivo.
Auditoría inicial.
Arquitectura creada.
Tablas creadas.
Tablas modificadas.
Migraciones aplicadas.
Políticas RLS.
Flujo final de creación.
Flujo final de registro.
Fórmula de cálculo utilizada.
Estrategia de versionado.
Estrategia de snapshots.
Resultado de pruebas.
Resultado de UTF-8.
Resultado de validaciones.
Warnings.
Problemas pendientes.
Confirmación de que Sprint 2 continúa funcionando.
Confirmación de que no se trabajó en coach ni lista de compras.

La decisión final debe ser exactamente una:

SPRINT 3 COMPLETADO Y VALIDADO
SPRINT 3 REVERTIDO POR ERRORES
IMPLEMENTACIÓN LISTA, PENDIENTE DE MIGRACIÓN, PRUEBAS O CREDENCIALES

No avances al Sprint 4.

Tu único objetivo es dejar terminado el sistema de recetas, versionado, cálculo nutricional y registro de recetas en comida