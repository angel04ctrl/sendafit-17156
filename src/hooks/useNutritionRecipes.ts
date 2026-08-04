import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useNutritionCatalog";
import {
  archiveNutritionRecipe,
  duplicateNutritionRecipe,
  getNutritionRecipe,
  registerNutritionRecipe,
  saveNutritionRecipe,
  searchNutritionRecipes,
} from "@/services/nutritionRecipes";

const RECIPE_PAGE_SIZE = 20;

export function useNutritionRecipes(query: string, enabled = true) {
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const recipeQuery = useInfiniteQuery({
    queryKey: ["nutrition-recipes", debouncedQuery],
    queryFn: ({ pageParam }) => searchNutritionRecipes({
      query: debouncedQuery,
      offset: pageParam,
      pageSize: RECIPE_PAGE_SIZE,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });
  return { ...recipeQuery, debouncedQuery };
}

export function useNutritionRecipe(recipeId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["nutrition-recipe", recipeId],
    queryFn: () => getNutritionRecipe(recipeId!),
    enabled: enabled && Boolean(recipeId),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

function useRecipeInvalidation() {
  const queryClient = useQueryClient();
  return async (recipeId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["nutrition-recipes"] });
    if (recipeId) await queryClient.invalidateQueries({ queryKey: ["nutrition-recipe", recipeId] });
  };
}

export function useSaveNutritionRecipe() {
  const invalidate = useRecipeInvalidation();
  return useMutation({
    mutationFn: saveNutritionRecipe,
    onSuccess: (result) => invalidate(result.recipeId),
  });
}

export function useDuplicateNutritionRecipe() {
  const invalidate = useRecipeInvalidation();
  return useMutation({
    mutationFn: duplicateNutritionRecipe,
    onSuccess: (result) => invalidate(result.recipeId),
  });
}

export function useArchiveNutritionRecipe() {
  const invalidate = useRecipeInvalidation();
  return useMutation({
    mutationFn: archiveNutritionRecipe,
    onSuccess: (_, recipeId) => invalidate(recipeId),
  });
}

export function useRegisterNutritionRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerNutritionRecipe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meals-history"] });
    },
  });
}
