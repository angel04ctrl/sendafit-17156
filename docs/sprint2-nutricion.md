Inicia Beta Nutrition Sprint 2: Integración de la arquitectura nutrition_* y mejora completa de búsqueda y registro de alimentos.

────────────────────────────────────────
## Contexto confirmado
────────────────────────────────────────

El Sprint 1 de nutrición terminó correctamente.

La arquitectura nutrition_* ya está creada, poblada y validada.

Resultado final de la importación:

- estado: apply_committed;
- import batch: 51e29c0d-2e9c-4ccd-b2fd-31d15318ddf5;
- 304 alimentos importados;
- 169 alimentos actualizados;
- 135 alimentos nuevos;
- 875 porciones;
- 1,974 valores nutricionales aplicados;
- 235 grupos canónicos;
- 71 relaciones alimentarias;
- validación post-import:
  - 0 critical;
  - 0 warning.

El catálogo nutrition_* es ahora la fuente de verdad del sistema nutricional.

La aplicación todavía puede contener consultas, tipos, componentes o funciones que utilizan las tablas legacy.

Este sprint debe realizar la transición funcional hacia nutrition_* sin romper la aplicación.

────────────────────────────────────────
## Objetivo general
────────────────────────────────────────

Actualizar el sistema actual de búsqueda y registro de alimentos para que utilice la nueva arquitectura nutrition_*.

El usuario debe poder:

1. Ver el catálogo completo mediante scroll o paginación.
2. Buscar alimentos por nombre o alias.
3. Seleccionar un alimento canónico.
4. Elegir una variante, estado o preparación.
5. Elegir una porción o unidad.
6. Indicar la cantidad consumida.
7. Ver las calorías y nutrientes calculados.
8. Registrar correctamente el alimento en una comida.
9. Consultar posteriormente el alimento registrado.

Este sprint incluye integración de datos, backend, frontend, UI/UX y pruebas relacionadas exclusivamente con búsqueda y registro de alimentos.

No incluye recetas, planes alimenticios, coach IA ni listas de compras.

────────────────────────────────────────
## Contexto disponible en el repositorio
────────────────────────────────────────

Antes de modificar código, busca y lee recursivamente dentro del proyecto toda la documentación, migraciones y archivos relacionados con nutrition_*.

Localiza como mínimo:

- nutrition-master-export-contract-v2.md;
- beta-food-new-data-model.md;
- beta-food-new-relations.md;
- beta-food-architecture-correction.md;
- archivos de importación del catálogo v2.1;
- informes de importación;
- migraciones nutrition_*;
- validaciones post-import;
- tipos actuales de Supabase;
- servicios actuales de alimentos;
- componentes actuales para buscar y agregar alimentos;
- funciones relacionadas con meals y meal_ingredients;
- Edge Functions relacionadas con nutrición;
- hooks, stores y queries relacionadas con alimentos.

Busca especialmente dentro de:

- docs/;
- src/;
- supabase/;
- supabase/functions/;
- supabase/migrations/;
- scripts/;
- services/;
- hooks/;
- components/;
- cualquier carpeta equivalente utilizada realmente por el proyecto.

No asumas rutas.

Documenta las rutas reales encontradas.

────────────────────────────────────────
## Restricciones
────────────────────────────────────────

No modificar:

- ejercicios;
- entrenamientos;
- planes de entrenamiento;
- autenticación;
- usuarios;
- perfiles, salvo las lecturas nutricionales existentes estrictamente necesarias;
- progreso físico;
- suscripciones;
- módulos no nutricionales.

No eliminar todavía:

- foods;
- meals;
- meal_ingredients;
- food_analysis_logs;
- otras tablas legacy.

No realizar hard delete de datos.

No volver a importar el CSV.

No volver a curar alimentos.

No modificar valores nutricionales.

No agregar alimentos nuevos.

No comenzar el sistema de recetas.

No comenzar el coach nutricional.

No comenzar listas de compras.

────────────────────────────────────────
## Fase 1 — Auditoría de integración actual
────────────────────────────────────────

Antes de modificar código, identifica:

1. Qué componentes muestran alimentos.
2. Qué consultas cargan el catálogo.
3. Qué consultas utilizan foods legacy.
4. Qué funciones registran una comida.
5. Qué tablas reciben los registros.
6. Cómo se calculan actualmente calorías y macros.
7. Cómo se manejan porciones.
8. Cómo funciona el buscador actual.
9. Por qué solamente aparecen ocho o nueve alimentos al hacer scroll.
10. Si existe:
   - límite fijo;
   - paginación incompleta;
   - consulta sin cargar páginas posteriores;
   - virtualización incorrecta;
   - altura bloqueada;
   - filtro local aplicado sobre una página parcial;
   - query con limit;
   - caché incompleta;
   - error de estado;
   - problema de infinite scroll.

