/**
 * Sprint 5.2 food cleanup.
 *
 * Usage:
 *   npx tsx scripts/cleanup-foods.ts --dry-run
 *   npx tsx scripts/cleanup-foods.ts --apply
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type FoodRow = {
  id: number;
  nombre: string;
  name?: string | null;
  display_name?: string | null;
  description?: string | null;
  source?: string | null;
  fdc_id?: number | null;
  aliases?: string[] | null;
};

const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function fixMojibake(value: string): string {
  return value
    .replace(/ÃƒÆ’Ã‚Â¡|ÃƒÂ¡|Ã¡/g, "á")
    .replace(/ÃƒÆ’Ã‚Â©|ÃƒÂ©|Ã©/g, "é")
    .replace(/ÃƒÆ’Ã‚Â­|ÃƒÂ­|Ã­/g, "í")
    .replace(/ÃƒÆ’Ã‚Â³|ÃƒÂ³|Ã³/g, "ó")
    .replace(/ÃƒÆ’Ã‚Âº|ÃƒÂº|Ãº/g, "ú")
    .replace(/ÃƒÆ’Ã‚Â±|ÃƒÂ±|Ã±/g, "ñ")
    .replace(/ÃƒÆ’Ã‚Â|ÃƒÂ|Ã/g, "Á")
    .replace(/ÃƒÆ’Ã‚Â‰|ÃƒÂ‰|Ã‰/g, "É")
    .replace(/ÃƒÆ’Ã‚Â|ÃƒÂ|Ã/g, "Í")
    .replace(/ÃƒÆ’Ã‚Â“|ÃƒÂ“|Ã“/g, "Ó")
    .replace(/ÃƒÆ’Ã‚Âš|ÃƒÂš|Ãš/g, "Ú")
    .replace(/ÃƒÆ’Ã‚Â‘|ÃƒÂ‘|Ã‘/g, "Ñ")
    .replace(/Ãƒâ€š|Ã‚/g, "")
    .replace(/Ã¯Â¿Â½|ï¿½/g, "")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”")
    .replace(/â€˜/g, "‘")
    .replace(/â€™/g, "’")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€¦/g, "…")
    .normalize("NFC");
}

function normalizeSearchText(value: string): string {
  return fixMojibake(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasRawHiddenTerms(food: FoodRow): boolean {
  const text = normalizeSearchText([
    food.nombre,
    food.name || "",
    food.display_name || "",
    food.description || "",
  ].join(" "));

  return [
    "chicken raw",
    "raw chicken",
    "beef raw",
    "raw beef",
    "turkey raw",
    "raw turkey",
    "pork raw",
    "raw pork",
    "ground beef raw",
    "pechuga de pollo cruda",
    "pollo crudo",
    "carne cruda",
    "pavo crudo",
    "cerdo crudo",
    "arroz crudo",
    "pasta seca",
    "papa cruda",
  ].some((term) => text.includes(term));
}

const friendlyNames: Record<string, { displayName: string; aliases: string[]; priority: number }> = {
  "pechuga de pollo cocida": { displayName: "Pechuga de pollo cocida", aliases: ["pollo", "pechuga", "chicken breast"], priority: 1 },
  "muslo de pollo cocido": { displayName: "Muslo de pollo cocido", aliases: ["pollo", "muslo"], priority: 12 },
  "carne molida de res magra cocida": { displayName: "Carne molida cocida", aliases: ["res", "carne molida", "ground beef"], priority: 10 },
  "bistec de res cocido": { displayName: "Bistec asado", aliases: ["res", "bistec", "steak"], priority: 11 },
  "pechuga de pavo cocida": { displayName: "Pavo cocido", aliases: ["pavo", "turkey"], priority: 20 },
  "arroz blanco cocido": { displayName: "Arroz blanco cocido", aliases: ["arroz", "rice"], priority: 2 },
  "arroz integral cocido": { displayName: "Arroz integral cocido", aliases: ["arroz integral", "brown rice"], priority: 5 },
  "frijol negro cocido": { displayName: "Frijoles negros cocidos", aliases: ["frijoles", "frijol negro", "beans"], priority: 6 },
  "frijol pinto cocido": { displayName: "Frijoles pintos cocidos", aliases: ["frijoles", "pinto beans"], priority: 7 },
  "huevo entero": { displayName: "Huevo entero", aliases: ["huevo", "egg"], priority: 8 },
  "platano": { displayName: "Plátano", aliases: ["banana"], priority: 20 },
  "pina": { displayName: "Piña", aliases: ["pineapple"], priority: 30 },
  "brocoli cocido": { displayName: "Brócoli cocido", aliases: ["brocoli", "broccoli"], priority: 30 },
  "atun en agua": { displayName: "Atún en agua", aliases: ["atun", "tuna"], priority: 9 },
  "semillas de chia": { displayName: "Semillas de chía", aliases: ["chia"], priority: 35 },
  "azucar": { displayName: "Azúcar", aliases: ["sugar"], priority: 50 },
};

loadLocalEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseFetch(path: string, init?: RequestInit) {
  const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE);
  const url = `${requireEnv("SUPABASE_URL", SUPABASE_URL)}/rest/v1/${path}`;

  return fetch(url, {
    ...init,
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(init?.headers || {}),
    },
  });
}

async function main() {
  const response = await supabaseFetch("foods?select=id,nombre,name,display_name,description,source,fdc_id,aliases&order=id.asc", {
    headers: { Prefer: "" },
  });
  if (!response.ok) throw new Error(`Could not load foods: ${response.status} ${await response.text()}`);

  const foods = await response.json() as FoodRow[];
  let corrected = 0;
  let hidden = 0;
  let common = 0;
  let review = 0;

  for (const food of foods) {
    const fixedNombre = fixMojibake(food.nombre);
    const fixedName = food.name ? fixMojibake(food.name) : null;
    const fixedDisplayName = food.display_name ? fixMojibake(food.display_name) : null;
    const fixedDescription = food.description ? fixMojibake(food.description) : null;
    const baseName = fixedDisplayName || fixedName || fixedNombre;
    const key = normalizeSearchText(baseName);
    const mapping = friendlyNames[key];
    const isHidden = hasRawHiddenTerms(food);
    const displayName = mapping?.displayName || baseName.replace(/\s+crudos?$/i, "").replace(/\s+crudas?$/i, "");
    const aliases = Array.from(new Set([...(food.aliases || []), ...(mapping?.aliases || [])]));
    const patch: Record<string, unknown> = {
      nombre: fixedNombre,
      name: fixedName || fixedNombre,
      display_name: displayName,
      search_name: normalizeSearchText([displayName, fixedName || "", fixedNombre, ...aliases].join(" ")),
      aliases,
      is_visible: !isHidden,
      is_common: Boolean(mapping && !isHidden),
      visibility_priority: isHidden ? 999 : mapping?.priority || 100,
      preparation_state: isHidden ? "raw_hidden" : undefined,
      updated_at: new Date().toISOString(),
    };

    if (fixedDescription !== null) patch.description = fixedDescription;

    if (isHidden) hidden += 1;
    if (mapping && !isHidden) common += 1;
    if (
      fixedNombre !== food.nombre ||
      fixedName !== (food.name || null) ||
      fixedDisplayName !== (food.display_name || null) ||
      fixedDescription !== (food.description || null) ||
      displayName !== (food.display_name || food.nombre)
    ) corrected += 1;
    if (!mapping && !isHidden && ((fixedName || fixedDescription || "").length > 80)) review += 1;

    if (apply) {
      const update = await supabaseFetch(`foods?id=eq.${food.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (!update.ok) throw new Error(`Could not update food ${food.id}: ${update.status} ${await update.text()}`);
    }
  }

  console.log(`${dryRun ? "Dry run" : "Applied"} food cleanup`);
  console.log(`Reviewed: ${foods.length}`);
  console.log(`Corrected display/search names: ${corrected}`);
  console.log(`Hidden from normal search: ${hidden}`);
  console.log(`Marked common: ${common}`);
  console.log(`Needs manual review: ${review}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
