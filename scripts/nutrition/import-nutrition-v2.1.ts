/**
 * Beta Nutrition v2.1 catalog importer.
 *
 * Modes:
 *   npx tsx scripts/nutrition/import-nutrition-v2.1.ts --mode dry-run
 *   npx tsx scripts/nutrition/import-nutrition-v2.1.ts --mode apply --confirm APPLY_NUTRITION_V2_1
 *   npx tsx scripts/nutrition/import-nutrition-v2.1.ts --mode rollback --batch-id <uuid> --confirm ROLLBACK_NUTRITION_V2_1
 *
 * Required for DB modes:
 *   DATABASE_URL
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import pg from "pg";

const { Client } = pg;

type Mode = "dry-run" | "apply" | "rollback";
type Severity = "critical" | "warning" | "info";

type ValidationIssue = {
  severity: Severity;
  check: string;
  row?: number;
  details: string;
};

type ImportRow = Record<string, unknown>;

type ParsedRow = ImportRow & {
  parsedJson: Record<string, unknown>;
  rowNumber: number;
  rowChecksum: string;
};

type ImportSummary = {
  csvPath: string;
  fileSha256: string;
  bytes: number;
  rows: number;
  headers: number;
  existingFoodIds: number;
  newFoods: number;
  clientKeys: number;
  servings: number;
  nutrients: number;
  canonicalGroups: number;
  relationships: number;
  preparations: number;
  deprecatedFoods: number;
  referenceCatalogRows: number;
  uniqueReferenceCatalogs: number;
};

type ImportReport = {
  generatedAt: string;
  mode: Mode;
  decision: "dry_run_passed" | "dry_run_failed" | "apply_committed" | "apply_rolled_back" | "rollback_committed" | "pending_credentials";
  importBatchId?: string;
  summary: ImportSummary;
  db?: Record<string, unknown>;
  changes?: Record<string, number>;
  utf8Samples: Array<Record<string, string | number>>;
  issues: ValidationIssue[];
};

const DEFAULT_CSV_PATH = "BD-sendaFit/nutrition-master-catalog-v2.1-curated.csv";
const REPORT_JSON_PATH = "docs/nutrition-import-v2.1/import-report.json";
const REPORT_MD_PATH = "docs/nutrition-import-v2.1/import-report.md";

const EXPECTED_HEADERS = [
  "export_row_number",
  "export_total_foods",
  "food_id",
  "client_key",
  "legacy_food_id",
  "canonical_group_id",
  "canonical_group_client_key",
  "canonical_group_name",
  "group_member_id",
  "variant_type",
  "food_kind",
  "canonical_name",
  "display_name",
  "normalized_name",
  "description",
  "physical_state",
  "preparation_method",
  "legacy_preparation_state",
  "verification_status",
  "confidence_score",
  "brand_name",
  "brand_json",
  "category",
  "subcategory",
  "base_amount",
  "base_unit",
  "serving_grams",
  "calories_100g",
  "protein_100g",
  "carbohydrates_100g",
  "fat_100g",
  "fiber_100g",
  "sugars_100g",
  "sodium_mg_100g",
  "source_code",
  "source_external_id",
  "locale",
  "is_verified",
  "is_visible",
  "is_common",
  "visibility_priority",
  "aliases_json",
  "categories_json",
  "servings_json",
  "nutrients_json",
  "sources_json",
  "barcodes_json",
  "preparations_json",
  "food_relationships_json",
  "canonical_group_json",
  "food_record_json",
  "reference_catalog_json",
  "audit_has_aliases",
  "audit_has_category",
  "audit_has_description",
  "audit_has_servings",
  "audit_has_source",
  "audit_has_canonical_group",
  "audit_has_calories",
  "audit_has_protein",
  "audit_has_carbohydrates",
  "audit_has_fat",
  "audit_has_complete_macros",
  "audit_possible_duplicate_key",
  "audit_macro_energy_calculated",
  "audit_macro_energy_difference",
  "audit_needs_review",
  "audit_review_reasons",
  "created_at",
  "updated_at",
];

const JSON_COLUMNS = [
  "brand_json",
  "aliases_json",
  "categories_json",
  "servings_json",
  "nutrients_json",
  "sources_json",
  "barcodes_json",
  "preparations_json",
  "food_relationships_json",
  "canonical_group_json",
  "food_record_json",
  "reference_catalog_json",
];

const HUMAN_TEXT_COLUMNS = [
  "canonical_group_name",
  "canonical_name",
  "display_name",
  "description",
  "brand_name",
  "category",
  "subcategory",
];

const VALID_VERIFICATION_STATUS = new Set(["unverified", "needs_review", "partially_verified", "verified", "rejected", "deprecated"]);
const VALID_FOOD_KIND = new Set([
  "ingredient",
  "prepared_variant",
  "component",
  "composite_food",
  "recipe",
  "branded_product",
  "restaurant_item",
  "supplement",
  "beverage",
  "unclassified",
  "generic",
  "branded",
  "restaurant",
  "user_custom",
  "ai_estimated",
]);
const VALID_VARIANT_TYPE = new Set([
  "ingredient",
  "prepared_variant",
  "component",
  "composite_food",
  "recipe",
  "branded_product",
  "restaurant_item",
  "supplement",
  "beverage",
  "unclassified",
  "legacy_generic",
]);
const VALID_RELATIONSHIP_TYPE = new Set([
  "variant_of",
  "preparation_of",
  "component_of",
  "part_of",
  "derived_from",
  "cut_of",
  "equivalent_to",
  "related_to",
]);

function activeStatus(status: string | null) {
  return status !== "deprecated" && status !== "rejected";
}

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function nullableString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || text === "null") return null;
  return text.normalize("NFC");
}

function nullableRaw(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || text === "null") return null;
  return text;
}

function nullableNumber(value: unknown): number | null {
  const text = nullableRaw(value);
  if (text === null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function boolValue(value: unknown, fallback = false): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  if (["true", "t", "1", "yes", "si", "sí"].includes(text)) return true;
  if (["false", "f", "0", "no"].includes(text)) return false;
  return fallback;
}

function parseJsonCell(value: unknown): unknown {
  const text = nullableRaw(value);
  if (text === null) return null;
  return JSON.parse(text);
}

function normalizeHumanJson(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (Array.isArray(value)) return value.map(normalizeHumanJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, normalizeHumanJson(val)]));
  }
  return value;
}

function readCsvStrict(csvPath: string): { rows: ParsedRow[]; summary: ImportSummary; issues: ValidationIssue[]; utf8Samples: ImportReport["utf8Samples"] } {
  const issues: ValidationIssue[] = [];
  const fullPath = resolve(process.cwd(), csvPath);
  const bytes = readFileSync(fullPath);
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`CSV is not valid strict UTF-8: ${(error as Error).message}`);
  }

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\uFFFD")) {
    issues.push({ severity: "critical", check: "unicode_replacement_character", details: "CSV contains U+FFFD replacement character" });
  }

  const mojibakePatterns = [
    /\u00c3\u0192/u,
    /\u00c3\u201a/u,
    /\u00c3\u00a2\u00e2\u201a\u00ac/u,
    /\u00c3\u00b0\u00c5\u00b8/u,
    /\u00ef\u00bf\u00bd/u,
  ];
  for (const pattern of mojibakePatterns) {
    if (pattern.test(text)) {
      issues.push({ severity: "critical", check: "mojibake_pattern", details: `Pattern ${pattern.source} was found` });
    }
  }

  const rawRows = parse(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_quotes: false,
  }) as ImportRow[];

  const headers = Object.keys(rawRows[0] ?? {});
  if (headers.length !== EXPECTED_HEADERS.length) {
    issues.push({ severity: "critical", check: "header_count", details: `expected=${EXPECTED_HEADERS.length}, actual=${headers.length}` });
  }
  const headerDiff = EXPECTED_HEADERS.filter((header, index) => headers[index] !== header);
  if (headerDiff.length > 0) {
    issues.push({ severity: "critical", check: "headers_exact_order", details: `first mismatches=${headerDiff.slice(0, 10).join(",")}` });
  }

  const parsedRows: ParsedRow[] = rawRows.map((row, index) => {
    const normalizedRow = { ...row };
    for (const column of HUMAN_TEXT_COLUMNS) {
      if (typeof normalizedRow[column] === "string") normalizedRow[column] = normalizedRow[column].normalize("NFC");
    }
    const parsedJson: Record<string, unknown> = {};
    for (const column of JSON_COLUMNS) {
      try {
        parsedJson[column] = normalizeHumanJson(parseJsonCell(row[column]));
      } catch (error) {
        issues.push({ severity: "critical", check: "invalid_json", row: index + 2, details: `${column}: ${(error as Error).message}` });
        parsedJson[column] = null;
      }
    }
    return {
      ...normalizedRow,
      parsedJson,
      rowNumber: index + 2,
      rowChecksum: sha256(JSON.stringify(normalizedRow)),
    };
  });

  const clientKeys = parsedRows.map((row) => nullableRaw(row.client_key)).filter(Boolean) as string[];
  const duplicateClientKeys = duplicates(clientKeys);
  for (const key of duplicateClientKeys) {
    issues.push({ severity: "critical", check: "duplicate_client_key", details: key });
  }

  const existingFoodIds = parsedRows.filter((row) => nullableRaw(row.food_id)).length;
  const newFoods = parsedRows.filter((row) => !nullableRaw(row.food_id)).length;
  const referenceValues = parsedRows.map((row) => nullableRaw(row.reference_catalog_json)).filter((value) => value !== null);
  const referenceNonNull = referenceValues.filter((value) => value !== "null");
  const canonicalGroupKeys = new Set(parsedRows.map((row) => nullableRaw(row.canonical_group_client_key)).filter(Boolean));

  let servings = 0;
  let nutrients = 0;
  let relationships = 0;
  let preparations = 0;
  let deprecatedFoods = 0;
  const servingKeys: string[] = [];

  for (const row of parsedRows) {
    const rowNumber = row.rowNumber;
    const clientKey = nullableRaw(row.client_key);
    if (!clientKey) issues.push({ severity: "critical", check: "missing_client_key", row: rowNumber, details: "client_key is required" });
    if (!nullableString(row.display_name)) issues.push({ severity: "critical", check: "missing_display_name", row: rowNumber, details: String(row.client_key) });
    if (!VALID_VERIFICATION_STATUS.has(String(row.verification_status))) {
      issues.push({ severity: "critical", check: "invalid_verification_status", row: rowNumber, details: String(row.verification_status) });
    }
    if (!VALID_FOOD_KIND.has(String(row.food_kind))) {
      issues.push({ severity: "critical", check: "invalid_food_kind", row: rowNumber, details: String(row.food_kind) });
    }
    if (!VALID_VARIANT_TYPE.has(String(row.variant_type))) {
      issues.push({ severity: "critical", check: "invalid_variant_type", row: rowNumber, details: String(row.variant_type) });
    }
    if (nullableNumber(row.confidence_score) !== null) {
      const confidence = nullableNumber(row.confidence_score) as number;
      if (confidence < 0 || confidence > 1) issues.push({ severity: "critical", check: "invalid_confidence_score", row: rowNumber, details: String(confidence) });
    }
    if (String(row.verification_status) === "deprecated" || boolValue(row.is_visible, true) === false) deprecatedFoods++;

    const rowServings = row.parsedJson.servings_json;
    if (Array.isArray(rowServings)) {
      servings += rowServings.length;
      for (const serving of rowServings as Record<string, unknown>[]) {
        const key = nullableRaw(serving.serving_client_key);
        if (key) servingKeys.push(key);
        const quantity = nullableNumber(serving.quantity);
        const grams = nullableNumber(serving.grams);
        const milliliters = nullableNumber(serving.milliliters);
        if (quantity !== null && quantity <= 0) issues.push({ severity: "critical", check: "invalid_serving_quantity", row: rowNumber, details: key ?? "missing serving key" });
        if (grams !== null && grams <= 0) issues.push({ severity: "critical", check: "invalid_serving_grams", row: rowNumber, details: key ?? "missing serving key" });
        if (milliliters !== null && milliliters <= 0) issues.push({ severity: "critical", check: "invalid_serving_milliliters", row: rowNumber, details: key ?? "missing serving key" });
      }
    }

    const rowNutrients = row.parsedJson.nutrients_json;
    if (Array.isArray(rowNutrients)) {
      nutrients += rowNutrients.length;
      const codes = new Map<string, { amount: number | null; status: string | null }>();
      for (const nutrient of rowNutrients as Record<string, unknown>[]) {
        const code = nullableRaw(nutrient.nutrient_code);
        const amount = nullableNumber(nutrient.amount ?? nutrient.amount_per_100g);
        if (code) {
          const status = nullableRaw(nutrient.verification_status);
          const previous = codes.get(code);
          if (
            previous &&
            activeStatus(previous.status) &&
            activeStatus(status) &&
            (previous.amount !== amount || previous.status !== status)
          ) {
            issues.push({ severity: "critical", check: "duplicate_incompatible_nutrient_in_food", row: rowNumber, details: `${clientKey}:${code}` });
          }
          if (!previous || (!activeStatus(previous.status) && activeStatus(status))) codes.set(code, { amount, status });
        }
        if (amount !== null && amount < 0) issues.push({ severity: "critical", check: "negative_nutrient", row: rowNumber, details: `${clientKey}:${code}` });
      }
    }

    const rowRelationships = row.parsedJson.food_relationships_json;
    if (Array.isArray(rowRelationships)) {
      relationships += rowRelationships.length;
      for (const relationship of rowRelationships as Record<string, unknown>[]) {
        const type = nullableRaw(relationship.relationship_type);
        const source = nullableRaw(relationship.source_food_client_key);
        const target = nullableRaw(relationship.target_food_client_key);
        if (!type || !VALID_RELATIONSHIP_TYPE.has(type)) issues.push({ severity: "critical", check: "invalid_relationship_type", row: rowNumber, details: String(type) });
        if (!source || !target) issues.push({ severity: "critical", check: "unresolvable_relationship_client_key", row: rowNumber, details: JSON.stringify({ source, target, type }) });
        if (source && target && source === target) issues.push({ severity: "critical", check: "self_relationship_csv", row: rowNumber, details: source });
      }
    }

    const rowPreparations = row.parsedJson.preparations_json;
    if (Array.isArray(rowPreparations)) preparations += rowPreparations.length;
  }

  for (const key of duplicates(servingKeys)) issues.push({ severity: "critical", check: "duplicate_serving_client_key", details: key });

  const summary: ImportSummary = {
    csvPath,
    fileSha256: sha256(bytes),
    bytes: bytes.length,
    rows: parsedRows.length,
    headers: headers.length,
    existingFoodIds,
    newFoods,
    clientKeys: new Set(clientKeys).size,
    servings,
    nutrients,
    canonicalGroups: canonicalGroupKeys.size,
    relationships,
    preparations,
    deprecatedFoods,
    referenceCatalogRows: referenceNonNull.length,
    uniqueReferenceCatalogs: new Set(referenceNonNull).size,
  };

  if (summary.rows !== 304) issues.push({ severity: "critical", check: "approved_row_count", details: `expected=304, actual=${summary.rows}` });
  if (summary.headers !== 70) issues.push({ severity: "critical", check: "approved_header_count", details: `expected=70, actual=${summary.headers}` });
  if (summary.existingFoodIds !== 169) issues.push({ severity: "critical", check: "approved_existing_food_count", details: `expected=169, actual=${summary.existingFoodIds}` });
  if (summary.newFoods !== 135) issues.push({ severity: "critical", check: "approved_new_food_count", details: `expected=135, actual=${summary.newFoods}` });
  if (summary.clientKeys !== 304) issues.push({ severity: "critical", check: "approved_client_key_count", details: `expected=304, actual=${summary.clientKeys}` });
  if (summary.referenceCatalogRows !== 1) issues.push({ severity: "critical", check: "reference_catalog_once", details: `expected=1, actual=${summary.referenceCatalogRows}` });

  const utf8Samples = pickUtf8Samples(parsedRows);
  return { rows: parsedRows, summary, issues, utf8Samples };
}

function duplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function pickUtf8Samples(rows: ParsedRow[]) {
  const samples: ImportReport["utf8Samples"] = [];
  const accented = /[áéíóúÁÉÍÓÚñÑüÜµ]/u;
  for (const row of rows) {
    for (const column of HUMAN_TEXT_COLUMNS) {
      const value = nullableString(row[column]);
      if (value && accented.test(value)) {
        samples.push({
          row: row.rowNumber,
          column,
          value,
          chars: [...value].length,
          sha256: sha256(value.normalize("NFC")),
        });
        break;
      }
    }
    if (samples.length >= 12) break;
  }
  return samples;
}

function ensureReportDir() {
  mkdirSync(dirname(resolve(process.cwd(), REPORT_JSON_PATH)), { recursive: true });
}

function writeReports(report: ImportReport) {
  ensureReportDir();
  writeFileSync(resolve(process.cwd(), REPORT_JSON_PATH), JSON.stringify(report, null, 2), "utf8");
  const criticalCount = report.issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = report.issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = report.issues.filter((issue) => issue.severity === "info").length;
  const md = [
    `# Nutrition Import v2.1 Report`,
    ``,
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Decision: ${report.decision}`,
    report.importBatchId ? `Import batch: ${report.importBatchId}` : undefined,
    ``,
    `## Summary`,
    ``,
    "```json",
    JSON.stringify(report.summary, null, 2),
    "```",
    ``,
    `## Issues`,
    ``,
    `critical=${criticalCount}, warning=${warningCount}, info=${infoCount}`,
    ``,
    ...report.issues.map((issue) => `- ${issue.severity} / ${issue.check}${issue.row ? ` / row ${issue.row}` : ""}: ${issue.details}`),
    ``,
    `## UTF-8 Samples`,
    ``,
    "```json",
    JSON.stringify(report.utf8Samples, null, 2),
    "```",
    ``,
    `## DB / Changes`,
    ``,
    "```json",
    JSON.stringify({ db: report.db, changes: report.changes }, null, 2),
    "```",
  ].filter((line) => line !== undefined).join("\n");
  writeFileSync(resolve(process.cwd(), REPORT_MD_PATH), md, "utf8");
}

function dbUrl(): string | null {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
}

async function connectDb(): Promise<pg.Client | null> {
  const url = dbUrl();
  if (!url) return null;
  const client = new Client({ connectionString: url, statement_timeout: 120000 });
  await client.connect();
  await client.query("SET client_encoding TO 'UTF8'");
  return client;
}

async function ensureImportSchema(client: pg.Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.nutrition_import_batches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      import_name text NOT NULL,
      file_sha256 text NOT NULL,
      mode text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      summary jsonb NOT NULL DEFAULT '{}'::jsonb,
      error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
      started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz,
      CONSTRAINT nutrition_import_batches_status_check
      CHECK (status IN ('pending', 'dry_run', 'applying', 'committed', 'rolled_back', 'failed'))
    );

    CREATE TABLE IF NOT EXISTS public.nutrition_import_rows (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      import_batch_id uuid NOT NULL REFERENCES public.nutrition_import_batches(id) ON DELETE CASCADE,
      row_number integer NOT NULL,
      client_key text,
      food_id uuid,
      row_checksum text NOT NULL,
      raw_row jsonb NOT NULL,
      parsed_json jsonb NOT NULL,
      parse_status text NOT NULL DEFAULT 'valid',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (import_batch_id, row_number)
    );

    CREATE TABLE IF NOT EXISTS public.nutrition_import_errors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      import_batch_id uuid REFERENCES public.nutrition_import_batches(id) ON DELETE CASCADE,
      row_number integer,
      severity text NOT NULL,
      check_name text NOT NULL,
      details text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.nutrition_import_entity_map (
      import_batch_id uuid NOT NULL REFERENCES public.nutrition_import_batches(id) ON DELETE CASCADE,
      entity_type text NOT NULL,
      client_key text NOT NULL,
      entity_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (import_batch_id, entity_type, client_key)
    );

    CREATE TABLE IF NOT EXISTS public.nutrition_import_backups (
      import_batch_id uuid NOT NULL REFERENCES public.nutrition_import_batches(id) ON DELETE CASCADE,
      table_name text NOT NULL,
      entity_id text NOT NULL,
      operation text NOT NULL,
      before_row jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (import_batch_id, table_name, entity_id)
    );
  `);
}

async function inspectDatabase(client: pg.Client, issues: ValidationIssue[]) {
  const encoding = await client.query("SHOW server_encoding");
  const clientEncoding = await client.query("SHOW client_encoding");
  const db = {
    serverEncoding: encoding.rows[0]?.server_encoding,
    clientEncoding: clientEncoding.rows[0]?.client_encoding,
  };
  if (String(db.serverEncoding).toUpperCase() !== "UTF8") {
    issues.push({ severity: "critical", check: "server_encoding_not_utf8", details: String(db.serverEncoding) });
  }
  if (String(db.clientEncoding).toUpperCase() !== "UTF8") {
    issues.push({ severity: "critical", check: "client_encoding_not_utf8", details: String(db.clientEncoding) });
  }

  const requiredTables = [
    "nutrition_sources",
    "nutrition_brands",
    "nutrition_categories",
    "nutrition_units",
    "nutrition_nutrients",
    "nutrition_foods",
    "nutrition_food_aliases",
    "nutrition_food_categories",
    "nutrition_food_servings",
    "nutrition_food_nutrients",
    "nutrition_barcodes",
    "nutrition_food_preparations",
    "nutrition_physical_states",
    "nutrition_preparation_methods",
    "nutrition_canonical_food_groups",
    "nutrition_food_group_members",
    "nutrition_food_relationships",
  ];
  const tableResult = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [requiredTables],
  );
  const found = new Set(tableResult.rows.map((row) => row.table_name));
  for (const table of requiredTables) {
    if (!found.has(table)) issues.push({ severity: "critical", check: "missing_required_table", details: table });
  }

  return db;
}

async function createBatch(client: pg.Client, mode: Mode, summary: ImportSummary, issues: ValidationIssue[]) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO public.nutrition_import_batches (import_name, file_sha256, mode, status, summary, error_summary)
      VALUES ('nutrition-master-catalog-v2.1-curated', $1::text, $2::text, $3::text, $4::jsonb, $5::jsonb)
      RETURNING id
    `,
    [summary.fileSha256, mode, mode === "dry-run" ? "dry_run" : "applying", JSON.stringify(summary), JSON.stringify(issues)],
  );
  return result.rows[0].id;
}

async function loadStaging(client: pg.Client, batchId: string, rows: ParsedRow[], issues: ValidationIssue[]) {
  for (const row of rows) {
    await client.query(
      `
        INSERT INTO public.nutrition_import_rows (
          import_batch_id, row_number, client_key, food_id, row_checksum, raw_row, parsed_json, parse_status
        )
        VALUES ($1::uuid, $2::integer, $3::text, NULLIF($4::text, '')::uuid, $5::text, $6::jsonb, $7::jsonb, $8::text)
        ON CONFLICT (import_batch_id, row_number) DO UPDATE SET
          client_key = EXCLUDED.client_key,
          food_id = EXCLUDED.food_id,
          row_checksum = EXCLUDED.row_checksum,
          raw_row = EXCLUDED.raw_row,
          parsed_json = EXCLUDED.parsed_json,
          parse_status = EXCLUDED.parse_status
      `,
      [
        batchId,
        row.rowNumber,
        nullableRaw(row.client_key),
        nullableRaw(row.food_id) ?? "",
        row.rowChecksum,
        JSON.stringify(stripParsed(row)),
        JSON.stringify(row.parsedJson),
        issues.some((issue) => issue.row === row.rowNumber && issue.severity === "critical") ? "critical" : "valid",
      ],
    );
  }
  for (const issue of issues) {
    await client.query(
      `
        INSERT INTO public.nutrition_import_errors (import_batch_id, row_number, severity, check_name, details)
        VALUES ($1::uuid, $2::integer, $3::text, $4::text, $5::text)
      `,
      [batchId, issue.row ?? null, issue.severity, issue.check, issue.details],
    );
  }
}

function stripParsed(row: ParsedRow) {
  const copy = { ...row } as Record<string, unknown>;
  delete copy.parsedJson;
  delete copy.rowNumber;
  delete copy.rowChecksum;
  return copy;
}

async function backupExistingRows(client: pg.Client, batchId: string, rows: ParsedRow[]) {
  const existingIds = rows.map((row) => nullableRaw(row.food_id)).filter(Boolean);
  if (existingIds.length === 0) return;
  const tables = [
    { table: "nutrition_foods", id: "id", where: "id = ANY($2::uuid[])" },
    { table: "nutrition_food_aliases", id: "id", where: "food_id = ANY($2::uuid[])" },
    { table: "nutrition_food_categories", id: "food_id || ':' || category_id", where: "food_id = ANY($2::uuid[])" },
    { table: "nutrition_food_servings", id: "id", where: "food_id = ANY($2::uuid[])" },
    { table: "nutrition_food_nutrients", id: "id", where: "food_id = ANY($2::uuid[])" },
    { table: "nutrition_barcodes", id: "id", where: "food_id = ANY($2::uuid[])" },
    { table: "nutrition_food_group_members", id: "id", where: "food_id = ANY($2::uuid[])" },
    { table: "nutrition_food_preparations", id: "id", where: "base_food_id = ANY($2::uuid[]) OR prepared_food_id = ANY($2::uuid[])" },
    { table: "nutrition_food_relationships", id: "id", where: "parent_food_id = ANY($2::uuid[]) OR child_food_id = ANY($2::uuid[])" },
  ];

  for (const item of tables) {
    await client.query(
      `
        INSERT INTO public.nutrition_import_backups (import_batch_id, table_name, entity_id, operation, before_row)
        SELECT $1::uuid, $3::text, (${item.id})::text, 'restore', to_jsonb(t)
        FROM public.${item.table} t
        WHERE ${item.where}
        ON CONFLICT (import_batch_id, table_name, entity_id) DO NOTHING
      `,
      [batchId, existingIds, item.table],
    );
  }
}

async function getIdMap(client: pg.Client, sql: string, params: unknown[] = []) {
  const result = await client.query(sql, params);
  const map = new Map<string, string>();
  for (const row of result.rows) map.set(row.key, row.id);
  return map;
}

async function stage<T>(name: string, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${name}: ${message}`);
  }
}

async function applyCatalog(client: pg.Client, batchId: string, rows: ParsedRow[]) {
  const changes: Record<string, number> = {
    sources: 0,
    units: 0,
    nutrients: 0,
    brands: 0,
    categories: 0,
    foodsInserted: 0,
    foodsUpdated: 0,
    aliases: 0,
    servings: 0,
    nutrientsApplied: 0,
    canonicalGroups: 0,
    groupMembers: 0,
    preparations: 0,
    relationships: 0,
    barcodes: 0,
  };

  await stage("applyCatalog.backupExistingRows", () => backupExistingRows(client, batchId, rows));

  const reference = rows.find((row) => row.parsedJson.reference_catalog_json && row.parsedJson.reference_catalog_json !== null)?.parsedJson.reference_catalog_json as Record<string, unknown> | undefined;
  await stage("applyCatalog.upsertReferenceCatalog", () => upsertReferenceCatalog(client, reference, changes));

  await stage("applyCatalog.upsertBrands", async () => {
    for (const row of rows) {
      const brandName = nullableString(row.brand_name);
      if (brandName) {
        await client.query(
          `
            INSERT INTO public.nutrition_brands (name, normalized_name, brand_type, metadata)
            VALUES ($1::text, public.nutrition_normalize_text($1::text), 'brand', jsonb_build_object('import_batch_id', $2::text))
            ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
          `,
          [brandName, batchId],
        );
        changes.brands++;
      }
    }
  });

  const sourceMap = await stage("applyCatalog.loadSourceMap", () => getIdMap(client, "SELECT code AS key, id FROM public.nutrition_sources"));
  const brandMap = await stage("applyCatalog.loadBrandMap", () => getIdMap(client, "SELECT normalized_name AS key, id FROM public.nutrition_brands"));
  const stateMap = await stage("applyCatalog.loadStateMap", () => getIdMap(client, "SELECT code AS key, id FROM public.nutrition_physical_states"));
  const methodMap = await stage("applyCatalog.loadMethodMap", () => getIdMap(client, "SELECT code AS key, id FROM public.nutrition_preparation_methods"));

  const foodMap = new Map<string, string>();
  await stage("applyCatalog.upsertFoods", async () => {
    for (const row of rows) {
      const clientKey = nullableRaw(row.client_key);
      if (!clientKey) throw new Error(`Missing client_key at row ${row.rowNumber}`);
      try {
        const existingFoodId = nullableRaw(row.food_id);
        const sourceCode = nullableRaw(row.source_code);
        const brandName = nullableString(row.brand_name);
        const brandKey = brandName ? await normalizeDb(client, brandName) : null;
        const brandId = brandKey ? brandMap.get(brandKey) ?? null : null;
        const sourceId = sourceCode ? sourceMap.get(sourceCode) ?? null : null;
        const stateId = nullableRaw(row.physical_state) ? stateMap.get(String(row.physical_state)) ?? null : null;
        const methodId = nullableRaw(row.preparation_method) ? methodMap.get(String(row.preparation_method)) ?? null : null;
        const verified = String(row.verification_status) === "verified";
        const visible = boolValue(row.is_visible, true) && !["deprecated", "rejected"].includes(String(row.verification_status));
        const metadata = {
          import_batch_id: batchId,
          import_name: "nutrition-master-catalog-v2.1-curated",
          client_key: clientKey,
          audit_review_reasons: nullableString(row.audit_review_reasons),
          audit_possible_duplicate_key: nullableString(row.audit_possible_duplicate_key),
        };

        if (existingFoodId) {
          await client.query(
            `
              UPDATE public.nutrition_foods
              SET
                source_id = COALESCE($2::uuid, source_id),
                brand_id = $3::uuid,
                source_external_id = $4::text,
                food_kind = $5::text,
                canonical_name = $6::text,
                display_name = $7::text,
                normalized_name = $8::text,
                locale = COALESCE($9::text, locale),
                description = $10::text,
                preparation_state = $11::text,
                confidence_score = $12::numeric,
                is_verified = $13::boolean,
                is_visible = $14::boolean,
                is_common = $15::boolean,
                visibility_priority = COALESCE($16::integer, visibility_priority),
                verification_status = $17::text,
                physical_state_id = $18::uuid,
                preparation_method_id = $19::uuid,
                search_text = concat_ws(' ', $6::text, $7::text, $8::text, $10::text),
                metadata = COALESCE(metadata, '{}'::jsonb) || $20::jsonb,
                updated_at = now()
              WHERE id = $1::uuid
            `,
            [
              existingFoodId,
              sourceId,
              brandId,
              nullableRaw(row.source_external_id),
              row.food_kind,
              nullableString(row.canonical_name),
              nullableString(row.display_name),
              nullableString(row.normalized_name),
              nullableRaw(row.locale),
              nullableString(row.description),
              nullableRaw(row.legacy_preparation_state),
              nullableNumber(row.confidence_score),
              verified,
              visible,
              boolValue(row.is_common),
              nullableNumber(row.visibility_priority),
              row.verification_status,
              stateId,
              methodId,
              JSON.stringify(metadata),
            ],
          );
          foodMap.set(clientKey, existingFoodId);
          changes.foodsUpdated++;
        } else {
          const existingByClientKey = await client.query<{ id: string }>(
            "SELECT id FROM public.nutrition_foods WHERE metadata ->> 'client_key' = $1::text LIMIT 1",
            [clientKey],
          );
          if (existingByClientKey.rowCount && existingByClientKey.rows[0]) {
            foodMap.set(clientKey, existingByClientKey.rows[0].id);
            changes.foodsUpdated++;
            continue;
          }
          const result = await client.query<{ id: string }>(
            `
              INSERT INTO public.nutrition_foods (
                legacy_food_id, source_id, brand_id, source_external_id, food_kind, scope,
                canonical_name, display_name, normalized_name, locale, description,
                preparation_state, search_text, confidence_score, is_verified, is_visible,
                is_common, visibility_priority, metadata, verification_status,
                physical_state_id, preparation_method_id
              )
              VALUES (
                NULLIF($1::text, '')::integer, $2::uuid, $3::uuid, $4::text, $5::text, 'global',
                $6::text, $7::text, $8::text, COALESCE($9::text, 'es-MX'), $10::text,
                $11::text, concat_ws(' ', $6::text, $7::text, $8::text, $10::text), $12::numeric, $13::boolean, $14::boolean,
                $15::boolean, COALESCE($16::integer, 100), $17::jsonb, $18::text, $19::uuid, $20::uuid
              )
              RETURNING id
            `,
            [
              nullableRaw(row.legacy_food_id) ?? "",
              sourceId,
              brandId,
              nullableRaw(row.source_external_id),
              row.food_kind,
              nullableString(row.canonical_name),
              nullableString(row.display_name),
              nullableString(row.normalized_name),
              nullableRaw(row.locale),
              nullableString(row.description),
              nullableRaw(row.legacy_preparation_state),
              nullableNumber(row.confidence_score),
              verified,
              visible,
              boolValue(row.is_common),
              nullableNumber(row.visibility_priority),
              JSON.stringify(metadata),
              row.verification_status,
              stateId,
              methodId,
            ],
          );
          foodMap.set(clientKey, result.rows[0].id);
          changes.foodsInserted++;
        }

        await client.query(
          `
            INSERT INTO public.nutrition_import_entity_map (import_batch_id, entity_type, client_key, entity_id)
            VALUES ($1::uuid, 'food', $2::text, $3::uuid)
            ON CONFLICT (import_batch_id, entity_type, client_key) DO UPDATE SET entity_id = EXCLUDED.entity_id
          `,
          [batchId, clientKey, foodMap.get(clientKey)],
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`row=${row.rowNumber}, client_key=${clientKey}: ${message}`);
      }
    }
  });

  await stage("applyCatalog.applyCategories", () => applyCategories(client, batchId, rows, foodMap, changes));
  await stage("applyCatalog.applyAliases", () => applyAliases(client, rows, foodMap, changes));
  await stage("applyCatalog.applyServings", () => applyServings(client, batchId, rows, foodMap, changes));
  await stage("applyCatalog.applyFoodNutrients", () => applyFoodNutrients(client, batchId, rows, foodMap, sourceMap, changes));
  await stage("applyCatalog.applyCanonicalGroups", () => applyCanonicalGroups(client, batchId, rows, foodMap, stateMap, methodMap, changes));
  await stage("applyCatalog.applyPreparations", () => applyPreparations(client, rows, foodMap, changes));
  await stage("applyCatalog.applyRelationships", () => applyRelationships(client, batchId, rows, foodMap, changes));

  return changes;
}

async function upsertReferenceCatalog(client: pg.Client, reference: Record<string, unknown> | undefined, changes: Record<string, number>) {
  if (!reference) return;
  for (const source of Array.isArray(reference.sources) ? reference.sources as Record<string, unknown>[] : []) {
    const code = nullableRaw(source.code);
    if (!code) continue;
    await client.query(
      `
        INSERT INTO public.nutrition_sources (code, name, source_type, license, version, url, metadata)
        VALUES ($1::text, $2::text, COALESCE($3::text, 'catalog'), $4::text, $5::text, $6::text, COALESCE($7::jsonb, '{}'::jsonb))
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          source_type = EXCLUDED.source_type,
          license = EXCLUDED.license,
          version = EXCLUDED.version,
          url = EXCLUDED.url,
          metadata = public.nutrition_sources.metadata || EXCLUDED.metadata,
          updated_at = now()
      `,
      [code, nullableString(source.name) ?? code, nullableRaw(source.source_type), nullableRaw(source.license), nullableRaw(source.version), nullableRaw(source.url), JSON.stringify(source.metadata ?? {})],
    );
    changes.sources++;
  }
  for (const unit of Array.isArray(reference.units) ? reference.units as Record<string, unknown>[] : []) {
    const code = nullableRaw(unit.code);
    if (!code) continue;
    await client.query(
      `
        INSERT INTO public.nutrition_units (code, name, dimension, grams_multiplier, milliliters_multiplier, is_metric, metadata)
        VALUES ($1::text, $2::text, COALESCE($3::text, 'custom'), $4::numeric, $5::numeric, $6::boolean, COALESCE($7::jsonb, '{}'::jsonb))
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          dimension = EXCLUDED.dimension,
          grams_multiplier = EXCLUDED.grams_multiplier,
          milliliters_multiplier = EXCLUDED.milliliters_multiplier,
          is_metric = EXCLUDED.is_metric
      `,
      [code, nullableString(unit.name) ?? code, nullableRaw(unit.dimension), nullableNumber(unit.grams_multiplier), nullableNumber(unit.milliliters_multiplier), boolValue(unit.is_metric, true), JSON.stringify(unit.metadata ?? {})],
    );
    changes.units++;
  }
  for (const nutrient of Array.isArray(reference.nutrients) ? reference.nutrients as Record<string, unknown>[] : []) {
    const code = nullableRaw(nutrient.code);
    if (!code) continue;
    await client.query(
      `
        INSERT INTO public.nutrition_nutrients (code, name, unit, nutrient_group, display_order)
        VALUES ($1::text, $2::text, $3::text, COALESCE($4::text, 'other'), COALESCE($5::integer, 100))
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          unit = EXCLUDED.unit,
          nutrient_group = EXCLUDED.nutrient_group,
          display_order = EXCLUDED.display_order
      `,
      [code, nullableString(nutrient.name) ?? code, nullableRaw(nutrient.unit) ?? "g", nullableRaw(nutrient.nutrient_group), nullableNumber(nutrient.display_order)],
    );
    changes.nutrients++;
  }
}

async function normalizeDb(client: pg.Client, value: string) {
  const result = await client.query<{ value: string }>("SELECT public.nutrition_normalize_text($1::text) AS value", [value]);
  return result.rows[0].value;
}

async function applyCategories(client: pg.Client, batchId: string, rows: ParsedRow[], foodMap: Map<string, string>, changes: Record<string, number>) {
  const categoryMap = await getIdMap(client, "SELECT normalized_name || ':' || category_level || ':' || locale AS key, id FROM public.nutrition_categories");
  for (const row of rows) {
    const foodId = foodMap.get(String(row.client_key));
    if (!foodId) throw new Error(`Food not resolved for ${row.client_key}`);
    const categories = Array.isArray(row.parsedJson.categories_json) ? row.parsedJson.categories_json as Record<string, unknown>[] : [];
    await client.query("UPDATE public.nutrition_food_categories SET is_primary = false WHERE food_id = $1::uuid", [foodId]);
    let primaryAssigned = false;
    for (const category of categories) {
      const name = nullableString(category.category_name);
      const level = nullableRaw(category.category_level) ?? "category";
      const locale = nullableRaw(category.locale) ?? "es-MX";
      if (!name) continue;
      const normalized = await normalizeDb(client, name);
      const key = `${normalized}:${level}:${locale}`;
      let categoryId = categoryMap.get(key);
      if (!categoryId) {
        const result = await client.query<{ id: string }>(
          `
            INSERT INTO public.nutrition_categories (name, normalized_name, category_level, locale, metadata)
            VALUES ($1::text, $2::text, $3::text, $4::text, jsonb_build_object('import_batch_id', $5::text, 'client_key', $6::text))
            ON CONFLICT DO NOTHING
            RETURNING id
          `,
          [name, normalized, level, locale, batchId, nullableRaw(category.category_client_key)],
        );
        categoryId = result.rows[0]?.id;
        if (!categoryId) {
          const found = await client.query<{ id: string }>(
            "SELECT id FROM public.nutrition_categories WHERE normalized_name = $1::text AND category_level = $2::text AND locale = $3::text LIMIT 1",
            [normalized, level, locale],
          );
          categoryId = found.rows[0]?.id;
        }
        if (categoryId) categoryMap.set(key, categoryId);
        changes.categories++;
      }
      if (!categoryId) throw new Error(`Category not resolved: ${name}`);
      const isPrimary = boolValue(category.is_primary) || (!primaryAssigned && level === "category");
      await client.query(
        `
          INSERT INTO public.nutrition_food_categories (food_id, category_id, is_primary)
          VALUES ($1::uuid, $2::uuid, $3::boolean)
          ON CONFLICT (food_id, category_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
        `,
        [foodId, categoryId, isPrimary],
      );
      if (isPrimary) primaryAssigned = true;
    }
  }
}

async function applyAliases(client: pg.Client, rows: ParsedRow[], foodMap: Map<string, string>, changes: Record<string, number>) {
  for (const row of rows) {
    const foodId = foodMap.get(String(row.client_key));
    const aliases = Array.isArray(row.parsedJson.aliases_json) ? row.parsedJson.aliases_json as Record<string, unknown>[] : [];
    for (const alias of aliases) {
      const aliasText = nullableString(alias.alias);
      if (!foodId || !aliasText) continue;
      const normalized = nullableString(alias.normalized_alias) ?? await normalizeDb(client, aliasText);
      await client.query(
        `
          INSERT INTO public.nutrition_food_aliases (food_id, alias, normalized_alias, locale, source)
          VALUES ($1::uuid, $2::text, $3::text, COALESCE($4::text, 'es-MX'), COALESCE($5::text, 'catalog'))
          ON CONFLICT (food_id, normalized_alias, locale) DO UPDATE SET
            alias = EXCLUDED.alias,
            source = EXCLUDED.source
        `,
        [foodId, aliasText, normalized, nullableRaw(alias.locale), nullableRaw(alias.source)],
      );
      changes.aliases++;
    }
  }
}

async function applyServings(client: pg.Client, batchId: string, rows: ParsedRow[], foodMap: Map<string, string>, changes: Record<string, number>) {
  const unitMap = await getIdMap(client, "SELECT code AS key, id FROM public.nutrition_units");
  for (const row of rows) {
    const foodId = foodMap.get(String(row.client_key));
    const servings = Array.isArray(row.parsedJson.servings_json) ? row.parsedJson.servings_json as Record<string, unknown>[] : [];
    let defaultAssigned = false;
    for (const serving of servings) {
      const label = nullableString(serving.serving_label);
      const unitCode = nullableRaw(serving.unit_code);
      if (!foodId || !label || !unitCode) continue;
      const unitId = unitMap.get(unitCode);
      if (!unitId) throw new Error(`Unit not resolved: ${unitCode}`);
      const isDefault = boolValue(serving.is_default) && !defaultAssigned;
      if (isDefault) {
        await client.query("UPDATE public.nutrition_food_servings SET is_default = false WHERE food_id = $1::uuid", [foodId]);
        defaultAssigned = true;
      }
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM public.nutrition_food_servings WHERE food_id = $1::uuid AND lower(serving_label) = lower($2::text) LIMIT 1",
        [foodId, label],
      );
      const params = [
        foodId,
        unitId,
        label,
        nullableNumber(serving.quantity) ?? 1,
        nullableNumber(serving.grams),
        nullableNumber(serving.milliliters),
        isDefault,
        nullableRaw(serving.source) ?? "catalog",
        nullableNumber(serving.confidence_score),
        String(serving.verification_status ?? "unverified"),
        JSON.stringify({ import_batch_id: batchId, client_key: nullableRaw(serving.serving_client_key), source_code: nullableRaw(serving.source_code), source_external_id: nullableRaw(serving.source_external_id) }),
      ];
      if (existing.rowCount) {
        const updateParams = [
          unitId,
          label,
          nullableNumber(serving.quantity) ?? 1,
          nullableNumber(serving.grams),
          nullableNumber(serving.milliliters),
          isDefault,
          nullableRaw(serving.source) ?? "catalog",
          nullableNumber(serving.confidence_score),
          String(serving.verification_status ?? "unverified"),
          JSON.stringify({ import_batch_id: batchId, client_key: nullableRaw(serving.serving_client_key), source_code: nullableRaw(serving.source_code), source_external_id: nullableRaw(serving.source_external_id) }),
          existing.rows[0].id,
        ];
        await client.query(
          `
            UPDATE public.nutrition_food_servings
            SET unit_id = $1::uuid, serving_label = $2::text, quantity = $3::numeric, grams = $4::numeric, milliliters = $5::numeric,
                is_default = $6::boolean, source = $7::text, confidence_score = $8::numeric, verification_status = $9::text,
                metadata = COALESCE(metadata, '{}'::jsonb) || $10::jsonb, updated_at = now()
            WHERE id = $11::uuid
          `,
          updateParams,
        );
      } else {
        await client.query(
          `
            INSERT INTO public.nutrition_food_servings (
              food_id, unit_id, serving_label, quantity, grams, milliliters, is_default,
              source, confidence_score, verification_status, metadata
            )
            VALUES ($1::uuid,$2::uuid,$3::text,$4::numeric,$5::numeric,$6::numeric,$7::boolean,$8::text,$9::numeric,$10::text,$11::jsonb)
          `,
          params,
        );
      }
      changes.servings++;
    }
  }
}

async function applyFoodNutrients(client: pg.Client, batchId: string, rows: ParsedRow[], foodMap: Map<string, string>, sourceMap: Map<string, string>, changes: Record<string, number>) {
  const nutrientMap = await getIdMap(client, "SELECT code AS key, id FROM public.nutrition_nutrients");
  for (const row of rows) {
    const foodId = foodMap.get(String(row.client_key));
    const rawNutrients = Array.isArray(row.parsedJson.nutrients_json) ? row.parsedJson.nutrients_json as Record<string, unknown>[] : [];
    const nutrientByCode = new Map<string, Record<string, unknown>>();
    for (const nutrient of rawNutrients) {
      const code = nullableRaw(nutrient.nutrient_code);
      if (!code) continue;
      const previous = nutrientByCode.get(code);
      const status = nullableRaw(nutrient.verification_status);
      const previousStatus = previous ? nullableRaw(previous.verification_status) : null;
      if (!previous || (!activeStatus(previousStatus) && activeStatus(status))) {
        nutrientByCode.set(code, nutrient);
      }
    }
    const nutrients = [...nutrientByCode.values()].filter((nutrient) => activeStatus(nullableRaw(nutrient.verification_status)));
    for (const nutrient of nutrients) {
      const code = nullableRaw(nutrient.nutrient_code);
      if (!foodId || !code) continue;
      const nutrientId = nutrientMap.get(code);
      if (!nutrientId) throw new Error(`Nutrient not resolved: ${code}`);
      const sourceId = nullableRaw(nutrient.source_code) ? sourceMap.get(String(nutrient.source_code)) ?? null : null;
      const amount = nullableNumber(nutrient.amount ?? nutrient.amount_per_100g);
      if (amount === null) continue;
      await client.query(
        `
          INSERT INTO public.nutrition_food_nutrients (
            food_id, nutrient_id, source_id, amount_per_100g, is_verified, confidence_score, verification_status, metadata
          )
          VALUES ($1::uuid,$2::uuid,$3::uuid,$4::numeric,$5::boolean,$6::numeric,$7::text,$8::jsonb)
          ON CONFLICT (food_id, nutrient_id) DO UPDATE SET
            source_id = EXCLUDED.source_id,
            amount_per_100g = EXCLUDED.amount_per_100g,
            is_verified = EXCLUDED.is_verified,
            confidence_score = EXCLUDED.confidence_score,
            verification_status = EXCLUDED.verification_status,
            metadata = COALESCE(public.nutrition_food_nutrients.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            updated_at = now()
        `,
        [
          foodId,
          nutrientId,
          sourceId,
          amount,
          boolValue(nutrient.is_verified) || String(nutrient.verification_status) === "verified",
          nullableNumber(nutrient.confidence_score),
          String(nutrient.verification_status ?? "unverified"),
          JSON.stringify({ import_batch_id: batchId, client_key: nullableRaw(nutrient.food_nutrient_client_key), basis_amount: nullableNumber(nutrient.basis_amount), basis_unit: nullableRaw(nutrient.basis_unit) }),
        ],
      );
      changes.nutrientsApplied++;
    }
  }
}

async function applyCanonicalGroups(
  client: pg.Client,
  batchId: string,
  rows: ParsedRow[],
  foodMap: Map<string, string>,
  stateMap: Map<string, string>,
  methodMap: Map<string, string>,
  changes: Record<string, number>,
) {
  const groupMap = new Map<string, string>();

  // A canonical group can contain both active and deprecated variants. Upsert
  // the group once so a later deprecated duplicate cannot hide valid foods.
  const rowsByGroup = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const key = nullableRaw(row.canonical_group_client_key);
    const name = nullableString(row.canonical_group_name);
    if (!key || !name) continue;

    const groupRows = rowsByGroup.get(key) ?? [];
    groupRows.push(row);
    rowsByGroup.set(key, groupRows);
  }

  for (const [key, groupRows] of rowsByGroup) {
    const isEligibleVariant = (row: ParsedRow) =>
      boolValue(row.is_visible, true)
      && !["deprecated", "rejected"].includes(String(row.verification_status ?? "unverified"));
    const representative = groupRows.find(isEligibleVariant)
      ?? groupRows.find((row) => !["deprecated", "rejected"].includes(String(row.verification_status ?? "unverified")))
      ?? groupRows[0];
    const name = nullableString(representative.canonical_group_name);
    if (!name) continue;

    const groupStatus = groupRows.some(isEligibleVariant) ? "active" : "deprecated";
    const normalized = await normalizeDb(client, name);
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO public.nutrition_canonical_food_groups (client_key, canonical_name, normalized_name, description, locale, status, metadata)
        VALUES ($1::text, $2::text, $3::text, $4::text, COALESCE($5::text, 'es-MX'), $6::text, jsonb_build_object('import_batch_id', $7::text))
        ON CONFLICT (client_key) DO UPDATE SET
          canonical_name = EXCLUDED.canonical_name,
          normalized_name = EXCLUDED.normalized_name,
          description = EXCLUDED.description,
          locale = EXCLUDED.locale,
          status = EXCLUDED.status,
          metadata = COALESCE(public.nutrition_canonical_food_groups.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = now()
        RETURNING id
      `,
      [
        key,
        name,
        normalized,
        nullableString(representative.description),
        nullableRaw(representative.locale),
        groupStatus,
        batchId,
      ],
    );
    groupMap.set(key, result.rows[0].id);
    changes.canonicalGroups++;
  }

  for (const row of rows) {
    const groupKey = nullableRaw(row.canonical_group_client_key);
    const foodId = foodMap.get(String(row.client_key));
    const groupId = groupKey ? groupMap.get(groupKey) : null;
    if (!groupId || !foodId) continue;
    const stateId = nullableRaw(row.physical_state) ? stateMap.get(String(row.physical_state)) ?? null : null;
    const methodId = nullableRaw(row.preparation_method) ? methodMap.get(String(row.preparation_method)) ?? null : null;
    await client.query(
      `
        INSERT INTO public.nutrition_food_group_members (
          group_id, food_id, variant_type, display_order, is_default, is_ui_visible,
          physical_state_id, preparation_method_id, metadata
        )
        VALUES ($1::uuid,$2::uuid,$3::text,COALESCE($4::integer,100),$5::boolean,$6::boolean,$7::uuid,$8::uuid,jsonb_build_object('import_batch_id', $9::text, 'client_key', $10::text))
        ON CONFLICT (food_id) DO UPDATE SET
          group_id = EXCLUDED.group_id,
          variant_type = EXCLUDED.variant_type,
          display_order = EXCLUDED.display_order,
          is_default = EXCLUDED.is_default,
          is_ui_visible = EXCLUDED.is_ui_visible,
          physical_state_id = EXCLUDED.physical_state_id,
          preparation_method_id = EXCLUDED.preparation_method_id,
          metadata = COALESCE(public.nutrition_food_group_members.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = now()
      `,
      [
        groupId,
        foodId,
        row.variant_type,
        nullableNumber((row.parsedJson.canonical_group_json as Record<string, unknown> | null)?.group_member_record?.["sort_order"] ?? 100),
        boolValue((row.parsedJson.canonical_group_json as Record<string, unknown> | null)?.["is_default"], boolValue(row.is_visible, true)),
        boolValue(row.is_visible, true),
        stateId,
        methodId,
        batchId,
        nullableRaw((row.parsedJson.canonical_group_json as Record<string, unknown> | null)?.group_member_record?.["group_member_client_key"]),
      ],
    );
    if (boolValue((row.parsedJson.canonical_group_json as Record<string, unknown> | null)?.["is_default"])) {
      await client.query("UPDATE public.nutrition_canonical_food_groups SET default_food_id = $1::uuid WHERE id = $2::uuid", [foodId, groupId]);
    }
    changes.groupMembers++;
  }
}

async function applyPreparations(client: pg.Client, rows: ParsedRow[], foodMap: Map<string, string>, changes: Record<string, number>) {
  for (const row of rows) {
    const preparations = Array.isArray(row.parsedJson.preparations_json) ? row.parsedJson.preparations_json as Record<string, unknown>[] : [];
    for (const prep of preparations) {
      const baseKey = nullableRaw(prep.base_food_client_key);
      const preparedKey = nullableRaw(prep.prepared_food_client_key);
      const baseFoodId = baseKey ? foodMap.get(baseKey) ?? nullableRaw(prep.base_food_id) : nullableRaw(prep.base_food_id);
      const preparedFoodId = preparedKey ? foodMap.get(preparedKey) ?? nullableRaw(prep.prepared_food_id) : nullableRaw(prep.prepared_food_id);
      if (!baseFoodId || !preparedFoodId) throw new Error(`Preparation not resolvable: ${JSON.stringify({ baseKey, preparedKey })}`);
      await client.query(
        `
          INSERT INTO public.nutrition_food_preparations (base_food_id, prepared_food_id, preparation_state, yield_factor, notes)
          VALUES ($1::uuid,$2::uuid,COALESCE($3::text,'unknown'),$4::numeric,$5::text)
          ON CONFLICT (base_food_id, prepared_food_id, preparation_state) DO UPDATE SET
            yield_factor = EXCLUDED.yield_factor,
            notes = EXCLUDED.notes
        `,
        [baseFoodId, preparedFoodId, nullableRaw(prep.preparation_method) ?? nullableRaw(prep.physical_state) ?? "unknown", nullableNumber(prep.yield_factor), nullableString(prep.notes)],
      );
      changes.preparations++;
    }
  }
}

function relationshipEndpoint(row: Record<string, unknown>, key: "parent" | "child", foodMap: Map<string, string>) {
  const sourceKey = nullableRaw(row.source_food_client_key);
  const targetKey = nullableRaw(row.target_food_client_key);
  const sourceId = sourceKey ? foodMap.get(sourceKey) ?? nullableRaw(row.source_food_id) : nullableRaw(row.source_food_id);
  const targetId = targetKey ? foodMap.get(targetKey) ?? nullableRaw(row.target_food_id) : nullableRaw(row.target_food_id);
  const type = nullableRaw(row.relationship_type);
  const ofRelationship = type?.endsWith("_of");
  if (key === "parent") return ofRelationship ? targetId : sourceId;
  return ofRelationship ? sourceId : targetId;
}

async function applyRelationships(client: pg.Client, batchId: string, rows: ParsedRow[], foodMap: Map<string, string>, changes: Record<string, number>) {
  for (const row of rows) {
    const relationships = Array.isArray(row.parsedJson.food_relationships_json) ? row.parsedJson.food_relationships_json as Record<string, unknown>[] : [];
    for (const rel of relationships) {
      const parentFoodId = relationshipEndpoint(rel, "parent", foodMap);
      const childFoodId = relationshipEndpoint(rel, "child", foodMap);
      const type = nullableRaw(rel.relationship_type);
      if (!parentFoodId || !childFoodId || !type) throw new Error(`Relationship not resolvable: ${JSON.stringify(rel)}`);
      await client.query(
        `
          INSERT INTO public.nutrition_food_relationships (
            parent_food_id, child_food_id, relationship_type, display_order, is_default, is_ui_visible, notes, metadata
          )
          VALUES ($1::uuid,$2::uuid,$3::text,100,false,true,$4::text,jsonb_build_object('import_batch_id', $5::text, 'client_key', $6::text, 'confidence_score', $7::numeric, 'verification_status', $8::text))
          ON CONFLICT (parent_food_id, child_food_id, relationship_type) DO UPDATE SET
            notes = EXCLUDED.notes,
            metadata = COALESCE(public.nutrition_food_relationships.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            updated_at = now()
        `,
        [parentFoodId, childFoodId, type, nullableString(rel.notes), batchId, nullableRaw(rel.relationship_client_key), nullableNumber(rel.confidence_score), nullableRaw(rel.verification_status)],
      );
      changes.relationships++;
    }
  }
}

async function validateFinalState(client: pg.Client, expected: ImportSummary, batchId?: string) {
  const issues: ValidationIssue[] = [];
  const result = await client.query<{ severity: Severity; check_name: string; details: string }>(
    `
      WITH batch_foods AS (
        SELECT entity_id AS food_id
        FROM public.nutrition_import_entity_map
        WHERE ($1::uuid IS NULL OR import_batch_id = $1::uuid)
          AND entity_type = 'food'
      ),
      active_foods AS (
        SELECT f.*
        FROM public.nutrition_foods f
        WHERE f.id IN (SELECT food_id FROM batch_foods)
          AND f.is_visible IS TRUE
          AND f.verification_status NOT IN ('deprecated', 'rejected')
      )
      SELECT 'critical'::text AS severity, 'unresolved_food_client_keys' AS check_name, COUNT(*)::text AS details
      FROM public.nutrition_import_rows r
      LEFT JOIN public.nutrition_import_entity_map m
        ON m.import_batch_id = r.import_batch_id
       AND m.entity_type = 'food'
       AND m.client_key = r.client_key
      WHERE ($1::uuid IS NULL OR r.import_batch_id = $1::uuid)
        AND m.entity_id IS NULL
      HAVING COUNT(*) > 0

      UNION ALL
      SELECT 'critical', 'duplicate_active_normalized_foods', normalized_name || ':' || COUNT(*)
      FROM active_foods
      GROUP BY normalized_name
      HAVING COUNT(*) > 1

      UNION ALL
      SELECT 'critical', 'food_without_default_serving', COUNT(*)::text
      FROM active_foods f
      WHERE NOT EXISTS (
        SELECT 1 FROM public.nutrition_food_servings s
        WHERE s.food_id = f.id AND s.is_default IS TRUE
      )
      HAVING COUNT(*) > 0

      UNION ALL
      SELECT 'critical', 'food_without_primary_category', COUNT(*)::text
      FROM active_foods f
      WHERE NOT EXISTS (
        SELECT 1 FROM public.nutrition_food_categories c
        WHERE c.food_id = f.id AND c.is_primary IS TRUE
      )
      HAVING COUNT(*) > 0

      UNION ALL
      SELECT 'critical', 'duplicate_default_group_members', group_id || ':' || COUNT(*)
      FROM public.nutrition_food_group_members
      WHERE group_id IN (
        SELECT group_id FROM public.nutrition_food_group_members WHERE food_id IN (SELECT food_id FROM batch_foods)
      )
        AND is_default IS TRUE
      GROUP BY group_id
      HAVING COUNT(*) > 1

      UNION ALL
      SELECT 'critical', 'self_relationship', COUNT(*)::text
      FROM public.nutrition_food_relationships
      WHERE parent_food_id = child_food_id
      HAVING COUNT(*) > 0

      UNION ALL
      SELECT 'critical', 'negative_nutrient_amount', COUNT(*)::text
      FROM public.nutrition_food_nutrients
      WHERE food_id IN (SELECT food_id FROM batch_foods)
        AND amount_per_100g < 0
      HAVING COUNT(*) > 0

      UNION ALL
      SELECT 'critical', 'mojibake_in_imported_foods', COUNT(*)::text
      FROM public.nutrition_foods
      WHERE id IN (SELECT food_id FROM batch_foods)
        AND (display_name ~ 'Ãƒ|Ã‚|Ã¢â‚¬|Ã°Å¸|ï¿½' OR description ~ 'Ãƒ|Ã‚|Ã¢â‚¬|Ã°Å¸|ï¿½')
      HAVING COUNT(*) > 0

      UNION ALL
      SELECT 'info', 'imported_food_count', COUNT(*)::text
      FROM batch_foods

      UNION ALL
      SELECT 'info', 'catalog_food_count', COUNT(*)::text
      FROM public.nutrition_foods
    `,
    [batchId ?? null],
  );
  for (const row of result.rows) {
    issues.push({ severity: row.severity, check: row.check_name, details: row.details });
  }
  const imported = result.rows.find((row) => row.check_name === "imported_food_count");
  if (Number(imported?.details ?? 0) !== expected.rows) {
    issues.push({ severity: "critical", check: "final_imported_food_count", details: `expected=${expected.rows}, actual=${imported?.details ?? 0}` });
  }
  return issues;
}

async function rollbackBatch(client: pg.Client, batchId: string) {
  const changes: Record<string, number> = {};
  await client.query("BEGIN");
  try {
    const locked = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock(hashtext('nutrition_import_v2_1')) AS locked");
    if (!locked.rows[0]?.locked) throw new Error("Another nutrition import/rollback is running");

    const backups = await client.query<{ table_name: string; entity_id: string; before_row: Record<string, unknown> | null }>(
      "SELECT table_name, entity_id, before_row FROM public.nutrition_import_backups WHERE import_batch_id = $1::uuid ORDER BY created_at DESC",
      [batchId],
    );

    await client.query("DELETE FROM public.nutrition_food_relationships WHERE metadata ->> 'import_batch_id' = $1::text", [batchId]);
    await client.query("DELETE FROM public.nutrition_food_group_members WHERE metadata ->> 'import_batch_id' = $1::text", [batchId]);
    await client.query("DELETE FROM public.nutrition_canonical_food_groups WHERE metadata ->> 'import_batch_id' = $1::text", [batchId]);
    await client.query("DELETE FROM public.nutrition_foods WHERE metadata ->> 'import_batch_id' = $1::text AND legacy_food_id IS NULL", [batchId]);

    for (const backup of backups.rows) {
      if (!backup.before_row) continue;
      changes[backup.table_name] = (changes[backup.table_name] ?? 0) + 1;
      await restoreRow(client, backup.table_name, backup.before_row);
    }
    await client.query("UPDATE public.nutrition_import_batches SET status = 'rolled_back', finished_at = now() WHERE id = $1::uuid", [batchId]);
    await client.query("COMMIT");
    return changes;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function restoreRow(client: pg.Client, tableName: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  const values = columns.map((column) => row[column]);
  const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(", ");
  if ("id" in row) {
    await client.query(`UPDATE public.${tableName} SET ${assignments} WHERE id = $${columns.length + 1}`, [...values, row.id]);
  }
}

async function run() {
  loadLocalEnv();
  const mode = (argValue("--mode") ?? "dry-run") as Mode;
  const csvPath = argValue("--csv") ?? DEFAULT_CSV_PATH;
  const confirm = argValue("--confirm");
  const batchIdArg = argValue("--batch-id");
  if (!["dry-run", "apply", "rollback"].includes(mode)) throw new Error(`Invalid --mode ${mode}`);
  if (mode === "apply" && confirm !== "APPLY_NUTRITION_V2_1") throw new Error("Apply requires --confirm APPLY_NUTRITION_V2_1");
  if (mode === "rollback" && confirm !== "ROLLBACK_NUTRITION_V2_1") throw new Error("Rollback requires --confirm ROLLBACK_NUTRITION_V2_1");

  const { rows, summary, issues, utf8Samples } = readCsvStrict(csvPath);
  const report: ImportReport = {
    generatedAt: new Date().toISOString(),
    mode,
    decision: "dry_run_failed",
    summary,
    utf8Samples,
    issues,
  };

  const client = await connectDb();
  if (!client) {
    report.decision = mode === "dry-run" && !issues.some((issue) => issue.severity === "critical") ? "dry_run_passed" : "pending_credentials";
    report.issues.push({ severity: "warning", check: "database_url_missing", details: "DATABASE_URL/SUPABASE_DB_URL is not set; DB schema/apply validation was not executed" });
    writeReports(report);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  try {
    await ensureImportSchema(client);
    const db = await inspectDatabase(client, report.issues);
    report.db = db;

    if (mode === "rollback") {
      if (!batchIdArg) throw new Error("Rollback requires --batch-id");
      const changes = await rollbackBatch(client, batchIdArg);
      report.importBatchId = batchIdArg;
      report.changes = changes;
      report.decision = "rollback_committed";
      writeReports(report);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    await client.query("BEGIN");
    let batchId = "";
    try {
      const locked = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock(hashtext('nutrition_import_v2_1')) AS locked");
      if (!locked.rows[0]?.locked) throw new Error("Another nutrition import is running");
      batchId = await createBatch(client, mode, summary, report.issues);
      report.importBatchId = batchId;
      await loadStaging(client, batchId, rows, report.issues);

      if (report.issues.some((issue) => issue.severity === "critical")) {
        await client.query("UPDATE public.nutrition_import_batches SET status = 'failed', finished_at = now() WHERE id = $1::uuid", [batchId]);
        throw new Error("Critical validation errors found before apply");
      }

      if (mode === "dry-run") {
        await client.query("ROLLBACK");
        report.decision = "dry_run_passed";
        writeReports(report);
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      const changes = await applyCatalog(client, batchId, rows);
      report.changes = changes;
      const finalIssues = await validateFinalState(client, summary, batchId);
      report.issues.push(...finalIssues);
      if (report.issues.some((issue) => issue.severity === "critical")) {
        await client.query("UPDATE public.nutrition_import_batches SET status = 'failed', finished_at = now(), error_summary = $2::jsonb WHERE id = $1::uuid", [batchId, JSON.stringify(report.issues)]);
        throw new Error("Critical final validation errors found; rolling back");
      }
      await client.query("UPDATE public.nutrition_import_batches SET status = 'committed', finished_at = now(), summary = $2::jsonb WHERE id = $1::uuid", [batchId, JSON.stringify({ ...summary, changes })]);
      await client.query("COMMIT");
      report.decision = "apply_committed";
    } catch (error) {
      await client.query("ROLLBACK");
      report.decision = mode === "apply" ? "apply_rolled_back" : "dry_run_failed";
      report.issues.push({ severity: "critical", check: "transaction_error", details: (error as Error).message });
    }

    writeReports(report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  const report: ImportReport = {
    generatedAt: new Date().toISOString(),
    mode: ((argValue("--mode") ?? "dry-run") as Mode),
    decision: "dry_run_failed",
    summary: {
      csvPath: argValue("--csv") ?? DEFAULT_CSV_PATH,
      fileSha256: "",
      bytes: 0,
      rows: 0,
      headers: 0,
      existingFoodIds: 0,
      newFoods: 0,
      clientKeys: 0,
      servings: 0,
      nutrients: 0,
      canonicalGroups: 0,
      relationships: 0,
      preparations: 0,
      deprecatedFoods: 0,
      referenceCatalogRows: 0,
      uniqueReferenceCatalogs: 0,
    },
    utf8Samples: [],
    issues: [{ severity: "critical", check: "fatal_error", details: (error as Error).message }],
  };
  writeReports(report);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});
