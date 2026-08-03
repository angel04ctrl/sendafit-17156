import { useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import {
  getNutritionCatalogGroup,
  registerNutritionFoodSelection,
  searchNutritionCatalog,
} from "@/services/nutritionCatalog";

const CATALOG_PAGE_SIZE = 24;

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}

export function useNutritionCatalog(query: string, enabled = true) {
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const catalogQuery = useInfiniteQuery({
    queryKey: ["nutrition-catalog", debouncedQuery],
    queryFn: ({ pageParam }) => searchNutritionCatalog({
      query: debouncedQuery,
      offset: pageParam,
      pageSize: CATALOG_PAGE_SIZE,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });

  return { ...catalogQuery, debouncedQuery };
}

export function useNutritionCatalogGroup(groupId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["nutrition-catalog-group", groupId],
    queryFn: () => getNutritionCatalogGroup(groupId!),
    enabled: enabled && Boolean(groupId),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useRegisterNutritionFood() {
  return useMutation({
    mutationFn: registerNutritionFoodSelection,
  });
}
