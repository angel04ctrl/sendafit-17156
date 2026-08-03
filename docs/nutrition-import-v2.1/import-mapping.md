# Nutrition Import v2.1 - Mapping

CSV source:

`BD-sendaFit/nutrition-master-catalog-v2.1-curated.csv`

The CSV is treated as curated editorial input. The importer does not reinterpret nutrition values.

## Protected Columns

These columns are loaded into staging/reporting only and are not used to overwrite active catalog data:

- `export_row_number`
- `export_total_foods`
- `food_record_json`
- `reference_catalog_json` except for controlled reference catalog upserts
- `audit_*`
- `created_at`
- `updated_at`

Existing `food_id` values are preserved. New foods get a generated UUID from PostgreSQL.

## Food Mapping

`nutrition_foods`

- `food_id` -> existing row selector only
- `client_key` -> stored in `metadata.client_key` and import map
- `legacy_food_id` -> insert only for new rows when present
- `food_kind` -> `food_kind`
- `canonical_name` -> `canonical_name`
- `display_name` -> `display_name`
- `normalized_name` -> `normalized_name`
- `description` -> `description`
- `legacy_preparation_state` -> `preparation_state`
- `source_code` -> `source_id`
- `brand_name` -> `brand_id`
- `source_external_id` -> `source_external_id`
- `confidence_score` -> `confidence_score`
- `verification_status` -> `verification_status`
- `is_verified` -> true only when status is `verified`
- `is_visible` -> false when status is `deprecated` or `rejected`
- `is_common` -> `is_common`
- `visibility_priority` -> `visibility_priority`
- `physical_state` -> `physical_state_id`
- `preparation_method` -> `preparation_method_id`

## Reference Catalog

`reference_catalog_json` is processed only from the single non-null row.

Supported reference upserts:

- `sources` -> `nutrition_sources`
- `units` -> `nutrition_units`
- `nutrients` -> `nutrition_nutrients`

Physical states and preparation methods are expected from the approved architecture correction.

## Aliases

`aliases_json` -> `nutrition_food_aliases`

Unique key used by database:

`food_id + normalized_alias + locale`

## Categories

`categories_json` -> `nutrition_categories` and `nutrition_food_categories`

The importer:

- upserts missing categories by normalized name, level and locale;
- sets previous categories for each imported food to non-primary;
- inserts/updates CSV categories;
- assigns at most one primary category from the CSV row.

## Servings

`servings_json` -> `nutrition_food_servings`

The importer never deletes old servings because meal-log items can reference them. It updates by:

`food_id + lower(serving_label)`

For each imported food, the importer first clears existing default flags and then applies the CSV default serving.

## Nutrients

`nutrients_json` -> `nutrition_food_nutrients`

Database key:

`food_id + nutrient_id`

If a nutrient appears twice in the CSV with one deprecated/rejected entry and one active entry, the active entry wins. Multiple active conflicting values are critical and block import.

## Canonical Groups

`canonical_group_client_key` and `canonical_group_json` ->:

- `nutrition_canonical_food_groups`
- `nutrition_food_group_members`

Group `client_key` is first-class in `nutrition_canonical_food_groups`.

Group member client keys are stored in `metadata.client_key` because the current architecture has no dedicated column for them.

## Preparations

`preparations_json` -> `nutrition_food_preparations`

Resolved via:

- `base_food_client_key`
- `prepared_food_client_key`

Fallback UUIDs are used only when present in the CSV and resolvable.

## Food Relationships

`food_relationships_json` -> `nutrition_food_relationships`

For relationship types ending in `_of`, the importer maps:

- parent = target food
- child = source food

This means a row saying "cooked rice preparation_of raw rice" stores raw rice as parent and cooked rice as child.

## Import Infrastructure

Created tables:

- `nutrition_import_batches`
- `nutrition_import_rows`
- `nutrition_import_errors`
- `nutrition_import_entity_map`
- `nutrition_import_backups`

These tables are technical audit/staging tables only.