No corrijas el problema suponiendo su causa.

Encuentra y documenta la causa real.

Crea:

docs/beta-nutrition-sprint-2-audit.md

Debe incluir:

- flujo actual;
- archivos involucrados;
- tablas utilizadas;
- causa del bug;
- riesgos;
- plan de modificación.

────────────────────────────────────────
## Fase 2 — Fuente de datos nutrition_*
────────────────────────────────────────

El catálogo visible debe obtenerse exclusivamente desde la nueva arquitectura nutrition_*.

La consulta debe respetar:

- is_visible = true;
- estados activos;
- alimentos no deprecated;
- alimentos no rejected;
- grupos canónicos;
- miembro predeterminado;
- prioridad de búsqueda;
- popularidad o is_common;
- categorías principales;
- aliases;
- porciones;
- preparaciones;
- nutrientes activos.

No utilices registros nutricionales con:

- verification_status = deprecated;
- verification_status = rejected.

Para cada combinación alimento–nutriente debe utilizarse únicamente el registro activo.

No selecciones arbitrariamente el primer nutriente encontrado.

────────────────────────────────────────
## Fase 3 — Tipos de Supabase
────────────────────────────────────────

Regenera o actualiza los tipos de Supabase para que incluyan correctamente todas las tablas nutrition_* utilizadas.

No mantengas casts innecesarios como:

as any

cuando exista una solución tipada.

Actualiza:

- tipos de tablas;
- tipos de inserts;
- tipos de updates;
- relaciones;
- enums;
- funciones RPC, si existen.

No modifiques manualmente tipos generados si el proyecto dispone de un comando oficial para regenerarlos.

Documenta el comando utilizado.

────────────────────────────────────────
## Fase 4 — Servicio centralizado de alimentos
────────────────────────────────────────

Crea o adapta una capa centralizada de acceso a datos nutricionales.

No distribuyas consultas complejas de Supabase entre muchos componentes.

El servicio debe proporcionar operaciones como:

- listar grupos canónicos;
- buscar alimentos;
- obtener variantes de un grupo;
- obtener un alimento por ID;
- obtener porciones;
- obtener nutrientes activos;
- obtener categorías;
- registrar selección del usuario;
- recuperar un registro nutricional.

Los nombres concretos deben adaptarse a las convenciones existentes del proyecto.

La capa debe devolver modelos preparados para UI y no filas crudas difíciles de interpretar.

────────────────────────────────────────
## Fase 5 — Listado completo y corrección del bug
────────────────────────────────────────

Corrige el problema por el cual solamente aparecen ocho o nueve alimentos cuando el usuario intenta desplazarse por la lista.

El comportamiento requerido es:

- al abrir el selector deben aparecer alimentos inmediatamente;
- el usuario debe poder seguir desplazándose;
- deben cargarse más resultados hasta recorrer el catálogo completo;
- no debe ser necesario escribir una letra para acceder a alimentos que no estaban en la primera carga;
- la búsqueda y el scroll deben funcionar independientemente;
- no deben aparecer alimentos duplicados al cargar más páginas;
- no debe perderse la posición de scroll innecesariamente;
- debe existir estado de carga;
- debe existir estado de fin de resultados;
- debe existir estado vacío;
- debe existir manejo de error.

Utiliza una estrategia apropiada:

- paginación por cursor;
- paginación por rango;
- infinite scroll;
- carga incremental;

según la arquitectura real del proyecto.

No cargues necesariamente todas las relaciones y nutrientes de los 304 alimentos en la consulta inicial.

La lista inicial debe cargar solamente los datos necesarios para mostrar resultados.

Los detalles completos deben cargarse cuando el usuario seleccione un alimento.

────────────────────────────────────────
## Fase 6 — Búsqueda
────────────────────────────────────────

La búsqueda debe funcionar con:

- nombre visible;
- nombre canónico;
- normalized_name;
- aliases;
- nombres regionales;
- nombres en inglés cuando existan;
- marca cuando aplique.

Debe tolerar:

- mayúsculas y minúsculas;
- acentos;
- espacios adicionales;
- singular y plural cuando existan aliases;
- términos como jitomate/tomate;
- términos regionales incluidos en aliases.

