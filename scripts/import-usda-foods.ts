/**
 * Sprint 5.1 USDA FoodData Central importer.
 *
 * Required env:
 * - FDC_API_KEY
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run with a TS runner such as:
 *   npx tsx scripts/import-usda-foods.ts
 *
 * This script imports a controlled beta list. It does not use SMAE data and
 * does not invent nutrition values.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type FdcNutrient = {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
};

type FdcFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  foodCategory?: string;
  foodNutrients?: FdcNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
  publishedDate?: string;
};

type ImportCandidate = {
  query: string;
  name: string;
  category: string;
  aliases?: string[];
  preparationState?: string;
  priority?: number;
};

let nextFoodId: number | null = null;

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

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const FDC_API_KEY = process.env.FDC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const candidates: ImportCandidate[] = [
  { query: "chicken breast cooked roasted", name: "Pechuga de pollo cocida", category: "Proteinas", aliases: ["pollo cocido", "pechuga cocida"] },
  { query: "chicken thigh meat cooked", name: "Muslo de pollo cocido", category: "Proteinas" },
  { query: "ground beef 90% lean cooked", name: "Carne molida de res magra cocida", category: "Proteinas" },
  { query: "beef steak cooked lean", name: "Bistec de res cocido", category: "Proteinas" },
  { query: "pork lean cooked", name: "Carne de cerdo magra cocida", category: "Proteinas" },
  { query: "tuna canned in water", name: "Atun en agua", category: "Proteinas" },
  { query: "salmon cooked dry heat", name: "Salmon cocido", category: "Proteinas" },
  { query: "tilapia cooked dry heat", name: "Tilapia cocida", category: "Proteinas" },
  { query: "shrimp cooked moist heat", name: "Camaron cocido", category: "Proteinas" },
  { query: "egg whole raw fresh", name: "Huevo entero", category: "Proteinas" },
  { query: "egg white raw fresh", name: "Clara de huevo", category: "Proteinas" },
  { query: "turkey breast meat cooked", name: "Pechuga de pavo cocida", category: "Proteinas" },
  { query: "tofu firm raw", name: "Tofu firme", category: "Proteinas" },
  { query: "rice white cooked", name: "Arroz blanco cocido", category: "Carbohidratos" },
  { query: "rice brown cooked", name: "Arroz integral cocido", category: "Carbohidratos" },
  { query: "oats rolled raw", name: "Avena", category: "Carbohidratos" },
  { query: "pasta cooked enriched", name: "Pasta cocida", category: "Carbohidratos" },
  { query: "potato boiled cooked flesh", name: "Papa cocida", category: "Carbohidratos" },
  { query: "sweet potato cooked baked", name: "Camote cocido", category: "Carbohidratos" },
  { query: "bread whole wheat", name: "Pan integral", category: "Carbohidratos" },
  { query: "bread white commercially prepared", name: "Pan blanco", category: "Carbohidratos" },
  { query: "tortilla corn", name: "Tortilla de maiz", category: "Carbohidratos" },
  { query: "tortilla flour", name: "Tortilla de harina", category: "Carbohidratos" },
  { query: "granola homemade", name: "Granola simple", category: "Carbohidratos" },
  { query: "beans black cooked boiled", name: "Frijol negro cocido", category: "Leguminosas" },
  { query: "beans pinto cooked boiled", name: "Frijol pinto cocido", category: "Leguminosas" },
  { query: "lentils cooked boiled", name: "Lentejas cocidas", category: "Leguminosas" },
  { query: "chickpeas cooked boiled", name: "Garbanzo cocido", category: "Leguminosas" },
  { query: "soybeans mature cooked boiled", name: "Soya cocida", category: "Leguminosas" },
  { query: "milk whole", name: "Leche entera", category: "Lacteos" },
  { query: "milk reduced fat 2%", name: "Leche semidescremada", category: "Lacteos" },
  { query: "milk nonfat", name: "Leche descremada", category: "Lacteos" },
  { query: "yogurt plain whole milk", name: "Yogur natural", category: "Lacteos" },
  { query: "greek yogurt plain nonfat", name: "Yogur griego natural", category: "Lacteos" },
  { query: "cottage cheese lowfat", name: "Queso cottage", category: "Lacteos" },
  { query: "banana raw", name: "Platano", category: "Frutas" },
  { query: "apple raw with skin", name: "Manzana", category: "Frutas" },
  { query: "orange raw", name: "Naranja", category: "Frutas" },
  { query: "mango raw", name: "Mango", category: "Frutas" },
  { query: "papaya raw", name: "Papaya", category: "Frutas" },
  { query: "watermelon raw", name: "Sandia", category: "Frutas" },
  { query: "cantaloupe raw", name: "Melon", category: "Frutas" },
  { query: "strawberries raw", name: "Fresas", category: "Frutas" },
  { query: "blueberries raw", name: "Arándanos", category: "Frutas", aliases: ["blueberries", "arandanos"] },
  { query: "grapes raw", name: "Uvas", category: "Frutas" },
  { query: "pineapple raw", name: "Pina", category: "Frutas" },
  { query: "avocado raw all commercial varieties", name: "Aguacate", category: "Frutas" },
  { query: "broccoli cooked boiled drained", name: "Brocoli cocido", category: "Verduras" },
  { query: "carrots raw", name: "Zanahoria", category: "Verduras" },
  { query: "lettuce raw green leaf", name: "Lechuga", category: "Verduras" },
  { query: "spinach raw", name: "Espinaca", category: "Verduras" },
  { query: "tomatoes red ripe raw", name: "Jitomate", category: "Verduras", aliases: ["tomate"] },
  { query: "onions raw", name: "Cebolla", category: "Verduras" },
  { query: "cucumber raw with peel", name: "Pepino", category: "Verduras" },
  { query: "squash zucchini raw", name: "Calabacita", category: "Verduras" },
  { query: "chayote fruit raw", name: "Chayote", category: "Verduras" },
  { query: "nopales raw", name: "Nopales", category: "Verduras" },
  { query: "corn sweet yellow cooked", name: "Elote", category: "Verduras" },
  { query: "mushrooms white raw", name: "Champinones", category: "Verduras" },
  { query: "olive oil", name: "Aceite de oliva", category: "Grasas" },
  { query: "vegetable oil soybean", name: "Aceite vegetal", category: "Grasas" },
  { query: "butter salted", name: "Mantequilla", category: "Grasas" },
  { query: "peanut butter smooth", name: "Crema de cacahuate", category: "Grasas" },
  { query: "almonds", name: "Almendras", category: "Grasas" },
  { query: "walnuts english", name: "Nueces", category: "Grasas" },
  { query: "peanuts raw", name: "Cacahuates", category: "Grasas" },
  { query: "chia seeds dried", name: "Semillas de chia", category: "Grasas" },
  { query: "sugar granulated", name: "Azucar", category: "Basicos" },
  { query: "honey", name: "Miel", category: "Basicos" },
  { query: "mayonnaise regular", name: "Mayonesa", category: "Basicos" },
  { query: "catsup", name: "Catsup", category: "Basicos" },
  { query: "salt table", name: "Sal", category: "Basicos" },
];

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasRawMeatTerms(value: string): boolean {
  const text = normalizeSearchText(value);
  return [
    "raw chicken",
    "chicken raw",
    "raw beef",
    "beef raw",
    "raw turkey",
    "turkey raw",
    "raw pork",
    "pork raw",
    "ground beef raw",
    "raw meat",
    "uncooked meat",
  ].some((term) => text.includes(term));
}

function nutrient(food: FdcFood, names: string[]): number {
  const found = food.foodNutrients?.find((item) => {
    const nutrientName = item.nutrientName?.toLowerCase() || "";
    const unitName = item.unitName?.toLowerCase() || "";
    const nameMatches = names.some((name) => nutrientName.includes(name.toLowerCase()));
    const isEnergy = names.some((name) => name.toLowerCase() === "energy");
    return nameMatches && (!isEnergy || unitName === "kcal");
  });
  return Number.isFinite(found?.value) ? Number(found?.value) : 0;
}

async function searchFood(candidate: ImportCandidate): Promise<FdcFood | null> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", requireEnv("FDC_API_KEY", FDC_API_KEY));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: candidate.query,
      pageSize: 10,
      pageNumber: 1,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
    }),
  });

  if (!response.ok) {
    throw new Error(`FDC search failed for ${candidate.query}: ${response.status} ${await response.text()}`);
  }

  const body = await response.json() as { foods?: FdcFood[] };
  const foods = body.foods || [];
  const usableFoods = foods.filter((food) => !hasRawMeatTerms(food.description || ""));
  return usableFoods.find((food) => food.fdcId && food.foodNutrients?.length && nutrient(food, ["Energy"]) > 0) ||
    usableFoods.find((food) => food.fdcId && food.foodNutrients?.length) ||
    null;
}

async function assertSupabaseSchema() {
  const supabaseUrl = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/foods?select=id,fdc_id,source,calories_per_100g,protein_per_100g&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Supabase foods schema check failed: ${response.status} ${await response.text()}. ` +
      "Apply supabase/migrations/20260629000000_sprint5_1_foods_usda_metadata.sql before importing.",
    );
  }
}

async function getNextFoodId(): Promise<number> {
  if (nextFoodId !== null) {
    const id = nextFoodId;
    nextFoodId += 1;
    return id;
  }

  const supabaseUrl = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/foods?select=id&order=id.desc&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase max id lookup failed: ${response.status} ${await response.text()}`);
  }

  const rows = await response.json() as Array<{ id: number }>;
  nextFoodId = (rows[0]?.id || 0) + 1;
  const id = nextFoodId;
  nextFoodId += 1;
  return id;
}

async function upsertFood(candidate: ImportCandidate, food: FdcFood) {
  const calories = nutrient(food, ["Energy"]);
  const protein = nutrient(food, ["Protein"]);
  const carbs = nutrient(food, ["Carbohydrate"]);
  const fat = nutrient(food, ["Total lipid", "fat"]);
  const fiber = nutrient(food, ["Fiber"]);
  const sugar = nutrient(food, ["Sugars"]);
  const sodium = nutrient(food, ["Sodium"]);

  const row = {
    nombre: candidate.name,
    name: candidate.name,
    display_name: candidate.name,
    normalized_name: candidate.name.toLowerCase(),
    search_name: normalizeSearchText([candidate.name, candidate.query, ...(candidate.aliases || [])].join(" ")),
    category: candidate.category,
    group_name: food.foodCategory || candidate.category,
    description: food.description,
    preparation_state: candidate.preparationState || (normalizeSearchText(candidate.name).includes("cocid") ? "cooked" : "ready_to_eat"),
    source: "USDA_FDC",
    source_license: "CC0_1_0",
    source_version: food.publishedDate || new Date().toISOString().slice(0, 10),
    source_url: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}/nutrients`,
    fdc_id: food.fdcId,
    data_type: food.dataType,
    racion: 100,
    unidad: "g",
    calorias: Math.round(calories),
    proteinas: Math.round(protein * 10) / 10,
    carbohidratos: Math.round(carbs * 10) / 10,
    grasas: Math.round(fat * 10) / 10,
    serving_size: 100,
    serving_unit: "g",
    grams_per_serving: 100,
    calories_per_100g: calories,
    protein_per_100g: protein,
    carbs_per_100g: carbs,
    fat_per_100g: fat,
    fiber_per_100g: fiber,
    sugar_per_100g: sugar,
    sodium_mg_per_100g: sodium,
    is_verified: true,
    is_visible: !hasRawMeatTerms(food.description || candidate.query),
    is_common: true,
    visibility_priority: candidate.priority || 20,
    locale: "es-MX",
    aliases: candidate.aliases || [],
    updated_at: new Date().toISOString(),
  };

  const supabaseUrl = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/foods?or=(fdc_id.eq.${food.fdcId},normalized_name.eq.${encodeURIComponent(candidate.name.toLowerCase())},nombre.eq.${encodeURIComponent(candidate.name)})&select=id&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!existingResponse.ok) {
    throw new Error(`Supabase lookup failed for ${candidate.name}: ${existingResponse.status} ${await existingResponse.text()}`);
  }

  const existingRows = await existingResponse.json() as Array<{ id: number }>;
  const existingId = existingRows[0]?.id;
  const requestBody = existingId ? row : { id: await getNextFoodId(), ...row };
  const url = existingId
    ? `${supabaseUrl}/rest/v1/foods?id=eq.${existingId}`
    : `${supabaseUrl}/rest/v1/foods`;

  const response = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Supabase ${existingId ? "update" : "insert"} failed for ${candidate.name}: ${response.status} ${await response.text()}`);
  }
}

async function main() {
  requireEnv("FDC_API_KEY", FDC_API_KEY);
  requireEnv("SUPABASE_URL", SUPABASE_URL);
  requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  await assertSupabaseSchema();

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      const food = await searchFood(candidate);
      if (!food) {
        skipped += 1;
        console.warn(`No USDA result: ${candidate.name}`);
        continue;
      }
      await upsertFood(candidate, food);
      imported += 1;
      console.log(`Imported ${candidate.name} from FDC ${food.fdcId}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed ${candidate.name}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Done. Imported ${imported}/${candidates.length} foods. Skipped ${skipped}. Failed ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
