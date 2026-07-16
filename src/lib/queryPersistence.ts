import { QueryClient } from "@tanstack/react-query";

const CACHE_KEY = "sendafit-query-cache:v1";
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const MAX_PERSISTED_QUERIES = 60;
const MAX_CACHE_BYTES = 2_000_000;

type CachedQuery = {
  queryKey: unknown[];
  data: unknown;
  updatedAt: number;
};

function readCache(): CachedQuery[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as CachedQuery[];
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    return parsed.filter((item) => (
      Array.isArray(item.queryKey) &&
      item.updatedAt &&
      now - item.updatedAt < MAX_CACHE_AGE_MS
    ));
  } catch (error) {
    console.warn("Could not read persisted query cache:", error);
    return [];
  }
}

function writeCache(entries: CachedQuery[]) {
  if (typeof window === "undefined") return;

  try {
    const sortedEntries = [...entries]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_PERSISTED_QUERIES);
    let payload = JSON.stringify(sortedEntries);

    while (payload.length > MAX_CACHE_BYTES && sortedEntries.length > 10) {
      sortedEntries.pop();
      payload = JSON.stringify(sortedEntries);
    }

    window.localStorage.setItem(CACHE_KEY, payload);
  } catch (error) {
    console.warn("Could not persist query cache:", error);
  }
}

export function hydrateQueryCache(queryClient: QueryClient) {
  readCache().forEach((entry) => {
    queryClient.setQueryData(entry.queryKey, entry.data, {
      updatedAt: entry.updatedAt,
    });
  });
}

export function subscribeQueryCachePersistence(queryClient: QueryClient) {
  let persistTimer: number | undefined;

  const persist = () => {
    const entries = queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.status === "success" && query.state.data !== undefined)
      .map((query) => ({
        queryKey: query.queryKey as unknown[],
        data: query.state.data,
        updatedAt: query.state.dataUpdatedAt || Date.now(),
      }));

    writeCache(entries);
  };

  return queryClient.getQueryCache().subscribe(() => {
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(persist, 250);
  });
}
