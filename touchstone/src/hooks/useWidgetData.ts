'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface WidgetDataOptions<T> {
  cacheKey: string;
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  autoRefresh?: boolean;
  refreshInterval?: number; // Auto-refresh interval in milliseconds (default: 2 minutes)
  fetchFn: () => Promise<T>;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

export function useWidgetData<T>({
  cacheKey,
  ttl = 5 * 60 * 1000, // 5 minutes default
  autoRefresh = true,
  refreshInterval = 2 * 60 * 1000, // 2 minutes default
  fetchFn,
}: WidgetDataOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getCachedData = useCallback((): CachedData<T> | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem(`widget_${cacheKey}`);
      if (!cached) return null;

      const parsed: CachedData<T> = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - parsed.timestamp < ttl) {
        return parsed;
      }
      
      // Cache expired, remove it
      localStorage.removeItem(`widget_${cacheKey}`);
      return null;
    } catch (err) {
      console.error('Error reading cache:', err);
      return null;
    }
  }, [cacheKey, ttl]);

  const setCachedData = useCallback((newData: T) => {
    if (typeof window === 'undefined') return;
    
    try {
      const cached: CachedData<T> = {
        data: newData,
        timestamp: Date.now(),
      };
      localStorage.setItem(`widget_${cacheKey}`, JSON.stringify(cached));
    } catch (err) {
      console.error('Error writing cache:', err);
    }
  }, [cacheKey]);

  const fetchData = useCallback(async (isRefresh = false, useCache = true) => {
    // Try to use cached data first (unless it's a manual refresh)
    if (useCache && !isRefresh) {
      const cached = getCachedData();
      if (cached) {
        setData(cached.data);
        setLastUpdated(new Date(cached.timestamp));
        setLoading(false);
        // Still fetch in background to update cache
        fetchData(false, false).catch(() => {
          // Silent fail for background refresh
        });
        return;
      }
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await fetchFn();
      setData(result);
      setLastUpdated(new Date());
      setCachedData(result);
    } catch (err) {
      console.error(`Error fetching widget data for ${cacheKey}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      
      // Try to use stale cache if available
      if (useCache) {
        const cached = getCachedData();
        if (cached) {
          setData(cached.data);
          setLastUpdated(new Date(cached.timestamp));
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, fetchFn, getCachedData, setCachedData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData(false, false); // Background refresh, don't use cache
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, fetchData]);

  // Refresh on tab focus
  useEffect(() => {
    const handleFocus = () => {
      // Check if cache is stale
      const cached = getCachedData();
      if (!cached || Date.now() - cached.timestamp > ttl / 2) {
        fetchData(false, false);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [getCachedData, fetchData, ttl]);

  const refresh = useCallback(() => {
    fetchData(true, false);
  }, [fetchData]);

  const invalidateCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`widget_${cacheKey}`);
  }, [cacheKey]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refreshing,
    refresh,
    invalidateCache,
  };
}

