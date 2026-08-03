# Nutrition Master Catalog Export Contract v2

Este contrato acompana `docs/nutrition-master-export-v2.sql`.

El CSV esperado se llama:

`nutrition-master-catalog-v2.csv`

## Que representa cada fila

Cada fila representa un registro nutricional principal de `nutrition_foods` dentro del catalogo maestro global.

Un alimento canonico visible en UI puede estar representado por un grupo canonico y varias filas de `nutrition_foods`, una por variante nutricional.

Ejemplo conceptual:

- Grupo canonico: Huevo entero.
- Registro nutricional 1: huevo entero crudo.
- Registro nutricional 2: huevo entero hervido.
- Registro nutricional 3: huevo entero escalfado.

Cada registro conserva sus propios nutrientes, fuente y porciones.

## Columnas principales

- `food_id`: UUID real de `nutrition_foods`.
- `client_key`: clave editorial estable para importacion futura. Existentes usan `existing:<food_id>`.
- `legacy_food_id`: ID heredado desde `foods`, si existe.
- `canonical_group_id`: UUID del grupo canonico, si existe.
- `canonical_group_client_key`: clave editorial del grupo.
- `canonical_group_name`: nombre del concepto canonico.
- `group_member_id`: ID de la membresia alimento-grupo.
- `variant_type`: rol editorial de la fila dentro del grupo.
- `food_kind`: tipo del alimento en `nutrition_foods`.
- `canonical_name`: nombre canonico interno del registro.
- `display_name`: nombre mostrado al usuario.
- `normalized_name`: nombre normalizado para busqueda.
- `description`: descripcion editorial.
- `physical_state`: estado fisico, por ejemplo `raw`, `cooked`, `dried`, `frozen`.
- `preparation_method`: metodo, por ejemplo `boiled`, `grilled`, `fried`, `scrambled`.
- `legacy_preparation_state`: valor textual legacy de `nutrition_foods.preparation_state`.
- `verification_status`: estado editorial nuevo.
- `confidence_score`: confianza editorial entre 0 y 1, o null si no esta evaluada.
- `is_verified`: booleano legacy.
- `is_visible`: visibilidad actual.
- `is_common`: alimento frecuente.
- `visibility_priority`: prioridad de UI.

## Tipos de alimento

Valores aceptados de `food_kind`:

- `ingredient`: ingrediente canonico.
- `prepared_variant`: variante preparada con nutrientes propios.
- `component`: parte o componente.
- `composite_food`: alimento compuesto.
- `recipe`: receta.
- `branded_product`: producto comercial.
- `restaurant_item`: alimento de restaurante.
- `supplement`: suplemento.
- `beverage`: bebida.
- `unclassified`: pendiente de clasificacion.
- `generic`: valor legacy temporal.
- `branded`, `restaurant`, `user_custom`, `ai_estimated`: valores legacy/compatibilidad.

## Variant type

`variant_type` describe el rol dentro de `nutrition_food_group_members`:

- `ingredient`
- `prepared_variant`
- `component`
- `composite_food`
- `recipe`
- `branded_product`
- `restaurant_item`
- `supplement`
- `beverage`
- `unclassified`
- `legacy_generic`

## Estado fisico y metodo

No mezclar estado y metodo.

Estado fisico (`physical_state`):

- `raw`
- `cooked`
- `dried`
- `frozen`
- `canned`
- `drained`
- `ready_to_eat`
- `unknown`

Metodo (`preparation_method`):

- `none`
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
- `unknown`

No asumir aceite o grasa anadida por el metodo. Si hay ingredientes anadidos, debe representarse despues como receta, alimento compuesto o metadata explicita.

## Estados de verificacion

Valores aceptados:

- `unverified`
- `needs_review`
- `partially_verified`
- `verified`
- `rejected`
- `deprecated`

Compatibilidad:

- `verification_status = verified` debe mapear a `is_verified = true`.
- cualquier otro estado debe mapear a `is_verified = false`.

## Columnas JSON

### `aliases_json`

Aliases existentes. Para aliases nuevos:

- dejar `alias_id` vacio en el parche futuro;
- usar `food_client_key`;
- completar `alias`, `normalized_alias`, `locale` y `source`.

### `categories_json`

Relaciones con `nutrition_categories`. Cada objeto incluye el registro de relacion y el registro de categoria.

Para categorias nuevas, usar:

- `category_client_key = new:category:<slug>`;
- `parent_category_client_key` si requiere jerarquia.

### `servings_json`

Porciones y equivalencias.

Para porciones nuevas:

- usar `serving_client_key = new:serving:<food_slug>:<serving_slug>`;
- usar `food_client_key`;
- usar `unit_client_key` o `unit_code`;
- completar `serving_label`, `quantity`, `grams` o `milliliters`;
- completar `verification_status`.

No usar `serving` como unidad generica si no hay etiqueta y equivalencia cuantitativa.