No hagas búsqueda únicamente sobre los resultados que ya fueron cargados en la primera página.

La búsqueda debe consultar el catálogo completo.

Aplica debounce razonable para evitar una consulta por cada pulsación inmediata.

Evita condiciones de carrera:

- una búsqueda anterior no debe sobrescribir una búsqueda más reciente;
- cancela o ignora respuestas obsoletas;
- limpia correctamente resultados al cerrar el modal.

────────────────────────────────────────
## Fase 7 — Orden de resultados
────────────────────────────────────────

Los resultados deben priorizar:

1. Coincidencia exacta del nombre visible.
2. Coincidencia exacta de alias.
3. Coincidencia inicial del nombre.
4. Coincidencia parcial.
5. Alimentos comunes.
6. Prioridad de búsqueda.
7. Miembro predeterminado del grupo canónico.

Los registros:

- deprecated;
- rejected;
- invisibles;

no deben mostrarse en la búsqueda normal.

No deben aparecer primero registros técnicos, duplicados legacy ni variantes ocultas.

────────────────────────────────────────
## Fase 8 — Presentación por grupo canónico
────────────────────────────────────────

La lista principal no debe mostrar todas las variantes como si fueran alimentos completamente independientes cuando pertenecen al mismo grupo canónico.

Ejemplo deseado:

Huevo entero

Al seleccionarlo, mostrar:

- crudo;
- hervido;
- escalfado;
- revuelto sin grasa añadida;
- frito, si existe.

Otro ejemplo:

Arroz blanco

Variantes:

- crudo;
- cocido;
- otra variante válida registrada.

La tarjeta principal puede mostrar:

- nombre;
- categoría;
- variante predeterminada;
- calorías de referencia;
- porción predeterminada;
- indicador de que existen más preparaciones.

No reconstruyas grupos por similitud de nombres.

Utiliza las relaciones y grupos canónicos de nutrition_*.

────────────────────────────────────────
## Fase 9 — Selector de variante y preparación
────────────────────────────────────────

Después de seleccionar un grupo, el usuario debe poder elegir una variante disponible.

La UI debe distinguir claramente:

- estado físico;
- método de preparación;
- componente;
- producto comercial;
- alimento compuesto;
- suplemento;
- bebida.

No muestres códigos técnicos como:

- prepared_variant;
- ready_to_eat;
- pan_seared;
- none.

Utiliza etiquetas traducidas y naturales, por ejemplo:

- Cocido;
- Hervido;
- A la plancha;
- Asado;
- Al horno;
- Frito;
- Escalfado;
- Revuelto;
- Crudo;
- Enlatado;
- Escurrido.

No inventes variantes no existentes en la base.

No permitas elegir una preparación que no esté vinculada al alimento.

La variante predeterminada del grupo debe seleccionarse inicialmente cuando sea apropiado.

────────────────────────────────────────
## Fase 10 — Porciones y unidades
────────────────────────────────────────

Después de elegir la variante, muestra solamente sus porciones válidas.

Ejemplos:

Huevo:

- 1 huevo mediano;
- 1 huevo grande;
- 100 g.

Arroz cocido:

- 100 g;
- 1/2 taza;
- 1 taza.

Leche:

- 100 ml;
- 200 ml;
- 250 ml;
- 1 taza.

El usuario debe poder seleccionar:

- unidad o porción;
- cantidad.

Ejemplos de cantidad:

- 1 huevo;
- 2 huevos;
- 0.5 taza;
- 2.5 porciones;
- 150 g;
- 250 ml.

La cantidad debe aceptar decimales cuando tenga sentido.

Debe impedir:

- valores negativos;
- cero;
- NaN;
- texto inválido;
- cantidades excesivamente grandes sin advertencia.

No conviertas automáticamente una porción a otra utilizando supuestos no registrados.

Utiliza exclusivamente las equivalencias almacenadas.

────────────────────────────────────────
## Fase 11 — Cálculo nutricional
────────────────────────────────────────

El cálculo debe basarse en:

- alimento o variante seleccionada;
- porción seleccionada;
- equivalencia en gramos o mililitros;
- cantidad indicada;
- nutrientes activos por base registrada.

Fórmula conceptual:

cantidad base consumida
=
cantidad seleccionada × equivalencia de la porción

nutriente consumido
=
nutriente de referencia × cantidad base consumida / base de referencia

No hardcodees siempre 100 g si el registro utiliza otra base válida.

Respeta:

