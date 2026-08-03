# Beta Nutrition - Correccion arquitectonica definitiva

Este documento describe una correccion dirigida sobre la arquitectura `nutrition_*`. No reemplaza el modelo creado en Beta Nutrition Sprint 1B y no importa el CSV curado rechazado.

## Limitaciones confirmadas

- `food_kind` quedo demasiado pobre para curacion profesional: todos los alimentos migrados quedaron como `generic`.
- `preparation_state` en `nutrition_foods` mezcla estado fisico, metodo de preparacion y texto libre.
- `nutrition_food_preparations` existe, pero no basta para agrupar concepto canonico, variantes y componentes.
- No hay entidad clara para mostrar un concepto principal como "Huevo entero" y variantes nutricionales distintas como crudo, hervido o frito.
- No hay relacion explicita para componentes como clara/yema de huevo.
- `is_verified` booleano no distingue `needs_review`, `partially_verified`, `rejected` o `deprecated`.
- `confidence_score` existe, pero no tiene reglas editoriales suficientes.
- Faltan unidades comunes: `oz`, `lb`, `fl_oz`, `slice`, `package`, `can`, `bottle`.
- Algunas categorias son demasiado generales o estan orientadas a macronutrientes.
- El export v1 no contenia `client_key` como columna editorial explicita para registros nuevos.

## Problemas que son de curacion, no arquitectura

- Nombres con preparacion incrustada.
- Alimentos mal categorizados.
- Alimentos sin aliases.
- Alimentos sin descripcion.
- Valores nutricionales inconsistentes.
- Falta de variantes reales por alimento.
- Falta de porciones intuitivas por alimento.

Estos problemas deben resolverlos el especialista y el futuro importador, no esta correccion.

## Cambios aplicados

La correccion agrega:

- `nutrition_physical_states`: catalogo de estados fisicos.
- `nutrition_preparation_methods`: catalogo de metodos de preparacion.
- `nutrition_canonical_food_groups`: conceptos canonicos agrupadores.
- `nutrition_food_group_members`: membresias de alimentos en grupos canonicos, con rol/variante.
- `nutrition_food_relationships`: relaciones explicitas entre alimentos, como componente, variante, preparacion o derivado.

Tambien agrega columnas editoriales:

- `nutrition_foods.verification_status`
- `nutrition_foods.physical_state_id`
- `nutrition_foods.preparation_method_id`
- `nutrition_food_servings.verification_status`
- `nutrition_food_nutrients.verification_status`

`is_verified` se conserva por compatibilidad con la app actual.

## Tipos de alimento

Se amplia `nutrition_foods.food_kind` para soportar:

- `ingredient`: ingrediente canonico simple.
- `prepared_variant`: variante preparada con valores nutricionales propios.
- `component`: parte o componente de un alimento.
- `composite_food`: alimento compuesto no necesariamente receta de usuario.
- `recipe`: receta.
- `branded_product`: producto comercial.
- `restaurant_item`: alimento de restaurante.
- `supplement`: suplemento.
- `beverage`: bebida.
- `unclassified`: pendiente de clasificacion.
- `generic`: valor legacy temporal.
- valores legacy previos: `branded`, `restaurant`, `user_custom`, `ai_estimated`.

No se reclasifican automaticamente los alimentos existentes.

## Estado fisico y metodo de preparacion

`nutrition_physical_states` representa estado:

- `raw`
- `cooked`
- `dried`
- `frozen`
- `canned`
- `drained`
- `ready_to_eat`
- `unknown`

`nutrition_preparation_methods` representa metodo:

- `boiled`
- `steamed`
- `grilled`
- `roasted`
- `baked`
- `pan_seared`
- `fried`
- `air_fried`
- `poached`
- `scrambled`
- `microwaved`
- `none`
- `unknown`

Un alimento puede tener estado, metodo, ambos o ninguno. No se infiere grasa anadida por metodo.

## Grupos canonicos y variantes

`nutrition_canonical_food_groups` agrupa un concepto editorial, por ejemplo "Huevo entero".

`nutrition_food_group_members` vincula cada `nutrition_foods.id` con el grupo y permite:

- rol de variante;
- orden;
- variante predeterminada;
- visibilidad en UI;
- estado fisico;
- metodo de preparacion.

Esto permite que un solo concepto tenga varios registros nutricionales independientes.

## Componentes y relaciones

`nutrition_food_relationships` permite relaciones explicitas:

- `variant_of`
- `preparation_of`
- `component_of`
- `part_of`
- `derived_from`
- `cut_of`
- `equivalent_to`
- `related_to`

Esta tabla evita representar componentes mediante aliases.

## Unidades y porciones

Se agregan unidades faltantes a `nutrition_units`:

- `oz`
- `lb`
- `fl_oz`
- `slice`
- `package`
- `can`
- `bottle`

Las unidades especificas por alimento deben modelarse como porciones con `serving_label`, `unit_id`, `grams` y/o `milliliters`, no como una unidad global distinta por alimento.

`serving` se conserva por compatibilidad, pero el contrato v2 indica que no debe usarse para esconder incertidumbre; debe tener etiqueta descriptiva y equivalencia cuantitativa.

## Estados de verificacion

Valores permitidos:

- `unverified`
- `needs_review`
- `partially_verified`
- `verified`
- `rejected`
- `deprecated`

Relacion con `is_verified`:

- `verification_status = 'verified'` debe mapear a `is_verified = true`.
- cualquier otro estado debe mapear a `is_verified = false`.
- durante la transicion, `is_verified` sigue existiendo para compatibilidad.

`confidence_score` sigue en rango 0 a 1:

- no se asigna automaticamente a 1;
- `NULL` significa que no hay evaluacion de confianza;
- 0 indica confianza nula;
- 1 indica confianza editorial maxima respaldada por fuente.

## Categorias

No se reemplaza `nutrition_categories`. Se agregan categorias base utiles para nutricion:

- huevos
- carnes y aves
- pescados y mariscos
- lacteos
- cereales y granos
- panes y tortillas
- legumbres
- frutas
- verduras
- tuberculos
- frutos secos y semillas
- aceites y grasas
- bebidas
- condimentos
- suplementos
- comidas preparadas
- productos comerciales
- restaurantes

No se reasignan alimentos automaticamente.

## Estrategia de client_key

`client_key` no se agrega como identidad definitiva de `nutrition_foods`.

El export v2 genera:

- existentes: `existing:<food_id>`
- nuevos futuros: `new:food:<slug_unico>`

Para importacion futura se recomienda una tabla staging y un mapa transaccional:

- `client_key`
- tabla destino
- UUID generado
- batch/import id

El importador no debe depender de extraer relaciones desde JSON anidado. El CSV de parche futuro debe exponer columnas planas de `client_key` y `*_client_key` para relaciones nuevas.

## Compatibilidad

- No se borran alimentos.
- No se borran nutrientes.
- No se cambian IDs.
- No se tocan logs de comidas.
- No se tocan usuarios ni perfiles.
- No se tocan modulos fuera de `nutrition_*`.
- Las tablas legacy siguen intactas.
- La app actual puede seguir usando `foods`, `meals` y `meal_ingredients`.

## Impacto futuro en UI/UX

La UI podra mostrar primero un grupo canonico y luego variantes:

1. Usuario busca "huevo".
2. App muestra "Huevo entero".
3. Usuario selecciona variante: crudo, hervido, escalfado, revuelto, frito.
4. Cada variante apunta a su propio `nutrition_foods.id` y valores nutricionales.

La UI tambien podra ocultar estados poco utiles usando `is_ui_visible` sin eliminar registros.
