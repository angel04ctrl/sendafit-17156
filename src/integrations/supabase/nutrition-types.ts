import type { Json } from "./types";

export type NutritionVerificationStatus =
  | "unverified"
  | "needs_review"
  | "partially_verified"
  | "verified"
  | "rejected"
  | "deprecated";

export type NutritionMealType = "desayuno" | "colacion_am" | "comida" | "colacion_pm" | "cena";

export interface NutritionFoodRow {
  id: string;
  legacy_food_id: number | null;
  owner_user_id: string | null;
  source_id: string | null;
  brand_id: string | null;
  source_external_id: string | null;
  food_kind: string;
  scope: "global" | "user";
  canonical_name: string;
  display_name: string;
  normalized_name: string;
  locale: string;
  description: string | null;
  preparation_state: string | null;
  search_text: string | null;
  confidence_score: number | null;
  is_verified: boolean;
  is_visible: boolean;
  is_common: boolean;
  visibility_priority: number;
  verification_status: NutritionVerificationStatus;
  physical_state_id: string | null;
  preparation_method_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type NutritionFoodInsert = Omit<
  NutritionFoodRow,
  "id" | "legacy_food_id" | "created_at" | "updated_at"
> & {
  id?: string;
  legacy_food_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type NutritionFoodUpdate = Partial<NutritionFoodInsert>;

export interface NutritionCanonicalGroupRow {
  id: string;
  client_key: string | null;
  canonical_name: string;
  normalized_name: string;
  description: string | null;
  locale: string;
  default_food_id: string | null;
  status: "active" | "needs_review" | "deprecated";
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type NutritionCanonicalGroupInsert = Omit<NutritionCanonicalGroupRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type NutritionCanonicalGroupUpdate = Partial<NutritionCanonicalGroupInsert>;

export interface NutritionFoodGroupMemberRow {
  id: string;
  group_id: string;
  food_id: string;
  variant_type: string;
  display_order: number;
  is_default: boolean;
  is_ui_visible: boolean;
  physical_state_id: string | null;
  preparation_method_id: string | null;
  notes: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type NutritionFoodGroupMemberInsert = Omit<NutritionFoodGroupMemberRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type NutritionFoodGroupMemberUpdate = Partial<NutritionFoodGroupMemberInsert>;

export interface NutritionServingRow {
  id: string;
  food_id: string;
  unit_id: string;
  serving_label: string;
  quantity: number;
  grams: number | null;
  milliliters: number | null;
  is_default: boolean;
  source: string;
  confidence_score: number | null;
  verification_status: NutritionVerificationStatus;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type NutritionServingInsert = Omit<NutritionServingRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type NutritionServingUpdate = Partial<NutritionServingInsert>;

export interface NutritionFoodNutrientRow {
  id: string;
  food_id: string;
  nutrient_id: string;
  source_id: string | null;
  amount_per_100g: number;
  is_verified: boolean;
  confidence_score: number | null;
  verification_status: NutritionVerificationStatus;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type NutritionFoodNutrientInsert = Omit<NutritionFoodNutrientRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type NutritionFoodNutrientUpdate = Partial<NutritionFoodNutrientInsert>;

export interface NutritionMealLogRow {
  id: string;
  legacy_meal_id: string | null;
  user_id: string;
  ai_analysis_id: string | null;
  meal_type: NutritionMealType;
  name: string;
  logged_date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium_mg: number | null;
  source: string;
  client_request_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type NutritionMealLogInsert = Omit<NutritionMealLogRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type NutritionMealLogUpdate = Partial<NutritionMealLogInsert>;

export interface NutritionMealLogItemRow {
  id: string;
  legacy_meal_ingredient_id: string | null;
  meal_log_id: string;
  food_id: string | null;
  recipe_id: string | null;
  serving_id: string | null;
  unit_id: string | null;
  canonical_group_id: string | null;
  item_name: string;
  quantity: number;
  unit_label: string | null;
  grams: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium_mg: number | null;
  source: string;
  is_verified: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type NutritionMealLogItemInsert = Omit<NutritionMealLogItemRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type NutritionMealLogItemUpdate = Partial<NutritionMealLogItemInsert>;

export interface NutritionCatalogSearchRow {
  canonical_group_id: string;
  canonical_name: string;
  group_description: string | null;
  default_food_id: string;
  default_food_name: string;
  food_kind: string;
  variant_count: number;
  category_name: string | null;
  brand_name: string | null;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  default_serving_id: string | null;
  default_serving_label: string | null;
  default_serving_quantity: number | null;
  default_serving_grams: number | null;
  default_serving_milliliters: number | null;
  verification_status: NutritionVerificationStatus;
  is_common: boolean;
  total_count: number;
}

export interface NutritionRpcDefinitions {
  search_nutrition_catalog: {
    Args: { _query?: string | null; _limit?: number; _offset?: number };
    Returns: NutritionCatalogSearchRow[];
  };
  get_nutrition_catalog_group: {
    Args: { _canonical_group_id: string };
    Returns: Json;
  };
  register_nutrition_food_meal: {
    Args: {
      _canonical_group_id: string;
      _food_id: string;
      _serving_id: string;
      _quantity: number;
      _meal_type: NutritionMealType;
      _logged_date: string;
      _client_request_id: string;
    };
    Returns: Json;
  };
  get_nutrition_meal_log: {
    Args: { _nutrition_meal_log_id: string };
    Returns: Json;
  };
}

export interface NutritionTableRelations {
  nutrition_foods: {
    brand_id: "nutrition_brands.id";
    source_id: "nutrition_sources.id";
    physical_state_id: "nutrition_physical_states.id";
    preparation_method_id: "nutrition_preparation_methods.id";
  };
  nutrition_food_group_members: {
    group_id: "nutrition_canonical_food_groups.id";
    food_id: "nutrition_foods.id";
  };
  nutrition_food_servings: {
    food_id: "nutrition_foods.id";
    unit_id: "nutrition_units.id";
  };
  nutrition_food_nutrients: {
    food_id: "nutrition_foods.id";
    nutrient_id: "nutrition_nutrients.id";
  };
  nutrition_meal_log_items: {
    meal_log_id: "nutrition_meal_logs.id";
    food_id: "nutrition_foods.id";
    serving_id: "nutrition_food_servings.id";
    canonical_group_id: "nutrition_canonical_food_groups.id";
  };
}