- basis_amount;
- basis_unit;
- gramos;
- mililitros;
- valores null;
- nutrientes no reportados.

No conviertas null en cero.

El resumen debe mostrar, como mínimo:

- calorías;
- proteína;
- carbohidratos;
- grasas.

Cuando existan:

- fibra;
- azúcares;
- sodio.

No recalcules ni sustituyas los datos curados.

────────────────────────────────────────
## Fase 12 — Registro del alimento
────────────────────────────────────────

Al confirmar, guarda suficiente información para reconstruir el registro posteriormente.

Debe preservarse como mínimo:

- food_id de la variante seleccionada;
- canonical_group_id, cuando corresponda;
- serving_id;
- cantidad;
- gramos o mililitros consumidos;
- calorías calculadas;
- macros calculados;
- fecha;
- tipo de comida;
- usuario mediante la relación ya existente;
- snapshot del nombre y porción cuando sea necesario para preservar historial.

No dependas únicamente del nombre.

No uses el grupo canónico como sustituto del food_id concreto consumido.

Si el usuario selecciona “huevo hervido”, el registro debe apuntar a la variante nutricional “huevo hervido”, no solamente al grupo “huevo”.

────────────────────────────────────────
## Fase 13 — Compatibilidad con historial
────────────────────────────────────────

Los registros históricos existentes no deben desaparecer ni romperse.

Debes analizar cómo se muestran actualmente los meal logs legacy.

Implementa una estrategia compatible para que:

- los registros nuevos utilicen nutrition_*;
- los registros anteriores continúen visibles;
- no se dupliquen entradas;
- no se cambien valores históricos;
- no se reasignen alimentos legacy incorrectamente;
- el frontend pueda distinguir registros antiguos y nuevos cuando sea necesario.

No migres destructivamente el historial en este sprint.

No elimines tablas legacy.

────────────────────────────────────────
## Fase 14 — Estados de UI
────────────────────────────────────────

El selector debe tener estados claros:

- cargando;
- resultados disponibles;
- cargando más;
- sin resultados;
- error;
- sin variantes;
- sin porciones;
- dato parcialmente verificado;
- alimento no disponible.

No dejes el modal vacío sin explicación.

Los errores deben ser comprensibles para el usuario.

No muestres mensajes técnicos de Supabase directamente.

────────────────────────────────────────
## Fase 15 — Rendimiento
────────────────────────────────────────

Evita:

- descargar todos los nutrients_json en cada búsqueda;
- descargar todas las porciones de todos los alimentos inicialmente;
- consultas N+1;
- repetir la misma consulta al abrir y cerrar;
- renders innecesarios;
- búsquedas sin debounce;
- cargar alimentos deprecated;
- filtros exclusivamente del lado cliente sobre una página incompleta.

Mide y documenta:

- tiempo de primera carga;
- tiempo de búsqueda;
- cantidad de consultas;
- cantidad aproximada de datos transferidos;
- comportamiento al cargar las 304 opciones.

No optimices prematuramente mediante cachés complejas sin evidencia.

────────────────────────────────────────
## Fase 16 — Accesibilidad y experiencia
────────────────────────────────────────

El flujo debe funcionar con:

- teclado;
- mouse;
- pantallas táctiles;
- lectores de pantalla cuando la estructura actual lo soporte.

Incluye:

- foco inicial en buscador;
- navegación mediante teclado;
- etiquetas accesibles;
- botón de cierre;
- estados disabled;
- indicadores de selección;
- contraste apropiado;
- mensajes de validación asociados al campo correcto.

No cambies el diseño visual global de la aplicación.

Mantén la identidad actual de SendaFit.

────────────────────────────────────────
## Fase 17 — Pruebas obligatorias
────────────────────────────────────────

Crea pruebas para los siguientes escenarios.

### Listado

1. Al abrir aparecen alimentos.
2. El scroll carga más de los primeros ocho o nueve.
3. Se puede recorrer el catálogo completo.
4. No aparecen duplicados.
5. Se excluyen deprecated e invisibles.

### Búsqueda

6. Buscar “huevo” encuentra el grupo correcto.
7. Buscar mediante alias encuentra el alimento.
8. Buscar con y sin acento funciona.
9. Una búsqueda sin resultados muestra estado vacío.
10. Una respuesta anterior no sobrescribe la búsqueda actual.

### Variantes

11. Huevo muestra sus variantes reales.
12. Una variante no vinculada no aparece.
13. El miembro predeterminado se selecciona correctamente.
14. Los códigos internos se traducen.

