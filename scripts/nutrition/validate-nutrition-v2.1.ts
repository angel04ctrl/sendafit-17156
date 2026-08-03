/**
 * Runs the post-import validation SQL for Nutrition v2.1.
 *
 * Required env:
 *   DATABASE_URL
 *
 * Usage:
 *   npx tsx scripts/nutrition/validate-nutrition-v2.1.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or SUPABASE_DB_URL is required");
  }

  const sql = readFileSync(resolve(process.cwd(), "docs/nutrition-import-v2.1/post-import-validation.sql"), "utf8");
  const client = new Client({ connectionString, statement_timeout: 120000 });
  await client.connect();
  try {
    await client.query("SET client_encoding TO 'UTF8'");
    const result = await client.query(sql);
    console.table(result.rows);
    const critical = result.rows.filter((row) => row.severity === "critical");
    if (critical.length > 0) {
      process.exitCode = 1;
      console.error(`Validation failed: ${critical.length} critical rows`);
    } else {
      console.log("Validation passed: 0 critical rows");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