### `nutrients_json`

Valores nutricionales por 100 g.

Cada objeto incluye:

- nutriente;
- unidad;
- amount;
- basis 100 g;
- fuente;
- estado de verificacion;
- confianza;
- fila original.

No convertir ni corregir valores dentro del CSV maestro. La correccion debe ir en un parche futuro.

### `food_relationships_json`

Relaciones explicitas entre alimentos.

Tipos:

- `variant_of`
- `preparation_of`
- `component_of`
- `part_of`
- `derived_from`
- `cut_of`
- `equivalent_to`
- `related_to`

Usar para componentes como clara/yema o relaciones base-variante cuando el grupo canonico no sea suficiente.

### `canonical_group_json`

Objeto con el grupo canonico y la membresia de la fila.

El grupo canonico representa el concepto que la UI puede mostrar primero.

### `reference_catalog_json`

Aparece solo en la primera fila.

Incluye:

- fuentes;
- marcas;
- categorias;
- unidades;
- nutrientes;
- estados fisicos;
- metodos de preparacion;
- estados de verificacion permitidos;
- tipos de alimento permitidos;
- tipos de relacion permitidos;
- tipos de variante permitidos.

## Como crear un alimento canonico

En el parche futuro:

1. Crear un grupo canonico con `canonical_group_client_key = new:group:<slug>`.
2. Crear o vincular un alimento base.
3. Marcar una membresia como `is_default = true`.
4. Usar `variant_type = ingredient` o el tipo correcto.

No usar aliases para representar el grupo canonico.

## Como crear una variante

1. Crear una nueva fila alimento con `client_key = new:food:<slug_variante>`.
2. Asignar `canonical_group_client_key` del grupo existente o nuevo.
3. Definir `variant_type = prepared_variant`.
4. Asignar `physical_state` y/o `preparation_method`.
5. Agregar nutrientes independientes en `nutrients_json` o parche normalizado futuro.

## Como vincular una preparacion

Usar una de estas dos formas:

- `canonical_group_members` para variantes dentro del mismo concepto.
- `food_relationships_json` con `relationship_type = preparation_of` cuando se necesite una relacion alimento-a-alimento explicita.

## Como vincular un componente

Usar `food_relationships_json` con:

- `relationship_type = component_of` o `part_of`;
- padre: alimento entero;
- hijo: componente.

Ejemplo conceptual:

- padre: huevo entero;
- hijo: clara de huevo;
- relacion: `component_of`.

## Como agregar porciones

Usar `servings_json` con:

- `serving_label`;
- `quantity`;
- `unit_code`;
- `grams` o `milliliters`;
- `is_default`;
- `verification_status`;
- `source`.

Ejemplos de etiqueta:

- `1 huevo grande`
- `1 rebanada`
- `1 scoop`
- `1 lata`

## Como usar unidades

Unidades globales aceptadas incluyen:

- masa: `mg`, `g`, `kg`, `oz`, `lb`;
- volumen: `ml`, `l`, `tsp`, `tbsp`, `cup`, `fl_oz`;
- conteo/presentacion: `piece`, `unit`, `slice`, `scoop`, `package`, `can`, `bottle`.

Las unidades especificas por alimento deben ser porciones, no nuevas unidades globales.

## Como usar client_key

Reglas:

- Existente: `existing:<food_id>`.
- Nuevo alimento: `new:food:<slug_unico>`.
- Nuevo grupo: `new:group:<slug_unico>`.
- Nueva categoria: `new:category:<slug_unico>`.
- Nueva porcion: `new:serving:<food_slug>:<slug_unico>`.

`client_key` no sustituye el UUID definitivo. El importador futuro mapeara `client_key -> UUID` dentro de una transaccion.

## Columnas que puede editar el especialista

Puede proponer cambios en:

- nombres;
- descripcion;
- `food_kind`;
- `variant_type`;
- `physical_state`;
- `preparation_method`;
- `verification_status`;
- categorias;
- aliases;
- porciones;
- valores nutricionales;
- relaciones;
- grupos canonicos.

## Columnas que no debe modificar

No modificar:

- `food_id`;
- IDs existentes dentro de JSON;
- `legacy_food_id`;
- `created_at`;
- `updated_at`;
- `food_record_json`;
- `reference_catalog_json`;
- columnas `audit_*`.

## Como marcar registros para revision

Usar `verification_status = needs_review` y razones editoriales claras en el parche futuro.

Ejemplos:

- `missing_aliases`
- `missing_category`
- `missing_canonical_group`
- `macro_energy_mismatch`
- `duplicate_candidate`
- `serving_needs_equivalence`

## CSV y JSON valido

El CSV devuelto debe:

- conservar exactamente encabezados;
- mantenerse en UTF-8;
- conservar JSON valido;
- no usar comillas tipograficas;
- no romper arrays JSON;
- no cambiar IDs existentes.