### Porciones

15. Cambiar porción actualiza nutrientes.
16. Cambiar cantidad actualiza nutrientes.
17. No se permite cantidad cero o negativa.
18. Los líquidos usan unidades adecuadas.
19. Solo aparece una porción predeterminada.

### Registro

20. El alimento se registra con su food_id real.
21. Se conserva serving_id.
22. Se conservan cantidad y equivalencia.
23. Los nutrientes registrados coinciden con el cálculo mostrado.
24. El registro aparece posteriormente en la comida.
25. El historial legacy sigue visible.

### Regresión

26. No se rompieron ejercicios.
27. No se rompió autenticación.
28. No se modificaron perfiles.
29. No se eliminaron tablas legacy.
30. No aparecen errores de TypeScript.

────────────────────────────────────────
## Validación UTF-8
────────────────────────────────────────

Verifica en frontend y backend que se muestren correctamente textos como:

- salmón;
- proteína;
- México;
- kéfir;
- maíz;
- porción;
- cocción;
- µg, cuando se muestre.

No utilices conversiones Latin-1 o Windows-1252.

No elimines acentos.

No implementes correcciones ortográficas automáticas.

Los textos recuperados de Supabase deben mostrarse como UTF-8.

Busca patrones de corrupción como:

- Ã;
- Â;
- â€;
- �.

Si aparecen, identifica su origen.

No los reemplaces silenciosamente.

────────────────────────────────────────
## Entregables
────────────────────────────────────────

Crea o actualiza, según la estructura real del proyecto:

- servicio de catálogo nutricional;
- hooks o queries de búsqueda;
- tipos Supabase;
- componentes de selector;
- componentes de variantes;
- componente de porciones;
- cálculo nutricional;
- registro de comida;
- pruebas;
- documentación.

Crear:

docs/beta-nutrition-sprint-2-audit.md
docs/beta-nutrition-sprint-2-implementation.md
docs/beta-nutrition-sprint-2-validation.md

La documentación debe incluir:

- archivos modificados;
- consultas antiguas reemplazadas;
- consultas nuevas;
- causa del bug de ocho o nueve alimentos;
- solución implementada;
- estrategia de paginación;
- estrategia de búsqueda;
- flujo de selección;
- fórmula de cálculo;
- estrategia de compatibilidad;
- pruebas realizadas;
- problemas pendientes.

────────────────────────────────────────
## Criterios de aceptación
────────────────────────────────────────

El sprint se aprueba únicamente si:

1. La aplicación utiliza nutrition_* para búsquedas nuevas.
2. El usuario puede recorrer más de los primeros ocho o nueve alimentos.
3. El listado puede llegar a todo el catálogo visible.
4. La búsqueda consulta el catálogo completo.
5. Los aliases funcionan.
6. Los grupos canónicos funcionan.
7. Las variantes funcionan.
8. Las preparaciones funcionan.
9. Las porciones funcionan.
10. Las cantidades decimales funcionan.
11. Los nutrientes se calculan correctamente.
12. Los alimentos se registran con el food_id de la variante.
13. Los nuevos registros pueden recuperarse.
14. El historial anterior continúa visible.
15. Los registros deprecated no aparecen.
16. No existen consultas N+1 críticas.
17. No hay errores de TypeScript.
18. No existe mojibake.
19. Las pruebas pasan.
20. No se modificaron módulos ajenos.
21. No se eliminaron tablas legacy.
22. La validación final no contiene errores críticos.

────────────────────────────────────────
## Entrega final
────────────────────────────────────────

Al finalizar entrega:

1. Resumen ejecutivo.
2. Causa confirmada del bug de listado.
3. Archivos creados.
4. Archivos modificados.
5. Tablas nutrition_* utilizadas.
6. Consultas legacy reemplazadas.
7. Flujo final de usuario.
8. Resultado de pruebas.
9. Resultado de UTF-8.
10. Métricas básicas de rendimiento.
11. Problemas pendientes.
12. Confirmación de que no se trabajó en recetas, coach IA ni lista de compras.

La decisión final debe ser exactamente una:

- SPRINT 2 COMPLETADO Y VALIDADO
- SPRINT 2 REVERTIDO POR ERRORES
- IMPLEMENTACIÓN LISTA, PENDIENTE DE PRUEBAS O CREDENCIALES

No avances al Sprint 3.

Tu único objetivo es integrar correctamente nutrition_* y dejar terminada la experiencia de búsqueda, selección, cálculo y registro de alimentos.