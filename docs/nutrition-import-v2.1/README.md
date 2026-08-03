# Nutrition Import v2.1

This package imports `nutrition-master-catalog-v2.1-curated.csv` into the approved `nutrition_*` architecture.

It does not modify frontend code, users, profiles, meal logs, legacy food tables, workouts, subscriptions, exercises, or auth data.

## Files

- `scripts/nutrition/import-nutrition-v2.1.ts`: dry-run, apply and rollback script.
- `scripts/nutrition/validate-nutrition-v2.1.ts`: runs post-import SQL validation.
- `docs/nutrition-import-v2.1/staging-schema.sql`: staging/audit schema.
- `docs/nutrition-import-v2.1/backup-before-import.sql`: immutable catalog backup before apply.
- `docs/nutrition-import-v2.1/pre-import-validation.sql`: independent DB pre-check.
- `docs/nutrition-import-v2.1/post-import-validation.sql`: independent DB post-check.
- `docs/nutrition-import-v2.1/rollback.sql`: batch-specific SQL rollback helper.
- `docs/nutrition-import-v2.1/import-mapping.md`: mapping contract.
- `docs/nutrition-import-v2.1/import-report.json`: generated report.
- `docs/nutrition-import-v2.1/import-report.md`: generated report.

## Dependencies

Installed project dependencies:

- `pg`
- `csv-parse`

Installed dev dependencies:

- `tsx`
- `@types/pg`

## Environment

Use a direct PostgreSQL connection string:

```powershell
$env:DATABASE_URL="postgresql://..."
```

Do not put service-role keys or database passwords in frontend files.

The script also reads `.env` if present, but `.env` must not be committed.

## Connection Check

Run:

```powershell
npx tsx scripts/nutrition/validate-nutrition-v2.1.ts
```

Before the import exists this may show `missing_committed_import_batch`, but it confirms whether `DATABASE_URL` works.

## Create Staging Schema

The apply script creates staging automatically, but you may create it manually first:

```sql
-- Supabase SQL Editor
-- docs/nutrition-import-v2.1/staging-schema.sql
```

## Pre-Import Validation

Run this in Supabase SQL Editor:

```sql
-- docs/nutrition-import-v2.1/pre-import-validation.sql
```

Continue only when there are 0 `critical` rows.

## Backup

Run this before apply:

```sql
-- docs/nutrition-import-v2.1/backup-before-import.sql
```

This creates `public.nutrition_catalog_backup_v2_1_20260803` with a row-level JSON snapshot of catalog tables only.
It does not include personal logs or legacy tables.

## Dry-Run

Local CSV-only dry-run:

```powershell
npx tsx scripts/nutrition/import-nutrition-v2.1.ts --mode dry-run
```

Full dry-run with database schema/staging validation:

```powershell
$env:DATABASE_URL="postgresql://..."
npx tsx scripts/nutrition/import-nutrition-v2.1.ts --mode dry-run
```

Dry-run never commits catalog data.

## Apply

Apply is protected by an explicit confirmation token:

```powershell
$env:DATABASE_URL="postgresql://..."
npx tsx scripts/nutrition/import-nutrition-v2.1.ts --mode apply --confirm APPLY_NUTRITION_V2_1
```

The script:

- validates strict UTF-8;
- validates exact headers and row counts;
- creates import batch and staging rows;
- takes scoped backups for existing catalog rows;
- opens one PostgreSQL transaction;
- uses advisory lock to prevent concurrent imports;
- resolves `client_key -> UUID`;
- applies foods, aliases, categories, servings, nutrients, groups, preparations and relationships;
- runs final critical checks before commit;
- rolls back automatically on critical failure.

## Post-Import Validation

Run either:

```powershell
npx tsx scripts/nutrition/validate-nutrition-v2.1.ts
```

or in Supabase SQL Editor:

```sql
-- docs/nutrition-import-v2.1/post-import-validation.sql
```

Approval signal:

`0 critical`

## Rollback

Preferred rollback:

```powershell
$env:DATABASE_URL="postgresql://..."
npx tsx scripts/nutrition/import-nutrition-v2.1.ts --mode rollback --batch-id <import_batch_id> --confirm ROLLBACK_NUTRITION_V2_1
```

SQL rollback helper:

1. Open `docs/nutrition-import-v2.1/rollback.sql`.
2. Replace `__BATCH_ID__` with the batch id.
3. Execute in Supabase SQL Editor.

The rollback is batch-scoped. It does not truncate the catalog and does not touch users, personal logs, legacy tables, workouts or subscriptions.

## UTF-8 Protection

The importer:

- reads bytes with strict UTF-8 decoding;
- removes only a UTF-8 BOM at file start;
- rejects U+FFFD;
- checks common mojibake patterns;
- normalizes human text to Unicode NFC;
- preserves UUIDs, codes, client keys and JSON technical identifiers.

## Idempotence

Existing foods use `food_id`.

New foods are resolved by `metadata.client_key` on reruns.

Reference catalogs are upserted by stable keys.

Aliases, nutrients, categories, canonical groups, group members, preparations and relationships are applied through database uniqueness rules or explicit lookup/update.

## If Same Checksum Already Exists

If a committed batch already has the same `file_sha256`, do not run apply again unless you are intentionally testing idempotence.

Run dry-run first and inspect `docs/nutrition-import-v2.1/import-report.json`.

## Files Not To Commit

Do not commit:

- `.env`
- database passwords
- service role keys
- private connection strings
- manually exported production backups containing private user data

## Exact Execution Order

1. Confirm `BD-sendaFit/nutrition-master-catalog-v2.1-curated.csv` exists.
2. Run local dry-run.
3. Set `DATABASE_URL`.
4. Run `pre-import-validation.sql`.
5. Run `backup-before-import.sql`.
6. Run DB dry-run.
7. Run apply with confirmation.
8. Run post-import validation.
9. If there is any `critical`, rollback the batch and inspect the report.
