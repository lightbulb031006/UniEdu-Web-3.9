/**
 * usePrefetch Hook
 * Prefetch data in the background for better UX
 */

import { useEffect, useRef } from 'react';

type PrefetchFn = () => Promise<any>;

export function usePrefetch(fetchFn: PrefetchFn, dependencies: any[] = []) {
  const prefetchedRef = useRef(false);

  useEffect(() => {
    // Only prefetch once
    if (prefetchedRef.current) return;
    
    // Prefetch in background (low priority)
    const timeoutId = setTimeout(() => {
      fetchFn().catch(() => {
        // Silently fail - prefetch is optional
      });
      prefetchedRef.current = true;
    }, 1000); // Wait 1 second before prefetching

    return () => {
      clearTimeout(timeoutId);
    };
  }, dependencies);
}

/**
 * Prefetch next month data when viewing current month
 */
export function usePrefetchNextMonth(
  fetchFn: (month: string) => Promise<any>,
  currentMonth: string
) {
  useEffect(() => {
    // Calculate next month
    const [year, month] = currentMonth.split('-').map(Number);
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;

    // Prefetch next month data after a delay
    const timeoutId = setTimeout(() => {
      fetchFn(nextMonthStr).catch(() => {
        // Silently fail
      });
    }, 2000); // Wait 2 seconds before prefetching

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentMonth, fetchFn]);
}

