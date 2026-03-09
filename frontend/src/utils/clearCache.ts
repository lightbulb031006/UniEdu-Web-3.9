/**
 * Utility functions to clear application cache
 * Các hàm tiện ích để xóa cache của ứng dụng
 */

/**
 * Clear all staff-related cache
 * Xóa tất cả cache liên quan đến nhân sự
 */
export function clearStaffCache() {
  try {
    // Clear localStorage cache
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach((key) => {
      if (
        key.startsWith('staff-') ||
        key.startsWith('staff-unpaid-amounts') ||
        key.startsWith('staff-detail-data-') ||
        key.startsWith('staff-work-items-') ||
        key.startsWith('staff-bonuses-') ||
        key.startsWith('sessions-staff-')
      ) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage cache
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach((key) => {
      if (
        key.startsWith('staff-') ||
        key.startsWith('staff-unpaid-amounts') ||
        key.startsWith('staff-detail-data-') ||
        key.startsWith('staff-work-items-') ||
        key.startsWith('staff-bonuses-') ||
        key.startsWith('sessions-staff-')
      ) {
        sessionStorage.removeItem(key);
      }
    });

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Clear all application cache (more aggressive)
 * Xóa tất cả cache của ứng dụng (mạnh hơn)
 */
export function clearAllCache() {
  try {
    // Clear all localStorage (be careful!)
    localStorage.clear();

    // Clear all sessionStorage
    sessionStorage.clear();

    // Reload page to ensure fresh data
    window.location.reload();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Clear cache for a specific staff member
 * Xóa cache cho một nhân sự cụ thể
 */
export function clearStaffMemberCache(staffId: string) {
  try {
    const keysToRemove: string[] = [];
    
    // Check localStorage
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach((key) => {
      if (key.includes(staffId)) {
        keysToRemove.push(key);
        localStorage.removeItem(key);
      }
    });

    // Check sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach((key) => {
      if (key.includes(staffId)) {
        keysToRemove.push(key);
        sessionStorage.removeItem(key);
      }
    });

    return true;
  } catch (error) {
    return false;
  }
}

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).clearStaffCache = clearStaffCache;
  (window as any).clearAllCache = clearAllCache;
  (window as any).clearStaffMemberCache = clearStaffMemberCache;
}

