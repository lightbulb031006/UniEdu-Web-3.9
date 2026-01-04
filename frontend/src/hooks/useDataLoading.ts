import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for optimized data loading
 * Tối ưu loading states và caching
 */
export function useDataLoading<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = [],
  options: {
    enabled?: boolean;
    refetchInterval?: number;
    cacheKey?: string;
    staleTime?: number;
    persistCache?: boolean; // If true, use localStorage instead of sessionStorage
  } = {}
) {
  const { enabled = true, refetchInterval, cacheKey, staleTime = 5 * 60 * 1000, persistCache = false } = options;

  // Helper function to get cached data synchronously (for initial state)
  const getCachedDataSync = (): T | null => {
    if (!cacheKey) return null;
    try {
      const storage = persistCache ? localStorage : sessionStorage;
      const cached = storage.getItem(cacheKey);
      if (!cached) return null;
      const { data: cachedData, timestamp } = JSON.parse(cached);
      const now = Date.now();
      if (now - timestamp > staleTime) {
        storage.removeItem(cacheKey);
        return null;
      }
      return cachedData;
    } catch {
      return null;
    }
  };

  // Initialize with cached data if available
  const initialData = getCachedDataSync();
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(!initialData); // Only loading if no cached data
  const [error, setError] = useState<Error | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  // Use refs to store stable references
  const fetchFnRef = useRef(fetchFn);
  const dependenciesRef = useRef(dependencies);
  const isFetchingRef = useRef(false);
  const prevDepsStringRef = useRef<string>('');

  // Update refs when they change
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    dependenciesRef.current = dependencies;
  }, [dependencies]);

  // Cache management - use localStorage if persistCache is true, otherwise sessionStorage
  const getCachedData = useCallback((): T | null => {
    if (!cacheKey) return null;
    try {
      const storage = persistCache ? localStorage : sessionStorage;
      const cached = storage.getItem(cacheKey);
      if (!cached) return null;
      const { data: cachedData, timestamp } = JSON.parse(cached);
      const now = Date.now();
      if (now - timestamp > staleTime) {
        storage.removeItem(cacheKey);
        return null;
      }
      return cachedData;
    } catch {
      return null;
    }
  }, [cacheKey, staleTime, persistCache]);

  const setCachedData = useCallback(
    (dataToCache: T) => {
      if (!cacheKey) return;
      try {
        const storage = persistCache ? localStorage : sessionStorage;
        storage.setItem(
          cacheKey,
          JSON.stringify({
            data: dataToCache,
            timestamp: Date.now(),
          })
        );
      } catch (error) {
        // If storage is full, try to clear old cache entries
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          try {
            const storage = persistCache ? localStorage : sessionStorage;
            // Clear old cache entries (older than 1 day)
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            for (let i = 0; i < storage.length; i++) {
              const key = storage.key(i);
              if (key && key.startsWith('staff-detail-data-')) {
                try {
                  const item = storage.getItem(key);
                  if (item) {
                    const { timestamp } = JSON.parse(item);
                    if (timestamp < oneDayAgo) {
                      storage.removeItem(key);
                    }
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
            // Retry setting cache
            storage.setItem(
              cacheKey,
              JSON.stringify({
                data: dataToCache,
                timestamp: Date.now(),
              })
            );
          } catch {
            // Ignore storage errors
          }
        }
      }
    },
    [cacheKey, persistCache]
  );

  // Stable fetch function that uses refs
  const fetchData = useCallback(
    async (isRefetch = false) => {
      if (!enabled || isFetchingRef.current) return;

      isFetchingRef.current = true;

      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        // Check if user is authenticated before making request
        // Check both localStorage and sessionStorage (for "remember me" functionality)
        const token = localStorage.getItem('unicorns.token') || sessionStorage.getItem('unicorns.token');
        if (!token) {
          // No token, don't retry
          setIsLoading(false);
          setIsRefetching(false);
          isFetchingRef.current = false;
          return;
        }

        // Try cache first (only on initial load)
        if (!isRefetch && cacheKey) {
          const cached = getCachedData();
          if (cached) {
            setData(cached);
            setIsLoading(false);
            setIsRefetching(false);
            isFetchingRef.current = false;
            // Still fetch in background for freshness (only if token exists)
            if (token) {
              fetchFnRef.current()
                .then((freshData) => {
                  setData(freshData);
                  setCachedData(freshData);
                })
                .catch(() => {
                  // Ignore background fetch errors
                });
            }
            return;
          }
        }

        const result = await fetchFnRef.current();
        setData(result);
        setCachedData(result);
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        
        // If 401 (unauthorized), stop retrying
        if (err?.response?.status === 401) {
          setIsLoading(false);
          setIsRefetching(false);
          isFetchingRef.current = false;
          // Don't retry on 401 - let the interceptor handle redirect
          return;
        }
        
        // If 429 (too many requests), stop retrying immediately
        if (err?.response?.status === 429) {
          setIsLoading(false);
          setIsRefetching(false);
          isFetchingRef.current = false;
          // Don't retry on 429 - rate limit exceeded
          console.warn('[useDataLoading] Rate limit exceeded (429), stopping fetch');
          return;
        }
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
        isFetchingRef.current = false;
      }
    },
    [enabled, cacheKey, getCachedData, setCachedData]
  );

  // Only refetch when dependencies actually change
  useEffect(() => {
    if (!enabled) return;

    // Check if user is authenticated
    // Check both localStorage and sessionStorage (for "remember me" functionality)
    const token = localStorage.getItem('unicorns.token') || sessionStorage.getItem('unicorns.token');
    if (!token) {
      // No token, don't fetch
      setIsLoading(false);
      return;
    }

    // Serialize dependencies to compare
    const depsString = JSON.stringify(dependencies);
    
    // Only fetch if dependencies changed or this is the first render
    if (depsString !== prevDepsStringRef.current) {
      prevDepsStringRef.current = depsString;
      fetchData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...dependencies]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;
    
    // Check token before setting interval
    // Check both localStorage and sessionStorage (for "remember me" functionality)
    const token = localStorage.getItem('unicorns.token') || sessionStorage.getItem('unicorns.token');
    if (!token) return;
    
    const interval = setInterval(() => {
      // Check token again before each refetch
      const currentToken = localStorage.getItem('unicorns.token') || sessionStorage.getItem('unicorns.token');
      if (!currentToken) {
        clearInterval(interval);
        return;
      }
      fetchData(true);
    }, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchData]);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return {
    data,
    isLoading,
    isRefetching,
    error,
    refetch,
  };
}

