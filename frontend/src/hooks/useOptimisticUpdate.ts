import { useState, useCallback, useRef } from 'react';
import { toast } from '../utils/toast';

/**
 * Custom hook for optimistic updates
 * Tự động cập nhật UI ngay lập tức, rollback nếu có lỗi
 * 
 * @template T - Type of the data being updated
 * @param initialData - Initial data state
 * @param updateFn - Function to update data in the backend
 * @param options - Configuration options
 * @returns Object with update function and state
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T) => Promise<T>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error, rollbackData: T) => void;
    successMessage?: string;
    errorMessage?: string;
    showToast?: boolean;
  } = {}
) {
  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    showToast = true,
  } = options;

  const [data, setData] = useState<T>(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const historyRef = useRef<T[]>([]); // Stack for rollback

  // Update initial data when it changes
  const updateInitialData = useCallback((newData: T) => {
    setData(newData);
    historyRef.current = []; // Clear history when data is refreshed from server
  }, []);

  const update = useCallback(
    async (optimisticData: T, actualUpdateFn?: (data: T) => Promise<T>) => {
      // Store current state for rollback
      historyRef.current.push(data);
      
      // Optimistic update: update UI immediately
      setData(optimisticData);
      setIsUpdating(true);

      try {
        // Call the update function
        const updateFunction = actualUpdateFn || updateFn;
        const result = await updateFunction(optimisticData);

        // Success: update with server response
        setData(result);
        historyRef.current = []; // Clear history on success

        if (showToast && successMessage) {
          toast.success(successMessage);
        }

        if (onSuccess) {
          onSuccess(result);
        }
      } catch (error: any) {
        // Error: rollback to previous state
        const rollbackData = historyRef.current.pop() || initialData;
        setData(rollbackData);

        if (showToast) {
          const message = errorMessage || error?.response?.data?.error || error?.message || 'Có lỗi xảy ra';
          toast.error(message);
        }

        if (onError) {
          onError(error, rollbackData);
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [data, initialData, updateFn, onSuccess, onError, successMessage, errorMessage, showToast]
  );

  const updateList = useCallback(
    async <ItemType extends { id: string | number }>(
      list: ItemType[],
      item: ItemType,
      action: 'add' | 'update' | 'delete',
      updateFn: (item: ItemType) => Promise<ItemType | void>
    ) => {
      // Store current state for rollback
      historyRef.current.push(data as any);
      
      // Optimistic update
      let optimisticList: ItemType[];
      
      if (action === 'add') {
        optimisticList = [...list, item];
      } else if (action === 'update') {
        optimisticList = list.map((i) => (i.id === item.id ? item : i));
      } else {
        optimisticList = list.filter((i) => i.id !== item.id);
      }

      setData(optimisticList as T);
      setIsUpdating(true);

      try {
        const result = await updateFn(item);
        
        // If result is provided, use it; otherwise refetch or use optimistic data
        if (result) {
          if (action === 'add') {
            optimisticList = [...list, result as ItemType];
          } else if (action === 'update') {
            optimisticList = list.map((i) => (i.id === item.id ? result as ItemType : i));
          }
        }

        setData(optimisticList as T);
        historyRef.current = [];

        if (showToast && successMessage) {
          toast.success(successMessage);
        }

        if (onSuccess) {
          onSuccess(optimisticList as T);
        }
      } catch (error: any) {
        // Rollback
        const rollbackData = historyRef.current.pop() || initialData;
        setData(rollbackData);

        if (showToast) {
          const message = errorMessage || error?.response?.data?.error || error?.message || 'Có lỗi xảy ra';
          toast.error(message);
        }

        if (onError) {
          onError(error, rollbackData);
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [data, initialData, onSuccess, onError, successMessage, errorMessage, showToast]
  );

  return {
    data,
    isUpdating,
    update,
    updateList,
    updateInitialData,
  };
}

